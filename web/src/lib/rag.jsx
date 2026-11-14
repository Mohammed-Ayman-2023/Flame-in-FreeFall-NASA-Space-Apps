// The team's RAG (RAG/src) for the static site: retrieval over the 4,086 exported passages with BM25 in the browser,
// then Gemini with the team's prompt rules (RAG/src/prompts.py, exported verbatim) and the visitor's own key.
// The key goes only from the browser to Google; nothing is sent to or stored by the project.
import ragPrompt from '../data/rag_prompt.json'
export { ragPrompt }
export const KEY_STORE = 'fif-gemini-key'
let passagesP = null, bm25 = null
function loadPassages() {
  if (!passagesP) passagesP = fetch((import.meta.env.BASE_URL || './') + 'data/rag_passages.json').then(r => r.json())
  return passagesP
}
const tok = s => (s.toLowerCase().replace(/₂/g, '2').match(/[a-z0-9]+(?:[.-][a-z0-9]+)*/g) || []).filter(t => t.length > 1 && !STOPW.has(t))
const STOPW = new Set('the of and in to a is for on with by as at from that this are was were be an or it its which what how does do did can will would about into than then there their these those has have had not no but if we you our'.split(' '))
function buildBM25(P) {
  const docs = P.map(p => tok(`${p[0]} ${p[1]} ${p[2]} ${p[3]}`))
  const df = new Map(); docs.forEach(d => new Set(d).forEach(t => df.set(t, (df.get(t) || 0) + 1)))
  const avg = docs.reduce((s, d) => s + d.length, 0) / docs.length, N = docs.length
  const tfs = docs.map(d => { const m = new Map(); d.forEach(t => m.set(t, (m.get(t) || 0) + 1)); return m })
  return (q, k = 10) => {
    const qs = [...new Set(tok(q))]
    const sc = tfs.map((m, i) => { let s = 0; for (const t of qs) { const f = m.get(t); if (!f) continue; const idf = Math.log(1 + (N - df.get(t) + .5) / (df.get(t) + .5)); s += idf * f * 2.2 / (f + 1.2 * (.25 + .75 * docs[i].length / avg)) } return [s, i] })
    return sc.filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, k).map(([s, i]) => ({ score: s, h: P[i].slice(0, 3).filter(Boolean), text: P[i][3] }))
  }
}
// the team's prompt (RAG/src/prompts.py), exported verbatim
const buildPrompt = (question, documents) => `${ragPrompt.system}\n# RETRIEVED DOCUMENTS\n<documents>\n${documents || '(No documents were retrieved for this question.)'}\n</documents>\n\n# USER QUESTION\n<question>\n${question}\n</question>\n\nAnswer the question following every rule above. Use only the retrieved documents.`

export function MiniMarkdown({ text }) {
  const lines = String(text).split('\n')
  const inline = s => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p)
  return <div className="col" style={{ gap: 6, fontSize: 15, lineHeight: 1.6 }}>{lines.map((l, i) => l.trim() === '' ? null : /^\s*[-*•]\s+/.test(l)
    ? <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 8, paddingLeft: 6 }}><span style={{ color: 'var(--ember)' }}>•</span><span>{inline(l.replace(/^\s*[-*•]\s+/, ''))}</span></div>
    : <p key={i} style={{ margin: 0 }}>{inline(l.replace(/^#+\s*/, ''))}</p>)}</div>
}


export const getKey = () => { try { return sessionStorage.getItem(KEY_STORE) || '' } catch { return '' } }
export const setKey = k => { try { k ? sessionStorage.setItem(KEY_STORE, k) : sessionStorage.removeItem(KEY_STORE) } catch { /* private mode */ } }

export async function geminiAnswer(question, key) {
  const { got, prompt } = await retrieve(question)
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ragPrompt.model}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`)
  const answer = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('') || 'Gemini returned no text.'
  return { answer, docs: got, model: ragPrompt.model }
}

/* ---------------------------------------------------------------- default AI (no visitor key needed)
   Set at build time by .github/workflows/pages.yml from repository settings:
   - VITE_RAG_PROXY_URL (recommended): a small proxy (deploy/openrouter-proxy) that keeps the OpenRouter key secret.
   - VITE_OPENROUTER_KEY (simplest): the key is built into the page, so anyone can read it; use only a key with a
     $0 credit limit and a free model.
   VITE_OPENROUTER_MODEL defaults to the free-models router. */
const PROXY = (import.meta.env.VITE_RAG_PROXY_URL || '').replace(/\/$/, '')
const OR_KEY = import.meta.env.VITE_OPENROUTER_KEY || ''
export const DEFAULT_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || 'openrouter/free'
export const hasDefault = !!(PROXY || OR_KEY)

async function retrieve(question) {
  const P = await loadPassages()
  if (!bm25) bm25 = buildBM25(P)
  const got = bm25(question, 10)
  const documents = 'Documents Retrieved From The Research Reports Data Base That Are Most Relevant To The Question: \n\n' + got.map((d, i) => `Document ${i + 1} [${d.h.join(' > ') || 'NASA report'}]:\n${d.text}`).join('\n\n')
  return { got, prompt: buildPrompt(question, documents) }
}

export async function defaultAnswer(question) {
  const { got, prompt } = await retrieve(question)
  let res, j
  if (PROXY) {
    res = await fetch(PROXY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) })
    j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
    return { answer: j.answer || 'The model returned no text.', docs: got, model: j.model || DEFAULT_MODEL }
  }
  res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OR_KEY}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'Flame in Freefall' },
    body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.1 }),
  })
  j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`)
  return { answer: j.choices?.[0]?.message?.content || 'The model returned no text.', docs: got, model: j.model || DEFAULT_MODEL }
}
