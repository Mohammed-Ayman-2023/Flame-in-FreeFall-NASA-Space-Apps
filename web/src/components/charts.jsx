import { coverage, gasFlames, modelGas } from '../lib/data'

const ax = { fill: '#868B93', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }

/** Still-air burn time vs oxygen: every ACME CFI-G flame, optional model curve and marker. */
export function BurnChart({ curve, marker, pressure, w = 900, h = 380, onlyNear }) {
  const L = 60, R = 18, T = 20, B = 44
  const X = o => L + (o - 16) / (42 - 16) * (w - L - R)
  const Y = s => T + (1 - Math.log10(Math.max(s, 1)) / Math.log10(400)) * (h - T - B)
  const pts = gasFlames.filter(f => !onlyNear || Math.abs(f[1] - pressure) <= 0.12)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Still-air burn time of NASA ACME CFI-G gas flames against oxygen. Below 25 percent oxygen every flame went out within seconds; above 33 percent many burned until the fuel was cut." style={{ display: 'block' }}>
      <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#33373F" strokeWidth="2" /></pattern></defs>
      <rect x={X(modelGas.gap[0])} y={T} width={X(modelGas.gap[1]) - X(modelGas.gap[0])} height={h - T - B} fill="url(#hatch)" opacity=".7" />
      <text x={(X(modelGas.gap[0]) + X(modelGas.gap[1])) / 2} y={T + 16} textAnchor="middle" {...ax} fill="#A6AAB1">NO NASA TESTS</text>
      {[1, 10, 100].map(s => <g key={s}><line x1={L} x2={w - R} y1={Y(s)} y2={Y(s)} stroke="#252930" /><text x={L - 8} y={Y(s) + 4} textAnchor="end" {...ax}>{s} s</text></g>)}
      {[18, 22, 26, 30, 34, 38, 42].map(o => <text key={o} x={X(o)} y={h - B + 20} textAnchor="middle" {...ax}>{o}%</text>)}
      <text x={w - R} y={h - 6} textAnchor="end" {...ax}>OXYGEN →</text>
      {pts.map((f, i) => f[3] === 1
        ? <circle key={i} cx={X(f[0] + ((i * 37) % 11 - 5) * 0.05)} cy={Y(f[2])} r="3.8" fill="#7DB4FF" fillOpacity=".8" />
        : <circle key={i} cx={X(f[0] + ((i * 37) % 11 - 5) * 0.05)} cy={Y(f[2])} r="4.3" fill="none" stroke="#FF7A3D" strokeWidth="1.6" />)}
      {curve && <polyline points={curve.map(c => `${X(c.o2)},${Y(c.median)}`).join(' ')} fill="none" stroke="#EEECE7" strokeWidth="2" />}
      {marker && <>
        <line x1={X(marker.o2)} x2={X(marker.o2)} y1={T} y2={h - B} stroke="#FF7A3D" strokeDasharray="3 4" />
        <circle cx={X(marker.o2)} cy={Y(marker.median)} r="7" fill="#FF7A3D" stroke="#0A0B0D" strokeWidth="2" />
      </>}
    </svg>
  )
}

const FAMCOL = { solid: '#D6CFC0', droplet: '#7DB4FF', gas: '#9AA0FF', smoke: '#C8CCD2', other: '#868B93' }
/** Every NASA test on oxygen × pressure, with the mission air as a target. */
export function CoverageMap({ target, w = 1000, h = 520 }) {
  const L = 64, R = 24, T = 26, B = 50
  const X = o => L + (o - 8) / (44 - 8) * (w - L - R)
  const lp0 = Math.log10(0.4), lp1 = Math.log10(6)
  const Y = p => T + (1 - (Math.log10(p) - lp0) / (lp1 - lp0)) * (h - T - B)
  const agg = {}
  coverage.forEach(([inv, fam, o, p, n]) => { const k = `${fam}|${Math.round(o)}|${p}`; agg[k] = (agg[k] || 0) + n })
  const tx = target ? X(target.x_o2 * 100) : 0, ty = target ? Y(target.p) : 0
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Map of NASA microgravity combustion tests by oxygen and pressure, with the chosen mission air marked." style={{ display: 'block' }}>
      {[0.5, 0.7, 1, 2, 3, 5].map(p => <g key={p}><line x1={L} x2={w - R} y1={Y(p)} y2={Y(p)} stroke="#252930" /><text x={L - 10} y={Y(p) + 4} textAnchor="end" {...ax}>{p}</text></g>)}
      {[10, 15, 20, 25, 30, 35, 40].map(o => <text key={o} x={X(o)} y={h - B + 22} textAnchor="middle" {...ax}>{o}%</text>)}
      <text x={L} y={T - 8} {...ax}>PRESSURE (atm, log)</text><text x={w - R} y={h - 8} textAnchor="end" {...ax}>OXYGEN →</text>
      {target && <rect x={X(target.x_o2 * 100 - 5)} y={Y(target.p + 0.2)} width={X(target.x_o2 * 100 + 5) - X(target.x_o2 * 100 - 5)} height={Y(Math.max(target.p - 0.2, 0.42)) - Y(target.p + 0.2)} fill="rgba(255,122,61,.1)" stroke="#FF7A3D" strokeDasharray="4 4" />}
      {Object.entries(agg).map(([k, n]) => {
        const [fam, o, p] = k.split('|'); const r = 2.5 + Math.sqrt(n) * 1.1, cx = X(+o), cy = Y(Math.min(+p, 5.8)), c = FAMCOL[fam]
        if (fam === 'solid') return <rect key={k} x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill={c} fillOpacity=".5" stroke={c} />
        if (fam === 'gas') return <path key={k} d={`M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`} fill={c} fillOpacity=".4" stroke={c} />
        if (fam === 'smoke') return <path key={k} d={`M${cx} ${cy - r}L${cx + r} ${cy + r * .8}L${cx - r} ${cy + r * .8}Z`} fill="none" stroke={c} />
        return <circle key={k} cx={cx} cy={cy} r={r} fill={c} fillOpacity=".45" stroke={c} />
      })}
      {target && <g><circle cx={tx} cy={ty} r="7" fill="none" stroke="#FF7A3D" strokeWidth="2" /><line x1={tx - 14} x2={tx + 14} y1={ty} y2={ty} stroke="#FF7A3D" /><line x1={tx} x2={tx} y1={ty - 14} y2={ty + 14} stroke="#FF7A3D" /></g>}
    </svg>
  )
}

export function CoverageLegend() {
  const it = (shape, t) => <span className="row mono" style={{ gap: 8, fontSize: 12, color: 'var(--muted)' }}>{shape}{t}</span>
  return (
    <div className="wrap-row" style={{ gap: 18 }}>
      {it(<span style={{ width: 10, height: 10, background: '#D6CFC0', opacity: .8 }} />, 'Burning solids')}
      {it(<span style={{ width: 10, height: 10, borderRadius: '50%', background: '#7DB4FF', opacity: .8 }} />, 'Fuel droplets')}
      {it(<span style={{ width: 10, height: 10, background: '#9AA0FF', transform: 'rotate(45deg)', opacity: .8 }} />, 'Gas flames')}
      {it(<svg width="12" height="12" aria-hidden="true"><path d="M6 1 L11 10 L1 10 Z" fill="none" stroke="#C8CCD2" /></svg>, 'Smoke')}
      {it(<span style={{ width: 14, height: 10, border: '1px dashed #FF7A3D', background: 'rgba(255,122,61,.1)' }} />, 'Within ±5% O₂, ±0.2 atm of your mission air')}
    </div>
  )
}
