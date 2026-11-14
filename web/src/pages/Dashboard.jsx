// Dashboard features brought to the website: Key findings, the adjustable Ranking, Ask the archive (cited search and
// the team's Gemini RAG), model explanations, data and sources, and the downloadable crew briefing.
// Every number comes from the files exported by scripts/export_web.py and scripts/export_web_extras.py,
// computed with the same code as the Streamlit dashboard (app/streamlit_app.py).
import { Fragment, useMemo, useState } from 'react'
import { Nav, Footer, PageHead, Ev, pct } from '../components/ui'
import { Link } from '../lib/router'
import { useMission } from '../lib/mission'
import { useApi, post } from '../lib/api'
import { BurnChart } from '../components/charts'
import { AirQualityChart } from './Evidence'
import { useIndex } from '../components/Chat'
import { rankings, takeaways, corpus, gasPredict, gasCurve, modelGas, modelSolids, modelDroplets, airQuality, atmospheres, methods } from '../lib/data'
import closestTests from '../data/closest_tests.json'
import missionGaps from '../data/mission_gaps.json'
import findings from '../data/findings.json'
import sources from '../data/sources.json'
import bass2 from '../data/bass2_gas.json'
import ragPrompt from '../data/rag_prompt.json'
import { KEY_STORE, geminiAnswer, MiniMarkdown } from '../lib/rag'

const ax = { fill: '#868B93', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }
const BADGE = { measured: 'measurement', model: 'prediction', gap: 'gap', literature: 'literature' }
const near = (arr, v) => arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))
const REPO = 'https://github.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps'
const RAW = 'https://raw.githubusercontent.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps/main/'

function download(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
const csvCell = v => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const toCSV = (cols, rows) => [cols.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n')
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function Kpi({ n, kind, children }) {
  return <div className="card pad col" style={{ gap: 8 }}><span className="h1" style={{ fontSize: 40, color: 'var(--ember)' }}>{n}</span><Ev kind={kind} small /><span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{children}</span></div>
}

/* ================================================================== KEY FINDINGS */
export function Findings() {
  const { mission } = useMission()
  const o2 = Math.min(40, Math.max(18, Math.round(mission.x_o2 * 100))), pG = near([0.5, 0.69, 1.0, 2.0], mission.p)
  const h = gasPredict('propane', o2, pG), e = gasPredict('propane', 21, 1.0)
  const nr = findings.near[mission.id]
  const maxCo2 = Math.max(...findings.saffire_co2.map(r => r[1]))
  const ducts = ['Saffire I-III (51 cm duct)', 'Saffire IV (30.5 cm duct)', 'BASS (7.6 cm duct)']
  const top = airQuality.ranking[0], sibal = airQuality.ranking.find(r => r.family.startsWith('SIBAL'))
  return (<>
    <Nav active="Findings" />
    <main className="wrap col" style={{ paddingTop: 48, paddingBottom: 60, gap: 56 }}>
      <PageHead eyebrow={`Key findings · recomputed for ${mission.name} (${mission.air})`} title="What NASA's fire data already show.">
        <p className="p" style={{ fontSize: 16, maxWidth: 760 }}>Change the mission air in the top bar and every number on this page updates.</p>
      </PageHead>
      <div className="grid3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Kpi n={`${(h.median / e.median).toFixed(1)}×`} kind="prediction">longer still-air burn for a gas flame here ({h.median.toFixed(0)} s) than in Earth cabin air ({e.median.toFixed(1)} s)</Kpi>
        <Kpi n={pct(h.s30)} kind="prediction">of flames predicted still burning after 30 s with no air flow (Earth air: {pct(e.s30)})</Kpi>
        <Kpi n={nr.smoke} kind={nr.smoke ? 'measurement' : 'gap'}>smoke and soot tests within ±5 % O₂ and ±0.2 atm of this air (all ran at 21 % O₂, 1 atm)</Kpi>
        <Kpi n={nr.solids} kind={nr.solids ? 'measurement' : 'gap'}>solid-fuel burns within ±5 % O₂ and ±0.2 atm of this air, {nr.solids_psi} of them in PSI</Kpi>
      </div>

      <section className="col" style={{ gap: 14 }}>
        <h2 className="h2" style={{ fontSize: 30 }}>1 · Cutting the ventilation may not put out a fire in an oxygen-rich habitat</h2>
        <p className="p" style={{ maxWidth: 860 }}>Stopping air flow is a standard first step against a spacecraft fire: without flow, a microgravity flame starves. <b>ACME CFI-G</b> gas flames in still air did go out on their own at ≤ 25 % O₂, within seconds. At 33-40 % O₂ they kept burning, and 30 of 91 were still alight when the crew cut the fuel. <b>ACME BRE</b> reports the same for emulated burning solids.</p>
        <div className="card" style={{ padding: '18px 10px 8px' }}><BurnChart curve={gasCurve('propane', pG)} marker={{ o2, median: h.median }} pressure={pG} /></div>
        <div className="wrap-row" style={{ gap: 18, alignItems: 'center' }}><span className="row" style={{ gap: 6, fontSize: 13 }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: '#7DB4FF' }} />went out by itself</span><span className="row" style={{ gap: 6, fontSize: 13 }}><i style={{ width: 9, height: 9, borderRadius: '50%', border: '1.6px solid #FF7A3D' }} />still burning when fuel was cut (a minimum)</span><span className="row" style={{ gap: 6, fontSize: 13 }}><i style={{ width: 16, height: 2, background: '#EEECE7' }} />model median, propane at {pG} atm</span><span className="row" style={{ gap: 6, fontSize: 13 }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF7A3D' }} />your air</span></div>
        <span className="src">179 ACME CFI-G tests (PSI-159), ethane / propane / n-butane on a spherical porous burner, 0.5-3 atm. Model: Weibull survival model, leave-one-ISS-day-out concordance {methods.metrics.D_gas_flames.concordance_leave_one_day_out}.</span>
      </section>

      <div className="grid2" style={{ gap: 32 }}>
        <section className="col" style={{ gap: 12, minWidth: 0 }}>
          <h2 className="h2" style={{ fontSize: 24 }}>2 · Cabin materials still burn near habitat air</h2>
          <p className="p">Saffire V and VI burned large samples on Cygnus at <b>26-31 % O₂ and 0.53-0.70 atm</b>: fabric, cotton and plastic burned, Nomex did not ignite (Saffire IV-1 in cabin air shown for comparison). Thick plastic (PMMA) released far more CO₂ than fabric.</p>
          <div className="card" style={{ padding: '14px 10px' }}>
            <svg viewBox={`0 0 560 ${findings.saffire_co2.length * 40 + 30}`} width="100%" role="img" aria-label="Cabin CO2 increase by Saffire burn: PMMA burns raised CO2 far more than fabric burns.">
              {findings.saffire_co2.map(([lab, v], i) => { const w = v / maxCo2 * 250; const pm = lab.includes('PMMA'); return <g key={lab}>
                <text x="190" y={i * 40 + 24} textAnchor="end" fill="#D7D9DD" fontSize="12.5">{lab}</text>
                <rect x="200" y={i * 40 + 10} width={w} height="20" rx="3" fill={pm ? '#FF7A3D' : '#7DB4FF'} />
                <text x={208 + w} y={i * 40 + 24} {...ax} fill="#D7D9DD">+{Math.round(v).toLocaleString()} ppm</text></g> })}
              <text x="550" y={findings.saffire_co2.length * 40 + 22} textAnchor="end" {...ax}>CABIN CO₂ INCREASE (PPM) →</text>
            </svg>
          </div>
          <span className="src"><Ev kind="literature" small /> {findings.saffire_source}. Orange: PMMA. Nomex (VI-1) did not ignite.</span>
        </section>
        <section className="col" style={{ gap: 12, minWidth: 0 }}>
          <h2 className="h2" style={{ fontSize: 24 }}>3 · The enclosure changes how fast fire spreads</h2>
          <p className="p">The same cotton-fiberglass fabric, in nearly the same air, spread at <b>1.8 to 5.1 mm/s</b> depending on the duct around it. Habitat fire risk depends on room geometry, not only on the atmosphere.</p>
          <div className="card" style={{ padding: '14px 10px' }}>
            <svg viewBox="0 0 560 250" width="100%" role="img" aria-label="Flame spread rate by duct size: faster in the smallest duct.">
              {[0, 1, 2, 3, 4, 5, 6].map(v => <g key={v}><line x1="50" x2="550" y1={220 - v * 33} y2={220 - v * 33} stroke="#252930" /><text x="42" y={224 - v * 33} textAnchor="end" {...ax}>{v}</text></g>)}
              {ducts.map((d, i) => { const x = 130 + i * 170; return <g key={d}>
                <text x={x} y="242" textAnchor="middle" {...ax} fill="#D7D9DD">{d.replace(' duct)', ')')}</text>
                {findings.spread.filter(s => s[0] === d).map((s, k) => <circle key={k} cx={x + ((k * 7) % 5 - 2) * 6} cy={220 - s[2] * 33} r="7" fill={['#7DB4FF', '#FF7A3D', '#9AD9C9'][i]} stroke="#0A0B0D" strokeWidth="1.5"><title>{`${s[1]}: ${s[2]} mm/s at ${s[3]} cm/s, ${s[4]} % O2`}</title></circle>)}</g> })}
              <text x="12" y="14" {...ax}>SPREAD RATE (MM/S)</text>
            </svg>
          </div>
          <span className="src"><Ev kind="measurement" small /> {findings.spread_source}.</span>
        </section>
      </div>

      <section className="col" style={{ gap: 10 }}>
        <h2 className="h2" style={{ fontSize: 24 }}>4 · Smoke detection has never been tested at habitat conditions</h2>
        <p className="p" style={{ maxWidth: 860 }}><Ev kind="gap" small /> SAME and SAME-R measured how microgravity smoke can fool detectors; SPICE measured when flames start releasing soot. Together: <b>86 smoke tests and 469 soot-point settings, all at 21 % O₂ and 1 atm</b>. Near {mission.air}: {nr.smoke} tests. <Link to="/equipment" style={{ color: 'var(--plasma)' }}>How long smoke takes to reach a detector →</Link></p>
      </section>

      <section className="col" style={{ gap: 12 }}>
        <h2 className="h2" style={{ fontSize: 24 }}>5 · Which cabin materials foul the air most when they burn?</h2>
        <p className="p" style={{ maxWidth: 860 }}><Ev kind="measurement" small /> BASS-II measured O₂, CO₂ and CO before and after each of its {airQuality.n_burns} ISS burns. <b>Thick acrylic (PMMA) slabs raised CO the most: a median {top.co_rise_median.toFixed(0)} ppm per burn</b>, against {sibal.co_rise_median.toFixed(0)} ppm for cotton-fiberglass fabric; Nomex produced none.</p>
        <div className="card" style={{ padding: '18px 10px 8px' }}><AirQualityChart /></div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}><span className="src" style={{ flex: 1, minWidth: 260 }}>{airQuality.note} Source: BASS-II test matrix (PSI-25).</span>
          <button type="button" className="btn sm" onClick={() => download('bass2_gas_readings.csv', toCSV(bass2.columns, bass2.rows))}>Download the BASS-II gas readings (CSV)</button></div>
      </section>
    </main>
    <Footer />
  </>)
}

/* ================================================================== RANKING */
const PARTS = [['atmosphere', 'Atmosphere match', 'How close its tests come to the mission O₂ and pressure'], ['fire_type', 'Fire-type importance', 'Solids and smoke first, then droplets, then gas flames'], ['data', 'Data quality', 'Per-test outcomes > partial > conditions only > catalog only'], ['volume', 'Number of tests', 'More tests, more weight (log scale)']]
const DEFAULT_W = { atmosphere: 0.40, fire_type: 0.25, data: 0.25, volume: 0.10 }

export function Ranking() {
  const { mission } = useMission()
  const [w, setW] = useState(DEFAULT_W)
  const [open, setOpen] = useState(null)
  const sumW = Object.values(w).reduce((a, b) => a + b, 0) || 1
  const rows = useMemo(() => rankings[mission.id].map(r => ({ ...r, rel: 100 * PARTS.reduce((s, [k]) => s + w[k] * r['score_' + k], 0) / sumW }))
    .sort((a, b) => b.rel - a.rel).map((r, i) => ({ ...r, rk: i + 1 })), [mission.id, w, sumW])
  const ct = closestTests[mission.id]
  return (<>
    <Nav active="Ranking" />
    <main className="wrap col" style={{ paddingTop: 48, paddingBottom: 60, gap: 40 }}>
      <PageHead eyebrow={`Ranking · ${mission.name} · ${mission.air}`} title="Which investigations matter most for this air?"
        right={<button type="button" className="btn" onClick={() => download(`ranking_${mission.id}.csv`, toCSV(['rank', 'psi_id', 'investigation', 'fire_type', 'relevance', 'tests_near_mission', 'tests', 'closest_condition', 'data_level', 'why'], rows.map(r => [r.rk, r.psi_id, r.acronym, r.fire_type, r.rel.toFixed(1), r.n_near_mission, r.n_tests, r.closest_condition, r.data_level, r.why])))}>Download this ranking (CSV)</button>}>
        <p className="p" style={{ fontSize: 16, maxWidth: 800 }}>A transparent score, not a black box: four parts between 0 and 1, weighted. Change the mission air in the top bar or the weights below; the order updates instantly. Open a row to see its parts.</p>
      </PageHead>
      <div className="card pad col" style={{ gap: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}><span className="lab">Scoring weights</span><button type="button" className="btn sm" onClick={() => setW(DEFAULT_W)}>Reset to default (0.40 · 0.25 · 0.25 · 0.10)</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 22 }}>
          {PARTS.map(([k, lab, help]) => (
            <label key={k} htmlFor={'w-' + k} className="col" style={{ gap: 8 }}>
              <span className="row" style={{ justifyContent: 'space-between' }}><span className="lab">{lab}</span><span className="mono" style={{ color: 'var(--ember)' }}>{w[k].toFixed(2)}</span></span>
              <input id={'w-' + k} type="range" min="0" max="1" step="0.05" value={w[k]} onChange={e => setW({ ...w, [k]: +e.target.value })} />
              <span className="faint" style={{ fontSize: 12 }}>{help}</span>
            </label>))}
        </div>
      </div>
      <div className="card scroll-x"><table className="tbl" style={{ minWidth: 1240 }}>
        <thead><tr><th>#</th><th>Investigation</th><th>Fire type</th><th style={{ width: 170 }}>Relevance</th><th>Tests near mission</th><th>Closest tested condition</th><th>Data available</th><th>Why</th></tr></thead>
        <tbody>{rows.map(r => (<Fragment key={r.psi_id}>
          <tr onClick={() => setOpen(open === r.psi_id ? null : r.psi_id)} style={{ cursor: 'pointer' }} aria-expanded={open === r.psi_id}>
            <td className="mono faint">{r.rk}</td>
            <td><Link to={'/investigation/' + r.psi_id} onClick={e => e.stopPropagation()} style={{ fontWeight: 600 }}>{r.acronym}</Link><div className="mono faint" style={{ fontSize: 11 }}>{r.psi_id}</div></td>
            <td className="muted" style={{ fontSize: 13 }}>{r.fire_type}</td>
            <td><div className="row" style={{ gap: 10 }}><div className="bar" style={{ flex: 1 }}><span style={{ width: r.rel + '%' }} /></div><span className="mono" style={{ color: 'var(--ember)', width: 34, textAlign: 'right' }}>{r.rel.toFixed(0)}</span></div></td>
            <td className="mono">{r.n_near_mission} / {r.n_tests}</td>
            <td className="mono" style={{ fontSize: 12.5 }}>{r.closest_condition}</td>
            <td className="muted" style={{ fontSize: 13 }}>{r.data_level}</td>
            <td className="muted" style={{ fontSize: 12.5, minWidth: 320 }}>{r.why}</td>
          </tr>
          {open === r.psi_id && <tr><td /><td colSpan={7}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, padding: '4px 0 8px' }}>
            {PARTS.map(([k, lab]) => <div key={k} className="col" style={{ gap: 6 }}><span className="lab">{lab} · weight {w[k].toFixed(2)}</span><div className="row" style={{ gap: 8 }}><div className="bar" style={{ flex: 1 }}><span style={{ width: r['score_' + k] * 100 + '%', background: 'var(--plasma)' }} /></div><span className="mono" style={{ fontSize: 12 }}>{r['score_' + k].toFixed(2)}</span></div><span className="faint" style={{ fontSize: 12 }}>adds {(100 * w[k] * r['score_' + k] / sumW).toFixed(1)} points</span></div>)}
          </div></td></tr>}
        </Fragment>))}</tbody>
      </table></div>
      <span className="src">Relevance = 100 × Σ weight × part ÷ Σ weights (src/fif/ranking.py). EXT-SAFFIRE-456 is NASA literature (NTRS 20240002981), not a PSI dataset. BRE pressures come from the atmospheres named in its objectives. Catalog-only investigations are scored from their published ranges.</span>
      <section className="col" style={{ gap: 14 }}>
        <h2 className="h2" style={{ fontSize: 26 }}>The real tests closest to this mission air</h2>
        <div className="card scroll-x"><table className="tbl" style={{ minWidth: 980 }}>
          <thead><tr><th>Investigation</th><th>Test</th><th>Fuel</th><th>O₂</th><th>Pressure</th><th>Pressure source</th><th>Air speed</th><th>What happened</th><th style={{ width: 130 }}>Closeness</th></tr></thead>
          <tbody>{ct.map(t => <tr key={t.test_id}>
            <td><Link to={'/investigation/' + t.investigation_id} className="mono" style={{ fontSize: 12.5 }}>{t.investigation_id}</Link></td><td className="mono" style={{ fontSize: 12.5 }}>{t.test_id}</td><td>{t.fuel}</td>
            <td className="mono">{(t.x_o2 * 100).toFixed(1)}%</td><td className="mono">{t.pressure_atm?.toFixed(2)} atm</td><td className="faint" style={{ fontSize: 12.5 }}>{t.pressure_note}</td>
            <td className="mono">{t.flow_cm_s != null ? t.flow_cm_s + ' cm/s' : '—'}</td><td className="muted" style={{ fontSize: 13 }}>{t.outcome_note || '—'}</td>
            <td><div className="row" style={{ gap: 8 }}><div className="bar" style={{ flex: 1 }}><span style={{ width: t.proximity * 100 + '%', background: 'var(--plasma)' }} /></div><span className="mono" style={{ fontSize: 12 }}>{t.proximity.toFixed(2)}</span></div></td></tr>)}</tbody>
        </table></div>
        <span className="src">Closeness = exp(−d²/2), with d measured in units of 5 % O₂ and 0.25 atm (src/fif/ranking.py, closest_tests).</span>
      </section>
    </main>
    <Footer />
  </>)
}

/* ================================================================== mission gaps (Gaps page) */
export function MissionGaps() {
  const { mission } = useMission()
  const g = missionGaps[mission.id]
  const tone = s => (s.startsWith('GAP') ? ['var(--ember)', 'gap'] : s.startsWith('thin') ? ['#E8C15A', 'thin'] : ['var(--good)', 'covered'])
  return (
    <div className="card pad col" style={{ gap: 4 }}>
      <div className="lab" style={{ marginBottom: 8 }}>What has been tested near {mission.air}? (within ±5 % O₂ and ±0.2 atm)</div>
      {[...g, { fire_type: 'Moon and Mars gravity (0.16 g, 0.38 g)', status: 'GAP: never tested', tests_near_mission: 0, tests_total: 0, o2_range: '', pressure_range: '', closest_test: 'no PSI combustion test at partial gravity' }].map(r => {
        const [c, k] = tone(r.status)
        return <div key={r.fire_type} className="rule" style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', gap: 16, padding: '12px 0', alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 11, color: c, border: `1px solid ${c}`, borderRadius: 4, padding: '3px 7px', justifySelf: 'start', textTransform: 'uppercase' }}>{k}</span>
          <span style={{ fontSize: 14.5, lineHeight: 1.55 }}><b>{r.fire_type}</b>: {r.tests_total ? `${r.tests_near_mission} of ${r.tests_total} tests near this air · tested ${r.o2_range}, ${r.pressure_range} · closest ${r.closest_test}` : r.closest_test}{r.status.includes('(') ? <span className="faint"> · {r.status.slice(r.status.indexOf('('))}</span> : null}</span>
        </div>
      })}
    </div>
  )
}

/* ================================================================== ASK THE ARCHIVE */
const EXAMPLES = ['Will a fire go out if we stop the fans at 34 % oxygen?', 'Do smoke detectors work in a lunar habitat?', 'Which materials still burn in oxygen-rich air?', 'How do we put out a fire with CO2 or helium?', 'What about Moon or Mars gravity?', 'Why does fire spread faster in small spaces?']
export function Ask() {
  const { mission } = useMission()
  const api = useApi()
  const docs = useMemo(() => [...corpus, ...(takeaways[mission.id] || []).map(t => ({ title: t.title, text: `${t.text} ${t.action}${t.caveat ? ` (${t.caveat})` : ''}`, source: t.source, badge: t.badge, kind: `Finding for ${mission.name}` }))], [mission.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const search = useIndex(docs, 4)
  const [q, setQ] = useState(EXAMPLES[0])
  const hits = useMemo(() => (q.trim() ? search(q) : []), [q, search])
  const [key, setKey] = useState(() => { try { return sessionStorage.getItem(KEY_STORE) || '' } catch { return '' } })
  const [remember, setRemember] = useState(true)
  const [ai, setAi] = useState(null)
  const [busy, setBusy] = useState(false)
  const serverAI = !!(api && api.ai_answers && api.ai_answers.available)

  async function askAI() {
    setBusy(true); setAi(null)
    try {
      if (serverAI) {
        const r = await post('/api/ask', { question: q })
        if (r.mode === 'ai' && r.answer) { setAi({ answer: r.answer, docs: (r.rag_sources || []).map(d => ({ h: [d.section || ''], text: d.text })), via: 'server', model: r.model || ragPrompt.model }); return }
      }
      if (!key.trim()) { setAi({ error: 'Add a Gemini API key below to get an AI answer on this site.' }); return }
      try { remember ? sessionStorage.setItem(KEY_STORE, key.trim()) : sessionStorage.removeItem(KEY_STORE) } catch { /* private mode */ }
      const { answer, docs: got } = await geminiAnswer(q, key.trim())
      setAi({ answer: answer || 'Gemini returned no text.', docs: got, via: 'browser', model: ragPrompt.model })
    } catch (e) {
      setAi({ error: `Gemini could not answer (${e.message}). The cited search above still works.` })
    } finally { setBusy(false) }
  }

  return (<>
    <Nav active="Ask" />
    <main className="wrap col" style={{ paddingTop: 48, paddingBottom: 60, gap: 36 }}>
      <PageHead eyebrow="Ask the archive" title="Ask a question in plain English.">
        <p className="p" style={{ fontSize: 16, maxWidth: 820 }}>Two ways to answer. <b>Cited search</b> (always on) returns the passages from {docs.length} NASA-sourced summaries and the findings for {mission.air} that match, with their sources; it does not write new text, so it cannot invent a number. <b>AI answer</b> (optional) is the team's RAG assistant: it searches 4,086 passages of NASA reports and Gemini writes an answer only from them.</p>
      </PageHead>
      <div className="col" style={{ gap: 12 }}>
        <div className="wrap-row">{EXAMPLES.map(ex => <button key={ex} type="button" className={'chip' + (q === ex ? ' on' : '')} onClick={() => { setQ(ex); setAi(null) }}>{ex}</button>)}</div>
        <label htmlFor="ask-q" className="lab">Your question</label>
        <input id="ask-q" value={q} onChange={e => { setQ(e.target.value); setAi(null) }} style={{ background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 10, color: 'var(--text)', fontSize: 16, padding: '14px 16px' }} />
      </div>
      <section className="col" style={{ gap: 12 }}>
        <h2 className="h2" style={{ fontSize: 24 }}>Cited search</h2>
        {hits.length === 0 ? <div className="card pad" style={{ borderLeft: '3px solid var(--ember)' }}><Ev kind="gap" small /> <b>The archive does not cover this question.</b> <span className="muted">Try naming a fire type (fabric, plastic, droplet, gas flame, smoke), an atmosphere (oxygen, pressure) or a safety need (ventilation, detection, suppression).</span></div>
          : hits.map((h, i) => <div key={i} className="card pad col" style={{ gap: 8, borderLeft: `3px solid ${i ? 'var(--line2)' : 'var(--plasma)'}` }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}><Ev kind={BADGE[h.badge] || h.badge || 'literature'} small /><span className="mono faint" style={{ fontSize: 11 }}>{h.kind} · {i ? `also relevant (score ${h.score.toFixed(2)})` : 'best match'}</span></div>
            <strong style={{ fontSize: 16 }}>{h.title}</strong><span style={{ fontSize: 14.5, lineHeight: 1.6 }}>{h.text}</span><span className="src">Source: {h.source}</span></div>)}
        <span className="src">Search method: TF-IDF over words with fire-safety synonyms (fans → ventilation, plastic → PMMA), cosine similarity, top four passages above a minimum score; the same method as the dashboard.</span>
      </section>
      <section className="card pad col" style={{ gap: 14, borderColor: '#5a4a24' }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}><h2 className="h2" style={{ fontSize: 24 }}>AI answer from the NASA reports (Gemini)</h2><span className="ev"><i style={{ width: 8, height: 8, borderRadius: 2, background: '#E8C15A' }} />AI-generated</span></div>
        <p className="p" style={{ fontSize: 14.5 }}>The team's RAG assistant: it retrieves passages from 4,086 chunks of NASA PSI reports and NASA pages, then Gemini answers <b>only from those passages</b>, cites them, says "insufficient data" when they do not answer the question, and never extrapolates to Moon or Mars gravity (rules: RAG/src/prompts.py). It is generative AI, so it can still be wrong: read the passages it used.</p>
        {serverAI ? <span className="src">Connected to the project API: answers use the team's vector database (Gemini embeddings).</span> : <div className="col" style={{ gap: 8 }}>
          <label htmlFor="gkey" className="lab">Your Gemini API key (from Google AI Studio)</label>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <input id="gkey" type="password" autoComplete="off" spellCheck="false" value={key} onChange={e => setKey(e.target.value)} placeholder="Paste your key here, not in a chat" style={{ flex: 1, minWidth: 240, background: 'var(--panel2)', border: '1px solid var(--line2)', borderRadius: 8, color: 'var(--text)', padding: '11px 12px', fontFamily: 'var(--mono)', fontSize: 13 }} />
            <label className="row" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />Keep for this tab (also turns on AI answers in the chat)</label>
          </div>
          <span className="faint" style={{ fontSize: 12.5, lineHeight: 1.5 }}>The key goes only from your browser to Google's Gemini API; this site has no server and never sees or stores it (with "remember", it stays in this tab's session storage until you close it). On this static site the 4,086 passages are searched with BM25 keyword ranking in your browser instead of the team's embedding search.</span>
        </div>}
        <div><button type="button" className="btn primary" disabled={busy || !q.trim()} onClick={askAI}>{busy ? 'Retrieving NASA passages and asking Gemini…' : 'Ask Gemini about this question'}</button></div>
        {ai?.error && <div className="muted" style={{ fontSize: 14, borderLeft: '3px solid var(--ember)', paddingLeft: 12 }}>{ai.error}</div>}
        {ai?.answer && <div className="col" style={{ gap: 12, borderLeft: '3px solid #E8C15A', paddingLeft: 16 }}>
          <span className="mono faint" style={{ fontSize: 11 }}>{ai.model} · written from {ai.docs.length} retrieved passages · {ai.via === 'server' ? 'project API' : 'in your browser'}</span>
          <MiniMarkdown text={ai.answer} />
          <details><summary style={{ fontSize: 14 }}>The {ai.docs.length} NASA passages Gemini read</summary>
            <div className="col" style={{ gap: 12, marginTop: 12 }}>{ai.docs.map((d, i) => <div key={i} className="col" style={{ gap: 4 }}><b style={{ fontSize: 13 }}>Document {i + 1}: {d.h.join(' › ') || 'NASA report'}</b><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{d.text.slice(0, 900)}{d.text.length > 900 ? ' …' : ''}</pre></div>)}</div>
          </details>
        </div>}
        <span className="src">AI answers: team RAG module (RAG/: LangGraph, Chroma, Gemini {ragPrompt.model}). Declared as AI use in the repository README.</span>
      </section>
    </main>
    <Footer />
  </>)
}

/* ================================================================== HOW EACH MODEL DECIDES (Methods) */
function HBars({ rows, fmt, max, color = 'var(--ember)' }) {
  const m = max || Math.max(...rows.map(r => Math.abs(r[1])), 1e-9)
  return <div className="col" style={{ gap: 8 }}>{rows.map(([k, v]) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 60px', gap: 10, alignItems: 'center', fontSize: 13.5 }}>
    <span>{k}</span><div className="bar"><span style={{ width: Math.max(0, v) / m * 100 + '%', background: color }} /></div><span className="mono" style={{ textAlign: 'right', fontSize: 12.5 }}>{fmt(v)}</span></div>)}</div>
}
export function ModelExplain() {
  const ex = modelSolids.explain
  const imp = Object.entries(ex.importance_auc_drop).sort((a, b) => b[1] - a[1])
  const cat = Object.entries(ex.glass_box_category_odds || {}).filter(([k]) => k.startsWith('material')).sort((a, b) => b[1] - a[1])
  const rel = modelDroplets.explain.input_relevance
  return (
    <section className="col" style={{ gap: 16 }}>
      <h2 className="h2" style={{ fontSize: 28 }}>How each model decides</h2>
      <p className="p" style={{ maxWidth: 860, fontSize: 15 }}>Global explanations below; local ones (why <i>this</i> number) are in the <Link to="/lab" style={{ color: 'var(--plasma)' }}>Fire Lab</Link>: exact Shapley values (what SHAP estimates, computed exactly over every combination of inputs, no sampling) against Earth air and against 50 real NASA tests, and exact burn-time multipliers for the gas-flame model.</p>
      <div className="grid3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        <div className="card pad col" style={{ gap: 14 }}>
          <strong>Cabin solids · gradient boosting</strong>
          <span className="lab">Drop in ROC-AUC when one input is scrambled</span>
          <HBars rows={imp} fmt={v => v.toFixed(3)} />
          <span className="muted" style={{ fontSize: 13.5, lineHeight: 1.55 }}><b>Air speed matters most</b>: flames starve at very low air speed and blow off at high speed. Oxygen and pressure follow physics by construction (they can only raise the chance of burning).</span>
          <span className="lab">Glass-box check (logistic, held-out ROC-AUC {methods.metrics.A_solids.logistic.roc_auc})</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.55 }}>Each +1 % O₂ multiplies the odds of sustained burning by <b>{ex.glass_box_odds_ratios['+1 % O2']}</b>; each +0.1 atm by <b>{ex.glass_box_odds_ratios['+0.1 atm pressure']}</b>.</span>
          {cat.length > 0 && <HBars rows={cat.map(([k, v]) => [k.replace('material = ', ''), Math.log10(v) + 2])} fmt={v => '×' + Math.pow(10, v - 2).toFixed(2)} color="var(--plasma)" />}
          <span className="src">Category odds relative to the reference material, log scale. {ex.note || ''}</span>
        </div>
        <div className="card pad col" style={{ gap: 14 }}>
          <strong>Gas flames · Weibull survival model</strong>
          <span className="lab">Burn-time multiplier per change (95 % CI)</span>
          <div className="col" style={{ gap: 8 }}>{modelGas.time_ratios.map(t => <div key={t.effect} style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr) 64px', gap: 10, alignItems: 'center', fontSize: 13.5 }}>
            <span>{t.effect}</span>
            <svg viewBox="0 0 200 14" width="100%" height="14" aria-hidden="true"><line x1="100" x2="100" y1="0" y2="14" stroke="#4A4F57" />
              {(() => { const X = v => 100 + Math.log2(v) * 100; return <><line x1={X(t.ci95[0])} x2={X(t.ci95[1])} y1="7" y2="7" stroke="#A6AAB1" /><circle cx={X(t.time_ratio)} cy="7" r="4.5" fill={t.time_ratio > 1 ? '#FF7A3D' : '#7DB4FF'} /></> })()}</svg>
            <span className="mono" style={{ textAlign: 'right', fontSize: 12.5 }}>×{t.time_ratio}</span></div>)}</div>
          <span className="muted" style={{ fontSize: 13.5, lineHeight: 1.55 }}>Each +1 % O₂ makes a still-air flame burn about <b>17 % longer</b>; higher pressure slightly shortens it. Multipliers are exact for this model: they combine by multiplication.</span>
          <span className="src">Axis: ×0.5 to ×2, log scale; centre line ×1. {modelGas.note}</span>
        </div>
        <div className="card pad col" style={{ gap: 14 }}>
          <strong>Fuel droplets · Gaussian process</strong>
          <span className="lab">What the burning-rate model listens to</span>
          <HBars rows={Object.entries(rel.burning_rate_mm2_s).sort((a, b) => b[1] - a[1])} fmt={v => v.toFixed(2)} />
          <span className="lab">What the flame-out-size model listens to</span>
          <HBars rows={Object.entries(rel.extinction_diameter_mm).sort((a, b) => b[1] - a[1])} fmt={v => v.toFixed(2)} color="var(--plasma)" />
          <span className="src">{modelDroplets.explain.note}</span>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== DATA AND SOURCES (Methods) */
const FILES = [['data/processed/tests.csv', 'Every test, one row each'], ['data/processed/evidence.csv', 'Every measured value with its source file and line'], ['data/processed/issues.csv', 'Every correction and source conflict'], ['ml/v1/A_solids_flammability.csv', 'ML table A: solids flammability'], ['ml/v1/B_solids_spread.csv', 'ML table B: solids spread'], ['ml/v1/C_droplets.csv', 'ML table C: droplets'], ['ml/v1/D_gas_flames.csv', 'ML table D: gas flames'], ['reports/ranking/ranking_habitat.csv', 'Habitat ranking'], ['models/v1/metrics.json', 'Model validation scores'], ['catalog/investigations.csv', 'Investigation catalog']]
export function DataSources() {
  return (
    <section className="col" style={{ gap: 16 }}>
      <h2 className="h2" style={{ fontSize: 28 }}>Data and sources</h2>
      <p className="p" style={{ maxWidth: 860, fontSize: 15 }}>Dataset v1: <b>{methods.ledger.tests.toLocaleString()} tests, {methods.ledger.values.toLocaleString()} measured values, {sources.length} sources</b>. Every value traces to its source file and line; raw files are never edited; all {methods.ledger.corrections} corrections and source conflicts are logged. Units: O₂ as mole fraction, pressure in atm, air speed in cm/s.</p>
      <div className="card scroll-x"><table className="tbl" style={{ minWidth: 860 }}>
        <thead><tr><th>ID</th><th>Investigation</th><th>Fire type</th><th>Tests</th><th>Measured values</th><th>O₂ range</th><th>Pressure range</th><th>DOI</th></tr></thead>
        <tbody>{sources.map(s => <tr key={s.investigation_id}><td className="mono" style={{ fontSize: 12.5 }}>{s.investigation_id}</td><td>{s.acronym}</td><td className="muted">{s.fuel_class}</td><td className="mono">{s.tests}</td><td className="mono">{s.evidence_rows}</td>
          <td className="mono" style={{ fontSize: 12.5 }}>{s.o2_min != null ? `${(s.o2_min * 100).toFixed(1)}-${(s.o2_max * 100).toFixed(1)} %` : '—'}</td><td className="mono" style={{ fontSize: 12.5 }}>{s.p_min != null ? `${s.p_min.toFixed(2)}-${s.p_max.toFixed(2)} atm` : '—'}</td>
          <td style={{ fontSize: 12.5 }}>{s.doi ? <a href={String(s.doi).startsWith('http') ? s.doi : `https://doi.org/${s.doi}`} target="_blank" rel="noreferrer" style={{ color: 'var(--plasma)' }}>{String(s.doi).replace('https://doi.org/', '')}</a> : '—'}</td></tr>)}</tbody>
      </table></div>
      <span className="src">Blank pressure: not recorded per test (BRE pressures come from its named atmospheres; the BASS-II test matrix does not list pressure). SAME, SAME-R and SPICE are loaded as test conditions only: they show where smoke and soot were studied, not the measured results.</span>
      <div className="lab" style={{ marginTop: 8 }}>Downloads (CSV and JSON from the repository)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {FILES.map(([f, d]) => <a key={f} href={RAW + f} target="_blank" rel="noreferrer" className="card-link col" style={{ gap: 4, padding: '12px 14px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--plasma)' }}>↓ {f.split('/').pop()}</span><span className="muted" style={{ fontSize: 13 }}>{d}</span></a>)}
      </div>
      <p className="p" style={{ fontSize: 14, maxWidth: 900 }}><b>Sources.</b> NASA Physical Sciences Informatics (CC0-1.0): BASS (PSI-26), BASS-II (PSI-25), Saffire I-III (PSI-98, 99, 100), FLEX (PSI-69), CFI (PSI-39), PSI-117, ACME BRE (PSI-20), ACME CFI-G (PSI-159), SPICE (PSI-107), SAME (PSI-102), SAME-R (PSI-101), and catalog entries for PSI-68, 106, 62, 142, 115, 60, 10, 21, 22, 23. Urban et al., ICES-2024-365 (NASA NTRS 20240002981); Urban et al., ICES-2021-266 (NTRS 20210011521); NASA NTRS 20180005168; Olson et al., UCL Discovery eprint 10164340; Ferkul et al. (2013); BASS-II data FAQ and science requirements document. Partial gravity: Ferkul et al., NTRS 20250010653 (LUCI); Zayac et al., NTRS 20240015307 and the NASA FM2 page; NASA Glenn Combustion Science page (DAFT). NASA Spinoff and NTRS for Earth uses. NASA Planetary Fact Sheet. NASA Space Apps 2026 challenge brief. Full list: <a href={REPO + '#nasa-data-and-references'} target="_blank" rel="noreferrer" style={{ color: 'var(--plasma)' }}>README</a>.</p>
    </section>
  )
}

/* ================================================================== BRIEFING DOWNLOAD */
export function BriefingDownload() {
  const { mission } = useMission()
  function go() {
    const tk = takeaways[mission.id], rk = rankings[mission.id].slice(0, 8)
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Fire-safety briefing · ${esc(mission.name)}</title>
<style>body{font:15px/1.55 system-ui,sans-serif;max-width:860px;margin:32px auto;padding:0 20px;color:#1b1d21}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:26px 0 6px}.n{font-size:22px;font-weight:700;color:#c4501c}.t{border-top:1px solid #ddd;padding:14px 0}.s{font-size:12px;color:#666}.b{display:inline-block;font:11px monospace;border:1px solid #bbb;border-radius:3px;padding:1px 6px;margin-right:6px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}</style></head><body>
<h1>Fire-safety briefing: ${esc(mission.name)}</h1><div class="s">Mission air ${esc(mission.air)} · ${esc(mission.note)} · generated ${new Date().toISOString().slice(0, 10)} by Flame in Freefall (NASA Space Apps Challenge 2026)</div>
${tk.map((t, i) => `<div class="t"><h2>${i + 1}. ${esc(t.title)}</h2><div class="n">${esc(t.number)}</div><p>${esc(t.text)}</p><p><b>Action:</b> ${esc(t.action)}</p>${t.caveat ? `<p class="s">${esc(t.caveat)}</p>` : ''}<p class="s"><span class="b">${esc({ measured: 'NASA measurement', model: 'Model prediction', gap: 'Data gap', literature: 'NASA literature' }[t.badge] || t.badge)}</span>${esc(t.source)}</p></div>`).join('')}
<h2>Most relevant investigations for this air</h2><table><tr><th>#</th><th>Investigation</th><th>Relevance</th><th>Near this air</th><th>Why</th></tr>${rk.map(r => `<tr><td>${r.rank}</td><td>${esc(r.acronym)} (${esc(r.psi_id)})</td><td>${Math.round(r.relevance)}</td><td>${r.n_near_mission} / ${r.n_tests}</td><td>${esc(r.why)}</td></tr>`).join('')}</table>
<h2>Why habitats will breathe this air</h2><table><tr><th>Where</th><th>Oxygen</th><th>Pressure</th><th>O₂ partial pressure</th><th>Why</th></tr>${atmospheres.rows.map(r => `<tr><td>${esc(r.where)}</td><td>${esc(r.o2)}</td><td>${esc(r.psi)}</td><td>${r.ppo2.toFixed(2)} atm</td><td>${esc(r.why)}</td></tr>`).join('')}</table>
<p class="s">Research and education tool, not a certified fire-safety system. NASA data CC0-1.0; not affiliated with or endorsed by NASA. Model predictions are labelled; every number cites its source. ${esc(REPO)}</p></body></html>`
    download(`fire_safety_briefing_${mission.id}.html`, html, 'text/html')
  }
  return <button type="button" className="btn primary" onClick={go}>Download the mission briefing (HTML)</button>
}
