import { useState, useEffect } from 'react'
import { Link } from '../lib/router'
import { Mark, Flame, Ev, SpaceAppsBadge, ViewBar } from '../components/ui'
import SmokeSim from '../sims/SmokeSim'
import PlumeSandbox from '../sims/PlumeSandbox'
import { HARDWARE, Cutaway } from '../components/ModuleScene'
import Cabin from '../sims/Cabin'
import FireTriangle from '../sims/FireTriangle'

export const STEPS = [['Why fires start', '/learn/1'], ['How fire behaves', '/learn/2'], ['Prevention', '/learn/3'], ['Second line of defense', '/learn/4'], ['Try it yourself', '/lab']]

export function LessonHeader({ k }) {
  return (
    <header className="site-head">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 32px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 14 }}><SpaceAppsBadge /><span aria-hidden="true" style={{ width: 1, height: 26, background: 'var(--line2)' }} />
          <Link to="/" className="row" style={{ gap: 10 }}><Mark /><span className="disp" style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap' }}>Flame in Freefall</span></Link></div>
        <nav aria-label="Lesson steps" className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {STEPS.map(([t, to], i) => {
            const on = i === k, done = i < k, c = on ? 'var(--ember)' : done ? 'var(--text)' : 'var(--line2)'
            return (
              <span key={t} className="row" style={{ gap: 8 }}>
                <Link to={to} aria-current={on ? 'step' : undefined} className="row" style={{ gap: 8, fontSize: 13, color: on ? 'var(--text)' : done ? 'var(--muted)' : 'var(--faint)', fontWeight: on ? 600 : 400 }}>
                  <span className="mono" style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${c}`, background: on || done ? c : 'transparent', color: '#0A0B0D', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span className="hide-md">{t}</span>
                </Link>
                {i < STEPS.length - 1 && <span aria-hidden="true" style={{ width: 22, height: 2, background: done ? 'var(--ember)' : 'var(--line2)' }} />}
              </span>
            )
          })}
        </nav>
        <Link to="/explore" className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>Skip to the archive →</Link>
      </div>
      <ViewBar />
    </header>
  )
}

function LessonFoot({ k }) {
  return (
    <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '40px 32px 56px' }}>
      {k > 0 ? <Link to={STEPS[k - 1][1]} className="btn">← {STEPS[k - 1][0]}</Link> : <span />}
      <span className="mono faint" style={{ fontSize: 12 }}>{k + 1} / 5</span>
      <Link to={STEPS[k + 1][1]} className="btn primary">Next: {STEPS[k + 1][0]} →</Link>
    </div>
  )
}

/* ---------------------------------------------------------------- 1 · why fires start */
const STAGE = { position: 'relative', width: 'min(100%, calc((100vh - 190px) * 16 / 9))', minWidth: 'min(100%, 640px)', margin: '0 auto', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', background: '#07080a' }

export function Learn1() {
  const [hw, setHw] = useState('battery')
  const [stp, setStp] = useState(0)
  const [play, setPlay] = useState(0)
  const cur = HARDWARE.find(h => h.id === hw)
  const onPurpose = hw === 'cir', info = hw === 'detector', blue = onPurpose || info
  const accent = blue ? 'var(--plasma)' : 'var(--ember)'
  const pick = id => { setHw(id); setStp(0) }
  const [ct, cd] = cur.chain[stp]
  return (<>
    <LessonHeader k={0} />
    <main className="wrap" style={{ paddingTop: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="col" style={{ gap: 6 }}>
          <div className="eyebrow ember">Step 1 · Why fires start</div>
          <h1 className="h1" style={{ fontSize: 'clamp(26px, 3vw, 38px)' }}>What can start a fire on a space station?</h1>
        </div>
        <span className="muted" style={{ fontSize: 14 }}>Tap a glowing point inside the module. Each failure plays out in four steps.</span>
      </div>
      <div style={STAGE}>
        <div style={{ aspectRatio: '16 / 9' }}><Cabin mode="hazard" sel={hw} playKey={play} onPick={pick} onStep={setStp} ariaLabel={`Inside a station module: ${cur.name}. ${ct}: ${cd}`} /></div>
        <div className="cab-cap" aria-live="polite" style={{ borderLeft: `3px solid ${accent}` }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <span className="eyebrow" style={{ fontSize: 11, color: accent }}>{cur.name}</span>
            <span className="row" style={{ gap: 5 }}>{cur.chain.map((_, i) => <span key={i} style={{ width: 22, height: 4, borderRadius: 2, background: i <= stp ? accent : 'var(--line2)', transition: 'background .4s' }} />)}</span>
          </div>
          <div key={hw + stp} className="enter col" style={{ gap: 4 }}>
            <strong style={{ fontSize: 18 }}><span className="mono" style={{ color: accent, fontSize: 13, marginRight: 8 }}>{stp + 1}/4</span>{ct}</strong>
            <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{cd}</span>
          </div>
          <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setPlay(p => p + 1); setStp(0) }}>↻ Replay</button>
        </div>
      </div>
      <div className="wrap-row" style={{ marginTop: 14, justifyContent: 'center' }} role="group" aria-label="Choose hardware">
        {HARDWARE.map(h => {
          const b = h.id === 'cir' || h.id === 'detector'
          return <button key={h.id} type="button" aria-pressed={hw === h.id} className={'chip' + (hw === h.id ? ' on' : '')} onClick={() => pick(h.id)}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: b ? 'var(--plasma)' : 'var(--ember)', display: 'inline-block', marginRight: 6 }} />{h.name}</button>
        })}
      </div>

      <section key={hw} className="split enter" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.25fr) minmax(0,1fr)', gap: 20 }}>
        <div className="card pad col" style={{ gap: 12 }}>
          <span className="eyebrow" style={{ fontSize: 11, color: accent }}>{cur.tag}</span>
          <span className="h2" style={{ fontSize: 26 }}>{cur.name}</span>
          <span className="mono faint" style={{ fontSize: 12 }}>{cur.where}</span>
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, background: '#07080a', padding: 8 }}><Cutaway id={hw} /></div>
          <div className="grid3" style={{ gap: 8 }}>{cur.facts.map(([n, t]) => <div key={t} className="col" style={{ gap: 4 }}><span className="mono" style={{ fontSize: 16, color: 'var(--text)' }}>{n}</span><span className="faint" style={{ fontSize: 11, lineHeight: 1.35 }}>{t}</span></div>)}</div>
        </div>
        <div className="card pad col" style={{ gap: 4 }}>
          <span className="lab" style={{ marginBottom: 8 }}>{onPurpose ? 'How a controlled fire runs' : info ? 'How it works' : 'How it turns into a fire'}</span>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {cur.chain.map(([t, d], i) => (
              <li key={t} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr)', gap: 12, padding: '12px 10px', borderTop: i ? '1px solid var(--line)' : 0, borderRadius: 8, background: i === stp ? (blue ? 'rgba(125,180,255,.08)' : 'var(--ember-soft)') : 'transparent', transition: 'background .4s' }}>
                <span className="mono" style={{ width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${accent}`, background: i <= stp ? accent : 'transparent', color: i <= stp ? '#0A0B0D' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, transition: 'all .4s' }}>{i + 1}</span>
                <span className="col" style={{ gap: 3 }}><strong style={{ fontSize: 15 }}>{t}</strong><span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{d}</span></span>
              </li>))}
          </ol>
        </div>
        <div className="card pad col" style={{ gap: 12 }}>
          <span className="lab">{onPurpose ? 'Why it is safe' : 'What NASA does about it'}</span>
          <span style={{ fontSize: 15, lineHeight: 1.6 }}>{cur.nasa}</span>
          {info && <Link to="/learn/2" className="btn sm" style={{ alignSelf: 'flex-start' }}>Watch the smoke race →</Link>}
          {hw === 'stowage' && <Link to="/lab" className="btn sm" style={{ alignSelf: 'flex-start' }}>Will it burn at 30% O₂? Fire Lab →</Link>}
          <span className="src" style={{ marginTop: 'auto' }}>{cur.src}</span>
        </div>
      </section>

      <section className="split" style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 28, alignItems: 'center' }}>
        <div className="col" style={{ gap: 12 }}>
          <span className="eyebrow plasma">Not every fire is an accident</span>
          <span className="h2" style={{ fontSize: 30 }}>Some fires are lit on purpose, to make Earth’s engines cleaner.</span>
          <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => { pick('cir'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Watch a fire inside the combustion rack ↑</button>
        </div>
        <div className="card pad col" style={{ gap: 12 }}>
          <div className="row" style={{ alignItems: 'baseline' }}><span className="h1" style={{ fontSize: 52 }}>86%</span><span className="muted" style={{ fontSize: 13 }}>of world energy came from fossil fuels in 2025</span></div>
          <div className="bar" style={{ height: 8 }}><span className="grow" style={{ width: '86%' }} /></div>
          <p className="p" style={{ fontSize: 15 }}>Burning fuel releases CO₂ and soot that warm the planet. On Earth, gravity makes flames flicker and hides their chemistry. In orbit a flame is steady and can be measured exactly, which helps design engines and burners that waste less and pollute less. Those experiments run sealed inside the Combustion Integrated Rack.</p>
          <span className="src">Energy Institute Statistical Review 2026 · NASA ACME: about 85% of the energy we use comes from combustion</span>
        </div>
      </section>
    </main>
    <LessonFoot k={0} />
  </>)
}

/* ---------------------------------------------------------------- 2 · how fire behaves */
export function Learn2() {
  return (<>
    <LessonHeader k={1} />
    <main className="wrap" style={{ paddingTop: 40 }}>
      <div className="col enter" style={{ gap: 12, marginBottom: 24, maxWidth: 900 }}>
        <div className="eyebrow ember">Step 2 · How fire behaves without gravity</div>
        <h1 className="h1" style={{ fontSize: 'clamp(32px, 4.2vw, 48px)' }}>On Earth smoke rises to the ceiling. In orbit it has nowhere to rise to.</h1>
        <p className="p" style={{ fontSize: 17 }}>On Earth, hot gas is lighter than the air around it, so it rises, pulls fresh air in from below and stretches a flame into a teardrop. In orbit nothing is lighter or heavier. The flame becomes a slow, round ball, and its smoke spreads only where the fans push it.</p>
      </div>
      <SmokeSim />
      <div style={{ margin: '28px 0 56px', display: 'flex', gap: 18, alignItems: 'center', padding: '14px 18px', borderLeft: '2px solid var(--ember)', background: 'var(--panel)', borderRadius: '0 8px 8px 0' }}>
        <span style={{ fontSize: 15, lineHeight: 1.5 }}>That is why smoke detectors on the ISS sit <strong>inside the ventilation system</strong>, not on a ceiling. And even there, NASA’s SAME tests found they often miss the tiny smoke from overheated electronics.</span>
        <span className="src" style={{ whiteSpace: 'nowrap' }}>NIST · NASA SAME (2018)</span>
      </div>
      <div className="col" style={{ gap: 10, marginBottom: 24 }}>
        <div className="eyebrow">Play with the physics</div>
        <h2 className="h2" style={{ fontSize: 34 }}>Where does the heat go? Change gravity and the fans.</h2>
        <p className="p" style={{ fontSize: 15, maxWidth: 820 }}>A hot patch of gas is released next to the fire. Slide gravity from the space station (0) to Earth (9.81) and watch buoyancy take over from the cabin fans. <Ev kind="physics" small /></p>
      </div>
      <PlumeSandbox />
    </main>
    <LessonFoot k={1} />
  </>)
}

/* ---------------------------------------------------------------- 3 · prevention */
const PREV = {
  heat: { t: 'Control ignition sources', s: 'Heat', body: 'Design power systems, wiring and batteries so they cannot overheat, and test batteries for thermal runaway. NASA’s lesson from the Apollo 1 fire: ignition sources can be reduced but never removed completely, so the other two sides of the triangle matter too.',
    eg: ['Wires run well below their current rating, so they stay cool', 'Battery packs tested so one failing cell cannot ignite its neighbours', 'Oxygen generators redesigned with a protective screen after Mir'], src: 'NASA TM-1999-209285 · NASA MSFC, Control of Materials Flammability Hazards (2001)' },
  fuel: { t: 'Choose materials that will not carry a flame', s: 'Fuel', body: 'Every material that flies is flammability-tested. NASA-STD-6001 Test 1 lights the bottom of a sample and checks whether the flame climbs it. Materials that fail are swapped, covered or kept in small amounts.',
    eg: ['Fire-resistant fabrics such as Nomex (it did not ignite in Saffire VI)', 'Limits on how much flammable material sits together', 'Stowage bags and trash handled to avoid fuel piles'], src: 'NASA-STD-6001B · NASA White Sands Test Facility' },
  oxy: { t: 'Control the oxygen', s: 'Oxygen', body: 'Life support manages the cabin’s oxygen. Moon bases and pressurized rovers are expected to run at 30% oxygen or more at 10.2 psi or less: over 40% more oxygen than Earth air, which makes materials much more flammable.',
    eg: ['Materials tested in the air they will actually fly in', 'This is where Flame in Freefall’s data helps: which materials burned near habitat air, and which were never tested'], src: 'NASA Space Apps 2026 challenge brief · NASA GRC flammability studies' },
}
const SIDE_COL = { heat: '255,122,61', oxy: '125,180,255', fuel: '230,180,90' }
export function Learn3() {
  const [s, setS] = useState(null)
  const cur = s && PREV[s]
  const Side = ({ k, style }) => {
    const on = s === k, c = SIDE_COL[k]
    return <button type="button" aria-pressed={on} onClick={() => setS(on ? null : k)} className="mono" style={{ position: 'absolute', background: on ? 'rgba(40,20,20,.92)' : 'rgba(10,11,13,.88)', border: `1.5px solid ${on ? 'rgba(255,90,80,.9)' : `rgb(${c})`}`, borderRadius: 999, padding: '10px 16px', cursor: 'pointer', color: on ? '#ff8a80' : `rgb(${c})`, fontSize: 13, textTransform: 'uppercase', boxShadow: on ? 'none' : `0 0 22px rgba(${c},.35)`, ...style }}>{on ? `✕ ${PREV[k].s}` : PREV[k].s}</button>
  }
  return (<>
    <LessonHeader k={2} />
    <main className="wrap" style={{ paddingTop: 40 }}>
      <div className="split" style={{ display: 'grid', gridTemplateColumns: '520px minmax(0,1fr)', gap: 56, alignItems: 'center' }}>
        <div className="col" style={{ gap: 10 }}>
          <div className="eyebrow ember">Step 3 · First line of defense</div>
          <h1 className="h1" style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>A fire needs three things. Prevention takes one away.</h1>
          <p className="p" style={{ fontSize: 14 }}>Heat, fuel and oxygen are all feeding this flame. Tap a side to take it away and watch what happens.</p>
          <div style={{ position: 'relative', width: '100%', maxWidth: 520, aspectRatio: '520 / 470' }}>
            <FireTriangle removed={s} />
            <Side k="heat" style={{ left: '4%', top: '36%' }} />
            <Side k="oxy" style={{ right: '2%', top: '36%' }} />
            <Side k="fuel" style={{ left: '50%', transform: 'translateX(-50%)', top: '85%' }} />
          </div>
        </div>
        <div key={s || 'all'} className="card col enter" style={{ padding: 32, gap: 16 }}>
          {!cur ? (<>
            <span className="eyebrow ember">The fire triangle</span>
            <span className="h2" style={{ fontSize: 34 }}>Heat + fuel + oxygen = fire</span>
            <span style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--muted)' }}>Every fire, on Earth or in orbit, needs all three at once. Spacecraft designers attack each side separately, so a single mistake is not enough to start a fire.</span>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{Object.entries(PREV).map(([k, v]) => <li key={k} className="row rule" style={{ padding: '12px 0', fontSize: 15 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: `rgb(${SIDE_COL[k]})` }} /><button type="button" onClick={() => setS(k)} style={{ background: 'none', border: 0, color: 'var(--text)', cursor: 'pointer', fontSize: 15, padding: 0, textAlign: 'left' }}><strong>{v.s}:</strong> {v.t.toLowerCase()} →</button></li>)}</ul>
          </>) : (<>
            <span className="eyebrow" style={{ color: `rgb(${SIDE_COL[s]})` }}>Take away the {cur.s.toLowerCase()} · the flame dies</span>
            <span className="h2" style={{ fontSize: 34 }}>{cur.t}</span>
            <span style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--muted)' }}>{cur.body}</span>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{cur.eg.map(e => <li key={e} className="row rule" style={{ padding: '12px 0', fontSize: 15, alignItems: 'flex-start' }}><span style={{ color: `rgb(${SIDE_COL[s]})` }}>→</span><span>{e}</span></li>)}</ul>
            <span className="src">{cur.src}</span>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn sm" onClick={() => setS(null)}>↻ Put it back and relight</button>
              {s === 'oxy' && <Link to="/lab" className="btn sm">Which materials burn at 30% O₂? Fire Lab →</Link>}
            </div>
          </>)}
        </div>
      </div>
    </main>
    <LessonFoot k={2} />
  </>)
}

/* ---------------------------------------------------------------- 4 · second line of defense */
const RESP = [
  { t: 'Detect', who: 'Automatic or crew', body: 'Smoke detectors sit on the ventilation intake ducts. A detector can sound the alarm automatically, or a crew member can push the fire button.', nasa: 'SAME and SAME-R measured microgravity smoke so the next detectors catch the small particles from electronics.' },
  { t: 'Cut power, stop the air', who: 'Automatic', body: 'The alarm removes power from the equipment racks to isolate the ignition source, shuts the fans and closes the vents between modules, and stops oxygen and nitrogen flowing into that module.', nasa: 'Flame in Freefall’s key finding: in still 30%+ oxygen air, flames may keep burning, so stopping the fans alone may not be enough.' },
  { t: 'Protect the crew', who: 'Crew', body: 'Astronauts put on breathing masks fed from their own oxygen bottle (about 15 minutes each) so they do not breathe smoke, carbon monoxide or extinguisher gas.', nasa: 'Saffire measured how much CO₂ and CO a burning fabric or plastic puts into the cabin.' },
  { t: 'Put it out', who: 'Crew', body: 'Portable extinguishers: carbon dioxide in the US segment (6 lb, empties in about 45 s), water-based foam in the Russian segment. NASA developed a fine water mist extinguisher that cools the fire without filling the air with CO₂.', nasa: 'FLEX tested how CO₂ and helium in the air put out burning fuel droplets.' },
  { t: 'Clean the air', who: 'Crew and life support', body: 'Sensors check carbon monoxide and other toxic gases; filters and scrubbers clean the atmosphere before masks come off. Leaving the station in the Soyuz is the last resort.', nasa: 'SAME-R and Saffire smoke data help size filters and air-quality checks.' },
]
const DUR = [7, 6.5, 6, 7.5, 9]
const HUD = [
  ['Duct smoke detector', ['Smoke arriving', 'ALARM', 'ALARM', 'ALARM', 'Reset'], [1, 2, 2, 2, 0]],
  ['Rack power', ['On', 'OFF', 'OFF', 'OFF', 'OFF until checked'], [0, 1, 1, 1, 1]],
  ['Fans and vents', ['Running', 'STOPPED · closed', 'STOPPED · closed', 'STOPPED · closed', 'On, through filters'], [0, 1, 1, 1, 0]],
  ['O₂ / N₂ feed', ['Open', 'CLOSED', 'CLOSED', 'CLOSED', 'CLOSED'], [0, 1, 1, 1, 1]],
  ['Crew', ['Working', 'Heading for masks', 'Masks on', 'Masks on', 'Masks on'], [0, 1, 0, 0, 0]],
  ['Fire', ['Burning', 'Burning in still air', 'Burning', 'Going out', 'Out'], [2, 2, 2, 1, 0]],
]
const SMOKE = [0.3, 0.55, 0.62, 0.72, 0.08], CO = [0.2, 0.45, 0.55, 0.6, 0.15]
const TONE = ['var(--muted)', '#ffb020', '#ff5a4e']
export function Learn4() {
  const [i, setI] = useState(0)
  const [auto, setAuto] = useState(true)
  const [pk, setPk] = useState(0)
  useEffect(() => {
    if (!auto || i >= 4) return
    const h = setTimeout(() => setI(i + 1), DUR[i] * 1000)
    return () => clearTimeout(h)
  }, [i, auto, pk])
  const cur = RESP[i]
  const goto = k => { setAuto(false); setI(k) }
  const replay = () => { setI(0); setAuto(true); setPk(p => p + 1) }
  return (<>
    <LessonHeader k={3} />
    <main className="wrap" style={{ paddingTop: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="col" style={{ gap: 6 }}>
          <div className="eyebrow ember">Step 4 · When prevention fails</div>
          <h1 className="h1" style={{ fontSize: 'clamp(26px, 3vw, 38px)' }}>A fire has started. Here is how the station fights back.</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {auto && i < 4 ? <button type="button" className="btn sm" onClick={() => setAuto(false)}>❚❚ Pause</button> : <button type="button" className="btn sm light" onClick={() => (i >= 4 ? replay() : setAuto(true))}>{i >= 4 ? '↻ Replay the whole response' : '▶ Continue'}</button>}
        </div>
      </div>
      <div style={STAGE}>
        <div style={{ aspectRatio: '16 / 9' }}><Cabin mode="response" step={i} playKey={pk} ariaLabel={`Fire response, step ${i + 1}: ${cur.t}. ${cur.body}`} /></div>
        <div className="cab-cap" aria-live="polite" style={{ borderLeft: '3px solid var(--ember)' }}>
          <span className="eyebrow ember" style={{ fontSize: 11 }}>Step 0{i + 1} · {cur.who}</span>
          <div key={i} className="enter col" style={{ gap: 4 }}>
            <strong style={{ fontSize: 20 }}>{cur.t}</strong>
            <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{cur.body}</span>
          </div>
        </div>
        <div className="cab-hud" aria-label="Station status">
          {HUD.map(([k, v, tone]) => (
            <div key={k} className="row" style={{ justifyContent: 'space-between', gap: 14, padding: '5px 0', borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <span className="faint" style={{ fontSize: 11 }}>{k}</span>
              <span className="mono" style={{ fontSize: 11, color: TONE[tone[i]], fontWeight: 600, textAlign: 'right' }}>{v[i]}</span>
            </div>))}
          {[['Smoke in the air', SMOKE[i]], ['Carbon monoxide', CO[i]]].map(([k, v]) => (
            <div key={k} className="col" style={{ gap: 4, paddingTop: 7 }}>
              <span className="faint" style={{ fontSize: 11 }}>{k}</span>
              <span style={{ height: 6, borderRadius: 3, background: '#22262d', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${v * 100}%`, background: v > 0.5 ? '#ff5a4e' : v > 0.25 ? '#ffb020' : '#3ee08f', transition: 'width 2.5s ease, background 2.5s' }} /></span>
            </div>))}
          <span className="faint" style={{ fontSize: 10, paddingTop: 6 }}>Levels are illustrative</span>
        </div>
      </div>
      <ol className="resp-steps" style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 8 }}>
        {RESP.map((r, k) => (
          <li key={r.t}>
            <button type="button" aria-current={k === i ? 'step' : undefined} onClick={() => goto(k)} style={{ width: '100%', position: 'relative', overflow: 'hidden', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', border: `1px solid ${k === i ? 'var(--ember)' : 'var(--line)'}`, background: k === i ? 'var(--ember-soft)' : k < i ? 'var(--panel2)' : 'transparent', color: 'var(--text)' }}>
              <span className="mono" style={{ fontSize: 11, color: k <= i ? 'var(--ember)' : 'var(--faint)' }}>0{k + 1}</span>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600, marginTop: 2 }}>{r.t}</span>
              {k === i && auto && i < 4 && <span key={`${pk}-${i}`} style={{ position: 'absolute', left: 0, bottom: 0, height: 3, background: 'var(--ember)', animation: `fill ${DUR[i]}s linear forwards` }} />}
              {k < i && <span style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: '100%', background: 'var(--ember)', opacity: 0.5 }} />}
            </button>
          </li>))}
      </ol>
      <div key={i} className="split enter" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16 }}>
        <div className="card pad col" style={{ gap: 8 }}><span className="eyebrow ember" style={{ fontSize: 11 }}>What happens · {cur.who}</span><span style={{ fontSize: 15, lineHeight: 1.6 }}>{cur.body}</span></div>
        <div className="col" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 20, gap: 8 }}><span className="eyebrow plasma" style={{ fontSize: 11 }}>What NASA’s experiments add</span><span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--muted)' }}>{cur.nasa}</span></div>
      </div>
      <span className="src" style={{ display: 'block', marginTop: 12 }}>NASA ISS Fire Detection &amp; Suppression overview (2001) · NASA fine water mist extinguisher papers · ESA/Tim Peake · Illustration, not to scale</span>
    </main>
    <LessonFoot k={3} />
  </>)
}
