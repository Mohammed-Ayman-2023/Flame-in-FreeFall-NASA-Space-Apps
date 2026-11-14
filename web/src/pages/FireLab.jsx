import { useMemo, useState } from 'react'
import { Link } from '../lib/router'
import { Ev, Flame, pct } from '../components/ui'
import { BurnChart } from '../components/charts'
import { LessonHeader } from './Learn'
import { FlammabilityMap, ShapleyWaterfall, FlameSim, simShape } from './Evidence'
import shapSolids from '../data/shap_solids.json'
import { useMission } from '../lib/mission'
import { useApi, useLive } from '../lib/api'
import { G, modelGas, modelSolids, modelDroplets, gasFlames, gasPredict, gasCurve, gasInGap, solidPredict, solidCurve, solidInside, dropPredict, dropInside, richardson, buoyantVelocity, d2Check, exactShapley } from '../lib/data'

const near = (arr, v) => arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))
const fp = v => (+v).toFixed(2).replace(/0$/, '')
const PG = [0.5, 0.69, 1.0, 2.0]

// Says where the numbers come from: the live model server, or the grids exported with the site.
function LiveTag({ api, live }) {
  const on = api && live?.data
  const txt = api === undefined ? 'Connecting to the model server…' : !api ? 'Precomputed model grid · model server offline' : live === null ? 'Model server connected · no model for this material' : live?.fresh ? `Live model · computed on the server in ${live.ms} ms` : 'Live model · updating…'
  return <div role="status" className="row mono" style={{ gap: 8, fontSize: 11, color: on ? '#3ee08f' : 'var(--faint)' }}><span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: on ? '#3ee08f' : 'var(--line2)', boxShadow: on ? '0 0 10px #3ee08f' : 'none' }} />{txt}</div>
}
function Pressure({ id, live, val, set, opts, max = 2 }) {
  return live
    ? <Slider id={id} label="Pressure" val={val} set={set} min={0.5} max={max} step={0.01} fmt={v => fp(v) + ' atm'} note={['0.5 atm', 'Earth 1 atm', max + ' atm']} />
    : <Seg label="Pressure" opts={opts} val={val} set={set} />
}

function Slider({ id, label, val, set, min, max, step, fmt, note }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor={id} className="lab">{label}</label><span className="mono" style={{ color: 'var(--ember)', fontSize: 16 }}>{fmt(val)}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={val} onChange={e => set(+e.target.value)} />
      {note && <div className="row mono faint" style={{ justifyContent: 'space-between', fontSize: 10 }}>{note.map(n => <span key={n}>{n}</span>)}</div>}
    </div>
  )
}
function Seg({ label, opts, val, set }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="lab">{label}</span>
      <div className="seg">{opts.map(([v, n, dis]) => <button key={String(v)} type="button" className={val === v ? 'on' : ''} disabled={dis} onClick={() => set(v)}>{n}</button>)}</div>
    </div>
  )
}
function Big({ label, value, unit, sub, color }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="lab">{label}</div>
      <div className="h1" style={{ fontSize: 56, marginTop: 8, color }}>{value}<span style={{ fontSize: 24, color: 'var(--muted)' }}>{unit}</span></div>
      {sub && <div className="mono muted" style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}
function Range({ inside, insideText, outsideText }) {
  return inside
    ? <div className="row card" style={{ padding: '12px 14px', fontSize: 13, gap: 10 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--plasma)', flex: 'none' }} />{insideText}</div>
    : <div className="row" style={{ padding: '12px 14px', fontSize: 13, gap: 10, border: '1px dashed var(--ember)', borderRadius: 12 }}><span style={{ width: 9, height: 9, border: '1px dashed var(--ember)', flex: 'none' }} />{outsideText}</div>
}
function Bars({ title, rows, note }) {
  const max = Math.max(...rows.map(r => Math.abs(r.w)), 1e-9)
  return (
    <div className="card pad col" style={{ gap: 12 }}>
      <span className="lab">{title}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 70px', gap: '10px 12px', alignItems: 'center', fontSize: 13 }}>
        {rows.map(r => [
          <span key={r.k + 'a'} className="muted" style={r.strong ? { color: 'var(--text)', fontWeight: 600 } : null}>{r.k}</span>,
          <span key={r.k + 'b'} style={{ height: 8, borderRadius: 4, background: r.color || 'var(--ember)', width: `${Math.max(3, Math.abs(r.w) / max * 100)}%`, opacity: r.w === 0 ? .2 : 1, transition: 'width .3s' }} />,
          <span key={r.k + 'c'} className="mono" style={{ textAlign: 'right', color: r.strong ? 'var(--ember)' : 'var(--text)', fontWeight: r.strong ? 600 : 400 }}>{r.v}</span>,
        ])}
      </div>
      {note && <span className="src">{note}</span>}
    </div>
  )
}
function Twin({ intensity, orbitSize, earthLabel, orbitLabel }) {
  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', overflow: 'hidden', background: '#050607', minHeight: 300 }}>
      <div className="col" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, borderRight: '1px solid var(--line)', padding: 16 }}>
        <div className="mono faint" style={{ fontSize: 11 }}>ON EARTH · 1 g</div>
        <Flame size={70} earth style={{ opacity: .9 }} />
        <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{earthLabel}</span>
      </div>
      <div className="col" style={{ alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--plasma)' }}>ON THE ISS · ~0 g</div>
        <div style={{ height: 190, display: 'flex', alignItems: 'center' }}><Flame size={orbitSize} intensity={intensity} soot={intensity > .8} className="breathe" /></div>
        <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{orbitLabel}</span>
      </div>
    </div>
  )
}
function Story({ children }) {
  return <div style={{ borderLeft: '2px solid var(--ember)', background: 'var(--panel)', padding: '14px 18px', borderRadius: '0 10px 10px 0' }}><div className="lab" style={{ marginBottom: 6 }}>What you are seeing</div><p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{children}</p></div>
}
function LineChart({ pts, band, x, xlabel, ylabel, ymax = 1, yfmt = v => Math.round(v * 100) + '%', log, marks }) {
  const w = 720, h = 256, L = 54, R = 14, T = 14, B = 52
  const xs = pts.map(p => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs)
  const f = v => (log ? Math.log(v) : v)
  const X = v => L + (f(v) - f(x0)) / ((f(x1) - f(x0)) || 1) * (w - L - R)
  const Y = v => T + (1 - v / ymax) * (h - T - B)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`${ylabel} against ${xlabel}`} style={{ display: 'block' }}>
      {[0, .5, 1].map(q => <g key={q}><line x1={L} x2={w - R} y1={Y(q * ymax)} y2={Y(q * ymax)} stroke="#252930" /><text x={L - 8} y={Y(q * ymax) + 4} textAnchor="end" fill="#868B93" fontFamily="IBM Plex Mono" fontSize="11">{yfmt(q * ymax)}</text></g>)}
      {(marks || [x0, x1]).map(m => <text key={m} x={X(m)} y={h - 30} textAnchor="middle" fill="#868B93" fontFamily="IBM Plex Mono" fontSize="11">{m}</text>)}
      <text x={w - R} y={h - 6} textAnchor="end" fill="#868B93" fontFamily="IBM Plex Mono" fontSize="11">{xlabel} →</text>
      {band && <polygon points={[...pts.map(p => `${X(p.x)},${Y(p.hi)}`), ...pts.slice().reverse().map(p => `${X(p.x)},${Y(p.lo)}`)].join(' ')} fill="rgba(255,122,61,.13)" />}
      <polyline points={pts.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke="#EEECE7" strokeWidth="2" />
      {x != null && <><line x1={X(x)} x2={X(x)} y1={T} y2={h - B} stroke="#FF7A3D" strokeDasharray="3 4" />
        <circle cx={X(x)} cy={Y((pts.find(p => p.x === x) || pts.reduce((a, b) => Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a)).y)} r="6" fill="#FF7A3D" stroke="#0A0B0D" strokeWidth="2" /></>}
    </svg>
  )
}

/* ------------------------------------------------------------------ gas leak */
function GasLab() {
  const { mission } = useMission()
  const [fuel, setFuel] = useState('propane')
  const [o2, setO2] = useState(Math.round(mission.x_o2 * 100))
  const [p, setP] = useState(near(PG, mission.p))
  const api = useApi(), on = !!api
  const live = useLive('/api/predict/gas', { fuel, o2, p }, on)
  const L = live.data
  const pG = near(PG, p)
  const r = L ? { median: L.median, s10: L.s10, s30: L.s30, s60: L.s60 } : gasPredict(fuel, Math.round(o2), pG)
  const r0 = gasPredict(fuel, 21, 1.0)
  const gridCurve = useMemo(() => gasCurve(fuel, pG), [fuel, pG])
  const curve = L ? L.curve : gridCurve
  const gap = L ? L.in_gap : gasInGap(o2)
  const pTested = modelGas.tested_p.some(t => Math.abs(t - p) < 0.03)
  const win = gasFlames.filter(f => Math.abs(f[0] - o2) <= 3 && Math.abs(f[1] - p) <= 0.25)
  const nOut = win.filter(f => f[3] === 1).length, nStill = win.length - nOut
  const fO2 = Math.pow(1.17, o2 - 21), fP = Math.pow(0.967, (p - 1) / 0.1)
  const size = Math.round(70 + 120 * Math.min(1, Math.log10(r.median) / Math.log10(120)))
  const presets = on ? [['ISS cabin', 21, 1.0], ['NASA exploration', 26.5, 0.69], ['Challenge habitat', 30, 0.69], ['Lunar base', 34, 0.56]]
    : [['ISS cabin', 21, 1.0], ['NASA exploration', 27, 0.69], ['Challenge habitat', 30, 0.69], ['Lunar base', 34, 0.5]]
  let story
  if (o2 <= 25) story = `At ${o2}% oxygen in still air, the flame starves itself: with no buoyancy, burned gas is not carried away and fresh oxygen does not arrive. Most flames here go out on their own.`
  else if (gap) story = 'This is the band NASA never tested. The model joins the low-oxygen and high-oxygen results, so treat this number as an informed guess. It is the reason this experiment is at the top of our list.'
  else story = `At ${o2}% oxygen enough oxygen reaches the flame by diffusion alone, so it keeps going without any air flow. Cutting the ventilation would not starve it quickly.`
  return (
    <div className="split" style={{ display: 'grid', gridTemplateColumns: '330px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
      <aside className="card pad col" style={{ gap: 22, position: 'sticky', top: 90 }}>
        <div className="col" style={{ gap: 8 }}><span className="lab">Start from a mission</span>
          <div className="col" style={{ gap: 6 }}>{presets.map(([n, o, pp]) => <button key={n} type="button" onClick={() => { setO2(o); setP(pp) }} className="row" style={{ justifyContent: 'space-between', borderRadius: 6, padding: '9px 12px', fontSize: 13, cursor: 'pointer', border: `1px solid ${o2 === o && p === pp ? 'var(--ember)' : 'var(--line2)'}`, background: o2 === o && p === pp ? 'var(--ember-soft)' : 'transparent' }}><span>{n}</span><span className="mono faint" style={{ fontSize: 11 }}>{o}% · {pp} atm</span></button>)}</div>
          <span className="faint" style={{ fontSize: 11 }}>{on ? 'The live model runs at the exact mission values.' : 'Presets snap to the nearest point the model was run at.'}</span>
        </div>
        <LiveTag api={api} live={live} />
        <Seg label="Gas" opts={[['ethane', 'Ethane'], ['propane', 'Propane'], ['butane', 'n-Butane']]} val={fuel} set={setFuel} />
        <Slider id="o2" label="Oxygen" val={o2} set={setO2} min={18} max={40} step={on ? 0.5 : 1} fmt={v => v + '%'} note={['18%', 'Earth 21%', '40%']} />
        <Pressure id="gp" live={on} val={p} set={setP} opts={[[0.5, '0.5 atm'], [0.69, '0.69 atm'], [1.0, '1 atm'], [2.0, '2 atm']]} />
        <p className="faint" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>Still air: no fans. This is the case where ventilation has been shut off.</p>
      </aside>
      <div className="col" style={{ gap: 20, minWidth: 0 }}>
        <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)' }}>
          <Twin intensity={0.35 + 0.65 * Math.min(1, r.median / 60)} orbitSize={size} earthLabel="Hot gas rises: a tall flickering teardrop" orbitLabel={`Still air: a round flame · median ${r.median < 10 ? r.median.toFixed(1) : Math.round(r.median)} s`} />
          <div className="col" style={{ gap: 12 }}>
            <Big label="Median burn time" value={r.median < 10 ? r.median.toFixed(1) : Math.round(r.median)} unit=" s" sub={`Earth air, same gas: ${r0.median.toFixed(1)} s`} />
            <div className="card" style={{ padding: 16 }}>
              <div className="lab">Still burning after…</div>
              {[['10 s', r.s10], ['30 s', r.s30], ['60 s', r.s60]].map(([t, v]) => <div key={t} className="row" style={{ marginTop: 10 }}><span className="mono" style={{ width: 40, fontSize: 12 }}>{t}</span><div className="bar" style={{ flex: 1, height: 6 }}><span style={{ width: pct(v) }} /></div><span className="mono" style={{ width: 44, textAlign: 'right', fontSize: 13 }}>{pct(v)}</span></div>)}
            </div>
            <Range inside={!gap && pTested} insideText={`Inside the tested range · ${win.length} NASA flame${win.length === 1 ? '' : 's'} nearby`} outsideText={gap ? 'No NASA tests between 24% and 33% O₂ · interpolated' : `No NASA flames at ${fp(p)} atm · interpolated between tested pressures`} />
          </div>
        </div>
        <div className="grid2">
          <Bars title="Why the model says this" rows={[
            { k: 'Earth air (21%, 1 atm)', w: 1, v: r0.median.toFixed(1) + ' s', color: 'var(--line2)' },
            { k: `Oxygen ${o2}%`, w: Math.log(Math.max(fO2, 1.0001)), v: '×' + fO2.toFixed(2) },
            { k: `Pressure ${fp(p)} atm`, w: Math.abs(Math.log(fP)) + 1e-4, v: '×' + fP.toFixed(2), color: 'var(--plasma)' },
            { k: 'This air', w: 0, v: '≈ ' + Math.round(r0.median * fO2 * fP) + ' s', strong: true },
          ]} note="Time ratios from the survival model: +1% O₂ multiplies burn time by 1.17 (95% CI 1.15–1.19); +0.1 atm by 0.97." />
          <div className="card pad col" style={{ gap: 12 }}>
            <span className="lab">What happened in the nearest NASA tests</span>
            {win.length ? <>
              <div className="row" style={{ height: 30, borderRadius: 6, overflow: 'hidden', gap: 0 }}>
                {nOut > 0 && <span className="mono" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--plasma)', color: '#0A0B0D', fontSize: 12, width: `${nOut / win.length * 100}%` }}>{nOut}</span>}
                {nStill > 0 && <span className="mono" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ember)', color: '#0A0B0D', fontSize: 12, width: `${nStill / win.length * 100}%` }}>{nStill}</span>}
              </div>
              <div className="row" style={{ gap: 16, fontSize: 12 }}><span style={{ color: 'var(--plasma)' }}>■ went out by itself</span><span style={{ color: 'var(--ember)' }}>■ still burning at fuel cut</span></div>
              <span className="src">{win.length} ISS flames within ±3% O₂ and ±0.25 atm · ACME CFI-G (PSI-159), all fuels</span>
            </> : <div style={{ border: '1px dashed var(--muted)', borderRadius: 8, padding: 12, fontSize: 14, lineHeight: 1.5 }}>No NASA flame was lit near this air. The number above is an interpolation, and this is one of the experiments we recommend.</div>}
          </div>
        </div>
        <div className="card" style={{ padding: '16px 10px 6px' }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', padding: '0 10px 8px' }}><span style={{ fontSize: 15, fontWeight: 600 }}>Sweep: burn time across all oxygen levels at {fp(p)} atm</span><span className="src">line = model · dots = every NASA flame · ring = still burning at fuel cut</span></div>
          <BurnChart curve={curve} marker={{ o2, median: r.median }} />
        </div>
        <Story>{story}</Story>
        <FlameSim mode="gas" speed={6} build={(g, gl) => [
          { title: 'ISS cabin air · 21 % O₂, 1 atm, 0 g, still air', gravity_label: '0 g', air: 0, size: 1, t_end: Math.min(r0.median, 999), q: simShape(0, 0, 0.21, 1) },
          { title: `Your conditions · ${o2}% O₂, ${fp(p)} atm, ${gl.split(' (')[0]}, still air`, gravity_label: gl, air: 0, size: Math.min(1.6, Math.max(0.8, Math.sqrt(o2 / 21))), t_end: Math.min(r.median, 999), extra: g > 0 ? 'timing from microgravity data; shape from buoyancy' : '', q: simShape(g, 0, o2 / 100, p) }]} />
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}><Ev kind="prediction" /><span className="src">{modelGas.note}</span><Link to="/methods" className="mono" style={{ fontSize: 11, color: 'var(--plasma)' }}>How good is this model? →</Link></div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ cabin materials */
const MATS = [['PMMA', 'Acrylic (PMMA) slab'], ['cotton-fiberglass', 'Cotton-fiberglass fabric'], ['wax', 'Wax (candle)'], ['Nomex', 'Nomex fabric'], ['silicone', 'Silicone'], ['cotton', 'Cotton']]
const FLOWS = [1, 2, 5, 10, 20, 30, 50]
/* Why this number? Exact Shapley values, against Earth air (2 inputs, from the grid) or against 50 real NASA tests
   (all 6 inputs, precomputed with the model by scripts/export_web_extras.py, same reference as the dashboard). */
function SolidShapley({ mat, oG, pG, flow, inside }) {
  const [ref, setRef] = useState('nasa')
  const p = solidPredict(mat, oG, pG, flow)?.p
  let sh = null
  if (ref === 'earth') sh = exactShapley(pt => solidPredict(mat, pt.o2, pt.p, flow)?.p, { o2: oG, p: pG }, { o2: 21, p: 1.0 }, { Oxygen: ['o2'], Pressure: ['p'] })
  else {
    const r = shapSolids.rows.find(x => x[0] === mat && x[1] === oG && x[2] === pG && x[3] === flow)
    if (r) { const phi = shapSolids.players.map((k, i) => ({ k, v: r[5 + i] })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)); sh = { base: r[4], total: r[4] + phi.reduce((a, b) => a + b.v, 0), phi } }
  }
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span className="lab">Why this number? (exact Shapley values)</span>
        <div className="seg">{[['nasa', 'vs 50 real NASA tests'], ['earth', 'vs Earth cabin air']].map(([k, n]) => <button key={k} type="button" className={ref === k ? 'on' : ''} aria-pressed={ref === k} onClick={() => setRef(k)}>{n}</button>)}</div>
      </div>
      <ShapleyWaterfall title={ref === 'nasa' ? `Why ${pct(p)} instead of the average NASA test?` : `Why ${pct(p)} here instead of Earth air?`} sh={sh}
        baseLabel={ref === 'nasa' ? 'Average NASA test' : 'Earth air (21%, 1 atm)'} totalLabel="This prediction" fmt={v => (v * 100).toFixed(1) + ' pts'}
        note={ref === 'nasa'
          ? `Each input's share of this prediction: start from the model's average over ${shapSolids.reference}, then each input moves the chance up (orange) or down (blue). The bars add up exactly. Computed over all 64 combinations of the six inputs (oxygen, pressure, air speed, material, sample shape, flow direction) with the model itself, no sampling, like the dashboard (src/fif/xai.py). They explain the model, not the physics.`
          : `Against Earth cabin air with the same material and air speed (${flow} cm/s): how much of the change oxygen and pressure are each responsible for. Exact, from the model grid (oxygen rounded to 1 %). pts = percentage points.`} />
    </div>
  )
}

function SolidsLab() {
  const { mission } = useMission()
  const [mat, setMat] = useState('PMMA')
  const [o2, setO2] = useState(Math.round(mission.x_o2 * 100))
  const [p, setP] = useState(near([0.5, 0.69, 1.0], mission.p))
  const [flow, setFlow] = useState(10)
  const [sweep, setSweep] = useState('flow')
  const [grav, setGrav] = useState('Orbit')
  const api = useApi(), on = !!api
  const modelled = !modelSolids.not_modelled.includes(mat)
  const live = useLive('/api/predict/solid', { material: mat, o2, p, flow, sweep }, on && modelled)
  const L = live.data?.kind === 'prediction' ? live.data : null
  const oG = Math.round(o2), pG = near([0.5, 0.69, 1.0], p)
  const r = !modelled ? null : L ? { p: L.p, lo: L.lo, hi: L.hi } : solidPredict(mat, oG, pG, flow)
  const inside = modelled && (L ? L.inside_tested_range : solidInside(mat, o2, p, flow))
  const env = modelSolids.envelope[mat]
  const curve = !modelled ? [] : L ? L.curve.map(c => ({ x: c.x, y: c.p, lo: c.lo, hi: c.hi }))
    : (sweep === 'flow' ? solidCurve(mat, oG, pG, 'flow') : solidCurve(mat, oG, pG, flow)).map(c => ({ x: c.x, y: c.p, lo: c.lo, hi: c.hi }))
  const gv = { Orbit: 0, Moon: G.Moon, Mars: G.Mars, Earth: G.Earth }[grav]
  const Ri = richardson(gv, 1200 - 295, 0.05, flow / 100)
  const ub = buoyantVelocity(gv, 1200 - 295, 0.05)
  const regime = gv === 0 ? 'In orbit nothing rises: only the fans bring fresh oxygen to the flame.' : Ri > 10 ? 'Buoyancy feeds this flame far more than the fans do, as on Earth.' : Ri < 0.1 ? 'The fans feed this flame more than buoyancy does.' : 'Buoyancy and the fans feed this flame about equally.'
  const imp = modelSolids.explain.importance_auc_drop
  let story
  if (!modelled) story = `Too few NASA tests of ${mat} to train a model (${env?.n || 0} test${env?.n === 1 ? '' : 's'}: ${env?.out || 0} went out). In Saffire VI, Nomex did not ignite near habitat air; silicone burned in Earth tests but not in microgravity. These stay labelled as data gaps.`
  else if (flow <= 2) story = 'Very slow air: the flame is close to starving. In microgravity this low-flow limit is where many flames go out, which Earth tests cannot show.'
  else if (flow >= 30) story = 'Fast air: strong flow can blow a flame off the material. Air speed is the input that moves this model the most.'
  else story = `Gentle air at ${flow} cm/s keeps the flame fed without blowing it out, so this is close to the riskiest air speed. More oxygen or more pressure can only raise the chance of burning in this model (a physics constraint).`
  return (
    <div className="split" style={{ display: 'grid', gridTemplateColumns: '330px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
      <aside className="card pad col" style={{ gap: 22, position: 'sticky', top: 90 }}>
        <div className="col" style={{ gap: 8 }}><span className="lab">Material</span>
          <div className="col" style={{ gap: 6 }}>{MATS.map(([k, n]) => <button key={k} type="button" onClick={() => setMat(k)} className="row" style={{ justifyContent: 'space-between', borderRadius: 6, padding: '9px 12px', fontSize: 13, cursor: 'pointer', border: `1px solid ${mat === k ? 'var(--text)' : 'var(--line2)'}`, background: mat === k ? 'var(--text)' : 'transparent', color: mat === k ? '#0A0B0D' : 'var(--text)' }}><span>{n}</span>{modelSolids.not_modelled.includes(k) && <span className="mono" style={{ fontSize: 10, opacity: .7 }}>no model</span>}</button>)}</div>
        </div>
        <LiveTag api={api} live={modelled ? live : null} />
        <Slider id="so2" label="Oxygen" val={o2} set={setO2} min={15} max={40} step={on ? 0.5 : 1} fmt={v => v + '%'} note={['15%', 'Earth 21%', '40%']} />
        <Pressure id="sp" live={on} max={1} val={p} set={setP} opts={[[0.5, '0.5 atm'], [0.69, '0.69 atm'], [1.0, '1 atm']]} />
        <Seg label="Air speed past the material" opts={FLOWS.map(f => [f, f + ' cm/s'])} val={flow} set={setFlow} />
      </aside>
      <div className="col" style={{ gap: 20, minWidth: 0 }}>
        <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)' }}>
          <Twin intensity={r ? 0.3 + 0.7 * r.p : 0.25} orbitSize={r ? 80 + 110 * r.p : 70} earthLabel="Buoyancy feeds the flame from below" orbitLabel={r ? `${pct(r.p)} chance it keeps burning` : 'Not modelled'} />
          <div className="col" style={{ gap: 12 }}>
            <Big label="Chance the flame keeps burning" value={r ? Math.round(r.p * 100) : '—'} unit={r ? '%' : ''} sub={r ? `range ${pct(r.lo)}–${pct(r.hi)} · bootstrap 10–90%` : 'too few NASA tests'} />
            {modelled
              ? <Range inside={inside} insideText={`Inside the tested range · ${env.tests} NASA tests of this material`} outsideText={`Outside the conditions NASA tested for this material (O₂ ${env.o2[0].toFixed(0)}–${env.o2[1].toFixed(0)}%, ${env.p[0].toFixed(2)}–${env.p[1].toFixed(2)} atm) · extrapolation`} />
              : <div className="row" style={{ padding: '12px 14px', fontSize: 13, gap: 10, border: '1px dashed var(--muted)', borderRadius: 12 }}><Ev kind="gap" small /> Data gap · not modelled</div>}
            <Bars title="What moves this model most" rows={[
              { k: 'Air speed', w: imp['Air speed'], v: imp['Air speed'].toFixed(3) },
              { k: 'Material', w: imp.Material, v: imp.Material.toFixed(3) },
              { k: 'Oxygen', w: imp.Oxygen, v: imp.Oxygen.toFixed(3) },
              { k: 'Shape', w: imp.Shape, v: imp.Shape.toFixed(3) },
              { k: 'Pressure', w: imp.Pressure, v: imp.Pressure.toFixed(3) },
            ]} note="Drop in ROC-AUC when each input is scrambled. Glass-box companion: +1% O₂ multiplies the odds of burning by 1.54." />
          </div>
        </div>
        {modelled && <div className="card" style={{ padding: '16px 10px 6px' }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', padding: '0 10px 8px', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Sweep one variable</span>
            <div className="seg">{[['flow', 'Air speed'], ['o2', 'Oxygen']].map(([k, n]) => <button key={k} type="button" className={sweep === k ? 'on' : ''} onClick={() => setSweep(k)}>{n}</button>)}</div>
          </div>
          {sweep === 'flow'
            ? <LineChart pts={curve} band x={flow} log xlabel="air speed (cm/s, log)" ylabel="chance of burning" marks={[1, 5, 20, 50]} />
            : <LineChart pts={curve} band x={o2} xlabel="oxygen (%)" ylabel="chance of burning" marks={[15, 21, 30, 40]} />}
          <div className="src" style={{ padding: '0 10px 8px' }}>Other inputs held at your settings · band = 10–90% bootstrap · {mat}</div>
        </div>}
        {modelled && <SolidShapley mat={mat} oG={oG} pG={pG} flow={flow} inside={inside} />}
        {modelled && <FlammabilityMap mat={mat} p={pG} o2={o2} flow={flow} />}
        <div className="grid2">
          <div className="card pad col" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><span className="lab">Flow regime at this air speed</span><div className="seg">{['Orbit', 'Moon', 'Mars', 'Earth'].map(k => <button key={k} type="button" className={grav === k ? 'on' : ''} onClick={() => setGrav(k)}>{k}</button>)}</div></div>
            <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
              <div><div className="lab">Buoyant speed</div><div className="mono" style={{ fontSize: 20 }}>{(ub * 100).toFixed(0)} cm/s</div></div>
              <div><div className="lab">Fan air speed</div><div className="mono" style={{ fontSize: 20 }}>{flow} cm/s</div></div>
              <div><div className="lab">Richardson Ri</div><div className="mono" style={{ fontSize: 20 }}>{gv === 0 ? '0' : Ri > 1000 ? '>1000' : Ri.toFixed(1)}</div></div>
            </div>
            <span style={{ fontSize: 14, lineHeight: 1.5 }}>{regime}</span>
            <span className="src"><Ev kind="physics" small /> Ri = (u_b/u)², u_b = √(g·ΔT/T·L), ΔT 905 K, L 5 cm. The model itself is trained on microgravity tests.</span>
          </div>
          <Story>{story}</Story>
        </div>
        {modelled && r && <FlameSim mode="solid" speed={4} build={(g, gl) => [
          { title: 'ISS cabin air · 21 % O₂, 1 atm, 0 g', gravity_label: '0 g', air: flow, p_burn: solidPredict(mat, 21, 1.0, flow)?.p ?? r.p, direction: modelSolids.shapes[mat]?.direction, spread: 2.2, t_end: 30, q: simShape(0, flow, 0.21, 1) },
          { title: `Your conditions · ${o2}% O₂, ${fp(p)} atm, ${gl.split(' (')[0]}`, gravity_label: gl, air: flow, p_burn: r.p, direction: modelSolids.shapes[mat]?.direction, spread: 2.2, t_end: 30, extra: g > 0 ? 'timing from microgravity data; shape from buoyancy' : '', q: simShape(g, flow, o2 / 100, p) }]} />}
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}><Ev kind="prediction" /><span className="src">{modelSolids.note}</span><Link to="/methods" className="mono" style={{ fontSize: 11, color: 'var(--plasma)' }}>How good is this model? →</Link></div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ spilled fuel (droplets) */
function DropLab() {
  const { mission } = useMission()
  const [fuel, setFuel] = useState('n-heptane')
  const [o2, setO2] = useState(Math.min(35, Math.round(mission.x_o2 * 100)))
  const [p, setP] = useState(near([0.5, 0.69, 1.0, 2.0], mission.p))
  const [co2, setCo2] = useState(0)
  const [he, setHe] = useState(0)
  const [d0, setD0] = useState(3)
  const api = useApi(), on = !!api
  const live = useLive('/api/predict/droplet', { fuel, o2, p, co2, he, d0 }, on)
  const L = live.data
  const pG = near(PG, p)
  const r = L ? { br: L.br, brSd: L.br_sd, ext: L.ext, extSd: L.ext_sd } : dropPredict(fuel, Math.round(o2), pG, co2, he, d0)
  const r0 = dropPredict(fuel, 21, 1.0, 0, 0, d0)
  const inside = L ? L.inside_tested_range : dropInside(fuel, o2, p, co2, he)
  const tb = Math.max(0, (d0 * d0 - r.ext * r.ext) / r.br)
  const tests = modelDroplets.tests.filter(t => t[0] === fuel && Math.abs(t[1] - o2) <= 2 && Math.abs(t[2] - p) <= 0.3 && Math.abs(t[3] - co2) <= 0.05 && Math.abs(t[4] - he) <= 0.1)
  const measK = tests.map(t => t[6]).filter(v => v > 0)
  const rel = modelDroplets.explain.input_relevance.burning_rate_mm2_s
  let curve = []
  if (L) curve = L.curve
  else for (let o = 15; o <= 35; o++) { const q = dropPredict(fuel, o, pG, co2, he, d0); if (q) curve.push({ x: o, y: q.br, lo: q.br - q.brSd, hi: q.br + q.brSd }) }
  const ymax = Math.max(1, ...curve.map(c => c.hi)) * 1.05
  const story = `${fuel === 'methanol' ? 'Methanol' : 'n-Heptane'} droplet, ${d0} mm across, at ${o2}% oxygen and ${fp(p)} atm${co2 || he ? ` with ${co2 ? Math.round(co2 * 100) + '% CO₂' : ''}${co2 && he ? ' and ' : ''}${he ? Math.round(he * 100) + '% helium' : ''} in the air` : ''}: it burns at ${r.br.toFixed(2)} mm²/s, ${r.br > r0.br ? Math.round((r.br / r0.br - 1) * 100) + '% faster' : Math.round((1 - r.br / r0.br) * 100) + '% slower'} than in Earth air. ${co2 || he ? 'CO₂ and helium were tested by FLEX as fire suppressants: they slow the burning down.' : ''} ${o2 > 25 && (co2 || he) ? 'NASA only tested suppressants up to 25% O₂, so this combination is outside the data.' : ''}`
  return (
    <div className="split" style={{ display: 'grid', gridTemplateColumns: '330px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
      <aside className="card pad col" style={{ gap: 20, position: 'sticky', top: 90 }}>
        <Seg label="Spilled fuel" opts={[['n-heptane', 'n-Heptane'], ['methanol', 'Methanol']]} val={fuel} set={setFuel} />
        <LiveTag api={api} live={live} />
        <Slider id="do2" label="Oxygen" val={o2} set={setO2} min={15} max={35} step={on ? 0.5 : 1} fmt={v => v + '%'} note={['15%', 'Earth 21%', '35%']} />
        <Pressure id="dp" live={on} val={p} set={setP} opts={[[0.5, '0.5 atm'], [0.69, '0.69 atm'], [1.0, '1 atm'], [2.0, '2 atm']]} />
        <Seg label="CO₂ added (suppressant)" opts={[[0, '0%'], [0.1, '10%'], [0.2, '20%']]} val={co2} set={setCo2} />
        <Seg label="Helium added (suppressant)" opts={[[0, '0%'], [0.2, '20%'], [0.4, '40%']]} val={he} set={setHe} />
        <Seg label="Droplet size at ignition" opts={[[2, '2 mm'], [3, '3 mm'], [4, '4 mm']]} val={d0} set={setD0} />
      </aside>
      <div className="col" style={{ gap: 20, minWidth: 0 }}>
        <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)' }}>
          <Twin intensity={Math.min(1, .4 + r.br)} orbitSize={60 + d0 * 22} earthLabel="Gravity pulls hot gas up: a teardrop" orbitLabel={`A steady ball around a ${d0} mm drop`} />
          <div className="col" style={{ gap: 12 }}>
            <div className="grid2" style={{ gap: 12 }}>
              <Big label="Burning rate" value={r.br.toFixed(2)} unit=" mm²/s" sub={`± ${r.brSd.toFixed(2)} · Earth air ${r0.br.toFixed(2)}`} />
              <Big label="Flame goes out at" value={r.ext.toFixed(2)} unit=" mm" sub={`± ${r.extSd.toFixed(2)} droplet size`} />
            </div>
            <Big label="Burns for about (d²-law)" value={tb.toFixed(1)} unit=" s" sub={`t = (d₀² − d_out²) / K · checked on ${d2Check.n} FLEX burns: R² ${d2Check.r2.toFixed(3)}, typical error ${d2Check.median_abs_err_s.toFixed(1)} s`} />
            <Range inside={inside} insideText={`Inside the tested range · ${tests.length} FLEX droplet${tests.length === 1 ? '' : 's'} nearby${measK.length ? ` (measured K ${Math.min(...measK).toFixed(2)}–${Math.max(...measK).toFixed(2)})` : ''}`} outsideText="Outside the conditions FLEX tested · extrapolation" />
          </div>
        </div>
        <div className="grid2">
          <div className="card" style={{ padding: '16px 10px 6px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, padding: '0 10px 8px' }}>Sweep: burning rate across oxygen</div>
            <LineChart pts={curve} band x={o2} xlabel="oxygen (%)" ylabel="burning rate" ymax={ymax} yfmt={v => v.toFixed(2)} marks={[15, 21, 28, 35]} />
            <div className="src" style={{ padding: '0 10px 8px' }}>mm²/s · band = ± 1 standard deviation</div>
          </div>
          <Bars title="What the model listens to (burning rate)" rows={Object.entries(rel).map(([k, v]) => ({ k, w: v, v: v.toFixed(2) }))} note="Share of the Gaussian process length-scales across the physical inputs." />
        </div>
        <ShapleyWaterfall title="Why this burning rate instead of Earth air?"
          sh={exactShapley(pt => dropPredict(fuel, pt.o2, pt.p, pt.co2, pt.he, d0)?.br, { o2: Math.round(o2), p: pG, co2, he }, { o2: 21, p: 1.0, co2: 0, he: 0 },
            co2 || he ? { Oxygen: ['o2'], Pressure: ['p'], Suppressant: ['co2', 'he'] } : { Oxygen: ['o2'], Pressure: ['p'] })}
          baseLabel="Earth air (21%, 1 atm)" totalLabel="Your air" fmt={v => v.toFixed(2) + ' mm²/s'}
          note={`Exact Shapley values against Earth air with no suppressant, same fuel and ${d0} mm droplet. Computed from the precomputed Gaussian-process grid (oxygen rounded to 1%).`} />
        <Story>{story}</Story>
        <FlameSim mode="droplet" speed={2} build={(g, gl) => [
          { title: `ISS cabin air · 21 % O₂, 1 atm, 0 g · ${fuel}`, gravity_label: '0 g', air: 0, d0, K: r0.br, dext: Math.min(r0.ext, d0), t_end: Math.max(0, (d0 * d0 - Math.min(r0.ext, d0) ** 2) / r0.br), standoff: 6, q: simShape(0, 0, 0.21, 1, fuel !== 'methanol') },
          { title: `Your conditions · ${o2}% O₂, ${fp(p)} atm, ${gl.split(' (')[0]} · ${fuel}`, gravity_label: gl, air: 0, d0, K: r.br, dext: Math.min(r.ext, d0), t_end: tb, standoff: 6 * Math.pow(21 / o2, 0.7), extra: g > 0 ? 'timing from microgravity data; shape from buoyancy' : '', q: simShape(g, 0, o2 / 100, p, fuel !== 'methanol') }]} />
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}><Ev kind="prediction" /><span className="src">{modelDroplets.note}</span><Link to="/methods" className="mono" style={{ fontSize: 11, color: 'var(--plasma)' }}>How good is this model? →</Link></div>
      </div>
    </div>
  )
}

export default function FireLab() {
  const [mode, setMode] = useState('gas')
  return (<>
    <LessonHeader k={4} />
    <main className="wrap" style={{ paddingTop: 36 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', marginBottom: 24 }}>
        <div className="col" style={{ gap: 12 }}>
          <div className="eyebrow ember">Step 5 · Fire Lab · every number comes from models trained on NASA tests</div>
          <h1 className="h1" style={{ fontSize: 'clamp(36px, 5vw, 54px)' }}>Light a flame. Change the air.</h1>
        </div>
        <Link to="/explore" className="btn primary">Done · explore the full archive →</Link>
      </div>
      <div role="tablist" aria-label="What is burning" className="row" style={{ gap: 0, borderBottom: '1px solid var(--line)', marginBottom: 24, flexWrap: 'wrap' }}>
        {[['gas', 'Gas leak', 'ACME CFI-G · 132 flames'], ['solid', 'Cabin material', 'BASS, BASS-II, Saffire · 212 tests'], ['drop', 'Spilled fuel', 'FLEX · 265 droplets']].map(([k, n, s]) => (
          <button key={k} role="tab" aria-selected={mode === k} type="button" onClick={() => setMode(k)} style={{ background: 'transparent', border: 0, borderBottom: `2px solid ${mode === k ? 'var(--ember)' : 'transparent'}`, padding: '12px 20px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: mode === k ? 'var(--text)' : 'var(--muted)' }}>{n}</span><span className="mono faint" style={{ fontSize: 11 }}>{s}</span>
          </button>))}
      </div>
      {mode === 'gas' && <GasLab />}
      {mode === 'solid' && <SolidsLab />}
      {mode === 'drop' && <DropLab />}
    </main>
    <div style={{ height: 56 }} />
  </>)
}
