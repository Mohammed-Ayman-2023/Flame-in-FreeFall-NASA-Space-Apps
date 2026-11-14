import { useEffect, useRef, useState } from 'react'
import { G, buoyantVelocity } from '../lib/data'

/* Illustrative particle simulation (not CFD): the same small fire in an Earth / Mars / Moon room with a
   ceiling smoke detector, and in a station module where smoke only goes where the fans carry it, towards a
   detector in the ventilation duct (where ISS detectors really sit). */
const GF = { Earth: 1, Mars: G.Mars / G.Earth, Moon: G.Moon / G.Earth }

export default function SmokeSim() {
  const [grav, setGrav] = useState('Earth')
  const [fans, setFans] = useState(true)
  const [run, setRun] = useState(0)
  const [ui, setUi] = useState({ t: 0, a: null, b: null })
  const ca = useRef(null), cb = useRef(null)
  const st = useRef({})

  useEffect(() => {
    const s = st.current = { pe: [], ps: [], t0: performance.now(), a: null, b: null, last: 0 }
    const gf = GF[grav]
    let raf
    const near = (ps, x, y, r) => { let n = 0; for (const p of ps) { const dx = p.x - x, dy = p.y - y; if (dx * dx + dy * dy < r * r) n++ } return n }
    const flame = (g, x, y, earth, t) => {
      if (earth) {
        const f = 1 + (Math.sin(t * 22) * .06 + Math.sin(t * 13) * .04) * Math.sqrt(gf)
        g.save(); g.translate(x, y); g.scale(1, (1 + .75 * Math.sqrt(gf)) * f)
        const gr = g.createRadialGradient(0, 4, 2, 0, 0, 34)
        gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.25, 'rgba(255,230,170,.9)'); gr.addColorStop(.55, 'rgba(255,150,60,.7)'); gr.addColorStop(1, 'rgba(255,90,30,0)')
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 34, 0, 6.283); g.fill(); g.restore()
      } else {
        const r = 40 * (1 + Math.sin(t * 2) * .05)
        const gr = g.createRadialGradient(x, y, 2, x, y, r)
        gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.3, 'rgba(180,210,255,.9)'); gr.addColorStop(.6, 'rgba(70,110,240,.6)'); gr.addColorStop(1, 'rgba(40,60,180,0)')
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill()
      }
    }
    const det = (g, x, y, on, label, below) => {
      g.fillStyle = on ? '#FF7A3D' : '#2a2e35'; g.strokeStyle = '#5a606a'; g.lineWidth = 2
      g.beginPath(); g.arc(x, y, 11, 0, 6.283); g.fill(); g.stroke()
      if (on) { g.strokeStyle = 'rgba(255,122,61,.35)'; g.lineWidth = 6; g.beginPath(); g.arc(x, y, 18, 0, 6.283); g.stroke() }
      g.fillStyle = '#868B93'; g.font = '10px IBM Plex Mono, monospace'; g.textAlign = 'center'; g.fillText(label, x, y + (below ? 30 : -20))
    }
    const loop = now => {
      raf = requestAnimationFrame(loop)
      const A = ca.current, B = cb.current
      if (!A || !B) return
      const t = (now - s.t0) / 1000
      if (t > 30) { s.pe = []; s.ps = []; s.t0 = now; s.a = s.b = null }
      const W = A.width, H = A.height
      // earth-like room: buoyant rise, spread along the ceiling
      const fx = W * .5, fy = H - 70, ceil = 46
      for (let k = 0; k < 2; k++) s.pe.push({ x: fx + (Math.random() - .5) * 14, y: fy - 20, vx: (Math.random() - .5) * .4, vy: -1.2 * Math.sqrt(gf) - Math.random() * Math.sqrt(gf) })
      for (const p of s.pe) {
        if (p.y > ceil + 4) { p.vy -= .05 * gf; p.vx += (Math.random() - .5) * .12 } else { p.y = ceil + 2 + Math.random() * 6; p.vy = 0; p.vx += (p.x < fx ? -1 : 1) * .05 + (Math.random() - .5) * .1 }
        p.vx *= .985; p.vy = Math.max(p.vy, -3.2 * Math.sqrt(gf)); if (gf < 1) p.vy *= .99
        p.x += p.vx; p.y += p.vy
        if (p.x < 8) { p.x = 8; p.vx = Math.abs(p.vx) * .2 } if (p.x > W - 8) { p.x = W - 8; p.vx = -Math.abs(p.vx) * .2 }
      }
      if (s.pe.length > 3200) s.pe.splice(0, s.pe.length - 3200)
      // station module: no buoyancy, diffusion + fan flow
      const sx = W * .32, sy = H * .55
      for (let k = 0; k < 2; k++) { const a = Math.random() * 6.283; s.ps.push({ x: sx + Math.cos(a) * 26, y: sy + Math.sin(a) * 26, vx: Math.cos(a) * .35, vy: Math.sin(a) * .35 }) }
      for (const p of s.ps) {
        p.vx += (Math.random() - .5) * .08; p.vy += (Math.random() - .5) * .08
        if (fans) { p.vx += .02; p.vy += (H * .5 - p.y) * .00025 }
        p.vx *= .97; p.vy *= .97; p.x += p.vx; p.y += p.vy
        if (p.y < 12) p.y = 12; if (p.y > H - 12) p.y = H - 12; if (p.x < 10) p.x = 10
        if (p.x > W - 30) { p.x = W - 30 + Math.random() * 6; p.vx *= .2 }
      }
      if (s.ps.length > 3200) s.ps.splice(0, s.ps.length - 3200)
      const eD = [W * .64, 34], sD = [W - 34, H * .5]
      if (s.a === null && near(s.pe, eD[0], eD[1], 40) > 30) s.a = t
      if (s.b === null && near(s.ps, sD[0], sD[1], 44) > 30) s.b = t
      let g = A.getContext('2d')
      g.fillStyle = '#0d0f12'; g.fillRect(0, 0, W, H); g.fillStyle = '#16191e'; g.fillRect(0, 0, W, 40); g.fillRect(0, H - 40, W, 40)
      g.fillStyle = '#868B93'; g.font = '10px IBM Plex Mono, monospace'; g.textAlign = 'left'; g.fillText('CEILING', 12, 26); g.fillText('FLOOR', 12, H - 16)
      g.fillStyle = 'rgba(200,204,210,.16)'; for (const p of s.pe) { g.beginPath(); g.arc(p.x, p.y, 5, 0, 6.283); g.fill() }
      flame(g, fx, H - 92, true, t); det(g, eD[0], eD[1] + 6, s.a !== null, 'CEILING DETECTOR', true)
      g = B.getContext('2d')
      g.fillStyle = '#0d0f12'; g.fillRect(0, 0, W, H); g.strokeStyle = '#33373F'; g.lineWidth = 2; g.strokeRect(W - 24, H * .5 - 50, 22, 100)
      g.fillStyle = '#868B93'; g.font = '10px IBM Plex Mono, monospace'; g.textAlign = 'right'; g.fillText('VENT INTAKE', W - 30, H * .5 - 58)
      if (fans) { g.fillStyle = 'rgba(125,180,255,.55)'; g.textAlign = 'left'; g.fillText('AIR FLOW →→→', 14, 24) }
      g.fillStyle = 'rgba(200,204,210,.16)'; for (const p of s.ps) { g.beginPath(); g.arc(p.x, p.y, 5, 0, 6.283); g.fill() }
      flame(g, sx, sy, false, t); det(g, sD[0] - 26, sD[1], s.b !== null, 'DUCT DETECTOR', false)
      if (now - s.last > 250) { s.last = now; setUi({ t, a: s.a, b: s.b }) }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [grav, fans, run])

  const fmt = v => v === null ? 'not yet' : v.toFixed(1) + ' s'
  const ub = buoyantVelocity(G[grav], 600, 0.05)
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn sm" onClick={() => setFans(!fans)} aria-pressed={fans}>
            <span style={{ position: 'relative', width: 38, height: 20, borderRadius: 10, display: 'block', background: fans ? 'var(--plasma)' : 'var(--line2)' }}><span style={{ position: 'absolute', top: 2, left: fans ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#EEECE7', transition: 'left .2s' }} /></span>
            Station fans {fans ? 'on' : 'off'}
          </button>
          <button type="button" className="btn sm" onClick={() => setRun(run + 1)}>↻ Restart</button>
        </div>
        <span className="mono muted" style={{ fontSize: 13 }}>{ui.t.toFixed(1)} s</span>
      </div>
      <div className="grid2">
        <figure className="col" style={{ margin: 0, gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span className="disp" style={{ fontSize: 20, fontWeight: 600 }}>Room on {grav} · {(G[grav] / G.Earth).toFixed(2)} g</span>
            <div className="seg">{Object.keys(GF).map(k => <button key={k} type="button" className={grav === k ? 'on' : ''} onClick={() => setGrav(k)}>{k}</button>)}</div>
          </div>
          <canvas ref={ca} width="660" height="380" style={{ width: '100%', height: 'auto', border: '1px solid var(--line)', borderRadius: 12, display: 'block' }} role="img" aria-label="Simulation: with gravity the flame is a teardrop and smoke rises to a ceiling detector" />
          <div className="row card" style={{ justifyContent: 'space-between', padding: '10px 14px' }}><span className="lab">Ceiling detector alarm</span><span className="mono" style={{ fontSize: 16, color: ui.a !== null ? 'var(--ember)' : 'var(--text)' }}>{fmt(ui.a)}</span></div>
          <div className="row mono" style={{ justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}><span>gravity {G[grav].toFixed(2)} m/s²</span><span>hot-gas rise ≈ {(ub * 100).toFixed(0)} cm/s</span></div>
          {grav !== 'Earth' && <span className="p" style={{ fontSize: 12 }}>Weaker gravity, slower rise. Physics scaling only: NASA’s PSI archive has no partial-gravity fire data yet.</span>}
        </figure>
        <figure className="col" style={{ margin: 0, gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="disp" style={{ fontSize: 20, fontWeight: 600 }}>Station module · ~0 g</span><span className="lab">nothing rises</span></div>
          <canvas ref={cb} width="660" height="380" style={{ width: '100%', height: 'auto', border: '1px solid var(--line)', borderRadius: 12, display: 'block' }} role="img" aria-label="Simulation: in microgravity the flame is a sphere and smoke goes only where the fans carry it" />
          <div className="row card" style={{ justifyContent: 'space-between', padding: '10px 14px' }}><span className="lab">Duct detector alarm</span><span className="mono" style={{ fontSize: 16, color: ui.b !== null ? 'var(--ember)' : 'var(--text)' }}>{fmt(ui.b)}</span></div>
          <span className="p" style={{ fontSize: 13 }}>{fans ? 'The fans carry smoke sideways to the detector in the air duct. They also feed the fire fresh oxygen and can push it in any direction.' : 'With the fans off, smoke only creeps outward in a slow cloud. It may never reach the detector in the duct.'}</span>
        </figure>
      </div>
      <p className="src">Illustrative particle simulation, not CFD. Rise speed ≈ √(g·ΔT/T·L) with ΔT 600 K and L 5 cm, the formula used in the dashboard.</p>
    </div>
  )
}
