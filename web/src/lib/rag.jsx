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

export async function geminiAnswer(question, key, onDelta, onDocs) {
  const { got, prompt } = await retrieve(question)
  onDocs?.(got)
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ragPrompt.model}:streamGenerateContent?alt=sse`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 900 } }),
  })
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error?.message || `HTTP ${res.status}`) }
  const answer = await readSSE(res, j => (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''), onDelta)
  return { answer: answer || 'Gemini returned no text.', docs: got, model: ragPrompt.model }
}

/* ---------------------------------------------------------------- default AI (no visitor key needed)
   Set at build time by .github/workflows/pages.yml from repository settings:
   - VITE_RAG_PROXY_URL (recommended): a small proxy (deploy/openrouter-proxy) that keeps the OpenRouter key secret.
   - VITE_OPENROUTER_KEY (simplest): the key is built into the page, so anyone can read it; use only a key with a
     $0 credit limit and a free model.
   VITE_OPENROUTER_MODEL defaults to the free-models router. */
const PROXY = (import.meta.env.VITE_RAG_PROXY_URL || '').replace(/\/$/, '')
// Default key: the repository secret OPENROUTER_API_KEY, built in by the Pages workflow (never stored in the repo).
const OR_KEY = import.meta.env.VITE_OPENROUTER_KEY || ''
export const DEFAULT_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || 'google/gemma-4-31b-it:free'
export const hasDefault = !!(PROXY || OR_KEY)

/** Download the passages and build the search index ahead of the first question (called when the chat opens). */
export function warmUp() { loadPassages().then(P => { if (!bm25) bm25 = buildBM25(P) }).catch(() => { passagesP = null }) }

async function retrieve(question) {
  const P = await loadPassages()
  if (!bm25) bm25 = buildBM25(P)
  const got = bm25(question, 10)
  const documents = 'Documents Retrieved From The Research Reports Data Base That Are Most Relevant To The Question: \n\n' + got.map((d, i) => `Document ${i + 1} [${d.h.join(' > ') || 'NASA report'}]:\n${d.text}`).join('\n\n')
  return { got, prompt: buildPrompt(question, documents) }
}

// Server-sent events reader shared by both providers: calls onDelta(text) as tokens arrive.
async function readSSE(res, pick, onDelta) {
  const reader = res.body.getReader(), dec = new TextDecoder()
  let buf = '', out = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return out
      try { const t = pick(JSON.parse(data)); if (t) { out += t; onDelta?.(out) } } catch { /* keep-alive or partial line */ }
    }
  }
  return out
}

async function openRouter(prompt, key, model, onDelta) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'Flame in Freefall' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 900, stream: true }),
  })
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error?.message || `HTTP ${res.status}`) }
  const answer = await readSSE(res, j => { if (j.error) throw new Error(j.error.message); return j.choices?.[0]?.delta?.content }, onDelta)
  return { answer: answer || 'The model returned no text.', model }
}

/** A visitor's own key: OpenRouter keys start with "sk-or-", anything else is treated as a Gemini key. */
export async function userAnswer(question, key, onDelta, onDocs) {
  if (key.startsWith('sk-or-')) {
    const { got, prompt } = await retrieve(question)
    onDocs?.(got)
    const r = await openRouter(prompt, key, DEFAULT_MODEL, onDelta)
    return { ...r, docs: got }
  }
  return geminiAnswer(question, key, onDelta, onDocs)
}

export async function defaultAnswer(question, onDelta, onDocs) {
  const { got, prompt } = await retrieve(question)
  onDocs?.(got)
  let res, j
  if (PROXY) {
    res = await fetch(PROXY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) })
    j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
    return { answer: j.answer || 'The model returned no text.', docs: got, model: j.model || DEFAULT_MODEL }
  }
  const r = await openRouter(prompt, OR_KEY, DEFAULT_MODEL, onDelta)
  return { ...r, docs: got }
}

/* ---------------------------------------------------------------- AI explanation of a model prediction (no retrieval) */
export const EXPLAIN_START = '# Role\nYou explain a Flame in Freefall model prediction'
export function explainPrompt(ctx) {
  return `${EXPLAIN_START} to a ${ctx.audience || 'general technical'} reader.
# Rules
- Use ONLY the numbers in DATA. Never invent numbers, tests, materials or sources.
- Shapley values split the model's prediction among its inputs relative to a reference; they explain the MODEL, not the physics. Say so once.
- Go through the contributions from largest to smallest absolute size, saying whether each raises or lowers the prediction and by how much (use the units given).
- You may add one short "Physics context" sentence per input from standard combustion knowledge, only if it agrees with the sign of that contribution, and label it as general knowledge.
- If DATA says the conditions are outside the tested range, state clearly that the prediction and its explanation are extrapolations.
- 150-220 words. Plain language. No headings other than the three below.
# Response format
**What the model predicts:** one or two sentences.
**What drives it:** short bullets, largest first.
**Caveats:** one to three bullets (tested range, what Shapley values can and cannot say, and DATA notes).
# DATA
${JSON.stringify(ctx, null, 1)}`
}

/** Stream a completion from the visitor's own key, else the site default (proxy or built-in key). */
export async function llmExplain(prompt, onDelta) {
  const k = getKey()
  if (k && !k.startsWith('sk-or-')) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ragPrompt.model}:streamGenerateContent?alt=sse`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': k },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 600 } }),
    })
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error?.message || `HTTP ${res.status}`) }
    return { answer: await readSSE(res, j => (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''), onDelta), model: ragPrompt.model }
  }
  if (k) return openRouter(prompt, k, DEFAULT_MODEL, onDelta)
  if (PROXY) {
    const res = await fetch(PROXY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
    onDelta?.(j.answer || ''); return { answer: j.answer || '', model: j.model || DEFAULT_MODEL }
  }
  if (OR_KEY) return openRouter(prompt, OR_KEY, DEFAULT_MODEL, onDelta)
  throw new Error('no AI model is configured; add your own key in the chat')
}
export const aiAvailable = () => !!(getKey() || PROXY || OR_KEY)
