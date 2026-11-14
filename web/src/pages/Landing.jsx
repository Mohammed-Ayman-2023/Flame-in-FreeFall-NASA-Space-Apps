import { lazy, Suspense, useState } from 'react'
import { Link, go } from '../lib/router'
import { Nav, Ev, Footer } from '../components/ui'
import { methods, investigations, physics, buoyantVelocity } from '../lib/data'
import { ViewCards } from './ViewHub'

const SpaceScene = lazy(() => import('../components/SpaceScene'))

const STRIP = [
  ['BASS-II', 'PSI-25', 'Burning solids', 'linear-gradient(90deg,#0b0c0e 0%,#0b0c0e 46%,rgba(255,150,70,.9) 50%,rgba(80,120,255,.55) 53%,#1b2230 58%,#2a2e35 100%)'],
  ['FLEX', 'PSI-69', 'Fuel droplets', 'radial-gradient(circle at 50% 52%,#fff 0%,#dcebff 4%,#8fb8ff 9%,rgba(63,111,240,.55) 16%,#050607 34%)'],
  ['ACME CFI-G', 'PSI-159', 'Gas flames', 'radial-gradient(circle at 50% 52%,#fff 0%,#dcebff 7%,#8fb8ff 15%,rgba(63,111,240,.6) 26%,rgba(255,150,70,.18) 34%,#050607 52%)'],
  ['Saffire-I', 'PSI-98', 'Spacecraft-scale fire', 'linear-gradient(100deg,#0b0c0e 0%,#0b0c0e 30%,rgba(255,150,70,.85) 36%,rgba(80,120,255,.5) 40%,#1b2230 50%,#2a2e35 100%)'],
  ['SAME-R', 'PSI-101', 'Smoke', 'radial-gradient(ellipse at 40% 55%,rgba(200,204,210,.35) 0%,rgba(200,204,210,.12) 30%,#050607 62%)'],
  ['SPICE', 'PSI-107', 'Soot', 'radial-gradient(ellipse at 50% 80%,#fff 0%,#dcebff 4%,rgba(255,170,80,.7) 12%,rgba(63,111,240,.3) 24%,#050607 45%)'],
]
export { STRIP }

const G = physics.gravity
const ub = g => Math.round(buoyantVelocity(g, 1000, 0.02) * 100)
const DEST = {
  orbit: {
    chip: 'Orbit · ISS', g: '≈ 0 g', title: 'Low Earth orbit: the ISS and Cygnus', ev: 'measurement',
    text: `Where every one of the ${methods.ledger.tests.toLocaleString()} NASA tests in this archive was run. In free fall hot gas does not rise, so flames become slow blue spheres fed only by fans or by diffusion.`,
    cta: ['Explore the 24 investigations', '/explore'],
  },
  moon: {
    chip: 'Moon', g: `${G.Moon} m/s² · 0.17 g`, title: 'The Moon: where the habitats will be', ev: 'gap',
    text: `Bases may breathe 30-34 % oxygen at 8-10 psi. A 2 cm flame would pull in its own fresh air at about ${ub(G.Moon)} cm/s (physics estimate). No PSI fire test has run at lunar gravity; NASA's LUCI and FM2 are the first steps.`,
    cta: ['What we can say for the Moon', '/gaps'],
  },
  mars: {
    chip: 'Mars', g: `${G.Mars} m/s² · 0.38 g`, title: 'Mars: no fire data yet', ev: 'gap',
    text: `A 2 cm flame would draw about ${ub(G.Mars)} cm/s of fresh air by itself (physics estimate). PSI holds no combustion test at Martian gravity, so every answer is bounded between our 0 g and 1 g data.`,
    cta: ['See the 0 g and 1 g bounds', '/gaps'],
  },
  earth: {
    chip: 'Earth', g: `${G.Earth} m/s² · 1 g`, title: 'Earth: where materials are screened', ev: 'literature',
    text: `Buoyancy pulls fresh air into a 2 cm flame at about ${ub(G.Earth)} cm/s and stretches it into a teardrop. NASA screens spacecraft materials here (NASA-STD-6001) and ran 1 g comparison burns for Saffire.`,
    cta: ['Compare flames in the Fire Lab', '/lab'],
  },
}

function SpaceExplorer() {
  const [focus, setFocus] = useState('overview')
  const d = DEST[focus]
  const pick = k => setFocus(f => (f === k ? 'overview' : k))
  return (
    <div className="col" style={{ gap: 14, minWidth: 0 }}>
      <div className="space-stage">
        <div aria-hidden="true" style={{ position: 'absolute', inset: '8%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(63,111,240,.22) 0%, rgba(63,111,240,0) 65%)', pointerEvents: 'none' }} />
        <Suspense fallback={<div aria-hidden="true" style={{ position: 'absolute', inset: '18%', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #4d79c7 0%, #183c7d 45%, #070f22 100%)', opacity: .6 }} />}>
          <SpaceScene focus={focus} onPick={pick} labels={{ orbit: 'ISS orbit', moon: 'Moon', mars: 'Mars', earth: 'Earth' }} />
        </Suspense>
        <span className="mono faint" style={{ position: 'absolute', right: 8, bottom: 6, fontSize: 10.5, pointerEvents: 'none' }}>Sizes to scale · distances not · drag to turn</span>
      </div>
      <div className="dest" role="group" aria-label="Choose where the fire is">
        {Object.entries(DEST).map(([k, v]) => (
          <button key={k} type="button" className={focus === k ? 'on' : ''} aria-pressed={focus === k} onClick={() => pick(k)}><b>{v.chip}</b><span>{v.g}</span></button>))}
      </div>
      <div className="card pad col" aria-live="polite" style={{ gap: 10, minHeight: 168 }}>
        {d ? <>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><strong style={{ fontSize: 16 }}>{d.title}</strong><Ev kind={d.ev} small /></div>
          <span className="muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>{d.text}</span>
          <Link to={d.cta[1]} className="mono" style={{ fontSize: 12, color: 'var(--plasma)' }}>{d.cta[0]} →</Link>
        </> : <>
          <strong style={{ fontSize: 16 }}>Where will the next fire burn?</strong>
          <span className="muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>NASA's fire data come from orbit, but crews are heading to the Moon and Mars, where gravity is weaker than Earth's and stronger than none. Pick a destination to see what that changes for a flame and what the archive can say about it.</span>
          <span className="src">Earth: NASA Blue Marble (Visible Earth). Moon and Mars surfaces are illustrations. Gravity: {physics.gravity_source}.</span>
        </>}
      </div>
    </div>
  )
}

export default function Landing() {
  const [q, setQ] = useState('')
  const stats = [[methods.ledger.tests.toLocaleString(), 'NASA tests'], [investigations.length, 'investigations'], [methods.ledger.values.toLocaleString(), 'measured values'], ['3', 'trained models']]
  return (<>
    <Nav transparent />
    <main>
      <section className="wrap" style={{ maxWidth: 1400, paddingTop: 40, paddingBottom: 24 }}>
        <div className="hero-grid">
          <div className="col enter" style={{ gap: 22 }}>
            <div className="eyebrow" style={{ color: '#C9CDD3' }}>NASA microgravity combustion archive · ISS and Cygnus</div>
            <h1 className="h1" style={{ fontSize: 'clamp(44px, 6.4vw, 88px)', lineHeight: .96 }}>Twenty-four fires NASA lit in orbit.</h1>
            <p style={{ margin: 0, fontSize: 18, color: '#C9CDD3', maxWidth: 560, lineHeight: 1.55 }}>Why fires start on a spacecraft, how they behave without gravity, and what {methods.ledger.tests.toLocaleString()} NASA tests say about the Moon bases and rovers we are about to build.</p>
            <div className="wrap-row" style={{ gap: 12, marginTop: 4 }}>
              <Link to="/learn/1" className="btn primary" style={{ fontSize: 16, padding: '15px 24px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor" /></svg>Start learning · 5 steps</Link>
              <Link to="/lab" className="btn" style={{ fontSize: 16, padding: '15px 24px', background: 'rgba(10,11,13,.6)' }}>Open the Fire Lab</Link>
            </div>
            <form role="search" onSubmit={e => { e.preventDefault(); try { sessionStorage.setItem('fif-q', q) } catch {} ; go('/explore') }} style={{ display: 'flex', width: 560, maxWidth: '100%', border: '1px solid var(--line2)', borderRadius: 10, background: 'rgba(17,19,23,.85)', overflow: 'hidden' }}>
              <label htmlFor="sb" className="sr">Search the archive</label>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ alignSelf: 'center', marginLeft: 14, flex: 'none' }}><circle cx="11" cy="11" r="7" fill="none" stroke="#868B93" strokeWidth="2" /><path d="M20 20l-4-4" stroke="#868B93" strokeWidth="2" /></svg>
              <input id="sb" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a fuel, a material, an investigation…" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, color: 'var(--text)', fontSize: 14, padding: '14px 12px', outline: 'none' }} />
              <button type="submit" className="btn sm" style={{ border: 0, borderLeft: '1px solid var(--line2)', borderRadius: 0, padding: '0 18px' }}>Search</button>
            </form>
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 16, margin: '10px 0 0', maxWidth: 600 }}>
              {stats.map(([n, l]) => <div key={l} className="col" style={{ gap: 2, borderLeft: '2px solid var(--ember)', paddingLeft: 12 }}><dt className="sr">{l}</dt><dd className="disp" style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>{n}</dd><span className="mono faint" aria-hidden="true" style={{ fontSize: 11 }}>{l}</span></div>)}
            </dl>
          </div>
          <SpaceExplorer />
        </div>
      </section>

      <section className="wrap" style={{ maxWidth: 1400, paddingTop: 40 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <h2 className="h2" style={{ fontSize: 26 }}>Choose your view</h2>
          <span className="muted" style={{ fontSize: 14 }}>A guided path through the same NASA data, for how you will use it.</span>
        </div>
        <ViewCards />
      </section>
      <section className="wrap" style={{ maxWidth: 1400, paddingTop: 40, paddingBottom: 56 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <h2 className="h2" style={{ fontSize: 26 }}>Six fires to start with</h2>
          <Link to="/explore" className="mono" style={{ fontSize: 12, color: 'var(--plasma)' }}>All 24 investigations →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          {STRIP.map(([a, id, f, g]) => (
            <Link key={id} to={'/investigation/' + id} className="card-link col" style={{ gap: 10, minWidth: 0, padding: 10 }}>
              <div aria-hidden="true" style={{ height: 120, borderRadius: 8, background: g }} />
              <span style={{ fontSize: 15, fontWeight: 600, padding: '0 4px' }}>{a}</span>
              <span className="mono faint" style={{ fontSize: 11, padding: '0 4px 4px' }}>{id} · {f}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ maxWidth: 1400, paddingBottom: 72 }}>
        <div className="grid3">
          {[['Learn', 'Five short steps: why fires start on a spacecraft, how they behave without gravity, prevention and response.', '/learn/1', 'Start step 1'],
            ['Predict', 'Change oxygen, pressure, air speed and gravity and watch three models trained on NASA tests answer, with uncertainty.', '/lab', 'Open the Fire Lab'],
            ['Decide', 'A crew briefing for your mission air, a ranking of the investigations that matter, and the tests NASA has not run yet.', '/briefing', 'Read the briefing']].map(([t, d, to, c], i) => (
            <Link key={t} to={to} className="card-link col" style={{ gap: 10, padding: 22 }}>
              <span className="mono" style={{ color: 'var(--ember)', fontSize: 12 }}>0{i + 1}</span>
              <span className="disp" style={{ fontSize: 22, fontWeight: 600 }}>{t}</span>
              <span className="muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>{d}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--plasma)', marginTop: 'auto' }}>{c} →</span>
            </Link>))}
        </div>
      </section>
    </main>
    <Footer />
  </>)
}

