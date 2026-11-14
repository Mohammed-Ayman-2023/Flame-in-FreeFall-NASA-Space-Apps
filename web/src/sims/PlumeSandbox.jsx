import { useEffect, useRef, useState } from 'react'
import { G, buoyantVelocity } from '../lib/data'

/* 2D hot-gas plume sandbox (physics estimate, not CFD, not NASA imagery).
   A small hot patch is released at the origin. Its centre is carried sideways by the cabin air (u) and
   upward by buoyancy u_b = √(g·ΔT/T·L) (same formula as src/fif/knowledge.py). It spreads by diffusion,
   σ(t) = √(σ0² + 2·D·t), and its peak temperature falls as heat spreads over a larger area. */
const T_AIR = 295, L = 0.01, SIG0 = 0.0025, D = 2.5e-5
const PRESETS = { Orbit: 0, Moon: G.Moon, Mars: G.Mars, Earth: G.Earth }

// inferno-like colour map, dark = cabin air, bright = hot
const STOPS = [[0, [8, 8, 16]], [.2, [60, 12, 90]], [.4, [140, 30, 90]], [.6, [220, 70, 50]], [.8, [250, 160, 40]], [1, [252, 252, 190]]]
function cmap(v) {
  v = Math.max(0, Math.min(1, v))
  for (let i = 1; i < STOPS.length; i++) if (v <= STOPS[i][0]) {
    const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], f = (v - a) / (b - a)
    return ca.map((c, k) => Math.round(c + (cb[k] - c) * f))
  }
  return STOPS[STOPS.length - 1][1]
}

function Slider({ id, label, val, set, min, max, step, fmt }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor={id} className="lab">{label}</label><span className="mono" style={{ color: 'var(--ember)', fontSize: 14 }}>{fmt(val)}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={val} onChange={e => set(+e.target.value)} />
    </div>
  )
}

export default function PlumeSandbox() {
  const [g, setG] = useState(0)
  const [u, setU] = useState(0.05)
  const [Th, setTh] = useState(1200)
  const [t, setT] = useState(1.5)
  const [play, setPlay] = useState(false)
  const cv = useRef(null)
  const ub = buoyantVelocity(g, Th - T_AIR, L)
  const Tend = 3
  // camera: a fixed 14 cm window while the gas stays near the fire, then it follows the hot patch
  const W = 720, H = 400
  const VIEW = 0.14
  const sx = VIEW / W
  const sig = Math.sqrt(SIG0 * SIG0 + 2 * D * t)
  const cx = u * t, cy = ub * t
  const follow = cx > 0.10 || cy > 0.045
  const x0 = follow ? cx - VIEW * 0.5 : -0.03
  const y0 = follow ? cy - (H * sx) * 0.5 : -(H * sx) * 0.5
  const peak = (Th - T_AIR) * (SIG0 * SIG0) / (sig * sig)
  const Ri = u > 0 ? (ub / u) ** 2 : (ub > 0 ? Infinity : 0)

  useEffect(() => {
    if (!play) return
    let raf, last = performance.now()
    const step = now => { const dt = (now - last) / 1000; last = now; setT(v => { const n = v + dt * 0.5; return n > Tend ? 0 : n }); raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [play])

  useEffect(() => {
    const c = cv.current; if (!c) return
    const ctx = c.getContext('2d'), img = ctx.createImageData(W, H)
    const range = Math.max(1, Th - T_AIR)
    for (let j = 0; j < H; j++) {
      const y = y0 + (H - j) * sx
      for (let i = 0; i < W; i++) {
        const x = x0 + i * sx
        const r2 = (x - cx) ** 2 + (y - cy) ** 2
        const T = peak * Math.exp(-r2 / (2 * sig * sig))
        const [R, Gc, B] = cmap((T / Math.max(peak, 1e-9)) * (0.55 + 0.45 * Math.sqrt(peak / range)))
        const k = (j * W + i) * 4; img.data[k] = R; img.data[k + 1] = Gc; img.data[k + 2] = B; img.data[k + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    const px = x => (x - x0) / sx, py = y => H - (y - y0) / sx
    // grid in cm
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.fillStyle = 'rgba(238,236,231,.6)'; ctx.font = '10px IBM Plex Mono, monospace'
    const stepCm = 2
    for (let cm = Math.ceil(x0 * 100 / stepCm) * stepCm; cm <= (x0 + W * sx) * 100; cm += stepCm) { ctx.beginPath(); ctx.moveTo(px(cm / 100), 0); ctx.lineTo(px(cm / 100), H); ctx.stroke(); ctx.fillText(cm + ' cm', px(cm / 100) + 3, H - 6) }
    for (let cm = Math.ceil(y0 * 100 / stepCm) * stepCm; cm <= (y0 + H * sx) * 100; cm += stepCm) { ctx.beginPath(); ctx.moveTo(0, py(cm / 100)); ctx.lineTo(W, py(cm / 100)); ctx.stroke(); if (cm !== 0) ctx.fillText(cm + ' cm', 4, py(cm / 100) - 3) }
    // path and markers
    ctx.strokeStyle = 'rgba(125,180,255,.9)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(cx), py(cy)); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = '#EEECE7'; ctx.beginPath(); ctx.arc(px(0), py(0), 4, 0, 6.283); ctx.fill(); ctx.fillText('fire starts here', px(0) + 8, py(0) + 14)
    ctx.strokeStyle = '#7DB4FF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px(cx) - 7, py(cy)); ctx.lineTo(px(cx) + 7, py(cy)); ctx.moveTo(px(cx), py(cy) - 7); ctx.lineTo(px(cx), py(cy) + 7); ctx.stroke(); ctx.lineWidth = 1
    if (follow) {
      ctx.fillStyle = 'rgba(10,11,13,.8)'; ctx.fillRect(W - 340, 10, 330, 26)
      ctx.fillStyle = '#EEECE7'; ctx.font = '11px IBM Plex Mono, monospace'
      ctx.fillText(`camera follows the gas · the fire is ${(Math.hypot(cx, cy) * 100).toFixed(0)} cm away`, W - 332, 27)
    }
  }, [g, u, Th, t])

  const regime = g === 0 ? (u > 0 ? 'Fans only: in orbit nothing rises, so the cabin air decides where heat and smoke go.' : 'No gravity and no fans: the hot gas only spreads slowly in every direction. A flame like this starves.')
    : Ri > 10 ? 'Buoyancy wins: hot gas rises much faster than the fans push it, as on Earth.'
      : Ri < 0.1 ? 'The fans win: air flow carries the heat sideways more than buoyancy lifts it.'
        : 'Mixed: buoyancy and the fans are about equally strong.'
  const gName = Object.entries(PRESETS).find(([, v]) => Math.abs(v - g) < 0.01)?.[0]
  const story = `${gName ? `On ${gName === 'Orbit' ? 'the space station' : gName === 'Earth' ? 'Earth' : 'the ' + gName}` : `At g = ${g.toFixed(2)} m/s²`}, after ${t.toFixed(1)} s the hot gas has moved ${(cx * 100).toFixed(1)} cm sideways and ${(cy * 100).toFixed(1)} cm up, and is now about ${(sig * 200).toFixed(1)} cm wide.`

  return (
    <div className="split" style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
      <div className="card pad col" style={{ gap: 20 }}>
        <div className="col" style={{ gap: 8 }}><span className="lab">Quick preset</span><div className="seg">{Object.entries(PRESETS).map(([k, v]) => <button key={k} type="button" className={Math.abs(g - v) < .01 ? 'on' : ''} onClick={() => setG(v)}>{k}</button>)}</div></div>
        <Slider id="g" label="Gravity g (m/s²)" val={g} set={setG} min={0} max={9.81} step={0.01} fmt={v => v.toFixed(2)} />
        <Slider id="u" label="Cabin air speed (m/s)" val={u} set={setU} min={0} max={0.3} step={0.005} fmt={v => v.toFixed(3)} />
        <Slider id="T" label="Hot gas temperature (K)" val={Th} set={setTh} min={500} max={2000} step={50} fmt={v => v.toFixed(0)} />
        <Slider id="t" label="Time after ignition (s)" val={t} set={setT} min={0} max={Tend} step={0.05} fmt={v => v.toFixed(2)} />
        <button type="button" className="btn sm" onClick={() => setPlay(!play)}>{play ? '❚❚ Pause' : '▶ Play'}</button>
      </div>
      <div className="col" style={{ gap: 14, minWidth: 0 }}>
        <div className="card" style={{ padding: 10, overflow: 'hidden' }}>
          <canvas ref={cv} width={W} height={H} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }} role="img" aria-label={story} />
          <div className="row mono" style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--faint)', padding: '8px 4px 0' }}><span>dark = cabin air · bright = hot</span><span>↑ away from gravity · → direction of air flow</span></div>
        </div>
        <div style={{ borderLeft: '2px solid var(--ember)', background: 'var(--panel)', padding: '14px 18px', borderRadius: '0 10px 10px 0' }}>
          <div className="lab" style={{ marginBottom: 6 }}>What you are seeing</div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{story} {regime}</p>
        </div>
        <div className="grid3" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
          {[['Buoyant rise speed', (ub * 100).toFixed(1) + ' cm/s'], ['Cabin air speed', (u * 100).toFixed(1) + ' cm/s'],
            ['Richardson number', Ri === Infinity ? '∞' : Ri < 0.01 ? Ri.toExponential(1) : Ri.toFixed(2)], ['Hot patch width', (sig * 200).toFixed(1) + ' cm']].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: '12px 14px' }}><div className="lab">{k}</div><div className="mono" style={{ fontSize: 20, marginTop: 6 }}>{v}</div></div>))}
        </div>
        <details className="card" style={{ padding: '12px 16px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 14 }}>What is actually computed (equations, assumptions, limits)</summary>
          <div className="p" style={{ fontSize: 13, marginTop: 10 }}>
            Buoyant velocity u_b = √(g·ΔT/T_air·L) with L = 1 cm and T_air = 295 K (ideal gas). Centre of the hot patch: x = u·t sideways, y = u_b·t up. Width σ(t) = √(σ0² + 2·D·t) with σ0 = 0.25 cm and an effective diffusivity D = 2.5×10⁻⁵ m²/s; the peak temperature falls as σ0²/σ² so the heat is conserved. Richardson number Ri = (u_b/u)²: above about 10 buoyancy dominates, below about 0.1 the fans do. This is a teaching estimate: it ignores the flame’s own chemistry, walls, turbulence and radiation. It is not CFD, not NASA imagery and not a measurement.
          </div>
        </details>
      </div>
    </div>
  )
}
