import { useState, useRef, useEffect } from 'react'
import { Link } from '../lib/router'
import { useMission } from '../lib/mission'
import { missions } from '../lib/data'

export function Mark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="#7DB4FF" strokeOpacity=".35" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#7DB4FF" strokeOpacity=".7" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="3.2" fill="#FF7A3D" />
    </svg>
  )
}

const EV_LABEL = { measurement: 'NASA measurement', prediction: 'Model prediction', literature: 'NASA literature', gap: 'Data gap', physics: 'Physics estimate' }
const EV_ALIAS = { model: 'prediction', nasa: 'measurement', measured: 'measurement', lit: 'literature', 'nasa literature': 'literature', estimate: 'physics' }
export function Ev({ kind, small }) {
  const k = EV_ALIAS[kind] || kind
  return <span className="ev" style={small ? { fontSize: 11 } : null}><i className={k} />{EV_LABEL[k] || kind}</span>
}

/** A microgravity flame: a sphere, white at the core, blue at the edge. earth=true gives a teardrop. */
export function Flame({ size = 200, intensity = 1, soot = false, earth = false, className = '', style }) {
  const a = intensity
  const bg = earth
    ? `radial-gradient(ellipse 50% 60% at 50% 66%, rgba(255,255,255,.95) 0%, rgba(255,236,190,.9) 12%, rgba(255,170,80,.85) 30%, rgba(255,110,40,.45) 52%, rgba(0,0,0,0) 72%)`
    : `radial-gradient(circle at 50% 50%, rgba(255,255,255,${0.95 * a}) 0%, rgba(220,235,255,${0.9 * a}) 8%, rgba(143,184,255,${0.85 * a}) 19%, rgba(63,111,240,${0.6 * a}) 33%, rgba(46,72,190,${0.32 * a}) 47%, rgba(30,40,120,${0.1 * a}) 61%, rgba(0,0,0,0) 72%)`
  return (
    <div aria-hidden="true" className={className}
      style={{ position: 'relative', width: size, height: earth ? size * 1.5 : size, borderRadius: earth ? '50% 50% 50% 50% / 62% 62% 38% 38%' : '50%', background: bg, ...style }}>
      {soot && <div style={{ position: 'absolute', inset: '16%', borderRadius: '50%', background: `radial-gradient(circle, rgba(0,0,0,0) 55%, rgba(255,150,70,${0.28 * a}) 63%, rgba(0,0,0,0) 72%)` }} />}
    </div>
  )
}

export function MissionPicker({ compact }) {
  const { mission, setMission } = useMission()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const on = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="mono" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}
        style={{ fontSize: 12, background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 999, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ember)' }} />
        {compact ? mission.air : <>Mission air · {mission.air}</>}
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="#A6AAB1" strokeWidth="2" /></svg>
      </button>
      {open && (
        <div role="listbox" className="card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 320, padding: 8, zIndex: 40, boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}>
          {missions.map(m => (
            <button key={m.id} role="option" aria-selected={m.id === mission.id} type="button" onClick={() => { setMission(m.id); setOpen(false) }}
              style={{ width: '100%', textAlign: 'left', background: m.id === mission.id ? 'var(--ember-soft)' : 'transparent', border: 0, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</span>
              <span className="mono faint" style={{ fontSize: 11 }}>{m.air}</span>
            </button>
          ))}
          <p className="p" style={{ fontSize: 12, padding: '8px 12px 4px' }}>Rankings, the briefing and the Fire Lab presets recompute for this air.</p>
        </div>
      )}
    </div>
  )
}

const NAV = [['Learn', '/learn/1'], ['Fire Lab', '/lab'], ['Investigations', '/explore'], ['Compare', '/compare'], ['Briefing', '/briefing'], ['Gaps', '/gaps'], ['Equipment', '/equipment'], ['Methods', '/methods']]
export function Nav({ active }) {
  return (
    <header style={{ borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 30, background: 'rgba(10,11,13,.92)', backdropFilter: 'blur(8px)' }}>
      <div className="wrap" style={{ padding: '14px 32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, justifyContent: 'space-between' }}>
        <Link to="/" className="row" style={{ gap: 10 }}><Mark /><span className="disp" style={{ fontWeight: 600, fontSize: 17 }}>Flame in Freefall</span></Link>
        <nav aria-label="Main" className="wrap-row" style={{ gap: 22 }}>
          {NAV.map(([n, to]) => (
            <Link key={n} to={to} style={{ fontSize: 14, padding: '8px 2px', color: active === n ? 'var(--text)' : 'var(--muted)', borderBottom: `1px solid ${active === n ? 'var(--ember)' : 'transparent'}` }}>{n}</Link>
          ))}
        </nav>
        <MissionPicker />
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 40 }}>
      <div className="wrap" style={{ padding: '32px 32px 40px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 20, fontSize: 13, color: 'var(--muted)' }}>
        <div className="row" style={{ gap: 10 }}><Mark size={18} /><span>Flame in Freefall · NASA Space Apps Challenge 2026</span></div>
        <div className="wrap-row mono" style={{ gap: 20, fontSize: 12 }}>
          <Link to="/methods">Methods &amp; data</Link>
          <a href="https://github.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://psi.nasa.gov/physci/repo/search?q=combustion" target="_blank" rel="noreferrer">NASA PSI</a>
        </div>
        <div className="mono faint" style={{ width: '100%', fontSize: 11 }}>NASA data CC0-1.0 · code Apache-2.0 · not affiliated with or endorsed by NASA · research and education tool, not a certified fire-safety system · AI use declared in the repository README</div>
      </div>
    </footer>
  )
}

export function PageHead({ eyebrow, title, children, right }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 24, alignItems: 'flex-end', marginBottom: 32 }}>
      <div className="col" style={{ gap: 14, maxWidth: 820 }}>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="h1" style={{ fontSize: 'clamp(36px, 5vw, 58px)' }}>{title}</h1>
        {children}
      </div>
      {right}
    </div>
  )
}

export const pct = v => (v == null ? '—' : Math.round(v * 100) + '%')
