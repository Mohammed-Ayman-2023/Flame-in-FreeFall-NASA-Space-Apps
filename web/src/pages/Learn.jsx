import { useState } from 'react'
import { Link } from '../lib/router'
import { Mark, Flame, Ev } from '../components/ui'
import SmokeSim from '../sims/SmokeSim'
import PlumeSandbox from '../sims/PlumeSandbox'

export const STEPS = [['Why fires start', '/learn/1'], ['How fire behaves', '/learn/2'], ['Prevention', '/learn/3'], ['Second line of defense', '/learn/4'], ['Try it yourself', '/lab']]

export function LessonHeader({ k }) {
  return (
    <header style={{ borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 30, background: 'rgba(10,11,13,.94)', backdropFilter: 'blur(8px)' }}>
      <div style={{ maxWidth: 1344, margin: '0 auto', padding: '16px 32px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" className="row" style={{ gap: 10 }}><Mark /><span className="disp" style={{ fontWeight: 600, fontSize: 16 }}>Flame in Freefall</span></Link>
        <nav aria-label="Lesson steps" className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {STEPS.map(([t, to], i) => {
            const on = i === k, done = i < k, c = on ? 'var(--ember)' : done ? 'var(--text)' : 'var(--line2)'
            return (
              <span key={t} className="row" style={{ gap: 8 }}>
                <Link to={to} aria-current={on ? 'step' : undefined} className="row" style={{ gap: 8, fontSize: 13, color: on ? 'var(--text)' : done ? 'var(--muted)' : 'var(--faint)', fontWeight: on ? 600 : 400 }}>
                  <span className="mono" style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${c}`, background: on || done ? c : 'transparent', color: '#0A0B0D', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span className="hide-sm">{t}</span>
                </Link>
                {i < STEPS.length - 1 && <span aria-hidden="true" style={{ width: 22, height: 2, background: done ? 'var(--ember)' : 'var(--line2)' }} />}
              </span>
            )
          })}
        </nav>
        <Link to="/explore" className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>Skip to the archive →</Link>
      </div>
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
const HW = [
  { id: 'batt', x: 560, y: 190, name: 'Lithium-ion batteries', tag: 'Malfunction · the fastest-growing risk',
    text: 'About 100 laptops fly on the ISS, plus tablets, cameras and tools. A damaged or faulty cell can go into thermal runaway: it heats itself, vents gas and can burn. Most of that gas is CO₂ and carbon monoxide, and the station is much better at scrubbing CO₂ than CO.',
    src: 'NASA NTRS 20200000365 · NASA JSC, Li-ion propagation risk (2019)' },
  { id: 'elec', x: 330, y: 118, name: 'Electronics and wiring', tag: 'Malfunction · the most likely source',
    text: 'Overheated circuits and wire insulation are the most likely source of fire and smoke in space. ESA astronaut Tim Peake: electricity is the most likely cause of a fire on board, so the first move is to cut the power.',
    src: 'NIST/NASA SAME study (2018) · ESA astronaut Tim Peake (2016)' },
  { id: 'oxy', x: 150, y: 210, name: 'Oxygen generator', tag: 'Malfunction · it has happened',
    text: 'In February 1997 an oxygen-generating canister on the Mir station burst into flame and filled the station with smoke. The ISS carries similar generators, redesigned after Mir with a protective screen.',
    src: 'NASA APPEL · NASA “Fire Prevention in Space” (2004)' },
  { id: 'insul', x: 420, y: 300, name: 'Hot insulation and plastics', tag: 'Malfunction · hard to detect',
    text: 'When Teflon and Kapton, used all over electronics, overheat, they make very small smoke particles. In NASA’s SAME tests, the station’s smoke detector often missed them.',
    src: 'NIST/NASA SAME, Fire Safety Journal 98 (2018)' },
  { id: 'trash', x: 245, y: 322, name: 'Trash and stowage', tag: 'Fuel · what a small fire grows on',
    text: 'Bags, clothing, packing foam and stored trash are fuel. NASA lists ignition of accumulated trash among the ways spacecraft fires start, and limits how much flammable material can sit together.',
    src: 'NASA TM-1999-209285, Fire Safety in the Low-Gravity Spacecraft Environment' },
]

function Module() {
  const racks = []
  for (let x = 64; x < 660; x += 102) racks.push(<g key={x}><rect x={x} y="60" width="90" height="52" rx="5" fill="#151920" stroke="#252930" /><rect x={x} y="308" width="90" height="52" rx="5" fill="#151920" stroke="#252930" /></g>)
  return (
    <svg viewBox="0 0 720 420" width="100%" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="6" y="20" width="708" height="380" rx="175" fill="#0d0f12" stroke="#33373F" strokeWidth="2" />
      <rect x="50" y="52" width="620" height="316" rx="16" fill="#101318" stroke="#252930" />
      {racks}
      <path d="M64 120 C 240 110, 420 132, 656 116" fill="none" stroke="#3a3f48" strokeWidth="3" />
      <rect x="128" y="168" width="44" height="78" rx="8" fill="#1d222a" stroke="#4a505a" />
      <rect x="520" y="166" width="84" height="52" rx="4" fill="#1d222a" stroke="#4a505a" /><rect x="527" y="172" width="70" height="36" fill="#0a0c0f" />
      <rect x="200" y="292" width="100" height="56" rx="14" fill="#2a2620" stroke="#5a5040" />
      <rect x="372" y="286" width="110" height="22" rx="3" fill="#25303a" stroke="#4a5866" />
      <rect x="600" y="230" width="56" height="74" rx="5" fill="#141a22" stroke="#7DB4FF" strokeOpacity=".55" /><circle cx="628" cy="262" r="14" fill="none" stroke="#7DB4FF" strokeOpacity=".7" />
      <text x="628" y="318" textAnchor="middle" fill="#7DB4FF" fontFamily="IBM Plex Mono" fontSize="9">EXPERIMENT RACK</text>
      <text x="360" y="414" textAnchor="middle" fill="#868B93" fontFamily="IBM Plex Mono" fontSize="10">INSIDE A STATION MODULE · ILLUSTRATION</text>
    </svg>
  )
}

export function Learn1() {
  const [hw, setHw] = useState('batt')
  const cur = HW.find(h => h.id === hw)
  return (<>
    <LessonHeader k={0} />
    <main className="wrap" style={{ paddingTop: 40 }}>
      <div className="col enter" style={{ gap: 12, marginBottom: 28 }}>
        <div className="eyebrow ember">Step 1 · Why fires start on a space station</div>
        <h1 className="h1" style={{ fontSize: 'clamp(34px, 4.5vw, 52px)' }}>Two kinds of fire: the ones we light, and the ones nobody wants.</h1>
      </div>
      <div className="split" style={{ display: 'grid', gridTemplateColumns: '400px minmax(0,1fr)', gap: 28 }}>
        <section className="card pad col enter" style={{ gap: 14 }}>
          <span className="eyebrow plasma">Cause 1 · fires we light on purpose</span>
          <span className="h2" style={{ fontSize: 28 }}>Combustion experiments</span>
          <p className="p" style={{ fontSize: 15 }}>Scientists burn fuels on the station on purpose, sealed inside racks built for it. Why? Most of humanity’s energy still comes from burning things:</p>
          <div className="row" style={{ alignItems: 'baseline' }}><span className="h1" style={{ fontSize: 56 }}>86%</span><span className="muted" style={{ fontSize: 13 }}>of world energy came from fossil fuels in 2025</span></div>
          <div className="bar" style={{ height: 8 }}><span className="grow" style={{ width: '86%' }} /></div>
          <p className="p" style={{ fontSize: 15 }}>Burning them releases CO₂ and soot that warm the planet. On Earth, gravity makes flames flicker and hides their chemistry. In orbit a flame is steady, so it can be measured exactly, and that knowledge helps design engines and burners that waste less and pollute less.</p>
          <div style={{ padding: '12px 14px', border: '1px dashed var(--line2)', borderRadius: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--muted)' }}>These fires are controlled and contained. The fires crews worry about are the ones nobody planned. →</div>
          <span className="src">Energy Institute Statistical Review 2026 · NASA ACME: about 85% of the energy we use comes from combustion</span>
        </section>
        <section className="col" style={{ gap: 14, minWidth: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="col" style={{ gap: 6 }}><span className="eyebrow ember">Cause 2 · fires nobody wants</span><h2 className="h2" style={{ fontSize: 34 }}>What can go wrong on board?</h2></div>
            <span className="muted" style={{ fontSize: 13 }}>Tap a glowing point or a name.</span>
          </div>
          <div className="split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 20 }}>
            <div className="col" style={{ gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <Module />
                {HW.map(h => (
                  <button key={h.id} type="button" aria-label={h.name} aria-pressed={hw === h.id} onClick={() => setHw(h.id)}
                    style={{ position: 'absolute', left: `${h.x / 7.2}%`, top: `${h.y / 4.2}%`, width: 44, height: 44, margin: '-22px 0 0 -22px', border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="pulse" style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--ember)' }} />
                    <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--ember)', background: hw === h.id ? 'var(--ember)' : 'rgba(255,122,61,.3)' }} />
                  </button>
                ))}
              </div>
              <div className="wrap-row" style={{ gap: 4 }}>
                {HW.map(h => <button key={h.id} type="button" onClick={() => setHw(h.id)} style={{ border: 0, borderLeft: `2px solid ${hw === h.id ? 'var(--ember)' : 'transparent'}`, background: hw === h.id ? 'var(--panel2)' : 'transparent', color: hw === h.id ? 'var(--text)' : 'var(--muted)', padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>{h.name}</button>)}
              </div>
            </div>
            <div key={hw} className="card pad col enter" style={{ gap: 12 }}>
              <span className="eyebrow ember" style={{ fontSize: 11 }}>{cur.tag}</span>
              <span className="h2" style={{ fontSize: 26 }}>{cur.name}</span>
              <span style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--muted)' }}>{cur.text}</span>
              <span className="src" style={{ marginTop: 'auto' }}>{cur.src}</span>
            </div>
          </div>
        </section>
      </div>
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
export function Learn3() {
  const [s, setS] = useState('fuel')
  const cur = PREV[s]
  const col = k => (k === s ? '#FF7A3D' : '#33373F'), wd = k => (k === s ? 8 : 4)
  const Side = ({ k, style }) => <button type="button" aria-pressed={s === k} onClick={() => setS(k)} className="mono" style={{ position: 'absolute', background: 'var(--bg)', border: '1px solid var(--line2)', borderRadius: 999, padding: '10px 16px', cursor: 'pointer', color: s === k ? 'var(--text)' : 'var(--faint)', fontSize: 13, textTransform: 'uppercase', ...style }}>{PREV[k].s}</button>
  return (<>
    <LessonHeader k={2} />
    <main className="wrap" style={{ paddingTop: 40 }}>
      <div className="split" style={{ display: 'grid', gridTemplateColumns: '520px minmax(0,1fr)', gap: 56, alignItems: 'center' }}>
        <div className="col" style={{ gap: 10 }}>
          <div className="eyebrow ember">Step 3 · First line of defense</div>
          <h1 className="h1" style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>A fire needs three things. Prevention takes one away.</h1>
          <p className="p" style={{ fontSize: 14 }}>Tap a side of the triangle.</p>
          <div style={{ position: 'relative', width: '100%', maxWidth: 520, aspectRatio: '520 / 470' }}>
            <svg viewBox="0 0 520 470" width="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
              <line x1="260" y1="40" x2="40" y2="420" stroke={col('heat')} strokeWidth={wd('heat')} strokeLinecap="round" />
              <line x1="260" y1="40" x2="480" y2="420" stroke={col('oxy')} strokeWidth={wd('oxy')} strokeLinecap="round" />
              <line x1="40" y1="420" x2="480" y2="420" stroke={col('fuel')} strokeWidth={wd('fuel')} strokeLinecap="round" />
            </svg>
            <div className="breathe" style={{ position: 'absolute', left: '35.5%', top: '43.5%' }}><Flame size={150} soot /></div>
            <Side k="heat" style={{ left: '6%', top: '36%' }} />
            <Side k="oxy" style={{ right: '4%', top: '36%' }} />
            <Side k="fuel" style={{ left: '41%', top: '85%' }} />
          </div>
        </div>
        <div key={s} className="card col enter" style={{ padding: 32, gap: 16 }}>
          <span className="eyebrow ember">Remove the {cur.s.toLowerCase()}</span>
          <span className="h2" style={{ fontSize: 34 }}>{cur.t}</span>
          <span style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--muted)' }}>{cur.body}</span>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{cur.eg.map(e => <li key={e} className="row rule" style={{ padding: '12px 0', fontSize: 15, alignItems: 'flex-start' }}><span style={{ color: 'var(--ember)' }}>→</span><span>{e}</span></li>)}</ul>
          <span className="src">{cur.src}</span>
          {s === 'oxy' && <Link to="/lab" className="btn sm" style={{ alignSelf: 'flex-start' }}>See which materials burn at 30% O₂ in the Fire Lab →</Link>}
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
export function Learn4() {
  const [i, setI] = useState(0)
  const cur = RESP[i]
  const fire = [1, .9, .85, .25, 0][i], smoke = [.5, .55, .5, .35, .08][i]
  return (<>
    <LessonHeader k={3} />
    <main className="wrap" style={{ paddingTop: 40 }}>
      <div className="split" style={{ display: 'grid', gridTemplateColumns: '380px minmax(0,1fr)', gap: 40 }}>
        <div className="col" style={{ gap: 14 }}>
          <div className="eyebrow ember">Step 4 · When prevention fails</div>
          <h1 className="h1" style={{ fontSize: 'clamp(32px, 4vw, 44px)' }}>The second line of defense</h1>
          <p className="p" style={{ fontSize: 15 }}>Fire safety in space assumes a fire can still start. These steps react to it, in order.</p>
          <ol style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RESP.map((r, k) => (
              <li key={r.t}><button type="button" aria-current={k === i ? 'step' : undefined} onClick={() => setI(k)} style={{ width: '100%', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left', border: `1px solid ${k === i ? 'var(--ember)' : k < i ? 'var(--line2)' : 'var(--line)'}`, background: k === i ? 'var(--ember-soft)' : k < i ? 'var(--panel2)' : 'transparent' }}>
                <span className="mono" style={{ fontSize: 12, color: k <= i ? 'var(--ember)' : 'var(--faint)' }}>0{k + 1}</span>
                <span className="col" style={{ gap: 2 }}><span style={{ fontSize: 16, fontWeight: 600 }}>{r.t}</span><span className="mono faint" style={{ fontSize: 10 }}>{r.who}</span></span>
              </button></li>))}
          </ol>
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '640 / 380', border: '1px solid var(--line)', borderRadius: 14, background: '#07080a', overflow: 'hidden' }}>
            <svg viewBox="0 0 640 380" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
              <rect x="10" y="30" width="620" height="320" rx="150" fill="#0d0f12" stroke="#33373F" strokeWidth="2" />
              <rect x="50" y="60" width="540" height="260" rx="14" fill="#101318" stroke="#252930" />
              {[0, 1, 2, 3, 4, 5].map(n => <rect key={n} x={70 + n * 80} y="72" width="70" height="40" rx="5" fill="#1a2028" stroke="#2c333d" style={{ opacity: i >= 1 ? .35 : 1, transition: 'opacity .6s' }} />)}
              {i >= 1 && <text x="70" y="132" fill="#7DB4FF" fontFamily="IBM Plex Mono" fontSize="10">POWER OFF · FANS OFF · O₂ FEED CLOSED</text>}
              {i >= 0 && <text x="470" y="160" fill="#FF7A3D" fontFamily="IBM Plex Mono" fontSize="10">● DUCT DETECTOR · ALARM</text>}
              {i >= 2 && <text x="470" y="250" fill="#EEECE7" fontFamily="IBM Plex Mono" fontSize="10">CREW ON MASKS</text>}
              {i >= 3 && <rect x="390" y="205" width="110" height="10" rx="5" fill="rgba(220,235,255,.7)" />}
              {i >= 4 && <text x="70" y="300" fill="#3ee08f" fontFamily="IBM Plex Mono" fontSize="10">CO AND SMOKE BEING SCRUBBED</text>}
            </svg>
            <div aria-hidden="true" style={{ position: 'absolute', left: '23%', top: '39%', width: '38%', height: '42%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,204,210,.55), rgba(200,204,210,0) 70%)', opacity: smoke, transition: 'opacity .7s' }} />
            <div style={{ position: 'absolute', left: '33.5%', top: '46%', opacity: fire, transform: `scale(${[1, .95, .9, .5, .2][i]})`, transition: 'all .7s' }}><Flame size={110} soot /></div>
          </div>
          <div key={i} className="split enter" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16 }}>
            <div className="card pad col" style={{ gap: 8 }}><span className="eyebrow ember" style={{ fontSize: 11 }}>Step 0{i + 1} · {cur.t}</span><span style={{ fontSize: 15, lineHeight: 1.6 }}>{cur.body}</span></div>
            <div className="col" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 20, gap: 8 }}><span className="eyebrow plasma" style={{ fontSize: 11 }}>What NASA’s experiments add</span><span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--muted)' }}>{cur.nasa}</span></div>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn sm" onClick={() => setI(Math.max(0, i - 1))}>← Previous step</button>
            <button type="button" className="btn sm light" onClick={() => setI(Math.min(4, i + 1))}>Next step →</button>
            <span className="src" style={{ marginLeft: 'auto' }}>NASA ISS Fire Detection &amp; Suppression overview (2001) · NASA fine water mist extinguisher papers · ESA/Tim Peake</span>
          </div>
        </div>
      </div>
    </main>
    <LessonFoot k={3} />
  </>)
}
