import { useEffect, useMemo, useRef, useState } from 'react'
import { corpus, takeaways } from '../lib/data'
import synonyms from '../data/synonyms.json'
import { useMission } from '../lib/mission'
import { Ev, Mark } from './ui'
import { apiStatus, post } from '../lib/api'
import { getKey, setKey, geminiAnswer, defaultAnswer, hasDefault, DEFAULT_MODEL, MiniMarkdown } from '../lib/rag'

// Cited search always runs here in the browser: it returns the NASA passages that answer the question,
// each with its source, and says so when nothing matches. When the API (server/main.py) is up and has a
// GOOGLE_API_KEY, /api/ask adds the team's Gemini RAG answer, written only from retrieved NASA passages
// and shown as AI interpretation, separate from the cited findings.
const STOP = new Set('a an the of in on at to is are was were be been it its this that these those and or for with from by as what which who how why when where do does did can could would should will i you we they my our your about into than then there here if not no yes any all some more most very just also so such has have had please tell me know like use used using make makes best good way really'.split(' '))
const norm = s => s.toLowerCase().replace(/₂/g, '2').replace(/\b([a-z]+)-(ii|iii|i|r|g|2)\b/g, '$1$2 $1-$2')
const toks = s => { const w = norm(s).match(/[a-z0-9]+/g) || []; const out = w.filter(x => !STOP.has(x)); w.forEach(x => { if (synonyms[x]) out.push(...synonyms[x].split(' ')) }); return out }

export function useIndex(docs, k = 3) {
  return useMemo(() => {
    const tf = docs.map(d => { const m = {}; toks(`${d.title} ${d.title} ${d.text}`).forEach(t => { m[t] = (m[t] || 0) + 1 }); return m })
    const df = {}; tf.forEach(m => Object.keys(m).forEach(t => { df[t] = (df[t] || 0) + 1 }))
    const N = docs.length
    const idf = t => Math.log((N + 1) / ((df[t] || 0) + 1)) + 1
    const vecs = tf.map(m => { const v = {}; let n = 0; for (const t in m) { v[t] = (1 + Math.log(m[t])) * idf(t); n += v[t] ** 2 } n = Math.sqrt(n) || 1; for (const t in v) v[t] /= n; return v })
    return q => {
      const m = {}; toks(q).forEach(t => { m[t] = (m[t] || 0) + 1 })
      const qv = {}; let n = 0; for (const t in m) { qv[t] = (1 + Math.log(m[t])) * idf(t); n += qv[t] ** 2 } n = Math.sqrt(n) || 1
      return vecs.map((v, i) => { let s = 0; for (const t in qv) if (v[t]) s += v[t] * qv[t] / n; return [s * (docs[i].kind?.startsWith('Finding') ? 1.2 : 1), i] })
        .sort((a, b) => b[0] - a[0]).slice(0, k).filter(([s]) => s >= 0.08).map(([s, i]) => ({ ...docs[i], score: s }))
    }
  }, [docs, k])
}

const SUGGEST = ['Will shutting off the fans put out a fire at 30% oxygen?', 'Which materials burned near habitat air?', 'Has smoke detection been tested in oxygen-rich air?', 'How would fire behave on the Moon?']

export default function Chat() {
  const { mission } = useMission()
  const docs = useMemo(() => [...corpus, ...(takeaways[mission.id] || []).map(t => ({ title: t.title, text: `${t.text} ${t.action}${t.caveat ? ` (${t.caveat})` : ''}`, source: t.source, badge: t.badge, kind: `Finding for ${mission.name}` }))], [mission])
  const search = useIndex(docs)
  const [open, setOpen] = useState(false)
  const [show, setShow] = useState(true)
  const [q, setQ] = useState('')
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)
  const [key, setKeyState] = useState(getKey)
  const [keyOpen, setKeyOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [serverAI, setServerAI] = useState(false)
  useEffect(() => { apiStatus().then(h => setServerAI(!!(h && h.ai_answers && h.ai_answers.available))) }, [])
  useEffect(() => { if (open) setKeyState(getKey()) }, [open])
  const end = useRef(null)
  useEffect(() => { const on = () => setShow(true); on(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('hashchange', on); return () => { window.removeEventListener('scroll', on); window.removeEventListener('hashchange', on) } }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [log, busy])

  async function ask(question) {
    if (!question.trim()) return
    setQ(''); setBusy(true)
    const hits = search(question)
    let ai = null
    if (await apiStatus()) {
      try { const r = await post('/api/ask', { question }); if (r.mode === 'ai' && r.answer) ai = r } catch { /* cited search below still answers */ }
    }
    const k = getKey()
    if (!ai && (k || hasDefault)) {
      try { const r = k ? await geminiAnswer(question, k) : await defaultAnswer(question); ai = { answer: r.answer, model: r.model, rag_sources: r.docs.map(d => ({ section: d.h.join(' › ') || 'NASA report' })) } }
      catch (e) { ai = { error: `The AI could not answer (${e.message}). The cited findings below still answer.` } }
    }
    setLog(l => [...l, { q: question, hits, ai }]); setBusy(false)
  }

  if (!show && !open) return null
  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
      {open && (
        <section role="dialog" aria-label="Ask the archive" className="card" style={{ width: 420, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 24px 60px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', maxHeight: '72vh' }}>
          <header className="row" style={{ justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
            <div className="row" style={{ gap: 10 }}><Mark size={20} /><div className="col"><strong style={{ fontSize: 15 }}>Ask the archive</strong><span className="mono faint" style={{ fontSize: 11 }}>Answers only from NASA sources · {mission.air}</span></div></div>
            <button type="button" className="btn sm" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </header>
          <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            {log.length === 0 && <>
              <p className="p" style={{ fontSize: 14 }}>Ask in plain words. You get the passages from NASA’s records that answer it, each with its source, and, with AI answers on, a Gemini answer written only from NASA report passages. If the archive has nothing, it says so.</p>
              <div className="wrap-row">{SUGGEST.map(s => <button key={s} type="button" className="chip" style={{ fontSize: 12 }} onClick={() => ask(s)}>{s}</button>)}</div>
            </>}
            {log.map((m, i) => (
              <div key={i} className="col" style={{ gap: 10 }}>
                <div style={{ alignSelf: 'flex-end', background: 'var(--line2)', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: 14, maxWidth: '85%' }}>{m.q}</div>
                {m.ai?.answer && (
                  <div style={{ border: '1px solid var(--plasma)', borderRadius: 10, padding: 12, fontSize: 14, lineHeight: 1.55 }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--plasma)', marginBottom: 6 }}>AI ANSWER · {(m.ai.model || 'GEMINI').toUpperCase()} · RAG FROM {m.ai.rag_sources?.length || 0} NASA REPORT PASSAGES · NOT A MEASUREMENT</div><MiniMarkdown text={m.ai.answer} />
                    {m.ai.rag_sources?.length > 0 && <details style={{ marginTop: 8 }}><summary className="mono faint" style={{ fontSize: 11, cursor: 'pointer' }}>Passages the AI read</summary>
                      <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--muted)' }}>{m.ai.rag_sources.map((d, k) => <li key={k} style={{ marginBottom: 4 }}><strong>{d.section}</strong></li>)}</ol></details>}
                  </div>
                )}
                {m.ai?.error && <div className="muted" style={{ fontSize: 13, borderLeft: '3px solid var(--ember)', paddingLeft: 10 }}>{m.ai.error}</div>}
                {m.hits.length > 0 && <span className="mono faint" style={{ fontSize: 10 }}>CITED FINDINGS FROM THE ARCHIVE</span>}
                {m.hits.length === 0
                  ? <div style={{ border: '1px dashed var(--muted)', borderRadius: 10, padding: 12, fontSize: 14 }}>The archive has no passage that answers this. NASA’s PSI data may not cover it.</div>
                  : m.hits.map((h, j) => (
                    <div key={j} style={{ border: '1px solid var(--line2)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}><strong style={{ fontSize: 14 }}>{h.title}</strong><Ev kind={h.badge === 'nasa' ? 'measurement' : h.badge} small /></div>
                      <span style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--muted)' }}>{h.text}</span>
                      <span className="src">[{j + 1}] {h.source}</span>
                    </div>))}
              </div>
            ))}
            {busy && <span className="mono faint" style={{ fontSize: 12 }}>{key || serverAI || hasDefault ? 'Searching the archive and asking the AI…' : 'Searching the archive…'}</span>}
            <div ref={end} />
          </div>
          <div style={{ padding: '10px 12px 0', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
            {serverAI ? <span className="mono" style={{ fontSize: 11, color: 'var(--good)' }}>● AI answers on: team RAG on the project server</span>
              : key ? <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}><span className="mono" style={{ fontSize: 11, color: 'var(--good)' }}>● AI answers on: Gemini RAG with your key (this tab only)</span><button type="button" className="btn sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { setKey(''); setKeyState('') }}>Remove key</button></span>
              : keyOpen ? <form onSubmit={e => { e.preventDefault(); if (draft.trim()) { setKey(draft.trim()); setKeyState(draft.trim()); setDraft(''); setKeyOpen(false) } }} className="col" style={{ gap: 6 }}>
                  <label htmlFor="chatkey" className="faint" style={{ fontSize: 11.5, lineHeight: 1.45 }}>Paste a Gemini API key (Google AI Studio). It stays in this tab and goes only to Google, never to us or GitHub.</label>
                  <div className="row" style={{ gap: 6 }}><input id="chatkey" type="password" autoComplete="off" spellCheck="false" value={draft} onChange={e => setDraft(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'var(--bg)', border: '1px solid var(--line2)', borderRadius: 6, color: 'var(--text)', padding: '7px 9px', fontFamily: 'var(--mono)', fontSize: 12 }} /><button type="submit" className="btn sm">Turn on</button></div>
                </form>
              : hasDefault ? <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}><span className="mono" style={{ fontSize: 11, color: 'var(--good)' }}>● AI answers on: RAG with the site's default model ({DEFAULT_MODEL})</span><button type="button" className="btn sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setKeyOpen(true)}>Use my Gemini key</button></span>
              : <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}><span className="faint" style={{ fontSize: 11.5 }}>AI answers (Gemini RAG over 4,086 NASA report passages) are off.</span><button type="button" className="btn sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setKeyOpen(true)}>Turn on</button></span>}
          </div>
          <form onSubmit={e => { e.preventDefault(); ask(q) }} className="row" style={{ gap: 8, padding: 12 }}>
            <label htmlFor="chatq" className="sr">Your question</label>
            <input id="chatq" value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about any NASA fire experiment…"
              style={{ flex: 1, minWidth: 0, background: 'var(--bg)', border: '1px solid var(--line2)', borderRadius: 8, color: 'var(--text)', fontSize: 14, padding: '12px 14px' }} />
            <button type="submit" className="btn primary" aria-label="Send">→</button>
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen(!open)} className="btn light" style={{ borderRadius: 999, boxShadow: '0 12px 32px rgba(0,0,0,.5)', padding: '13px 18px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="#0A0B0D" strokeWidth="2" strokeLinejoin="round" /></svg>
        {open ? 'Close' : 'Ask the archive'}
      </button>
    </div>
  )
}
