// One guided home page per audience named in the challenge. Every number is computed from the same exported data
// as the rest of the site (and the Streamlit dashboard); nothing here is new data.
import { useEffect } from 'react'
import { Nav, Footer, Ev, pct } from '../components/ui'
import { Link } from '../lib/router'
import { useMission } from '../lib/mission'
import { useAudience, AUD_BY, AUDIENCES } from '../lib/audience'
import { methods, rankings, takeaways, recommendations, equipment, hardware, investigations, modelGas, modelSolids, modelDroplets, d2Check, physics,
  gasPredict, dropPredict, buoyantVelocity } from '../lib/data'
import findings from '../data/findings.json'
import missionGaps from '../data/mission_gaps.json'
import { BriefingDownload } from './Dashboard'
import { STEPS } from './Learn'

const near = (arr, v) => arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))
const RAW = 'https://raw.githubusercontent.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps/main/'
const REPO = 'https://github.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps'
const BADGE = { measured: 'measurement', model: 'prediction', gap: 'gap', literature: 'literature' }
const M = methods.metrics

function H2({ children, sub }) {
  return <div className="col" style={{ gap: 6, marginBottom: 16 }}><h2 className="h2" style={{ fontSize: 28 }}>{children}</h2>{sub && <p className="p" style={{ maxWidth: 820 }}>{sub}</p>}</div>
}
function Card({ title, kind, children, to, cta }) {
  return (
    <div className="card pad col" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><strong style={{ fontSize: 16 }}>{title}</strong>{kind && <Ev kind={kind} small />}</div>
      <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--muted)' }}>{children}</div>
      {to && <Link to={to} className="mono" style={{ fontSize: 12, color: 'var(--plasma)', marginTop: 'auto' }}>{cta} →</Link>}
    </div>
  )
}
const Grid = ({ children, min = 280 }) => <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 16 }}>{children}</div>

/* live numbers shared by several views, for the chosen mission air */
function useNumbers() {
  const { mission } = useMission()
  const o2 = Math.min(40, Math.max(18, Math.round(mission.x_o2 * 100))), pG = near([0.5, 0.69, 1.0, 2.0], mission.p)
  const gH = gasPredict('propane', o2, pG), gE = gasPredict('propane', 21, 1.0)
  const dO2 = Math.min(34, o2), dP = near([0.5, 0.69, 1.0, 2.0], mission.p)
  const dH = dropPredict('n-heptane', dO2, dP, 0, 0, 3), dE = dropPredict('n-heptane', 21, 1.0, 0, 0, 3)
  const ub = g => Math.round(buoyantVelocity(g, 1000, 0.02) * 100)
  return { mission, o2, pG, gH, gE, dO2, dP, dH, dE, ub, nr: findings.near[mission.id], rank: rankings[mission.id], tk: takeaways[mission.id], gaps: missionGaps[mission.id] }
}

/* ------------------------------------------------------------------ undergraduate */
const GLOSSARY = [
  ['Microgravity', 'The near-weightless condition in orbit. The ISS is in free fall around Earth, so objects and gases inside it barely "weigh" anything.'],
  ['Buoyancy', 'On Earth, hot gas is lighter than the air around it, so it rises and pulls fresh air in from below. In microgravity this flow disappears.'],
  ['Oxygen fraction vs partial pressure', 'The fraction is the share of the air that is oxygen (21 % on Earth). Partial pressure is that share times the total pressure. Habitat air at 30 % and 0.69 atm has about Earth\'s oxygen partial pressure (0.21 atm) but a richer fraction.'],
  ['Self-extinction', 'A flame going out on its own, with nothing done to it. In still microgravity air this happens when oxygen cannot reach the flame fast enough.'],
  ['d²-law', 'A burning droplet\'s diameter squared falls at a steady rate K (mm²/s), so the burn time is (d₀² − d_out²) / K.'],
  ['Richardson number (Ri)', 'The square of the ratio between the flow a flame makes by itself (buoyancy) and the flow a fan supplies. Ri ≫ 1: buoyancy feeds the flame; Ri ≪ 1: the fan does.'],
  ['Censored data', 'A measurement that is only a lower limit, such as a flame still burning when the fuel was cut: it burned "at least this long". The gas-flame model is built to use these correctly.'],
  ['Shapley value', 'A fair split of a model\'s prediction among its inputs: how much each input moved the answer from a reference. The bars always add up to the prediction.'],
]
function Undergrad() {
  const n = useNumbers()
  return (<>
    <section>
      <H2 sub="These three ideas explain most of what you will see on this site.">Three ideas to start with</H2>
      <Grid>
        <Card title="1 · Without gravity, nothing rises" kind="physics" to="/learn/2" cta="See it in step 2">On Earth buoyancy pulls fresh air into a flame at about {n.ub(physics.gravity.Earth)} cm/s (a 2 cm flame, 1000 K hotter than the air) and stretches it into a teardrop. In orbit that flow is zero: flames become slow, round and fed only by diffusion or fans.</Card>
        <Card title="2 · Same oxygen pressure, richer oxygen" kind="literature" to="/briefing" cta="Why habitats use this air">The challenge habitat air, 30 % O₂ at 0.69 atm, keeps about Earth's oxygen partial pressure (0.30 × 0.69 ≈ 0.21 atm), so crews breathe normally, but its richer oxygen fraction makes materials burn more readily.</Card>
        <Card title="3 · Droplets shrink by the d²-law" kind="measurement" to="/lab" cta="Burn a droplet in the Fire Lab">Burn time = (d₀² − d_out²) / K. On {d2Check.n} real FLEX droplets this reproduces the measured burn times with R² = {d2Check.r2.toFixed(3)}.</Card>
      </Grid>
    </section>
    <section>
      <H2 sub={`Open the Fire Lab and try these. The numbers below are what the models predict for ${n.mission.air}; check them yourself.`}>Three experiments to try</H2>
      <Grid>
        <Card title="Turn off the fans" kind="prediction" to="/lab" cta="Gas leak lab">Propane flame in still air: median {n.gE.median.toFixed(1)} s before it goes out by itself in Earth cabin air, {n.gH.median.toFixed(0)} s at {n.o2} % O₂ and {n.pG} atm. Why does more oxygen keep it alive without any air flow?</Card>
        <Card title="Spill some fuel" kind="prediction" to="/lab" cta="Spilled fuel lab">A 3 mm n-heptane droplet burns at {n.dE.br.toFixed(2)} mm²/s in Earth air and {n.dH.br.toFixed(2)} mm²/s at {n.dO2} % O₂, {n.dP} atm. Change the droplet size: which part of the d²-law changes?</Card>
        <Card title="Go to the Moon" kind="physics" to="/gaps" cta="Buoyancy chart">A 2 cm flame would draw about {n.ub(physics.gravity.Moon)} cm/s of fresh air by itself on the Moon and {n.ub(physics.gravity.Mars)} cm/s on Mars. Compare that with the fan speeds NASA used in orbit.</Card>
      </Grid>
    </section>
    <section>
      <H2>Words you will meet</H2>
      <div className="card" style={{ padding: '6px 22px' }}>{GLOSSARY.map(([t, d]) => <div key={t} className="rule" style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 240px) minmax(0,1fr)', gap: 18, padding: '14px 0', borderTopColor: 'var(--line)' }}><b style={{ fontSize: 14.5 }}>{t}</b><span className="muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>{d}</span></div>)}</div>
    </section>
  </>)
}

/* ------------------------------------------------------------------ graduate */
function Grad() {
  const n = useNumbers()
  const files = [['data/processed/tests.csv', 'tests'], ['data/processed/evidence.csv', 'measured values with source file and line'], ['data/processed/issues.csv', 'every correction'], ['ml/v1/A_solids_flammability.csv', 'ML table A'], ['ml/v1/C_droplets.csv', 'ML table C'], ['ml/v1/D_gas_flames.csv', 'ML table D']]
  return (<>
    <section>
      <H2 sub="Each one is a gap in NASA's data that matters for the habitats being designed now, with the investigation it would build on.">Five open questions (thesis-sized)</H2>
      <div className="card" style={{ padding: '4px 22px' }}>{recommendations.map(r => <div key={r.priority} className="rule" style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: 14, padding: '16px 0' }}><span className="mono" style={{ color: 'var(--ember)' }}>P{r.priority}</span><div className="col" style={{ gap: 6 }}><b style={{ fontSize: 15.5 }}>{r.experiment}</b><span className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>{r.why}</span><span className="src">Builds on {r.builds_on}</span></div></div>)}</div>
    </section>
    <section>
      <H2 sub="Know where the models stop before you build on them.">Where the evidence and models end</H2>
      <Grid>
        <Card title="Gas flames: an untested oxygen band" kind="gap">No ACME CFI-G test between {modelGas.gap[0]} % and {modelGas.gap[1]} % O₂, exactly where the habitat air sits; the survival model interpolates there (leave-one-ISS-day-out concordance {M.D_gas_flames.concordance_leave_one_day_out}).</Card>
        <Card title="Solids: three materials modelled" kind="prediction">The solids model gives numbers only for {Object.keys(modelSolids.shapes).join(', ')} ({M.A_solids.gradient_boosting.n} rows, {M.A_solids.gradient_boosting.n_flameout} flame-outs, ROC-AUC {M.A_solids.gradient_boosting.roc_auc}); {modelSolids.not_modelled.join(', ')} have too few tests.</Card>
        <Card title="Droplets: suppressants only up to 25 % O₂" kind="gap">FLEX tested CO₂ and helium only up to {Math.round(modelDroplets.explain.suppressant_tests_max_o2 * 100)} % O₂, so suppression at habitat oxygen is untested (burning-rate R² {M.C_droplets.burning_rate_mm2_s.cv5_r2}, flame-out size R² {M.C_droplets.extinction_diameter_mm.cv5_r2}).</Card>
        <Card title="No partial-gravity data" kind="gap" to="/gaps" cta="0 g and 1 g bounds">No PSI combustion test at lunar (0.16 g) or Martian (0.38 g) gravity. The site bounds Moon and Mars between microgravity and Earth results, and labels physics estimates as such.</Card>
      </Grid>
    </section>
    <section>
      <H2 sub={`Dataset v1: ${methods.ledger.tests.toLocaleString()} tests, ${methods.ledger.values.toLocaleString()} measured values, ${methods.ledger.corrections} logged corrections. Every value traces to its source file and line.`}>Data and code you can reuse</H2>
      <Grid min={240}>{files.map(([f, d]) => <a key={f} href={RAW + f} target="_blank" rel="noreferrer" className="card-link col" style={{ gap: 4, padding: '14px 16px' }}><span className="mono" style={{ fontSize: 12.5, color: 'var(--plasma)' }}>↓ {f.split('/').pop()}</span><span className="muted" style={{ fontSize: 13 }}>{d}</span></a>)}</Grid>
      <pre className="card" style={{ margin: '14px 0 0', padding: 16, fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--muted)', overflowX: 'auto' }}>{`git clone ${REPO}.git
python scripts/build_data.py && python scripts/build_ml.py && python scripts/train_models.py
pytest -q        # 46 checks`}</pre>
      <span className="src">Code Apache-2.0, NASA data CC0-1.0. Cite the NASA investigation DOIs listed on each investigation page.</span>
    </section>
  </>)
}

/* ------------------------------------------------------------------ professor */
function Professor() {
  const n = useNumbers()
  const acts = [
    ['Does cutting ventilation stop a fire?', '/lab', 'Gas leak lab', `Students set 21 % O₂ at 1 atm, then the mission air. The model predicts a median still-air burn of ${n.gE.median.toFixed(1)} s vs ${n.gH.median.toFixed(0)} s (${(n.gH.median / n.gE.median).toFixed(1)}×). Discuss diffusion-limited flames and why censored data matter.`, 'prediction'],
    ['Test the d²-law against NASA data', '/lab', 'Spilled fuel lab', `Change the droplet size and read the burn time; the d²-law reproduces ${d2Check.n} FLEX burn times with R² ${d2Check.r2.toFixed(3)}. Ask why the flame goes out before the droplet is gone.`, 'measurement'],
    ['Buoyancy on the Moon and Mars', '/gaps', 'Buoyancy chart', `With the sliders, students compute the self-induced flow (2 cm flame, ΔT 1000 K: Earth ${n.ub(physics.gravity.Earth)}, Mars ${n.ub(physics.gravity.Mars)}, Moon ${n.ub(physics.gravity.Moon)} cm/s) and the Richardson number, then compare with NASA's fan speeds.`, 'physics'],
    ['Defend a ranking', '/ranking', 'Ranking', 'Groups set the four weights for a mission and must justify their top three investigations; compare the orders between groups.', 'prediction'],
    ['Data skepticism', '/methods', 'Methods', `Students read the ${methods.ledger.corrections} logged corrections and source conflicts and classify them (unit slips, swapped columns, disagreements between a table and a paper).`, 'measurement'],
    ['Explain a model', '/lab', 'Cabin material lab', 'Students read the exact Shapley waterfall against 50 real NASA tests and explain why air speed dominates the solids model.', 'prediction'],
  ]
  return (<>
    <section>
      <H2 sub="The Learn sequence works as a lecture: four short steps with interactive simulations and their NASA sources, then the Fire Lab.">A five-step lecture sequence</H2>
      <div className="card" style={{ padding: '4px 22px' }}>{STEPS.map(([t, to], i) => <div key={t} className="rule" style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', gap: 14, padding: '14px 0', alignItems: 'center' }}><span className="mono" style={{ color: 'var(--ember)' }}>{i + 1}</span><b style={{ fontSize: 15.5 }}>{t}</b><Link to={to} className="mono" style={{ fontSize: 12, color: 'var(--plasma)' }}>Open →</Link></div>)}</div>
    </section>
    <section>
      <H2 sub={`Numbers shown for ${n.mission.air}; change the mission air in the top bar and they update.`}>Six classroom activities</H2>
      <Grid>{acts.map(([t, to, cta, d, k]) => <Card key={t} title={t} kind={k} to={to} cta={cta}>{d}</Card>)}</Grid>
    </section>
    <section>
      <H2>Figures and handouts</H2>
      <Grid>
        <Card title="Figures with sources" kind="measurement" to="/findings" cta="Key findings">Five findings, each chart with its NASA source and an evidence label (measurement, prediction, literature, physics estimate or gap).</Card>
        <Card title="One-page briefing" kind="literature"><span>A downloadable HTML handout for the chosen mission air.</span><div style={{ marginTop: 10 }}><BriefingDownload /></div></Card>
        <Card title="Integrity" kind="literature" to="/methods" cta="Methods">Every model is tested on data it never saw. AI use (Claude for development, Gemini for optional answers) is declared in the repository.</Card>
      </Grid>
    </section>
  </>)
}

/* ------------------------------------------------------------------ researcher */
function Researcher() {
  const n = useNumbers()
  const withData = investigations.filter(i => i.n_tests > 0).length
  return (<>
    <section>
      <H2 sub={`Default weights (atmosphere 0.40, fire type 0.25, data 0.25, number of tests 0.10). ${investigations.length} investigations, ${withData} with test-level data.`}>{`Top five for ${n.mission.air}`}</H2>
      <div className="card scroll-x"><table className="tbl" style={{ minWidth: 820 }}>
        <thead><tr><th>#</th><th>Investigation</th><th>Relevance</th><th>Tests near this air</th><th>Why</th></tr></thead>
        <tbody>{n.rank.slice(0, 5).map(r => <tr key={r.psi_id}><td className="mono faint">{r.rank}</td><td><Link to={'/investigation/' + r.psi_id} style={{ fontWeight: 600 }}>{r.acronym}</Link> <span className="mono faint" style={{ fontSize: 11 }}>{r.psi_id}</span></td><td className="mono" style={{ color: 'var(--ember)' }}>{Math.round(r.relevance)}</td><td className="mono">{r.n_near_mission} / {r.n_tests}</td><td className="muted" style={{ fontSize: 13 }}>{r.why}</td></tr>)}</tbody>
      </table></div>
      <div style={{ marginTop: 10 }}><Link to="/ranking" className="mono" style={{ fontSize: 12, color: 'var(--plasma)' }}>Change the weights, see the closest real tests →</Link></div>
    </section>
    <section>
      <H2 sub="Tested within ±5 % O₂ and ±0.2 atm of the mission air.">Coverage near this air</H2>
      <Grid>{n.gaps.map(g => <Card key={g.fire_type} title={g.fire_type} kind={g.status.startsWith('GAP') ? 'gap' : 'measurement'}>{g.tests_near_mission} of {g.tests_total} tests near this air ({g.status}). Tested {g.o2_range}, {g.pressure_range}. Closest: {g.closest_test}.</Card>)}</Grid>
    </section>
    <section>
      <H2 sub="Results from the same apparatus line up more directly than results from different rigs.">Shared hardware</H2>
      <Grid>{Object.values(hardware).map(h => <Card key={h.name} title={h.short || h.name}>{h.members.map(m => investigations.find(i => i.id === m)?.acronym || m).join(' · ')}</Card>)}</Grid>
    </section>
    <section>
      <H2>Query and compare</H2>
      <Grid>
        <Card title="Ask the archive" kind="literature" to="/ask" cta="Ask">Cited search over the investigation summaries, plus the team's Gemini RAG over 4,086 passages of NASA reports, answering only from retrieved text and showing it.</Card>
        <Card title="Compare up to three" kind="measurement" to="/compare" cta="Compare">Same / different summary across hardware, conditions and measurements, with gaps marked.</Card>
        <Card title="Provenance and DOIs" kind="measurement" to="/methods" cta="Data and sources">Per-investigation test counts, O₂ and pressure ranges, DOIs, every correction logged, CSV downloads.</Card>
      </Grid>
    </section>
  </>)
}

/* ------------------------------------------------------------------ engineer */
function Engineer() {
  const n = useNumbers()
  return (<>
    <section>
      <H2 sub={`For ${n.mission.name} (${n.mission.air}). Model outputs carry uncertainty and a tested-range label in the Fire Lab.`}>Design numbers for your air</H2>
      <Grid min={220}>
        <Card title={`${(n.gH.median / n.gE.median).toFixed(1)}× longer`} kind="prediction">still-air burn of a gas flame here ({n.gH.median.toFixed(0)} s) than in Earth cabin air ({n.gE.median.toFixed(1)} s): shutting off the fans may not be enough.</Card>
        <Card title={`${pct(n.gH.s30)} still burning`} kind="prediction">after 30 s with no air flow (Earth air: {pct(n.gE.s30)}).</Card>
        <Card title={`${n.nr.smoke} smoke tests`} kind={n.nr.smoke ? 'measurement' : 'gap'}>near this air. Detector calibration in habitat air is untested.</Card>
        <Card title={`${n.nr.solids} solid burns`} kind={n.nr.solids ? 'measurement' : 'gap'}>near this air ({n.nr.solids_psi} in PSI): material screening at habitat conditions rests on very few tests.</Card>
      </Grid>
    </section>
    <section>
      <H2 sub="What the data say for each kind of control or equipment, and what it means for the next generation.">Implications for hardware</H2>
      <Grid>{equipment.map(e => <Card key={e.area} title={e.area} kind={BADGE[e.badge] || e.badge}>{e.next_gen}<div className="src" style={{ marginTop: 8 }}>{e.investigations}</div></Card>)}</Grid>
      <div style={{ marginTop: 10 }}><Link to="/equipment" className="mono" style={{ fontSize: 12, color: 'var(--plasma)' }}>Numbers behind each, BASS-II CO ranking and the smoke-to-detector calculator →</Link></div>
    </section>
    <section>
      <H2>Actions from the crew briefing</H2>
      <div className="card" style={{ padding: '4px 22px' }}>{n.tk.map((t, i) => <div key={t.key} className="rule" style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr) auto', gap: 14, padding: '14px 0', alignItems: 'baseline' }}><span className="mono" style={{ color: 'var(--ember)' }}>0{i + 1}</span><span style={{ fontSize: 14.5, lineHeight: 1.55 }}><b>{t.title}.</b> {t.action}</span><Ev kind={BADGE[t.badge] || t.badge} small /></div>)}</div>
      <div className="wrap-row" style={{ gap: 10, marginTop: 14 }}><BriefingDownload /><Link to="/briefing" className="btn">Full briefing</Link></div>
      <p className="src" style={{ marginTop: 12 }}>Research and education tool, not a certified fire-safety system. Use with NASA-STD-6001 testing and your programme's safety process.</p>
    </section>
  </>)
}

const BODY = { undergrad: Undergrad, grad: Grad, professor: Professor, researcher: Researcher, engineer: Engineer }

export default function ViewHub({ id }) {
  const a = AUD_BY[id]
  const { view, setView } = useAudience()
  useEffect(() => { if (a && view?.id !== a.id) setView(a.id) }, [a?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return <ChooseView />
  const Body = BODY[a.id]
  return (<>
    <Nav active={null} />
    <main className="wrap col" style={{ paddingTop: 44, paddingBottom: 60, gap: 56 }}>
      <section className="col" style={{ gap: 18 }}>
        <div className="eyebrow ember">View for {a.label.toLowerCase()}</div>
        <h1 className="h1" style={{ fontSize: 'clamp(36px, 5vw, 58px)', maxWidth: 900 }}>{a.verb}.</h1>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(210px, 1fr))`, gap: 12 }}>
          {a.path.map(([t, to, d], i) => <Link key={t} to={to} className="card-link col" style={{ gap: 6, padding: 16 }}><span className="mono" style={{ color: 'var(--ember)', fontSize: 12 }}>Step {i + 1}</span><b style={{ fontSize: 16 }}>{t}</b><span className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{d}</span></Link>)}
        </div>
        <span className="faint" style={{ fontSize: 13 }}>Every page stays open to every view; this one only sets the order and the starting point. <Link to="/views" style={{ color: 'var(--plasma)' }}>Switch view</Link></span>
      </section>
      <Body />
    </main>
    <Footer />
  </>)
}

export function ViewCards() {
  const { setView } = useAudience()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      {AUDIENCES.map(a => <Link key={a.id} to={'/for/' + a.id} onClick={() => setView(a.id)} className="card-link col" style={{ gap: 8, padding: 18 }}>
        <b style={{ fontSize: 16 }}>{a.label}</b><span className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{a.verb}.</span>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--plasma)', marginTop: 'auto' }}>Start: {a.path.map(p => p[0]).join(' → ')}</span></Link>)}
    </div>
  )
}

export function ChooseView() {
  const { setView } = useAudience()
  return (<>
    <Nav active={null} />
    <main className="wrap col" style={{ paddingTop: 44, paddingBottom: 60, gap: 28 }}>
      <div className="col" style={{ gap: 12 }}><div className="eyebrow ember">Views</div><h1 className="h1" style={{ fontSize: 'clamp(36px, 5vw, 58px)' }}>Who are you?</h1>
        <p className="p" style={{ maxWidth: 760, fontSize: 16 }}>Pick a view for a guided path through the same NASA data. You can switch at any time from the bar under the menu, and every page stays available.</p></div>
      <ViewCards />
      <div><button type="button" className="btn" onClick={() => { setView(null); window.location.hash = '' }}>No view: show everything</button></div>
    </main>
    <Footer />
  </>)
}
