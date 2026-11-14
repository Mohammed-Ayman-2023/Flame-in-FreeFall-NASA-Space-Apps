import { useEffect, useState } from 'react'
import { Nav, Footer, PageHead, Ev } from '../components/ui'
import { Link } from '../lib/router'
import { useMission } from '../lib/mission'
import { useAudience } from '../lib/audience'
import { llmExplain, explainPrompt, aiAvailable, DEFAULT_MODEL, MiniMarkdown } from '../lib/rag'
import { equipment, earth, airQuality, smokeDelay, physics, atmospheres, gravityBounds, partialGravity,
  buoyantVelocity, richardson, solidTests, modelSolids } from '../lib/data'

const ax = { fill: '#868B93', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }
const EVK = { measured: 'measurement', gap: 'gap', model: 'prediction', literature: 'literature' }

/** A slider styled like the Fire Lab ones. */
function Slider({ id, label, val, set, min, max, step, fmt }) {
  return (
    <label htmlFor={id} className="col" style={{ gap: 8, flex: 1, minWidth: 200 }}>
      <span className="row" style={{ justifyContent: 'space-between' }}><span className="lab">{label}</span><span className="mono" style={{ color: 'var(--ember)', fontSize: 15 }}>{fmt(val)}</span></span>
      <input id={id} type="range" min={min} max={max} step={step} value={val} onChange={e => set(+e.target.value)} />
    </label>
  )
}

/* ------------------------------------------------------------------ BASS-II carbon monoxide by material */
export function AirQualityChart() {
  const rows = airQuality.ranking.filter(r => r.co_rise_median != null)
  const w = 900, rowH = 34, L = 290, R = 90, T = 10, h = T + rows.length * rowH + 52
  const max = Math.max(...rows.map(r => r.co_rise_q3 || r.co_rise_median)) * 1.1
  const X = v => L + Math.max(0, v) / max * (w - L - R)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Median rise in carbon monoxide during one BASS-II burn, by material. Thick PMMA slabs raised CO the most; Nomex produced none." style={{ display: 'block' }}>
      {[0, 100, 200, 300, 400, 500].filter(v => v < max).map(v => <g key={v}><line x1={X(v)} x2={X(v)} y1={T} y2={h - 46} stroke="#252930" /><text x={X(v)} y={h - 30} textAnchor="middle" {...ax}>{v}</text></g>)}
      {rows.map((r, i) => {
        const y = T + i * rowH
        return <g key={r.family}>
          <text x={L - 12} y={y + 21} textAnchor="end" fill="#D7D9DD" fontSize="13">{r.family} <tspan fill="#868B93">({r.co_tests})</tspan></text>
          <rect x={L} y={y + 8} width={X(r.co_rise_median) - L} height={18} rx="3" fill="#FF7A3D" />
          {r.co_rise_q1 != null && <line x1={X(r.co_rise_q1)} x2={X(r.co_rise_q3)} y1={y + 17} y2={y + 17} stroke="#EEECE7" strokeWidth="1.5" />}
          <text x={Math.max(X(r.co_rise_q3 || 0), X(r.co_rise_median)) + 8} y={y + 21} {...ax} fill="#D7D9DD">{Math.max(0, r.co_rise_median).toFixed(0)} ppm</text>
        </g>
      })}
      <text x={w - R} y={h - 6} textAnchor="end" {...ax}>CO RISE PER BURN (PPM) →</text>
    </svg>
  )
}

/* ------------------------------------------------------------------ smoke to the detector */
function SmokeDelay() {
  const [dist, setDist] = useState(1.0)
  const [fan, setFan] = useState(5)
  const [dT, setDT] = useState(600)
  const rows = smokeDelay(dist, fan, dT)
  const fin = rows.filter(r => isFinite(r.delay))
  const max = Math.max(1, ...fin.map(r => r.delay)) * 1.25
  const w = 900, L = 120, R = 150, rowH = 40, h = rows.length * rowH + 8
  const X = v => L + v / max * (w - L - R)
  return (
    <div className="card pad col" style={{ gap: 18 }}>
      <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
        <Slider id="sd-d" label="Fire to detector" val={dist} set={setDist} min={0.2} max={3} step={0.1} fmt={v => v.toFixed(1) + ' m'} />
        <Slider id="sd-u" label="Fan air speed" val={fan} set={setFan} min={0} max={30} step={0.5} fmt={v => v + ' cm/s'} />
        <Slider id="sd-t" label="Smoke hotter than the air by" val={dT} set={setDT} min={100} max={1200} step={50} fmt={v => v + ' K'} />
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Estimated time for smoke to reach a detector in orbit, on the Moon, on Mars and on Earth." style={{ display: 'block' }}>
        {rows.map((r, i) => {
          const y = i * rowH
          return <g key={r.name}>
            <text x={L - 12} y={y + 24} textAnchor="end" fill="#D7D9DD" fontSize="13">{r.name}</text>
            {isFinite(r.delay)
              ? <><rect x={L} y={y + 10} width={Math.max(2, X(r.delay) - L)} height={20} rx="3" fill={r.g === 0 ? '#7DB4FF' : '#4E7FC4'} />
                  <text x={X(r.delay) + 8} y={y + 24} {...ax} fill="#D7D9DD">{r.delay < 10 ? r.delay.toFixed(1) : r.delay.toFixed(0)} s</text></>
              : <text x={L} y={y + 24} {...ax} fill="#FF7A3D">never: with the fans off only slow diffusion is left</text>}
          </g>
        })}
      </svg>
      <span className="src"><Ev kind="physics" small /> {physics.smoke_note} Gravity: {physics.gravity_source}.</span>
    </div>
  )
}

/* ------------------------------------------------------------------ page: equipment and Earth */
export function Equipment() {
  return (<>
    <Nav active="Equipment" />
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <PageHead eyebrow="Controls, equipment and fire safety on Earth" title="What NASA's fire research means for the hardware.">
        <p className="p muted" style={{ maxWidth: 760 }}>For each kind of control or equipment: what the NASA data say (numbers computed from the dataset),
          which investigations it comes from, and what it means for the next generation. Then the NASA fire technology already used on Earth.</p>
      </PageHead>

      <section className="col" style={{ gap: 0 }}>
        {equipment.map(r => (
          <div key={r.area} className="rule" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2.2fr) minmax(0,1.4fr)', gap: 24, padding: '22px 0' }}>
            <div className="col" style={{ gap: 8 }}><strong style={{ fontSize: 17 }}>{r.area}</strong><Ev kind={EVK[r.badge] || r.badge} small /></div>
            <div className="col" style={{ gap: 8 }}><span style={{ fontSize: 14.5, lineHeight: 1.6 }}>{r.data}</span><span className="src">{r.investigations}</span></div>
            <div style={{ fontSize: 14.5, lineHeight: 1.6, borderLeft: '2px solid var(--ember)', paddingLeft: 14 }}><div className="lab" style={{ marginBottom: 6 }}>Next generation</div>{r.next_gen}</div>
          </div>))}
      </section>

      <section style={{ marginTop: 56 }}>
        <h2 className="h2" style={{ fontSize: 30, marginBottom: 8 }}>Which cabin materials foul the air most when they burn?</h2>
        <p className="p muted" style={{ maxWidth: 820, marginBottom: 16 }}><Ev kind="measurement" small /> BASS-II measured O₂, CO₂ and CO before and after each of its {airQuality.n_burns} burns on the ISS.
          Bars: median carbon-monoxide rise per burn; white whiskers: the middle half of tests; (n) = tests with a usable CO reading.</p>
        <div className="card" style={{ padding: '18px 10px 8px' }}><AirQualityChart /></div>
        <p className="src" style={{ marginTop: 10 }}>{airQuality.note} Source: BASS-II test matrix (PSI-25).</p>
      </section>

      <section style={{ marginTop: 56 }}>
        <h2 className="h2" style={{ fontSize: 30, marginBottom: 8 }}>Detectors: how long until smoke reaches one?</h2>
        <p className="p muted" style={{ maxWidth: 820, marginBottom: 16 }}>On Earth smoke rises by itself; in orbit only the fans move it. Change the distance, the fan speed and the smoke temperature.</p>
        <SmokeDelay />
      </section>

      <section style={{ marginTop: 56 }}>
        <h2 className="h2" style={{ fontSize: 30, marginBottom: 16 }}>Fire safety on Earth</h2>
        <div className="grid2" style={{ gap: 18 }}>
          {earth.uses.map(e => (
            <div key={e.topic} className="card pad col" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}><Ev kind="literature" small /><strong style={{ fontSize: 17 }}>{e.topic}</strong></div>
              <span style={{ fontSize: 14.5, lineHeight: 1.6 }}>{e.text}</span>
              <span className="muted" style={{ fontSize: 13.5 }}>Link to our data: {e.link_to_data}</span>
              <a className="src" href={e.url} target="_blank" rel="noreferrer">{e.source} ↗</a>
            </div>))}
        </div>
        <details className="card pad" style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>What each NASA investigation page says about benefits on Earth</summary>
          <div className="col" style={{ gap: 14, marginTop: 14 }}>{earth.benefits.map(b => (
            <div key={b.psi} className="col" style={{ gap: 4 }}><Link to={'/investigation/' + b.psi} style={{ fontWeight: 600 }}>{b.acronym} ({b.psi})</Link>
              <span className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{b.text}</span></div>))}</div>
        </details>
        <p className="src" style={{ marginTop: 18 }}>{earth.scope}</p>
      </section>
    </main>
    <Footer />
  </>)
}

/* ------------------------------------------------------------------ why habitats use this air (Briefing) */
export function AtmosphereTable() {
  const { mission } = useMission()
  return (
    <div className="card pad col" style={{ gap: 12 }}>
      <div className="lab">Why habitats will breathe this air</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr>{['Where', 'Oxygen', 'Pressure', 'O₂ partial pressure', 'Why'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--line2)', color: 'var(--muted)', fontWeight: 500 }}>{h}</th>)}</tr></thead>
          <tbody>{atmospheres.rows.map(r => <tr key={r.where}>
            <td style={{ padding: '10px', borderBottom: '1px solid var(--line)', fontWeight: 600 }}>{r.where}</td>
            <td style={{ padding: '10px', borderBottom: '1px solid var(--line)' }}>{r.o2}</td>
            <td style={{ padding: '10px', borderBottom: '1px solid var(--line)' }}>{r.psi} <span className="faint">({r.atm.toFixed(2)} atm)</span></td>
            <td style={{ padding: '10px', borderBottom: '1px solid var(--line)' }} className="mono">{r.ppo2.toFixed(2)} atm</td>
            <td style={{ padding: '10px', borderBottom: '1px solid var(--line)', color: 'var(--muted)', lineHeight: 1.5 }}>{r.why}</td></tr>)}
            <tr><td style={{ padding: '10px', fontWeight: 600, color: 'var(--ember)' }}>Your mission: {mission.name}</td><td style={{ padding: '10px' }}>{Math.round(mission.x_o2 * 1000) / 10}%</td>
              <td style={{ padding: '10px' }}>{(mission.p * 14.696).toFixed(1)} psi <span className="faint">({mission.p.toFixed(2)} atm)</span></td><td style={{ padding: '10px' }} className="mono">{(mission.x_o2 * mission.p).toFixed(2)} atm</td>
              <td style={{ padding: '10px', color: 'var(--muted)' }}>{mission.note}</td></tr>
          </tbody>
        </table>
      </div>
      <span className="src">The Moon base keeps about the same oxygen partial pressure as Earth air, so crews breathe normally, but a much richer oxygen fraction, which is what makes materials burn more readily. Source: {atmospheres.source}.</span>
    </div>
  )
}

/* ------------------------------------------------------------------ partial gravity (Gaps) */
export function GravityBounds() {
  return (
    <div className="card pad col" style={{ gap: 12 }}>
      <div className="lab">Bounding with our own data: Saffire materials at 0 g and 1 g</div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead><tr>{['Material', 'Microgravity (Saffire I-III, Cygnus)', 'Earth gravity (NASA 1 g comparison burns)', 'What it suggests for the Moon'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--line2)', color: 'var(--muted)', fontWeight: 500 }}>{h}</th>)}</tr></thead>
        <tbody>{gravityBounds.map(r => <tr key={r.material}>{['material', 'microgravity', 'earth_1g', 'partial_gravity'].map(k =>
          <td key={k} style={{ padding: '10px', borderBottom: '1px solid var(--line)', lineHeight: 1.5, color: k === 'partial_gravity' && r[k].startsWith('bounds disagree') ? 'var(--ember)' : undefined, fontWeight: k === 'material' ? 600 : 400 }}>{r[k]}</td>)}</tr>)}</tbody>
      </table></div>
      <span className="src">NASA NTRS 20180005168, Table 1: each Saffire sample's 1 g result next to its microgravity result. Where the bounds agree it is the best available guess, not a measurement; NASA's FM2 work found some materials burn at lower oxygen at lunar gravity than at 1 g.</span>
    </div>
  )
}

export function BuoyancyPanel() {
  const [dT, setDT] = useState(1000)
  const [Lcm, setL] = useState(2)
  const w = 900, h = 320, L0 = 64, R = 20, T = 16, B = 44
  const us = Array.from({ length: 120 }, (_, i) => 0.5 + i * 0.5)
  const X = u => L0 + (u - 0.5) / 59.5 * (w - L0 - R)
  const Y = ri => T + (1 - (Math.log10(Math.min(Math.max(ri, 0.01), 1e4)) + 2) / 6) * (h - T - B)
  const umax = Math.max(...solidTests.filter(t => t[6].startsWith('PSI-25') || t[6].startsWith('PSI-26')).map(t => t[4]))
  const lines = [['Earth', physics.gravity.Earth, '#EEECE7'], ['Mars', physics.gravity.Mars, '#FF7A3D'], ['Moon', physics.gravity.Moon, '#7DB4FF']]
  const ub = Object.fromEntries(lines.map(([n, g]) => [n, buoyantVelocity(g, dT, Lcm / 100) * 100]))
  const inside = ['Moon', 'Mars'].filter(n => ub[n] <= umax)
  return (
    <div className="card pad col" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}><span className="lab">Does buoyancy or the fan feed a fire on the Moon and Mars?</span><Ev kind="physics" small /></div>
      <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
        <Slider id="bp-t" label="Flame hotter than the air by" val={dT} set={setDT} min={500} max={1800} step={50} fmt={v => v + ' K'} />
        <Slider id="bp-l" label="Flame size" val={Lcm} set={setL} min={1} max={20} step={0.5} fmt={v => v + ' cm'} />
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Richardson number against fan air speed at Earth, Mars and Moon gravity." style={{ display: 'block' }}>
        <rect x={L0} y={Y(10)} width={w - L0 - R} height={Y(0.1) - Y(10)} fill="#1B1E24" />
        <text x={w - R - 6} y={Y(10) + 14} textAnchor="end" {...ax}>MIXED: FAN AND BUOYANCY BOTH MATTER</text>
        <line x1={X(umax)} x2={X(umax)} y1={T} y2={h - B} stroke="#7DB4FF" strokeDasharray="4 4" />
        <text x={X(umax) - 6} y={T + 14} textAnchor="end" {...ax}>← AIR SPEEDS NASA'S MICROGRAVITY SOLID BURNS USED</text>
        {[0.01, 0.1, 1, 10, 100, 1000, 10000].map(v => <g key={v}><line x1={L0} x2={w - R} y1={Y(v)} y2={Y(v)} stroke="#252930" /><text x={L0 - 8} y={Y(v) + 4} textAnchor="end" {...ax}>{v >= 1000 ? v / 1000 + 'k' : v}</text></g>)}
        {[0, 10, 20, 30, 40, 50, 60].map(u => <text key={u} x={X(Math.max(u, 0.5))} y={h - B + 20} textAnchor="middle" {...ax}>{u}</text>)}
        <text x={w - R} y={h - 6} textAnchor="end" {...ax}>FAN AIR SPEED (CM/S) →</text>
        <text x={L0 + 8} y={T + 14} {...ax}>RICHARDSON Ri (BUOYANCY ÷ FAN)²</text>
        {lines.map(([n, g, c]) => <polyline key={n} points={us.map(u => `${X(u)},${Y(richardson(g, dT, Lcm / 100, u / 100))}`).join(' ')} fill="none" stroke={c} strokeWidth="2.2" />)}
        {lines.map(([n, , c], i) => <text key={n} x={L0 + 12 + i * 90} y={h - B - 10} fill={c} fontSize="12">— {n}</text>)}
      </svg>
      <span style={{ fontSize: 14.5, lineHeight: 1.6 }}>A flame this size drives its own fresh-air flow of about <b>{ub.Earth.toFixed(0)} cm/s</b> on Earth, <b>{ub.Mars.toFixed(0)} cm/s</b> on Mars
        and <b>{ub.Moon.toFixed(0)} cm/s</b> on the Moon, and none in orbit, where the fans are the only supply. {inside.length
          ? `The ${inside.join(' and ')} self-induced flow falls inside the air speeds NASA's microgravity solid burns explored, so microgravity tests at that air speed are the closest analogue.`
          : `Both exceed the air speeds NASA's microgravity solid burns explored (0–${umax.toFixed(0)} cm/s), so no microgravity test matches this case.`} This is consistent
        with NASA's FM2 finding that some materials burn at lower oxygen at lunar gravity; it is not a prediction.</span>
      <span className="src">{physics.physics_note} Gravity: {physics.gravity_source}.</span>
    </div>
  )
}

/* ------------------------------------------------------------------ flammability map (Fire Lab, solids) */
export function FlammabilityMap({ mat, p, o2, flow }) {
  const rows = modelSolids.grid.filter(g => g[0] === mat && g[2] === p)
  const o2s = [...new Set(rows.map(r => r[1]))].sort((a, b) => a - b)
  const flows = [...new Set(rows.map(r => r[3]))].sort((a, b) => a - b)
  const env = modelSolids.envelope[mat]
  const pts = solidTests.filter(t => t[0] === mat)
  if (!rows.length) return null
  const w = 900, h = 340, L = 64, R = 20, T = 14, B = 44
  const X = o => L + (o - 14.5) / (40.5 - 14.5) * (w - L - R)
  const fy = f => Math.log(f)
  const Y = f => T + (1 - (fy(f) - fy(0.7)) / (fy(70) - fy(0.7))) * (h - T - B)
  const edges = flows.map((f, i) => [i === 0 ? 0.7 : Math.sqrt(flows[i - 1] * f), i === flows.length - 1 ? 70 : Math.sqrt(f * flows[i + 1])])
  const col = v => `rgba(255,122,61,${0.08 + 0.85 * v})`
  return (
    <div className="card" style={{ padding: '16px 10px 6px' }}>
      <div style={{ fontSize: 15, fontWeight: 600, padding: '0 10px 8px' }}>Flammability map: where can {mat} burn at {p} atm?</div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`Chance that ${mat} keeps burning across oxygen and air speed, with NASA tests that kept burning or went out.`} style={{ display: 'block' }}>
        {rows.map((r, i) => { const fi = flows.indexOf(r[3]); const [f0, f1] = edges[fi]
          return <rect key={i} x={X(r[1] - 0.5)} y={Y(f1)} width={X(r[1] + 0.5) - X(r[1] - 0.5) + 0.5} height={Y(f0) - Y(f1) + 0.5} fill={col(r[4])} /> })}
        {env && <><rect x={X(env.o2[1] + 0.5)} y={T} width={X(40.5) - X(env.o2[1] + 0.5)} height={h - T - B} fill="#0A0B0D" opacity=".55" />
          <text x={(X(env.o2[1] + 0.5) + X(40.5)) / 2} y={T + 16} textAnchor="middle" {...ax}>NO TESTS ABOVE {Math.round(env.o2[1])}% O₂ · EXTRAPOLATION</text></>}
        {[1, 2, 5, 10, 20, 50].map(f => <g key={f}><line x1={L} x2={w - R} y1={Y(f)} y2={Y(f)} stroke="#0A0B0D" strokeOpacity=".35" /><text x={L - 8} y={Y(f) + 4} textAnchor="end" {...ax}>{f}</text></g>)}
        {[15, 20, 25, 30, 35, 40].map(o => <text key={o} x={X(o)} y={h - B + 20} textAnchor="middle" {...ax}>{o}%</text>)}
        <text x={w - R} y={h - 6} textAnchor="end" {...ax}>OXYGEN →</text>
        <text x={14} y={T + 8} {...ax}>CM/S</text>
        {pts.map((t, i) => t[5] === 1
          ? <circle key={i} cx={X(t[2])} cy={Y(Math.max(t[4], 0.8))} r="3.5" fill="#EEECE7" fillOpacity=".85" />
          : <g key={i} stroke="#7DB4FF" strokeWidth="2"><line x1={X(t[2]) - 4} x2={X(t[2]) + 4} y1={Y(Math.max(t[4], 0.8)) - 4} y2={Y(Math.max(t[4], 0.8)) + 4} /><line x1={X(t[2]) - 4} x2={X(t[2]) + 4} y1={Y(Math.max(t[4], 0.8)) + 4} y2={Y(Math.max(t[4], 0.8)) - 4} /></g>)}
        <circle cx={X(o2)} cy={Y(Math.max(flow, 0.8))} r="10" fill="none" stroke="#0A0B0D" strokeWidth="5" /><circle cx={X(o2)} cy={Y(Math.max(flow, 0.8))} r="10" fill="none" stroke="#EEECE7" strokeWidth="2.5" />
      </svg>
      <div className="src" style={{ padding: '0 10px 8px' }}>Colour = model chance it keeps burning (darker orange = higher) · white dots: NASA tests that kept burning · blue ×: went out (each at its own pressure) · ringed circle: your settings. Bounded below by quenching (too little fresh air); widens as oxygen rises.</div>
    </div>
  )
}

export { partialGravity }

/* ------------------------------------------------------------------ Shapley waterfall (Fire Lab) */
export function ShapleyWaterfall({ title, sh, baseLabel, totalLabel, fmt, note }) {
  if (!sh) return null
  const steps = [{ k: baseLabel, a: 0, b: sh.base, kind: 'total' }]
  let run = sh.base
  sh.phi.forEach(s => { steps.push({ k: s.k, a: run, b: run + s.v, kind: s.v >= 0 ? 'up' : 'down', v: s.v }); run += s.v })
  steps.push({ k: totalLabel, a: 0, b: sh.total, kind: 'total' })
  const lo = Math.min(0, ...steps.map(s => Math.min(s.a, s.b))), hi = Math.max(...steps.map(s => Math.max(s.a, s.b))) * 1.08 || 1
  const w = 900, rowH = 40, L = 200, R = 120, h = steps.length * rowH + 10
  const X = v => L + (v - lo) / (hi - lo) * (w - L - R)
  const col = { total: '#868B93', up: '#FF7A3D', down: '#7DB4FF' }
  return (
    <div className="card" style={{ padding: '16px 10px 6px' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '0 10px 8px' }}><span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span><Ev kind="prediction" small /></div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`${title}: ${sh.phi.map(s => `${s.k} ${s.v >= 0 ? '+' : ''}${fmt(s.v)}`).join(', ')}`} style={{ display: 'block' }}>
        {steps.map((s, i) => {
          const y = i * rowH + 6, x0 = X(Math.min(s.a, s.b)), x1 = X(Math.max(s.a, s.b))
          return <g key={s.k}>
            <text x={L - 12} y={y + 20} textAnchor="end" fill="#D7D9DD" fontSize="13">{s.k}</text>
            <rect x={x0} y={y + 6} width={Math.max(2, x1 - x0)} height={20} rx="3" fill={col[s.kind]} />
            {i > 0 && i < steps.length - 1 && <line x1={X(s.a)} x2={X(s.a)} y1={y - 14} y2={y + 6} stroke="#4A4F57" strokeDasharray="2 3" />}
            <text x={x1 + 8} y={y + 20} {...ax} fill="#D7D9DD">{s.kind === 'total' ? fmt(s.b) : (s.v >= 0 ? '+' : '−') + fmt(Math.abs(s.v))}</text>
          </g>
        })}
      </svg>
      <div className="src" style={{ padding: '0 10px 8px' }}>{note}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ the dashboard's animated flame simulator */
// Same template as app/assets/flame_sim.html (copied to public/sim, parameters passed in the URL hash) and the same
// panes and shape rule as app/streamlit_app.py (sim_shape): timing from the NASA-trained models, shape from buoyancy.
export const SIM_G = [['Orbit (ISS, 0 g)', 0], ['Moon (1.62 m/s²)', 1.62], ['Mars (3.71 m/s²)', 3.71], ['Earth (9.81 m/s²)', 9.81]]
export function simShape(g, air, xo2, p, sooty = true) {
  const ub = buoyantVelocity(g, 1000, 0.02) * 100, ubE = buoyantVelocity(9.81, 1000, 0.02) * 100
  const up = Math.pow(Math.min(1, ub / ubE), 0.6), down = air / (air + ub + 5)
  const soot = sooty ? Math.min(1, Math.max(0, 0.15 + 0.6 * up + 0.5 * (xo2 - 0.21) / 0.19)) : 0
  return { up, down, soot, bright: xo2 / 0.21 * Math.pow(p, 0.3), flicker: up }
}
export function FlameSim({ mode, speed, build }) {
  const [gi, setGi] = useState(0)
  const [label, g] = SIM_G[gi]
  const panes = build(g, label)
  const src = (import.meta.env.BASE_URL || './') + 'sim/flame_sim.html#' + encodeURIComponent(JSON.stringify({ mode, panes, speed }))
  return (
    <div className="card" style={{ padding: '16px 14px 10px' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Flame simulator · ISS cabin air vs your conditions</span>
        <div className="seg" role="group" aria-label="Gravity for the flame simulator">{SIM_G.map(([l], i) => <button key={l} type="button" className={gi === i ? 'on' : ''} aria-pressed={gi === i} onClick={() => setGi(i)}>{l.split(' (')[0]}</button>)}</div>
      </div>
      <iframe key={src} src={src} title={`Animated flame simulator, ${mode}`} style={{ width: '100%', height: 420, border: 0, borderRadius: 10, background: '#07080a', display: 'block' }} loading="lazy" />
      <div className="src" style={{ paddingTop: 8 }}>Timing and outcome come from our NASA-trained models (microgravity data). Flame shape follows buoyancy physics for the gravity you pick; colours, glow and flame size are illustrative, not to scale. NASA has no partial-gravity timing data, so at Moon, Mars or Earth gravity only the shape changes.</div>
    </div>
  )
}

/* ------------------------------------------------------------------ AI explanation of a Shapley chart */
// Sends the exact numbers behind the chart (and nothing else) to the site's default model or the visitor's own key,
// and streams a plain-language explanation. Labelled AI-generated; the chart above it is the evidence.
export function AIExplain({ ctx }) {
  const { view } = useAudience()
  const sig = JSON.stringify(ctx)
  const [st, setSt] = useState({ sig: '', text: '', busy: false, err: '', model: '', note: '', t0: 0 })
  const cur = st.sig === sig ? st : { sig, text: '', busy: false, err: '', model: '', note: '', t0: 0 }
  const [, tick] = useState(0)
  useEffect(() => { if (!cur.busy) return; const t = setInterval(() => tick(x => x + 1), 500); return () => clearInterval(t) }, [cur.busy])
  async function go() {
    setSt({ sig, text: '', busy: true, err: '', model: '', note: '', t0: Date.now() })
    try {
      const r = await llmExplain(explainPrompt({ ...ctx, audience: view ? view.label.toLowerCase() : 'general technical' }), t => setSt(s => (s.sig === sig ? { ...s, text: t } : s)), note => setSt(s => (s.sig === sig ? { ...s, note } : s)))
      setSt(s => (s.sig === sig ? { ...s, text: r.answer || s.text, busy: false, model: r.model } : s))
    } catch (e) { setSt(s => (s.sig === sig ? { ...s, busy: false, err: e.message } : s)) }
  }
  return (
    <div className="card pad col" style={{ gap: 10, borderColor: '#5a4a24' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <span className="lab">AI explanation of this chart</span>
        <button type="button" className="btn sm" onClick={go} disabled={cur.busy || !aiAvailable()}>{cur.busy ? 'Explaining…' : cur.text ? 'Explain again' : 'Explain with AI'}</button>
      </div>
      {!aiAvailable() && <span className="faint" style={{ fontSize: 13 }}>No AI model is configured on this site; add your own key in the chat to use this.</span>}
      {cur.busy && !cur.text && <span className="muted row" style={{ fontSize: 13.5, gap: 8 }}><span className="pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--plasma)', display: 'inline-block' }} />{cur.note || `Waiting for ${DEFAULT_MODEL} (free models can be busy; after 20 s it switches to OpenRouter's free router)`} <span className="mono faint">{Math.round((Date.now() - cur.t0) / 1000)} s</span></span>}
      {cur.note && cur.text && <span className="faint" style={{ fontSize: 12 }}>{cur.note}</span>}
      {cur.err && <span className="muted" style={{ fontSize: 13.5, borderLeft: '3px solid var(--ember)', paddingLeft: 10 }}>The AI could not answer ({cur.err}). The chart above is unaffected.</span>}
      {cur.text && <div style={{ borderLeft: '3px solid #E8C15A', paddingLeft: 14 }}><MiniMarkdown text={cur.text + (cur.busy ? ' ▍' : '')} /></div>}
      <span className="src">AI-generated ({cur.model || DEFAULT_MODEL}) from the numbers in the chart only; it can still be wrong. The chart is the evidence.</span>
    </div>
  )
}
