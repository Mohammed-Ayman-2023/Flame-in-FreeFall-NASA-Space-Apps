/* A station module, drawn as a side cut-away, with the hardware that can start a fire.
   Illustration only, not to scale. Every fact in HARDWARE carries its NASA source. */

export const HARDWARE = [
  {
    id: 'battery', name: 'Lithium-ion batteries', where: 'Laptops, tablets, cameras, power tools', tag: 'Malfunction · the fastest-growing risk', x: 870, y: 300,
    facts: [['~100', 'laptops on the ISS'], ['42 Wh', 'Surface Pro tablet pack, 4 pouch cells'], ['80–90%', 'of vent gas is CO₂ + CO']],
    chain: [
      ['Damage or defect', 'A crushed cell, a manufacturing flaw or lithium dendrites short the inside of a cell.'],
      ['Thermal runaway', 'The separator melts, the cell heats itself and the electrolyte reacts. It cannot be switched off.'],
      ['Venting', 'Hot gas, mostly CO₂ and carbon monoxide, bursts out. In zero g the force can propel an unsecured battery.'],
      ['Spread', 'Heat ignites the next cell in the pack, then nearby fabric or a stowage bag.'],
    ],
    nasa: 'NASA tests packs so one failing cell cannot ignite its neighbours, and proposed burning tablet batteries inside a Cygnus cargo ship to measure such a fire. The station scrubs CO₂ well but CO much less well.',
    src: 'NASA NTRS 20200000365 (Li-ion fires in spacecraft) · NASA JSC, Li-ion cell-to-cell propagation risk (2019)',
  },
  {
    id: 'wiring', name: 'Wiring and cable bundles', where: 'Behind every rack and along the ceiling', tag: 'Malfunction · the most likely source', x: 520, y: 92,
    facts: [['Teflon, Kapton', 'common wire insulation'], ['Test 18', 'NASA arc-tracking test'], ['#1', 'electricity is the likeliest cause (crew view)']],
    chain: [
      ['Chafe or overload', 'Insulation is rubbed through, a connector loosens or a wire carries too much current.'],
      ['Heat or arc', 'The wire overheats, or current jumps as an arc and burns along the insulation (arc tracking).'],
      ['Smoke first', 'Overheated Teflon and Kapton make very small smoke particles, often before any flame.'],
      ['Ignition', 'The hot spot ignites insulation or a nearby material, hidden behind a panel.'],
    ],
    nasa: 'Wires run well below their current rating. Insulation must pass NASA-STD-6001 wire flammability and arc-tracking tests. A fire alarm first removes power from the racks.',
    src: 'NASA-STD-6001B (Test 4 wire insulation, Test 18 arc tracking) · NASA TM-1999-209285 · ESA, Tim Peake (2016)',
  },
  {
    id: 'oxygen', name: 'Oxygen generator (“candle”)', where: 'Solid-fuel oxygen generator, Russian segment', tag: 'Malfunction · it has happened', x: 120, y: 230,
    facts: [['~1 L', 'lithium perchlorate per candle'], ['24 h', 'oxygen for one person'], ['1997', 'Mir: smoke filled the station']],
    chain: [
      ['Ignite the candle', 'A crew member fires the candle so the chemical block releases oxygen as it heats.'],
      ['Contamination', 'A flaw or contaminant makes the reaction run hotter than designed.'],
      ['Burn-through', 'The metal tube itself burns in the oxygen it makes: on Mir it sprayed molten metal and sparks.'],
      ['Blocked escape', 'On Mir, the jet blocked the route to the Soyuz escape ship and three extinguishers were used.'],
    ],
    nasa: 'The ISS generators were redesigned after Mir with a protective screen, and NASA and Roscosmos tested contaminated candles to find the cause.',
    src: 'NASA APPEL, “Fire on Mir” · NASA, Fire Prevention in Space (2004) · Vika oxygen generator',
  },
  {
    id: 'avionics', name: 'Electronics boxes', where: 'Avionics drawers inside the racks', tag: 'Malfunction · hard to detect', x: 400, y: 392,
    facts: [['Small', 'smoke particles from Teflon, Kapton'], ['Often missed', 'by the ISS detector in SAME'], ['0', 'flames needed for a smoke alarm']],
    chain: [
      ['Component fails', 'A capacitor, resistor or power supply overheats on a circuit board.'],
      ['Smoulder', 'Board materials and wire insulation pyrolyse: smoke with little or no flame.'],
      ['Detection gap', 'The smoke particles are small. In NASA’s SAME tests the ISS photoelectric detector often missed them.'],
      ['Spread in the duct', 'Fans carry the smoke through the module before anyone sees it.'],
    ],
    nasa: 'SAME and SAME-R measured microgravity smoke from real spacecraft materials so the next generation of detectors can catch it.',
    src: 'NIST/NASA SAME, Fire Safety Journal 98 (2018)',
  },
  {
    id: 'stowage', name: 'Stowage bags and trash', where: 'Cargo bags, clothing, packing foam', tag: 'Fuel · what a small fire grows on', x: 270, y: 300,
    facts: [['Foam', 'Pyrell packing foam, tested in SAME-R'], ['Fabric', 'cotton-fiberglass burned in BASS and Saffire'], ['Limits', 'on how much can sit together']],
    chain: [
      ['A small ignition', 'A hot battery, wire or device touches a bag.'],
      ['Fuel load', 'Stacked bags, clothes, foam and trash give the flame something to grow on.'],
      ['Air feeds it', 'Cabin fans bring oxygen and can push the flame in any direction, not just up.'],
      ['Bigger fire', 'A fire that would have gone out now spreads across the stack.'],
    ],
    nasa: 'Every material is flammability-tested and flammable items are limited in amount and kept apart. NASA lists ignition of accumulated trash among the ways spacecraft fires start.',
    src: 'NASA TM-1999-209285 · NASA-STD-6001B · Saffire and BASS results in this archive',
  },
  {
    id: 'cir', name: 'Combustion Integrated Rack', where: 'The station’s fire laboratory', tag: 'On purpose · a controlled fire', x: 1035, y: 392,
    facts: [['26 gal', 'sealed combustion chamber'], ['5', 'cameras watching each flame'], ['1,500+', 'fires lit on the ISS']],
    chain: [
      ['Sealed chamber', 'Fuel and gas are loaded into a strong, closed chamber, apart from the cabin air.'],
      ['Ignite and film', 'The flame is lit by command and filmed by the rack’s cameras and sensors.'],
      ['Contain', 'The flame and its products stay inside the chamber, apart from the cabin air.'],
      ['Data to Earth', 'The results go to NASA’s PSI archive: the 1,517 tests on this site.'],
    ],
    nasa: 'These are the fires we light on purpose, to make engines on Earth cleaner and spacecraft safer. They are contained by design.',
    src: 'NASA Glenn, Combustion Integrated Rack · Astronomy (2023) · NASA PSI',
  },
  {
    id: 'detector', name: 'Smoke detector', where: 'Inside the ventilation intake duct', tag: 'Detection · where the alarm sits', x: 1010, y: 92,
    facts: [['In the duct', 'not on a ceiling: there is no up'], ['IR laser', 'forward-scattered light'], ['0.3 µm', 'smallest particle it reports']],
    chain: [
      ['Fans pull air in', 'Cabin air is drawn through the intake filter, past the detector.'],
      ['Light scatters', 'Smoke particles in the beam scatter laser light onto a sensor.'],
      ['Alarm', 'Above a threshold the detector triggers the automatic fire response.'],
      ['Blind spot', 'With the fans off, or with very small particles, smoke may never reach or trigger it.'],
    ],
    nasa: 'This is step 2 of the lesson: see the smoke race between an Earth ceiling detector and a station duct detector.',
    src: 'NASA ISS Fire Detection and Suppression overview (2001) · NASA GRC, smoke detection on ISS (2007) · NIST',
  },
]

const S = { hull: '#0d0f12', panel: '#151920', line: '#252930', line2: '#33373F', mid: '#4a505a', text: '#A6AAB1', faint: '#6e737b' }
const Txt = ({ x, y, children, anchor = 'start', size = 9, fill = S.faint }) => <text x={x} y={y} textAnchor={anchor} fill={fill} fontFamily="IBM Plex Mono, monospace" fontSize={size}>{children}</text>

function Rack({ x, y, w = 130, h = 78, label, vents = true }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="4" fill={S.panel} stroke={S.line} />
      <rect x={x + 6} y={y + 6} width={w - 12} height={h * 0.45} rx="2" fill="#11151b" stroke={S.line} />
      {vents && [0, 1, 2, 3, 4].map(i => <line key={i} x1={x + 10} x2={x + w * 0.45} y1={y + h * 0.62 + i * 4} y2={y + h * 0.62 + i * 4} stroke={S.line2} />)}
      <circle cx={x + w - 14} cy={y + h - 12} r="3" fill="#2c333d" />
      {label && <Txt x={x + 8} y={y + h - 6} size={7.5}>{label}</Txt>}
    </g>
  )
}

export function ModuleScene({ sel, onPick }) {
  const hot = id => sel === id
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 1200 500" width="100%" role="img" aria-label="Cut-away illustration of a space station module showing the hardware that can start a fire" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FF7A3D" stopOpacity=".65" /><stop offset="100%" stopColor="#FF7A3D" stopOpacity="0" /></radialGradient>
          <linearGradient id="screen" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="#1d2a3a" /><stop offset="100%" stopColor="#0d141c" /></linearGradient>
          <pattern id="net" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0 L10 10 M10 0 L0 10" stroke="#3a3f48" strokeWidth=".8" /></pattern>
        </defs>
        {/* hull with ring frames */}
        <rect x="8" y="14" width="1184" height="472" rx="210" fill={S.hull} stroke={S.line2} strokeWidth="2" />
        {[230, 470, 730, 970].map(x => <line key={x} x1={x} x2={x} y1="20" y2="480" stroke="#14171c" strokeWidth="6" />)}
        <rect x="70" y="44" width="1060" height="412" rx="18" fill="#101318" stroke={S.line} />
        {/* ceiling racks */}
        {[90, 230, 370, 650, 790].map((x, i) => <Rack key={x} x={x} y="120" label={['STOWAGE', 'AVIONICS', 'LIFE SUPPORT', 'POWER', 'STOWAGE'][i]} />)}
        {/* floor racks */}
        {[90, 230, 650, 790].map((x, i) => <Rack key={x} x={x} y="350" label={['STOWAGE', 'AVIONICS', 'EXPERIMENT', 'CREW'][i]} />)}

        {/* cable bundle along the ceiling, with a junction */}
        <path d="M80 92 C 300 80, 560 104, 1120 86" fill="none" stroke="#3a3f48" strokeWidth="9" strokeLinecap="round" />
        <path d="M80 96 C 300 84, 560 108, 1120 90" fill="none" stroke="#2a2e35" strokeWidth="2" />
        <rect x="502" y="80" width="36" height="24" rx="3" fill="#1d222a" stroke={S.mid} />
        {[506, 514, 522, 530].map(x => <line key={x} x1={x} x2={x} y1="104" y2="114" stroke={S.mid} strokeWidth="2" />)}
        <Txt x={545} y={78}>CABLE BUNDLE · CONNECTOR</Txt>
        {hot('wiring') && <g><circle cx="520" cy="92" r="40" fill="url(#glow)" className="pulse" /><path d="M512 90 l8 -10 l-2 8 l9 -3 l-10 12 l2 -7z" fill="#FFD27A" /></g>}

        {/* ventilation intake duct with smoke detector */}
        <rect x="940" y="62" width="150" height="40" rx="6" fill="#141a22" stroke={S.line2} />
        {[950, 962, 974, 986, 998].map(x => <line key={x} x1={x} x2={x} y1="68" y2="96" stroke={S.line2} />)}
        <rect x="1012" y="70" width="34" height="24" rx="4" fill="#1d222a" stroke="#7DB4FF" strokeOpacity={hot('detector') ? 1 : .5} />
        <circle cx="1029" cy="82" r="5" fill={hot('detector') ? '#FF7A3D' : '#2c333d'} />
        <Txt x={940} y={56}>VENT INTAKE · SMOKE DETECTOR</Txt>

        {/* solid-fuel oxygen generator on the aft wall */}
        <rect x="88" y="214" width="76" height="110" rx="6" fill="#1a1f27" stroke={S.mid} />
        <rect x="100" y="226" width="22" height="86" rx="10" fill="#2a2f38" stroke="#5a606a" />
        <rect x="104" y="232" width="14" height="56" rx="6" fill="#3a3530" />
        <rect x="130" y="230" width="24" height="36" rx="3" fill="#11151b" stroke={S.line2} />
        {[236, 244, 252].map(y => <line key={y} x1="134" x2="150" y1={y} y2={y} stroke={S.line2} />)}
        <Txt x={88} y={340}>O₂ GENERATOR</Txt><Txt x={88} y={350}>“CANDLE”</Txt>
        {hot('oxygen') && <g><circle cx="111" cy="260" r="46" fill="url(#glow)" className="pulse" />{[0, 1, 2, 3, 4].map(i => <circle key={i} cx={130 + i * 14} cy={250 - i * 6} r={2.5 - i * 0.3} fill="#FFD27A" />)}</g>}

        {/* stowage bags in a net */}
        <rect x="200" y="252" width="150" height="76" rx="10" fill="url(#net)" stroke="#5a5040" />
        {[[208, 262, 60, 30], [272, 258, 70, 34], [214, 296, 72, 28], [292, 296, 50, 28]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx="8" fill="#2a2620" stroke="#5a5040" opacity=".95" />)}
        {[[230, 262], [300, 258]].map(([x, y], i) => <line key={i} x1={x} x2={x} y1={y} y2={y + 30} stroke="#6a5f4a" strokeWidth="2" />)}
        <Txt x={200} y={344}>CARGO BAGS · FOAM · TRASH</Txt>
        {hot('stowage') && <circle cx="275" cy="290" r="60" fill="url(#glow)" className="pulse" />}

        {/* open avionics drawer with circuit boards */}
        <rect x="330" y="372" width="140" height="58" rx="3" fill="#141a22" stroke={S.mid} />
        {[0, 1, 2].map(i => <g key={i}><rect x={340 + i * 42} y={380} width="36" height="42" rx="2" fill="#173024" stroke="#2f5a43" />
          {[0, 1, 2, 3].map(j => <rect key={j} x={345 + i * 42 + (j % 2) * 14} y={386 + Math.floor(j / 2) * 16} width="9" height="9" fill="#0d1a13" stroke="#3d6b52" strokeWidth=".6" />)}</g>)}
        <Txt x={330} y={444}>AVIONICS DRAWER · CIRCUIT BOARDS</Txt>
        {hot('avionics') && <g><circle cx="400" cy="398" r="50" fill="url(#glow)" className="pulse" />{[0, 1, 2].map(i => <circle key={i} cx={392 + i * 10} cy={368 - i * 9} r={5 + i * 2} fill="#C8CCD2" opacity={.35 - i * .08} />)}</g>}

        {/* laptop on an articulating arm */}
        <path d="M760 214 L792 236 L812 258" fill="none" stroke={S.mid} strokeWidth="5" strokeLinecap="round" />
        <rect x="760" y="206" width="14" height="16" rx="3" fill={S.mid} />
        <g transform="rotate(-6 860 262)">
          <rect x="800" y="210" width="116" height="74" rx="4" fill="#1d222a" stroke={S.mid} />
          <rect x="806" y="216" width="104" height="62" rx="2" fill="url(#screen)" />
          {[0, 1, 2, 3].map(i => <rect key={i} x="814" y={224 + i * 11} width={50 + (i % 2) * 30} height="4" rx="2" fill="#2b4058" />)}
          <path d="M796 286 L920 286 L930 300 L788 300 Z" fill="#1d222a" stroke={S.mid} />
          <rect x="808" y="290" width="104" height="6" rx="1" fill="#141920" />
        </g>
        <Txt x={800} y={326}>LAPTOP · LI-ION PACK</Txt>
        {/* tablet and power tool strapped with velcro */}
        <rect x="944" y="234" width="46" height="64" rx="5" fill="#1d222a" stroke={S.mid} /><rect x="948" y="240" width="38" height="52" rx="2" fill="url(#screen)" />
        <path d="M1002 252 h30 a6 6 0 0 1 6 6 v10 a6 6 0 0 1 -6 6 h-14 v22 h-12 v-22 h-4 z" fill="#2a2f38" stroke={S.mid} />
        <rect x="1014" y="296" width="12" height="10" fill="#3a2f22" stroke="#6a5f4a" />
        <rect x="936" y="262" width="110" height="7" fill="#3a3f48" opacity=".9" /><Txt x={936} y={322}>TABLET · TOOL · VELCRO</Txt>
        {hot('battery') && <g><circle cx="870" cy="290" r="70" fill="url(#glow)" className="pulse" /><circle cx="1020" cy="300" r="34" fill="url(#glow)" />{[0, 1, 2].map(i => <circle key={i} cx={862 + i * 12} cy={310 + i * 8} r={4 + i * 2} fill="#C8CCD2" opacity={.4 - i * .1} />)}</g>}

        {/* combustion integrated rack with chamber window */}
        <rect x="960" y="340" width="150" height="100" rx="5" fill="#141a22" stroke="#7DB4FF" strokeOpacity={hot('cir') ? .9 : .45} />
        <circle cx="1035" cy="388" r="26" fill="#0a0d12" stroke="#7DB4FF" strokeOpacity=".7" strokeWidth="2" />
        <circle cx="1035" cy="388" r="9" fill="#8fb8ff" opacity=".85" /><circle cx="1035" cy="388" r="15" fill="#3f6ff0" opacity=".25" />
        {[[970, 352], [1092, 352], [970, 418], [1092, 418]].map(([x, y], i) => <rect key={i} x={x} y={y} width="8" height="8" fill="#2c333d" />)}
        <Txt x={960} y={456} fill="#7DB4FF">COMBUSTION INTEGRATED RACK</Txt>
        <Txt x={600} y={494} anchor="middle">INSIDE A STATION MODULE · ILLUSTRATION, NOT TO SCALE</Txt>
      </svg>
      {HARDWARE.map(h => (
        <button key={h.id} type="button" aria-label={h.name} aria-pressed={sel === h.id} onClick={() => onPick(h.id)}
          style={{ position: 'absolute', left: `${h.x / 12}%`, top: `${h.y / 5}%`, width: 44, height: 44, margin: '-22px 0 0 -22px', border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="pulse" style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', border: `2px solid ${h.id === 'cir' || h.id === 'detector' ? '#7DB4FF' : '#FF7A3D'}` }} />
          <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${h.id === 'cir' || h.id === 'detector' ? '#7DB4FF' : '#FF7A3D'}`, background: sel === h.id ? (h.id === 'cir' || h.id === 'detector' ? '#7DB4FF' : '#FF7A3D') : 'rgba(10,11,13,.6)' }} />
        </button>
      ))}
    </div>
  )
}

/* Cut-away of the inside of each item */
export function Cutaway({ id }) {
  const T = (x, y, t, a = 'start', c = '#A6AAB1') => <text x={x} y={y} textAnchor={a} fill={c} fontFamily="IBM Plex Mono, monospace" fontSize="10">{t}</text>
  const box = { viewBox: '0 0 360 220', width: '100%', role: 'img', style: { display: 'block' } }
  if (id === 'battery') return (
    <svg {...box} aria-label="Cut-away of a cylindrical lithium-ion cell: cathode, separator and anode wound together; a defect shorts the layers and heats the cell">
      <rect x="40" y="40" width="120" height="150" rx="16" fill="#1d222a" stroke="#5a606a" strokeWidth="2" /><rect x="80" y="28" width="40" height="14" rx="3" fill="#5a606a" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <line key={i} x1={52 + i * 13} x2={52 + i * 13} y1="54" y2="176" stroke={['#7DB4FF', '#EEECE7', '#C8A060'][i % 3]} strokeWidth="4" opacity=".75" />)}
      <circle cx="104" cy="118" r="20" fill="url(#cg)" /><defs><radialGradient id="cg"><stop offset="0%" stopColor="#FF7A3D" stopOpacity=".95" /><stop offset="100%" stopColor="#FF7A3D" stopOpacity="0" /></radialGradient></defs>
      <path d="M104 30 q -10 -14 4 -26 M120 32 q 12 -12 0 -26" fill="none" stroke="#C8CCD2" strokeWidth="2" opacity=".6" />
      {T(180, 60, '— cathode', 'start', '#7DB4FF')}{T(180, 80, '— separator (melts first)', 'start', '#EEECE7')}{T(180, 100, '— anode', 'start', '#C8A060')}
      {T(180, 128, '● internal short', 'start', '#FF7A3D')}{T(180, 160, '↑ vent: CO₂ + CO', 'start')}{T(40, 210, '18650 CYLINDRICAL CELL · CUT-AWAY')}
    </svg>)
  if (id === 'wiring') return (
    <svg {...box} aria-label="Cross-section of an insulated wire, and an arc burning along chafed insulation">
      <circle cx="90" cy="100" r="52" fill="#3a2f22" stroke="#6a5f4a" strokeWidth="2" /><circle cx="90" cy="100" r="40" fill="#c58a3d" opacity=".35" />
      {[[0, 0], [-14, -10], [14, -10], [-14, 10], [14, 10], [0, -20], [0, 20]].map(([dx, dy], i) => <circle key={i} cx={90 + dx} cy={100 + dy} r="7" fill="#C87533" />)}
      {T(20, 176, 'COPPER STRANDS · KAPTON/TEFLON')}
      <rect x="180" y="92" width="160" height="16" rx="8" fill="#3a2f22" stroke="#6a5f4a" /><rect x="236" y="92" width="34" height="16" fill="#C87533" />
      <path d="M244 90 l8 -16 l-2 12 l10 -6 l-10 16 l2 -8z" fill="#FFD27A" /><circle cx="252" cy="90" r="22" fill="#FF7A3D" opacity=".18" />
      {T(180, 140, 'chafed insulation → arc')}{T(180, 156, '→ burns along the wire')}{T(180, 190, 'NASA-STD-6001 TEST 18')}
    </svg>)
  if (id === 'oxygen') return (
    <svg {...box} aria-label="Cut-away of a solid-fuel oxygen candle: steel tube, oxygen-releasing block, igniter and filter">
      <rect x="40" y="70" width="230" height="70" rx="12" fill="#2a2f38" stroke="#5a606a" strokeWidth="2" />
      <rect x="70" y="80" width="150" height="50" rx="6" fill="#4a3f33" /><rect x="40" y="88" width="24" height="34" fill="#5a606a" /><rect x="226" y="80" width="38" height="50" fill="#1d222a" stroke="#33373F" />
      {[232, 240, 248, 256].map(x => <line key={x} x1={x} x2={x} y1="84" y2="126" stroke="#33373F" />)}
      {T(40, 60, 'igniter')}{T(100, 60, 'LiClO₄ block (~1 L)')}{T(222, 60, 'filter → O₂')}
      <circle cx="160" cy="105" r="28" fill="#FF7A3D" opacity=".28" /><path d="M150 140 l-8 34 M166 140 l4 38 M178 140 l14 30" stroke="#FFD27A" strokeWidth="2" strokeDasharray="2 4" />
      {T(40, 200, 'contaminated block → runs too hot → tube burns through')}
    </svg>)
  if (id === 'avionics') return (
    <svg {...box} aria-label="A circuit board with an overheating component releasing small smoke particles">
      <rect x="30" y="40" width="200" height="140" rx="6" fill="#173024" stroke="#2f5a43" strokeWidth="2" />
      {[[50, 60], [110, 60], [170, 60], [50, 120], [170, 120]].map(([x, y], i) => <rect key={i} x={x} y={y} width="36" height="28" rx="2" fill="#0d1a13" stroke="#3d6b52" />)}
      <rect x="112" y="118" width="34" height="34" rx="4" fill="#2a1a10" stroke="#FF7A3D" /><circle cx="129" cy="135" r="26" fill="#FF7A3D" opacity=".22" />
      {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} cx={140 + i * 16} cy={110 - i * 12} r={2 + (i % 2)} fill="#C8CCD2" opacity=".55" />)}
      {T(250, 70, 'tiny particles')}{T(250, 86, '(Teflon, Kapton)')}{T(250, 118, 'often missed by')}{T(250, 134, 'the ISS detector')}{T(30, 206, 'OVERHEATED COMPONENT · SMOULDER, NO FLAME')}
    </svg>)
  if (id === 'stowage') return (
    <svg {...box} aria-label="A stack of soft stowage bags with a small flame spreading across them">
      {[[30, 120, 120, 60], [150, 110, 110, 70], [60, 60, 100, 56], [170, 50, 120, 56]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx="12" fill="#2a2620" stroke="#5a5040" strokeWidth="2" />)}
      <ellipse cx="150" cy="118" rx="26" ry="16" fill="#FF7A3D" opacity=".35" /><ellipse cx="150" cy="118" rx="10" ry="7" fill="#FFD27A" opacity=".8" />
      <path d="M180 118 h60" stroke="#7DB4FF" strokeWidth="2" markerEnd="url(#a)" /><defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#7DB4FF" /></marker></defs>
      {T(196, 108, 'fan air', 'start', '#7DB4FF')}{T(30, 206, 'FUEL LOAD: FABRIC, FOAM, CLOTHES, TRASH')}
    </svg>)
  if (id === 'cir') return (
    <svg {...box} aria-label="The Combustion Integrated Rack: a sealed chamber with a flame inside, cameras around it">
      <rect x="60" y="30" width="180" height="170" rx="8" fill="#141a22" stroke="#7DB4FF" strokeOpacity=".6" strokeWidth="2" />
      <circle cx="150" cy="115" r="58" fill="#0a0d12" stroke="#7DB4FF" strokeWidth="3" />
      <circle cx="150" cy="115" r="20" fill="#8fb8ff" opacity=".9" /><circle cx="150" cy="115" r="34" fill="#3f6ff0" opacity=".3" />
      {[[150, 48], [210, 90], [210, 140], [90, 90], [90, 140]].map(([x, y], i) => <rect key={i} x={x - 6} y={y - 5} width="12" height="10" rx="2" fill="#5a606a" />)}
      {T(256, 70, 'sealed chamber', 'start', '#7DB4FF')}{T(256, 90, '(26 gal)')}{T(256, 120, '5 cameras')}{T(256, 150, 'kept apart from')}{T(256, 166, 'the cabin air')}
    </svg>)
  return (
    <svg {...box} aria-label="Smoke detector inside the ventilation duct: laser light scatters off smoke particles onto a sensor">
      <rect x="20" y="70" width="320" height="80" rx="8" fill="#141a22" stroke="#33373F" strokeWidth="2" />
      {[30, 44, 58].map(x => <line key={x} x1={x} x2={x} y1="74" y2="146" stroke="#33373F" />)}
      <path d="M80 110 h200" stroke="#7DB4FF" strokeWidth="1.5" strokeDasharray="4 4" />
      <rect x="160" y="96" width="52" height="28" rx="4" fill="#1d222a" stroke="#7DB4FF" /><circle cx="186" cy="110" r="5" fill="#FF7A3D" />
      <path d="M186 110 l40 -26" stroke="#FFD27A" strokeWidth="1.5" />{[0, 1, 2, 3].map(i => <circle key={i} cx={120 + i * 20} cy={104 + (i % 2) * 10} r="3" fill="#C8CCD2" opacity=".6" />)}
      {T(20, 56, 'air flow →', 'start', '#7DB4FF')}{T(222, 80, 'scattered light')}{T(20, 190, 'IR LASER DIODE · FORWARD SCATTER · IN THE DUCT')}
    </svg>)
}
