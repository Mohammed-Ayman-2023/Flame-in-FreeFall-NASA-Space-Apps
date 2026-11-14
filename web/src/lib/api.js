// Connection to the Flame in Freefall API (server/main.py).
//
// The site looks for the API at VITE_API_URL, or at its own address when the API serves the site
// (one deploy). If no API answers, everything still works from the model grids and data exported
// into src/data, and the UI says it is showing precomputed results.
import { useEffect, useRef, useState } from 'react'

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
let probe = null

export function apiStatus() {
  if (!probe) {
    probe = (async () => {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000)
        const r = await fetch(`${BASE}/api/health`, { signal: ctl.signal }); clearTimeout(t)
        if (!r.ok) return null
        const j = await r.json()
        return j && j.status === 'ok' ? j : null
      } catch { return null }
    })()
  }
  return probe
}

export function useApi() {
  const [h, setH] = useState(undefined)
  useEffect(() => { let on = true; apiStatus().then(v => on && setH(v)); return () => { on = false } }, [])
  return h // undefined = checking, null = offline, object = live
}

export async function post(path, body, signal) {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!r.ok) throw new Error(`${path} ${r.status}`)
  return r.json()
}

// Live model call for the current inputs, debounced; keeps the last answer while the next one loads.
export function useLive(path, body, enabled) {
  const [res, setRes] = useState(null)
  const key = JSON.stringify(body)
  const ctl = useRef(null)
  useEffect(() => {
    if (!enabled) { setRes(null); return }
    const h = setTimeout(async () => {
      ctl.current?.abort(); const c = new AbortController(); ctl.current = c
      const t0 = performance.now()
      try { const d = await post(path, body, c.signal); setRes({ key, data: d, ms: Math.round(performance.now() - t0) }) }
      catch (e) { if (e.name !== 'AbortError') setRes({ key, error: true }) }
    }, 110)
    return () => clearTimeout(h)
  }, [path, key, enabled]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!res || res.error) return { data: null, fresh: false, error: res?.error }
  return { data: res.data, fresh: res.key === key, ms: res.ms }
}

export async function get(path, signal) {
  const r = await fetch(`${BASE}${path}`, { signal })
  if (!r.ok) throw new Error(`${path} ${r.status}`)
  return r.json()
}

// GET that only runs when the API is up; returns { data, loading, error }.
export function useGet(path, enabled) {
  const [st, setSt] = useState({ data: null, loading: false, error: false, path: null })
  useEffect(() => {
    if (!enabled || !path) { setSt({ data: null, loading: false, error: false, path: null }); return }
    const c = new AbortController()
    setSt(s => ({ ...s, loading: true }))
    const h = setTimeout(() => get(path, c.signal).then(d => setSt({ data: d, loading: false, error: false, path }))
      .catch(e => { if (e.name !== 'AbortError') setSt({ data: null, loading: false, error: true, path }) }), 180)
    return () => { clearTimeout(h); c.abort() }
  }, [path, enabled])
  return st.path === path ? st : { ...st, data: null }
}
