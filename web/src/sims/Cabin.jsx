/* A live, perspective view down the inside of a station module.
   One canvas engine, two uses:
   - mode "hazard": a hardware failure plays out in four steps (step 1 of the lesson)
   - mode "response": the station's fire response plays out step by step (step 4)
   Illustration, not to scale. Flames are drawn the way NASA films them in microgravity:
   round, steady, blue at the base, stretched only where the fans blow. Sparks fly in
   straight lines because nothing pulls them down. */
import { useEffect, useRef } from 'react'

const W = 1200, H = 675
const XW = 1.25, YH = 0.8, CF = 0.24, L = 4, Z0 = -0.5
const OCT = [[-XW + CF, -YH], [XW - CF, -YH], [XW, -YH + CF], [XW, YH - CF], [XW - CF, YH], [-XW + CF, YH], [-XW, YH - CF], [-XW, -YH + CF]]
const ZS = [Z0, 0.5, 1.5, 2.5, 3.4, L]
const SURF = [[228, 225, 214], [104, 109, 118], [210, 206, 195], [104, 109, 118], [164, 160, 150], [104, 109, 118], [210, 206, 195], [104, 109, 118]]
const LIT = [1.03, .82, .93, .82, .8, .82, .93, .82]
const FOG = [14, 18, 25]
const INT = [0, -0.74, 2.9]
const THR = 22

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const rnd = (a, b) => a + Math.random() * (b - a)
const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const rgb = (c, k = 1, f = 0, a = 1) => `rgba(${Math.round(lerp(Math.min(255, c[0] * k), FOG[0], f))},${Math.round(lerp(Math.min(255, c[1] * k), FOG[1], f))},${Math.round(lerp(Math.min(255, c[2] * k), FOG[2], f))},${a})`
const fogAt = z => clamp((z - 0.3) / L) * 0.62

export const ANCHOR = {
  battery: [0.93, 0.1, 1.24], wiring: [1.13, -0.68, 1.62], oxygen: [-1.02, 0.36, 2.75], avionics: [0.06, 0.6, 1.42],
  stowage: [-0.98, -0.42, 1.98], cir: [-1.22, -0.05, 0.75], detector: [0.06, -0.78, 2.9],
}
const LABEL = { battery: 'Laptop · Li-ion battery', wiring: 'Cable bundle', oxygen: 'Oxygen generator', avionics: 'Electronics drawer', stowage: 'Cargo bags', cir: 'Combustion rack', detector: 'Smoke detector' }
const BLUE = new Set(['cir', 'detector'])
export const STEP_T = [0, 2.6, 5.4, 8.4]

/* seeded rack LEDs */
const LEDS = (() => {
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const out = []
  for (const i of [0, 2, 4, 6]) for (let k = 0; k < ZS.length - 1; k++) for (let n = 0; n < 3; n++) {
    out.push({ i, u: 0.08 + r() * 0.84, z: lerp(ZS[k] + 0.1, ZS[k + 1] - 0.1, r()), c: r() < 0.7 ? [80, 230, 140] : [255, 190, 70], rate: 0.6 + r() * 2.5, ph: r() * 6 })
  }
  return out
})()

/* seeded placards: warning labels, stickers, a strip of hazard tape */
const PLAC = (() => {
  let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const cols = [[210, 50, 40], [240, 190, 40], [40, 90, 180], [40, 150, 90], [235, 120, 40]]
  const out = []
  for (const i of [0, 2, 4, 6]) for (let k = 0; k < ZS.length - 1; k++) {
    if ((i === 6 && k <= 1) || (i === 4 && (k === 2 || k === 3))) continue
    for (let n = 0; n < 2; n++) out.push({ i, u: 0.4 + r() * 0.45, w: 0.06 + r() * 0.06, z: ZS[k] + 0.15 + r() * 0.6, h: 0.05 + r() * 0.06, c: cols[Math.floor(r() * cols.length)] })
  }
  out.push({ i: 4, u: 0.3, w: 0.4, z: 2.36, h: 0.05, c: [240, 200, 40], tape: true })
  out.push({ i: 2, u: 0.05, w: 0.06, z: 0.55, h: 0.6, c: [240, 200, 40], tape: true })
  return out
})()

/* ------------------------------------------------------------- scenario scripts */
function hazard(id, t, dt, S, emit) {
  const st = { flames: [], glows: [], fans: true, light: 1, screenOff: false, jolt: 0, cir: 0, laser: false, detW: 1, air: 1, pulses: 0, flicker: 0 }
  const stp = t < STEP_T[1] ? 0 : t < STEP_T[2] ? 1 : t < STEP_T[3] ? 2 : 3
  const lt = t - STEP_T[stp]
  st.step = stp
  const A = ANCHOR[id]
  if (id === 'battery') {
    const B = A
    if (stp === 0) st.glows.push([B[0] - 0.02, B[1] + 0.02, B[2], 0.08 + lt * 0.02, '255,60,40', 0.35 + 0.25 * Math.sin(t * 7)])
    if (stp === 1) {
      st.glows.push([B[0] - 0.02, B[1] + 0.02, B[2], 0.16, '255,120,40', 0.6 + 0.2 * Math.sin(t * 11)])
      st.screenOff = Math.random() < 0.35
      emit('smoke', B, [rnd(-.15, 0), rnd(-.1, .1), rnd(-.1, .1)], 8 * dt, { size: 0.04, col: [60, 60, 64], a: 0.22 })
    }
    if (stp >= 2) st.screenOff = true
    if (stp === 2) {
      st.jolt = Math.sin(t * 46) * 0.018 * Math.max(0, 1 - lt / 2.5)
      st.glows.push([B[0], B[1], B[2], 0.32, '255,210,150', 0.85])
      emit('gas', [B[0] - 0.12, B[1], B[2]], () => [rnd(-1.6, -0.9), rnd(-.25, .3), rnd(-.3, .35)], 150 * dt, { size: 0.05, col: [170, 168, 165], a: 0.25, drag: 2.4, grow: 0.5 })
      emit('spark', [B[0] - 0.1, B[1], B[2]], () => [rnd(-3, -0.8), rnd(-1.2, 1.2), rnd(-1.2, 1.2)], 70 * dt, { life: rnd(.4, .9) })
      st.flicker = 0.25
    }
    if (stp === 3) {
      st.flames.push({ x: B[0] - 0.1, y: B[1], z: B[2], r: Math.min(0.12, 0.04 + lt * 0.05), ph: 1 })
      if (lt > 1.6) st.flames.push({ x: 1.08, y: 0.12, z: 1.86, r: Math.min(0.08, (lt - 1.6) * 0.04), ph: 2 })
      emit('smoke', [B[0] - 0.12, B[1], B[2]], () => [rnd(-.3, 0), rnd(-.15, .15), rnd(-.15, .15)], 45 * dt, { size: 0.05, col: [52, 52, 56], a: 0.26 })
      emit('spark', [B[0] - 0.1, B[1], B[2]], () => [rnd(-2, -0.4), rnd(-1, 1), rnd(-1, 1)], 6 * dt, {})
    }
  } else if (id === 'wiring') {
    const zA = 1.62 + Math.max(0, t - STEP_T[1]) * 0.05
    const P = z => [1.13, -0.68, z]
    if (stp === 0) {
      st.glows.push([...P(1.62), 0.07, '255,150,60', Math.random() < 0.15 ? 0.9 : 0.25])
      emit('spark', P(1.62), () => [rnd(-1.5, -0.2), rnd(0, 1.5), rnd(-1, 1)], 3 * dt, { life: .4 })
    }
    if (stp === 1 || stp === 2) {
      const on = Math.random() < (stp === 1 ? 0.55 : 0.25)
      if (on) st.glows.push([...P(zA), 0.3, '190,215,255', 0.95])
      st.arc = on ? P(zA) : null
      emit('spark', P(zA), () => [rnd(-2.2, -0.2), rnd(0, 2), rnd(-1.2, 1.2)], (stp === 1 ? 55 : 15) * dt, { life: rnd(.3, .8), col: '220,235,255' })
      st.flicker = on ? 0.15 : 0
    }
    if (stp >= 2) emit('smoke', P(rnd(1.62, zA)), () => [rnd(-.2, 0), rnd(0, .15), rnd(-.1, .1)], 40 * dt, { size: 0.028, col: [205, 205, 210], a: 0.2 })
    st.detW = 0.7
    if (stp === 3) {
      st.flames.push({ x: 1.09, y: -0.64, z: zA, r: Math.min(0.065, 0.02 + lt * 0.03), ph: 3 })
      emit('smoke', P(zA), () => [rnd(-.2, 0), rnd(0, .15), rnd(-.1, .1)], 25 * dt, { size: 0.045, col: [60, 60, 64], a: 0.24 })
    }
  } else if (id === 'oxygen') {
    const O = A
    if (stp === 0) st.glows.push([...O, 0.12, '255,170,80', 0.35 + 0.1 * Math.sin(t * 3)])
    if (stp === 1) {
      st.glows.push([...O, 0.22, '255,230,170', 0.6 + 0.3 * Math.sin(t * 9)])
      emit('spark', O, () => [rnd(0.2, 1.2), rnd(-.6, .6), rnd(-.6, .6)], 6 * dt, { life: .6 })
    }
    if (stp >= 2) {
      st.glows.push([...O, 0.5, '255,240,200', 0.95])
      const d = [0.55, -0.12, -0.83]
      emit('molten', O, () => { const s = rnd(2.2, 3.4); return [(d[0] + rnd(-.2, .2)) * s, (d[1] + rnd(-.2, .2)) * s, (d[2] + rnd(-.2, .2)) * s] }, 140 * dt, { life: rnd(1, 1.8) })
      emit('smoke', O, () => [rnd(0, .6), rnd(-.3, .2), rnd(-.5, .1)], 55 * dt, { size: 0.06, col: [58, 56, 56], a: 0.24 })
      st.flicker = 0.55
      if (stp === 3) st.flames.push({ x: O[0] + 0.04, y: O[1], z: O[2], r: 0.07, ph: 4, hot: true })
    }
  } else if (id === 'avionics') {
    const Ap = A
    st.detW = 0.035
    if (stp === 0) st.glows.push([...Ap, 0.05, '255,70,40', 0.35 + 0.2 * Math.sin(t * 5)])
    if (stp >= 1) {
      st.glows.push([...Ap, 0.09, '255,110,40', 0.55 + 0.15 * Math.sin(t * 6)])
      emit('smoke', [Ap[0], Ap[1] - 0.04, Ap[2]], () => [rnd(-.1, .1), rnd(-.06, .02), rnd(-.1, .1)], (stp === 1 ? 14 : 30) * dt, { size: 0.022, col: [215, 215, 220], a: 0.2 })
    }
  } else if (id === 'stowage') {
    const F = A
    if (stp === 0) {
      st.glows.push([...F, 0.08, '255,140,60', 0.5])
      st.flames.push({ x: F[0], y: F[1], z: F[2], r: 0.015 + lt * 0.006, ph: 5 })
      emit('spark', F, () => [rnd(0.2, 1.2), rnd(-.5, .5), rnd(-.5, .5)], 3 * dt, { life: .5 })
    }
    if (stp >= 1) st.flames.push({ x: F[0], y: F[1], z: F[2], r: stp === 1 ? 0.03 + lt * 0.016 : 0.08, ph: 5 })
    if (stp >= 2) st.flames.push({ x: -0.96, y: -0.38, z: 2.24, r: Math.min(0.07, (t - STEP_T[2]) * 0.03), ph: 6 })
    if (stp === 3) {
      st.flames.push({ x: -0.98, y: -0.04, z: 1.8, r: Math.min(0.07, lt * 0.03), ph: 7 })
      st.flames.push({ x: -0.95, y: -0.06, z: 2.2, r: Math.min(0.06, Math.max(0, lt - 1) * 0.03), ph: 8 })
    }
    emit('smoke', F, () => [rnd(0, .25), rnd(-.1, .15), rnd(-.1, .2)], (stp + 0.3) * 14 * dt, { size: 0.05, col: [55, 54, 56], a: 0.24 })
  } else if (id === 'cir') {
    if (stp === 1) st.cir = ease(lt / 0.5)
    if (stp === 2) st.cir = Math.sqrt(Math.max(0, 1 - lt / 2.8))
    if (stp === 3) st.pulses = lt
    st.cirCams = stp >= 1
  } else if (id === 'detector') {
    st.air = stp === 0 ? 2.4 : 1.4
    st.laser = stp >= 1 && stp <= 2
    if (stp === 2 && lt < 0.9) emit('smoke', [0.25, -0.25, 2.1], () => [rnd(-.2, .2), rnd(-.2, .2), rnd(-.2, .2)], 110 * dt, { size: 0.05, col: [90, 90, 94], a: 0.24 })
    if (stp === 3) {
      st.fans = false
      if (!S.reset3) { S.reset3 = true; S.det = 0; S.alarm = false }
      if (lt < 0.7) emit('smoke', [0.45, 0.25, 1.3], () => [rnd(-.15, .15), rnd(-.15, .15), rnd(-.15, .15)], 110 * dt, { size: 0.05, col: [90, 90, 94], a: 0.24 })
    }
  }
  return st
}

const F1 = [-0.98, -0.42, 1.98], F2 = [-0.96, -0.38, 2.24]
const CREW0 = [0.15, -0.05, 3.9], CREW1 = [-0.28, 0.02, 2.55]
function response(step, t, dt, S, emit) {
  const st = { flames: [], glows: [], fans: step === 0 || step === 4, light: 1, screenOff: step >= 1 && step <= 3, ledsOff: step >= 1 && step <= 3, detW: 1, air: step === 4 ? 1.6 : 1, flowK: step === 4 ? 2.2 : 1 }
  if (step >= 1 && step <= 3) st.light = step === 1 ? lerp(1, 0.6, ease(t / 1.2)) : 0.6
  if (step === 4) st.light = lerp(0.6, 1, ease(t / 1.5))
  let fl = 1
  if (step === 1) fl = lerp(1, 0.75, ease(t / 2))
  if (step === 2) fl = 0.75
  if (step === 3) fl = 0.75 * (1 - ease((t - 0.8) / 3.6))
  if (step === 4) fl = 0
  S.fire = fl
  if (fl > 0.01) {
    st.flames.push({ x: F1[0], y: F1[1], z: F1[2], r: 0.09 * fl, ph: 1 })
    st.flames.push({ x: F2[0], y: F2[1], z: F2[2], r: 0.065 * fl, ph: 2 })
    emit('smoke', F1, () => [rnd(0, .25), rnd(-.12, .12), rnd(-.1, .2)], 40 * fl * dt, { size: 0.05, col: [55, 54, 56], a: 0.24 })
  }
  if (step === 3 && t > 4.4 && t < 5.2) emit('smoke', F1, () => [rnd(0, .4), rnd(-.3, .3), rnd(-.3, .3)], 60 * dt, { size: 0.06, col: [120, 120, 124], a: 0.2 })
  if (step === 0 && t > 2.2) S.alarm = true
  if (step >= 1 && step <= 3) S.alarm = true
  if (step === 4) S.alarm = false
  if (step >= 2) {
    const k = step === 2 ? ease(t / 3) : 1
    st.crew = [lerp(CREW0[0], CREW1[0], k), lerp(CREW0[1], CREW1[1], k) + Math.sin(t * 0.9) * 0.01, lerp(CREW0[2], CREW1[2], k)]
  }
  if (step === 3 && t > 0.6 && t < 4.8) {
    const c = st.crew, N = [c[0] - 0.42, c[1] - 0.02, c[2] - 0.12]
    const d = [F1[0] - N[0], F1[1] - N[1], F1[2] - N[2]], m = Math.hypot(...d)
    emit('mist', N, () => { const s = rnd(2.2, 3.2); return [(d[0] / m + rnd(-.18, .18)) * s, (d[1] / m + rnd(-.18, .18)) * s, (d[2] / m + rnd(-.18, .18)) * s] }, 160 * dt, { size: 0.018, col: [235, 240, 248], a: 0.16, drag: 1.4, grow: 0.09, life: rnd(1, 1.6) })
    st.nozzle = N
  }
  const target = [0.14, 0.3, 0.36, 0.42, 0.02][step]
  S.haze += (target - S.haze) * Math.min(1, dt * (step === 4 ? 0.45 : 0.35))
  return st
}

/* ------------------------------------------------------------- the component */
export default function Cabin({ mode = 'hazard', sel = 'battery', step = 0, playKey = 0, onPick, onStep, ariaLabel }) {
  const cv = useRef(null)
  const props = useRef({})
  props.current = { mode, sel, step, playKey, onPick, onStep }
  const hits = useRef([])
  const mouse = useRef({ x: 0, y: 0, on: false })

  useEffect(() => {
    const c = cv.current, ctx = c.getContext('2d')
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let sx = 1, sy = 1, cssW = 1200
    const resize = () => {
      const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1)
      cssW = r.width
      c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr))
      sx = c.width / W; sy = c.height / H
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(c)
    let visible = true
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }); io.observe(c)

    const cam = { cx: 0, cy: 0, cz: -1.1, F: 520, zoom: 1, fx: W / 2, fy: H / 2 }
    const pj = (x, y, z) => { const d = Math.max(0.05, z - cam.cz), s = cam.F / d; return [W / 2 + (x - cam.cx) * s, H / 2 + (y - cam.cy) * s, s] }
    const sp = (i, u, z) => { const a = OCT[i], b = OCT[(i + 1) % 8]; return pj(lerp(a[0], b[0], u), lerp(a[1], b[1], u), z) }
    const poly = pts => { ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath() }
    const quad = (i, u0, u1, z0, z1) => poly([sp(i, u0, z0), sp(i, u1, z0), sp(i, u1, z1), sp(i, u0, z1)])
    const P3 = pts => poly(pts.map(p => pj(...p)))
    const line3 = (a, b, w, col) => { const p = pj(...a), q = pj(...b); ctx.strokeStyle = col; ctx.lineWidth = w * (p[2] + q[2]) / 2; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke() }

    let parts = []
    const dust = Array.from({ length: 46 }, () => ({ x: rnd(-1.1, 1.1), y: rnd(-0.7, 0.7), z: rnd(0, 3.6), ph: rnd(0, 6) }))
    let key = '', t = 0, T = 0, last = performance.now(), S = { det: 0, alarm: false, haze: 0, fire: 1 }, shown = -1, raf

    const emit = (kind, at, vel, n, o = {}) => {
      let k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0)
      while (k-- > 0) {
        const v = typeof vel === 'function' ? vel() : vel
        const life = o.life ?? (kind === 'smoke' ? rnd(4, 7) : kind === 'gas' ? rnd(1.2, 2) : kind === 'mist' ? rnd(1.2, 2) : rnd(.4, 1))
        parts.push({ kind, x: at[0] + rnd(-.015, .015), y: at[1] + rnd(-.015, .015), z: at[2] + rnd(-.015, .015), vx: v[0], vy: v[1], vz: v[2], life, max: life, size: o.size ?? 0.01, col: o.col, a: o.a ?? 1, drag: o.drag ?? (kind === 'spark' ? 1.2 : kind === 'molten' ? 0.25 : 0.6), grow: o.grow ?? 0.02, sc: o.col })
      }
    }

    const glow = (x, y, z, r, col, a) => {
      const q = pj(x, y, z), R = Math.max(1, q[2] * r)
      const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], R)
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`)
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, 7); ctx.fill()
    }

    const flowAt = (x, y, z) => { const dx = INT[0] - x, dy = INT[1] - y, dz = INT[2] - z, d = Math.hypot(dx, dy, dz) + 0.25, w = clamp(d / 1.2); return [dx / d * 0.42 + Math.sin(z * 2.1 + T * 0.3) * 0.08 * w, dy / d * 0.42 * (1 - 0.5 * w), dz / d * 0.42 + 0.12 * w] }

    /* ---------------- drawing the module */
    function drawCabin(st) {
      const lk = st.light
      // far end with hatch
      const fe = OCT.map(([x, y]) => pj(x, y, L))
      poly(fe); ctx.fillStyle = rgb([190, 186, 175], lk * 0.9, 0.62); ctx.fill()
      P3([[-0.56, -0.54, L], [0.56, -0.54, L], [0.56, 0.62, L], [-0.56, 0.62, L]]); ctx.fillStyle = rgb([150, 155, 162], lk, 0.62); ctx.fill()
      const h0 = pj(-0.44, -0.42, L), h1 = pj(0.44, 0.5, L)
      const hg = ctx.createLinearGradient(0, h0[1], 0, h1[1]); hg.addColorStop(0, '#2a3340'); hg.addColorStop(1, '#141922')
      ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(h0[0], h0[1], h1[0] - h0[0], h1[1] - h0[1], 10 * h0[2] / 100); ctx.fill()
      // the next module, far away
      const n0 = pj(-0.3, -0.2, L + 3), n1 = pj(0.3, 0.25, L + 3)
      ctx.fillStyle = `rgba(200,205,190,${0.18 * lk})`; ctx.fillRect(n0[0], n0[1], n1[0] - n0[0], n1[1] - n0[1])
      ctx.fillStyle = `rgba(255,250,230,${0.25 * lk})`; ctx.fillRect(n0[0] + 3, n0[1], n1[0] - n0[0] - 6, 3)

      for (let i = 0; i < 8; i++) {
        const corner = i % 2 === 1
        for (let k = ZS.length - 2; k >= 0; k--) {
          const z0 = ZS[k], z1 = ZS[k + 1], f = fogAt((z0 + z1) / 2)
          quad(i, 0, 1, z0, z1); ctx.fillStyle = rgb([70, 72, 76], lk, f); ctx.fill()
          if (corner) {
            quad(i, 0.02, 0.98, z0, z1); ctx.fillStyle = rgb(SURF[i], LIT[i] * lk, f); ctx.fill()
            continue
          }
          const a = sp(i, 0, (z0 + z1) / 2), b = sp(i, 1, (z0 + z1) / 2)
          const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1])
          g.addColorStop(0, rgb(SURF[i], LIT[i] * lk * 0.92, f)); g.addColorStop(0.5, rgb(SURF[i], LIT[i] * lk * 1.03, f)); g.addColorStop(1, rgb(SURF[i], LIT[i] * lk * 0.9, f))
          quad(i, 0.025, 0.975, z0 + 0.025, z1 - 0.025); ctx.fillStyle = g; ctx.fill()
          ctx.strokeStyle = rgb([90, 92, 96], lk, f, 0.55); ctx.lineWidth = 1
          for (const u of [0.34, 0.67]) { const p = sp(i, u, z0 + 0.03), q = sp(i, u, z1 - 0.03); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke() }
          const zm = lerp(z0, z1, 0.5); const p = sp(i, 0.03, zm), q = sp(i, 0.34, zm); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke()
        }
      }
      // corner cable runs
      const CAB = [[54, 58, 66], [214, 178, 64], [74, 104, 160]]
      for (const i of [1, 3, 5, 7]) CAB.forEach((col, n) => {
        const u = 0.25 + n * 0.25
        for (let k = ZS.length - 2; k >= 0; k--) {
          const p = sp(i, u, ZS[k]), q = sp(i, u, ZS[k + 1])
          ctx.strokeStyle = rgb(col, st.light, fogAt(ZS[k] + 0.5)); ctx.lineWidth = (p[2] + q[2]) / 2 * 0.03; ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke()
        }
        if (n === 1) for (let z = 0.25; z < L; z += 0.5) { const a = sp(i, 0.18, z), b = sp(i, 0.82, z); ctx.strokeStyle = rgb([235, 235, 230], st.light, fogAt(z), 0.55); ctx.lineWidth = Math.max(1, a[2] * 0.005); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke() }
      })
      // handrails
      for (const [i, u] of [[0, 0.07], [0, 0.93], [4, 0.07], [4, 0.93], [2, 0.88], [6, 0.12]]) {
        for (let k = 0; k < ZS.length - 1; k++) {
          const z0 = ZS[k] + 0.18, z1 = ZS[k + 1] - 0.18, f = fogAt(z0)
          const a = sp(i, u, z0), b = sp(i, u, z1)
          ctx.strokeStyle = rgb([118, 146, 186], st.light, f); ctx.lineWidth = (a[2] + b[2]) / 2 * 0.022; ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
        }
      }
      // overhead light panels
      for (const [z0, z1] of [[-0.3, 0.2], [0.8, 1.25], [1.85, 2.3], [3.05, 3.3]]) for (const [u0, u1] of [[0.12, 0.3], [0.7, 0.88]]) {
        quad(0, u0, u1, z0, z1); ctx.fillStyle = rgb([255, 251, 236], st.light, fogAt(z0) * 0.6); ctx.fill()
      }
      // placards and hazard tape
      for (const d of PLAC) {
        quad(d.i, d.u, d.u + d.w, d.z, d.z + d.h); ctx.fillStyle = rgb(d.c, st.light, fogAt(d.z)); ctx.fill()
        if (d.tape) { ctx.save(); ctx.clip(); ctx.strokeStyle = rgb([25, 25, 25], st.light, fogAt(d.z)); ctx.lineWidth = Math.max(1, sp(d.i, d.u, d.z)[2] * 0.012); for (let k = 0; k < 8; k++) { const a = sp(d.i, d.u + d.w * k / 6, d.z), b = sp(d.i, d.u + d.w * (k - 1.5) / 6, d.z + d.h); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke() } ctx.restore() }
      }
      // nadir window in the deck, with Earth going by
      {
        const wc = [0.42, YH - 0.002, 0.45], R = 0.2, ring = r => Array.from({ length: 32 }, (_, k) => [wc[0] + r * Math.cos(k / 32 * 6.283), wc[1], wc[2] + r * Math.sin(k / 32 * 6.283)])
        P3(ring(R * 1.25)); ctx.fillStyle = rgb([70, 74, 82], st.light, fogAt(0.45)); ctx.fill()
        P3(ring(R)); ctx.save(); ctx.clip()
        const c0 = pj(...wc), rr = c0[2] * R * 1.4
        const eg = ctx.createLinearGradient(c0[0] - rr, c0[1], c0[0] + rr, c0[1]); eg.addColorStop(0, '#0d3f7a'); eg.addColorStop(0.5, '#1f6fb8'); eg.addColorStop(1, '#0b3a6e')
        ctx.fillStyle = eg; ctx.fillRect(c0[0] - rr, c0[1] - rr, rr * 2, rr * 2)
        for (let k = 0; k < 7; k++) { const ph = ((T * 0.025 + k * 0.17) % 1), x = c0[0] - rr + ph * rr * 2.4 - rr * 0.2, y = c0[1] + (k - 3) * rr * 0.12; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x, y, rr * 0.22, rr * 0.035, 0, 0, 7); ctx.fill() }
        ctx.fillStyle = 'rgba(110,150,90,.5)'; const lx = c0[0] - rr + ((T * 0.025 + 0.5) % 1) * rr * 2.4; ctx.beginPath(); ctx.ellipse(lx, c0[1] + rr * 0.1, rr * 0.3, rr * 0.08, 0.3, 0, 7); ctx.fill()
        ctx.restore()
      }
      // LEDs
      for (const d of LEDS) {
        if (st.ledsOff) continue
        const on = Math.sin(T * d.rate + d.ph) > -0.3
        const q = sp(d.i, d.u, d.z)
        ctx.fillStyle = `rgba(${d.c.join(',')},${on ? 0.95 : 0.25})`; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1, q[2] * 0.007), 0, 7); ctx.fill()
      }
    }

    function boxPort(y0, y1, z0, z1, d, col, lk) {
      const xf = -XW + d, f = fogAt((z0 + z1) / 2)
      P3([[-XW, y0, z0], [xf, y0, z0], [xf, y1, z0], [-XW, y1, z0]]); ctx.fillStyle = rgb(col, lk * 0.76, f); ctx.fill()
      if (y1 < cam.cy) { P3([[-XW, y1, z0], [xf, y1, z0], [xf, y1, z1], [-XW, y1, z1]]); ctx.fillStyle = rgb(col, lk * 0.62, f); ctx.fill() }
      else if (y0 > cam.cy) { P3([[-XW, y0, z0], [xf, y0, z0], [xf, y0, z1], [-XW, y0, z1]]); ctx.fillStyle = rgb(col, lk * 0.98, f); ctx.fill() }
      P3([[xf, y0, z0], [xf, y1, z0], [xf, y1, z1], [xf, y0, z1]]); ctx.fillStyle = rgb(col, lk, f); ctx.fill()
      ctx.strokeStyle = rgb([60, 58, 54], lk, f, 0.5); ctx.lineWidth = 1; ctx.stroke()
      return xf
    }

    function drawObjects(st, p) {
      const lk = st.light
      /* Combustion Integrated Rack, port wall */
      quad(6, 0.02, 0.98, 0.05, 1.38); ctx.fillStyle = rgb([214, 222, 232], lk, fogAt(0.7)); ctx.fill()
      ctx.strokeStyle = rgb([120, 130, 145], lk, 0.1, 0.8); ctx.lineWidth = 1.2; ctx.stroke()
      for (const u of [0.13, 0.21, 0.86]) { const a = sp(6, u, 0.1), b = sp(6, u, 1.33); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke() }
      const cc = [-1.24, -0.05, 0.75], ring = (R, x = -1.24) => Array.from({ length: 28 }, (_, k) => [x, cc[1] + R * Math.cos(k / 28 * 6.283), cc[2] + R * Math.sin(k / 28 * 6.283)])
      P3(ring(0.3)); ctx.fillStyle = rgb([92, 100, 112], lk, 0.08); ctx.fill()
      P3(ring(0.24)); ctx.fillStyle = '#06080c'; ctx.fill()
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      const cq = pj(...cc)
      if (st.cir > 0.01) {
        glow(cc[0] + 0.02, cc[1], cc[2], 0.15 * st.cir, '120,170,255', 0.95)
        glow(cc[0] + 0.02, cc[1], cc[2], 0.06 * st.cir, '235,245,255', 0.95)
      } else glow(cc[0] + 0.02, cc[1], cc[2], 0.2, '60,90,160', 0.12)
      ctx.restore()
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * 6.283 + 0.6, q = pj(-1.24, cc[1] + 0.35 * Math.cos(a), cc[2] + 0.35 * Math.sin(a))
        ctx.fillStyle = '#2a3038'; ctx.beginPath(); ctx.arc(q[0], q[1], q[2] * 0.025, 0, 7); ctx.fill()
        if (st.cirCams) { ctx.fillStyle = Math.sin(T * 6 + k) > 0 ? '#ff4a3d' : '#5a1a14'; ctx.beginPath(); ctx.arc(q[0], q[1], q[2] * 0.009, 0, 7); ctx.fill() }
      }
      if (st.pulses) for (let k = 0; k < 3; k++) {
        const r = ((st.pulses * 0.35 + k * 0.33) % 1)
        ctx.strokeStyle = `rgba(125,180,255,${(1 - r) * 0.8})`; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(cq[0], cq[1], 20 + r * 140, -2.4, -0.7); ctx.stroke()
      }

      /* vent intake + smoke detector, overhead */
      quad(0, 0.38, 0.62, 2.7, 3.1); ctx.fillStyle = rgb([46, 52, 60], lk, fogAt(2.9)); ctx.fill()
      ctx.strokeStyle = rgb([110, 116, 124], lk, fogAt(2.9)); ctx.lineWidth = 1.2
      for (let z = 2.74; z < 3.08; z += 0.045) { const a = sp(0, 0.39, z), b = sp(0, 0.61, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke() }
      quad(0, 0.64, 0.75, 2.8, 3.0); ctx.fillStyle = rgb([206, 210, 216], lk, fogAt(2.9)); ctx.fill()
      const dq = sp(0, 0.695, 2.9)
      const red = S.alarm && Math.sin(T * 10) > 0
      ctx.fillStyle = red ? '#ff3b30' : S.alarm ? '#5a1410' : '#3ee08f'; ctx.beginPath(); ctx.arc(dq[0], dq[1], Math.max(2, dq[2] * 0.016), 0, 7); ctx.fill()
      if (red) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(0.39, -0.79, 2.9, 0.35, '255,50,40', 0.6); ctx.restore() }
      if (st.laser) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        const a = sp(0, 0.4, 2.92), b = sp(0, 0.6, 2.92)
        ctx.strokeStyle = `rgba(255,80,80,${0.6 + 0.3 * Math.sin(T * 20)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
        ctx.restore()
      }

      /* oxygen generator, port, far */
      const xf = boxPort(0.18, 0.54, 2.55, 2.95, 0.22, [150, 156, 164], lk)
      P3([[xf, 0.3, 2.62], [xf, 0.42, 2.62], [xf, 0.42, 2.88], [xf, 0.3, 2.88]]); ctx.fillStyle = rgb([86, 80, 72], lk, fogAt(2.75)); ctx.fill()
      P3([[xf, 0.22, 2.6], [xf, 0.27, 2.6], [xf, 0.27, 2.7], [xf, 0.22, 2.7]]); ctx.fillStyle = '#c33'; ctx.fill()

      /* cargo bags, port upper, strapped with a bungee */
      const bags = [[-0.56, -0.25, 2.02, 2.46, 0.26, [228, 222, 206]], [-0.2, 0.1, 1.98, 2.42, 0.3, [232, 226, 210]], [-0.56, -0.2, 1.55, 2.0, 0.3, [234, 228, 212]], [-0.18, 0.12, 1.6, 1.95, 0.22, [96, 128, 178]]]
      for (const [y0, y1, z0, z1, d, col] of bags) {
        const xb = boxPort(y0, y1, z0, z1, d, col, lk)
        line3([xb + 0.001, y0, (z0 + z1) / 2], [xb + 0.001, y1, (z0 + z1) / 2], 0.012, rgb([150, 140, 120], lk, fogAt(z0)))
        P3([[xb + 0.001, y0 + 0.04, z0 + 0.04], [xb + 0.001, y0 + 0.1, z0 + 0.04], [xb + 0.001, y0 + 0.1, z0 + 0.14], [xb + 0.001, y0 + 0.04, z0 + 0.14]]); ctx.fillStyle = rgb([230, 120, 50], lk, fogAt(z0)); ctx.fill()
      }
      line3([-0.94, -0.24, 1.5], [-0.94, -0.22, 2.5], 0.01, rgb([30, 30, 34], lk, 0.2))

      /* tablet and power tool on starboard, with velcro */
      const tf = 1.22
      P3([[tf, 0.0, 2.02], [tf, 0.0, 2.24], [tf, 0.3, 2.24], [tf, 0.3, 2.02]]); ctx.fillStyle = rgb([210, 160, 60], lk, fogAt(2.1)); ctx.fill()
      P3([[tf, -0.08, 2.03], [tf, -0.08, 2.11], [tf, 0.2, 2.11], [tf, 0.2, 2.03]]); ctx.fillStyle = rgb([40, 44, 52], lk, fogAt(2.1)); ctx.fill()
      P3([[1.23, -0.02, 1.76], [1.23, -0.02, 1.96], [1.23, 0.26, 1.96], [1.23, 0.26, 1.76]]); ctx.fillStyle = rgb([34, 38, 46], lk, fogAt(1.86)); ctx.fill()
      P3([[1.225, 0.01, 1.78], [1.225, 0.01, 1.94], [1.225, 0.23, 1.94], [1.225, 0.23, 1.78]]); ctx.fillStyle = st.screenOff && p.sel === 'battery' ? '#0b0d10' : rgb([44, 96, 150], 1, fogAt(1.86)); ctx.fill()
      P3([[1.215, 0.08, 1.72], [1.215, 0.13, 1.72], [1.215, 0.13, 2.28], [1.215, 0.08, 2.28]]); ctx.fillStyle = rgb([60, 62, 66], lk, fogAt(2)); ctx.fill()

      /* electronics drawer on the deck */
      const dy = 0.6, x0 = -0.38, x1 = 0.38, z0 = 1.08, z1 = 1.76
      P3([[x0, dy, z0], [x1, dy, z0], [x1, 0.8, z0], [x0, 0.8, z0]]); ctx.fillStyle = rgb([156, 160, 168], lk, fogAt(z0)); ctx.fill()
      line3([-0.12, 0.68, z0 - 0.002], [0.12, 0.68, z0 - 0.002], 0.02, rgb([60, 64, 72], lk, fogAt(z0)))
      P3([[x0, dy, z0], [x1, dy, z0], [x1, dy, z1], [x0, dy, z1]]); ctx.fillStyle = rgb([52, 58, 68], lk, fogAt(1.4)); ctx.fill()
      for (let b = 0; b < 3; b++) {
        const bx0 = -0.34 + b * 0.235, bx1 = bx0 + 0.2
        P3([[bx0, dy - 0.003, z0 + 0.06], [bx1, dy - 0.003, z0 + 0.06], [bx1, dy - 0.003, z1 - 0.06], [bx0, dy - 0.003, z1 - 0.06]]); ctx.fillStyle = rgb([34, 112, 72], lk, fogAt(1.4)); ctx.fill()
        for (let c = 0; c < 4; c++) { const cx = bx0 + 0.03 + (c % 2) * 0.09, cz = z0 + 0.12 + Math.floor(c / 2) * 0.24; P3([[cx, dy - 0.006, cz], [cx + 0.07, dy - 0.006, cz], [cx + 0.07, dy - 0.006, cz + 0.12], [cx, dy - 0.006, cz + 0.12]]); ctx.fillStyle = rgb([22, 26, 30], lk, fogAt(cz)); ctx.fill() }
      }

      /* laptop on its arm, starboard */
      const o = st.jolt || 0, lx = 1.08 - o
      line3([1.25, 0.1, 1.22], [0.98 - o, 0.1, 1.22], 0.03, rgb([96, 100, 108], lk, fogAt(1.2)))
      P3([[lx, -0.31, 0.94], [lx, -0.31, 1.52], [lx, 0.03, 1.52], [lx, 0.03, 0.94]]); ctx.fillStyle = rgb([30, 33, 40], lk, fogAt(1.2)); ctx.fill()
      const sOff = st.screenOff
      P3([[lx - 0.003, -0.28, 0.97], [lx - 0.003, -0.28, 1.49], [lx - 0.003, 0.0, 1.49], [lx - 0.003, 0.0, 0.97]])
      if (sOff) ctx.fillStyle = '#07090c'
      else { const a = pj(lx, -0.28, 0.97), b = pj(lx, 0, 1.49), g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, '#2a6cc0'); g.addColorStop(1, '#13325e'); ctx.fillStyle = g }
      ctx.fill()
      if (!sOff) for (let r = 0; r < 6; r++) { const yy = -0.24 + r * 0.04; line3([lx - 0.004, yy, 1.02], [lx - 0.004, yy, 1.02 + 0.18 + ((r * 37) % 5) * 0.05], 0.008, 'rgba(200,225,255,.55)') }
      P3([[lx, 0.03, 0.94], [lx, 0.03, 1.52], [0.84 - o, 0.11, 1.52], [0.84 - o, 0.11, 0.94]]); ctx.fillStyle = rgb([58, 62, 70], lk, fogAt(1.2)); ctx.fill()
      for (let r = 0; r < 4; r++) { const u = 0.2 + r * 0.18; line3([lerp(lx, 0.84 - o, u), lerp(0.03, 0.11, u), 0.99], [lerp(lx, 0.84 - o, u), lerp(0.03, 0.11, u), 1.47], 0.006, rgb([30, 32, 38], lk, 0.1)) }

      /* things floating in the cabin */
      const pen = [0.35 + 0.12 * Math.sin(T * 0.11), -0.28 + 0.06 * Math.sin(T * 0.17), 1.6 + 0.2 * Math.sin(T * 0.07)], pq = pj(...pen), ang = T * 0.35
      ctx.strokeStyle = '#e8e4da'; ctx.lineWidth = pq[2] * 0.012; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(pq[0] - Math.cos(ang) * pq[2] * 0.07, pq[1] - Math.sin(ang) * pq[2] * 0.07); ctx.lineTo(pq[0] + Math.cos(ang) * pq[2] * 0.07, pq[1] + Math.sin(ang) * pq[2] * 0.07); ctx.stroke()
      ctx.strokeStyle = '#2a5bd7'; ctx.beginPath(); ctx.moveTo(pq[0] + Math.cos(ang) * pq[2] * 0.05, pq[1] + Math.sin(ang) * pq[2] * 0.05); ctx.lineTo(pq[0] + Math.cos(ang) * pq[2] * 0.07, pq[1] + Math.sin(ang) * pq[2] * 0.07); ctx.stroke()
      const pou = [-0.35 + 0.1 * Math.sin(T * 0.09 + 2), 0.3 + 0.05 * Math.sin(T * 0.13), 2.3], uq = pj(...pou)
      ctx.save(); ctx.translate(uq[0], uq[1]); ctx.rotate(Math.sin(T * 0.2) * 0.6); ctx.fillStyle = rgb([196, 200, 206], lk); ctx.beginPath(); ctx.roundRect(-uq[2] * 0.05, -uq[2] * 0.035, uq[2] * 0.1, uq[2] * 0.07, 3); ctx.fill(); ctx.fillStyle = '#d65a2a'; ctx.fillRect(-uq[2] * 0.03, -uq[2] * 0.01, uq[2] * 0.06, uq[2] * 0.02); ctx.restore()
    }

    function drawCrew(c, st) {
      const q = pj(...c), u = q[2] * 0.0135
      ctx.save(); ctx.translate(q[0], q[1]); ctx.scale(-u, u); ctx.rotate(-0.18 + Math.sin(T * 0.8) * 0.03)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.strokeStyle = '#c99a7a'; ctx.lineWidth = 7
      ctx.beginPath(); ctx.moveTo(-4, 18); ctx.quadraticCurveTo(-20, 30, -38, 26); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(2, 18); ctx.quadraticCurveTo(-10, 36, -30, 40); ctx.stroke()
      ctx.fillStyle = '#8b7a5a'; ctx.beginPath(); ctx.roundRect(-10, 8, 18, 16, 5); ctx.fill()
      ctx.fillStyle = '#2b3f6e'; ctx.beginPath(); ctx.roundRect(-11, -20, 22, 32, 8); ctx.fill()
      ctx.fillStyle = '#d9b84a'; ctx.beginPath(); ctx.roundRect(-14, -12, 7, 16, 3); ctx.fill()
      ctx.fillStyle = '#c99a7a'; ctx.beginPath(); ctx.arc(2, -30, 9, 0, 7); ctx.fill()
      ctx.fillStyle = '#2a1e18'; ctx.beginPath(); ctx.arc(0, -33, 9, 3.3, 6.1); ctx.fill()
      ctx.fillStyle = 'rgba(190,215,235,.85)'; ctx.beginPath(); ctx.ellipse(8, -28, 6, 8, 0.2, 0, 7); ctx.fill()
      ctx.strokeStyle = '#3a3f48'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, -21); ctx.quadraticCurveTo(4, -12, -10, -6); ctx.stroke()
      ctx.strokeStyle = '#2b3f6e'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(4, -14); ctx.lineTo(20, -8); ctx.lineTo(30, -12); ctx.stroke()
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.roundRect(16, -20, 22, 10, 4); ctx.fill()
      ctx.fillStyle = '#222'; ctx.fillRect(38, -17, 7, 4)
      ctx.restore()
    }

    function drawFlame(f, st, ctxFlow) {
      const q = pj(f.x, f.y, f.z)
      const R = Math.max(1.5, q[2] * f.r * (1 + 0.035 * Math.sin(T * 5 + f.ph) + 0.02 * Math.sin(T * 13 + f.ph * 2)))
      glow(f.x, f.y, f.z, f.r * 9, '255,130,50', 0.2 * Math.min(1, f.r / 0.06))
      let ang = 0, str = 0
      if (st.fans) {
        const v = flowAt(f.x, f.y, f.z), a = pj(f.x + v[0], f.y + v[1], f.z + v[2])
        ang = Math.atan2(a[1] - q[1], a[0] - q[0]); str = 0.45
      }
      ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(ang); ctx.translate(R * str * 0.6, 0); ctx.scale(1 + str, 1 - str * 0.15)
      const g = ctx.createRadialGradient(-R * 0.15, 0, 0, 0, 0, R * 1.3)
      if (f.hot) { g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(0.5, 'rgba(255,230,160,.9)'); g.addColorStop(1, 'rgba(255,150,60,0)') }
      else if (st.fans) { g.addColorStop(0, 'rgba(255,240,200,.95)'); g.addColorStop(0.35, 'rgba(255,190,80,.9)'); g.addColorStop(0.7, 'rgba(240,100,30,.55)'); g.addColorStop(1, 'rgba(200,50,20,0)') }
      else { g.addColorStop(0, 'rgba(255,215,160,.75)'); g.addColorStop(0.45, 'rgba(250,140,60,.6)'); g.addColorStop(0.8, 'rgba(120,120,240,.35)'); g.addColorStop(1, 'rgba(60,80,220,0)') }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.3, 0, 7); ctx.fill()
      ctx.strokeStyle = `rgba(90,140,255,${st.fans ? 0.75 : 0.55})`; ctx.lineWidth = Math.max(1, R * 0.16)
      ctx.beginPath(); st.fans ? ctx.arc(R * 0.2, 0, R * 0.95, 2.2, 4.1) : ctx.arc(0, 0, R * 1.0, 0, 7); ctx.stroke()
      ctx.restore()
    }

    /* ---------------- loop */
    const frame = now => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      if (!visible) return
      const p = props.current
      const k = p.mode === 'hazard' ? `${p.sel}|${p.playKey}` : `r|${p.step}|${p.playKey}`
      if (k !== key) {
        const wasResp = key.startsWith('r|')
        key = k; t = 0
        if (p.mode === 'hazard') { parts = []; S = { det: 0, alarm: false, haze: 0 }; shown = -1 }
        else if (!wasResp || p.step === 0) { parts = []; S = { det: 0, alarm: false, haze: p.step === 0 ? 0 : [0.14, 0.3, 0.36, 0.42, 0.42][p.step], fire: 1 } }
      }
      t += dt; T += dt
      const st = p.mode === 'hazard' ? hazard(p.sel, t, dt, S, emit) : response(p.step, t, dt, S, emit)
      if (p.mode === 'hazard' && st.step !== shown) { shown = st.step; p.onStep && p.onStep(st.step) }

      // camera
      const m = mouse.current
      const tx = reduce ? 0 : m.on ? -m.x * 0.12 : 0.05 * Math.sin(T * 0.23)
      const ty = reduce ? 0 : m.on ? -m.y * 0.07 : 0.03 * Math.sin(T * 0.17)
      const kk = Math.min(1, dt * 2.5)
      cam.cx += (tx - cam.cx) * kk; cam.cy += (ty - cam.cy) * kk
      const A = p.mode === 'hazard' ? ANCHOR[p.sel] : [-0.6, -0.2, 2.2]
      const ap = pj(...A)
      const zt = p.mode === 'hazard' ? 1.2 : 1.12
      const kz = reduce ? 1 : Math.min(1, dt * 1.6)
      cam.zoom += (zt - cam.zoom) * kz
      const hw = W / 2 / cam.zoom, hh = H / 2 / cam.zoom
      cam.fx += (clamp(lerp(W / 2, ap[0], 0.8), hw, W - hw) - cam.fx) * kz
      cam.fy += (clamp(lerp(H / 2, ap[1], 0.8), hh, H - hh) - cam.fy) * kz
      const flick = st.flicker ? 1 - st.flicker * Math.random() * 0.5 : 1
      st.light *= flick

      // particles: air streaks
      if (st.fans) {
        const want = 70 * (st.air || 1)
        let n = 0; for (const q of parts) if (q.kind === 'air') n++
        for (; n < want; n++) parts.push({ kind: 'air', x: rnd(-1.1, 1.1), y: rnd(-0.7, 0.7), z: rnd(0, 3.6), vx: 0, vy: 0, vz: 0, life: rnd(1.5, 3.5), max: 3.5, size: 0, a: 1 })
      }
      for (const q of parts) {
        if (q.kind === 'air' || q.kind === 'smoke' || q.kind === 'gas' || q.kind === 'mist') {
          if (st.fans) {
            const f = flowAt(q.x, q.y, q.z), fk = (st.flowK || 1) * (q.kind === 'air' ? 1.8 : 1)
            const resp = q.kind === 'air' ? 4 : q.kind === 'smoke' ? 0.7 : 0.25
            q.vx += (f[0] * fk - q.vx) * dt * resp; q.vy += (f[1] * fk - q.vy) * dt * resp; q.vz += (f[2] * fk - q.vz) * dt * resp
          } else if (q.kind !== 'air') { q.vx *= Math.exp(-0.8 * dt); q.vy *= Math.exp(-0.8 * dt); q.vz *= Math.exp(-0.8 * dt) }
          if (q.kind !== 'air') { q.vx += rnd(-.06, .06) * dt * 4; q.vy += rnd(-.06, .06) * dt * 4; q.vz += rnd(-.06, .06) * dt * 4 }
        }
        if (q.kind === 'gas' || q.kind === 'mist' || q.kind === 'spark' || q.kind === 'molten') { const dk = Math.exp(-q.drag * dt); q.vx *= dk; q.vy *= dk; q.vz *= dk }
        q.px = q.x; q.py = q.y; q.pz = q.z
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt
        q.life -= dt
        if (q.size) q.size += q.grow * dt
        if ((q.kind === 'smoke' || q.kind === 'air') && st.fans && Math.hypot(q.x - INT[0], q.y - INT[1], q.z - INT[2]) < 0.22) {
          q.life = 0
          if (q.kind === 'smoke') { S.det += st.detW; if (S.det > THR && p.mode === 'hazard') S.alarm = true }
        }
        const out = Math.abs(q.x) > XW - 0.02 || Math.abs(q.y) > YH - 0.02 || q.z < -0.3 || q.z > L - 0.02
        if (out) {
          if (q.kind === 'smoke' || q.kind === 'gas' || q.kind === 'mist') {
            if (Math.abs(q.x) > XW - 0.02) { q.x = Math.sign(q.x) * (XW - 0.03); q.vx *= -0.3 }
            if (Math.abs(q.y) > YH - 0.02) { q.y = Math.sign(q.y) * (YH - 0.03); q.vy *= -0.3 }
            if (q.z < -0.3) { q.z = -0.29; q.vz *= -0.3 }
            if (q.z > L - 0.02) { q.z = L - 0.03; q.vz *= -0.3 }
          } else q.life = 0
        }
      }
      parts = parts.filter(q => q.life > 0)
      if (parts.length > 1800) parts = parts.slice(parts.length - 1800)

      /* ---------------- render */
      ctx.setTransform(sx, 0, 0, sy, 0, 0)
      ctx.fillStyle = '#07080a'; ctx.fillRect(0, 0, W, H)
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.fx, -cam.fy)
      drawCabin(st)
      // soft light pools under the light panels
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (const z of [0, 1.0, 2.05]) for (const x of [-0.6, 0.6]) glow(x, -0.78, z, 1.2, '255,248,225', 0.07 * st.light)
      ctx.restore()
      drawObjects(st, p)
      if (st.crew) drawCrew(st.crew, st)

      const vis = parts.slice().sort((a, b) => b.z - a.z)
      for (const q of vis) {
        if (q.kind === 'air') {
          if (!st.fans) continue
          const a = pj(q.x, q.y, q.z), b = pj(q.x - q.vx * 0.35, q.y - q.vy * 0.35, q.z - q.vz * 0.35)
          const al = Math.min(1, q.life / 0.6, (q.max - q.life) / 0.6) * (p.sel === 'detector' && p.mode === 'hazard' ? 0.35 : 0.13)
          ctx.strokeStyle = `rgba(170,205,255,${al})`; ctx.lineWidth = Math.max(0.6, a[2] * 0.004); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
        } else if (q.kind === 'smoke' || q.kind === 'gas' || q.kind === 'mist') {
          const a = pj(q.x, q.y, q.z), age = q.max - q.life
          const al = q.a * Math.min(1, age / 0.4, q.life / 1.2)
          ctx.fillStyle = rgb(q.col, 1, 0, al); ctx.beginPath(); ctx.arc(a[0], a[1], Math.max(1, a[2] * q.size), 0, 7); ctx.fill()
        }
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (const g of st.glows) glow(...g)
      for (const f of st.flames) drawFlame(f, st)
      if (st.arc) { const a = pj(...st.arc); ctx.strokeStyle = 'rgba(220,235,255,.95)'; ctx.lineWidth = 2; ctx.beginPath(); let x = a[0] - 14, y = a[1]; ctx.moveTo(x, y); for (let i = 0; i < 6; i++) { x += 5; y = a[1] + rnd(-7, 7); ctx.lineTo(x, y) } ctx.stroke() }
      for (const q of vis) {
        if (q.kind !== 'spark' && q.kind !== 'molten') continue
        const a = pj(q.x, q.y, q.z), b = pj(q.px, q.py, q.pz)
        const al = Math.min(1, q.life / 0.3)
        ctx.strokeStyle = q.kind === 'molten' ? `rgba(255,236,170,${al})` : `rgba(${q.sc || '255,200,110'},${al})`
        ctx.lineWidth = Math.max(1, a[2] * (q.kind === 'molten' ? 0.008 : 0.005))
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0] + (b[0] - a[0]) * 1.5, b[1] + (b[1] - a[1]) * 1.5); ctx.stroke()
      }
      ctx.restore()
      // dust motes
      for (const d of dust) {
        const q = pj(d.x + 0.03 * Math.sin(T * 0.3 + d.ph), d.y + 0.03 * Math.cos(T * 0.25 + d.ph), d.z)
        ctx.fillStyle = `rgba(255,250,235,${0.22 * st.light})`; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(0.6, q[2] * 0.0035), 0, 7); ctx.fill()
      }
      // overall haze
      const haze = p.mode === 'response' ? S.haze : Math.min(0.4, parts.filter(q => q.kind === 'smoke').length / 1600)
      if (haze > 0.005) { ctx.fillStyle = `rgba(92,90,88,${haze * 0.55})`; ctx.fillRect(cam.fx - W, cam.fy - H, W * 2, H * 2) }
      ctx.restore()

      // screen-space overlays
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72)
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
      if (S.alarm) {
        const pu = 0.5 + 0.5 * Math.sin(T * 9)
        ctx.fillStyle = `rgba(255,30,30,${0.09 * pu})`; ctx.fillRect(0, 0, W, H)
        ctx.strokeStyle = `rgba(255,60,50,${0.65 * pu})`; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8)
      }
      const toScr = (x, y, z) => { const q = pj(x, y, z); return [W / 2 + (q[0] - cam.fx) * cam.zoom, H / 2 + (q[1] - cam.fy) * cam.zoom] }
      const small = cssW < 700
      const fs = small ? 22 : 13
      if (p.mode === 'hazard') {
        // detector meter, top right
        const mx = W - (small ? 330 : 250), my = small ? 20 : 22
        ctx.fillStyle = 'rgba(8,10,14,.78)'; ctx.beginPath(); ctx.roundRect(mx, my, small ? 310 : 228, small ? 74 : 54, 8); ctx.fill()
        ctx.font = `500 ${small ? 18 : 10.5}px "IBM Plex Mono", monospace`; ctx.fillStyle = '#A6AAB1'; ctx.fillText('DUCT SMOKE DETECTOR', mx + 12, my + (small ? 26 : 19))
        ctx.fillStyle = S.alarm ? (Math.sin(T * 10) > 0 ? '#ff3b30' : '#a02018') : '#3ee08f'
        ctx.textAlign = 'right'; ctx.fillText(S.alarm ? 'ALARM' : 'NORMAL', mx + (small ? 298 : 216), my + (small ? 26 : 19)); ctx.textAlign = 'left'
        const fr = clamp(S.det / THR)
        ctx.fillStyle = '#22262d'; ctx.fillRect(mx + 12, my + (small ? 44 : 31), (small ? 286 : 204), small ? 12 : 8)
        ctx.fillStyle = S.alarm ? '#ff3b30' : fr > 0.5 ? '#ffb020' : '#3ee08f'; ctx.fillRect(mx + 12, my + (small ? 44 : 31), (small ? 286 : 204) * fr, small ? 12 : 8)
        // callouts
        const hs = []
        for (const id of Object.keys(ANCHOR)) {
          const [x, y] = toScr(...ANCHOR[id]); const on = p.sel === id, col = BLUE.has(id) ? '125,180,255' : '255,122,61'
          hs.push({ id, x, y })
          if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue
          const pr = (T * 0.8 + id.length * 0.13) % 1
          ctx.strokeStyle = `rgba(${col},${(1 - pr) * 0.9})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 8 + pr * 18, 0, 7); ctx.stroke()
          ctx.fillStyle = on ? `rgb(${col})` : 'rgba(8,10,14,.75)'; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2.5
          ctx.beginPath(); ctx.arc(x, y, small ? 13 : 8, 0, 7); ctx.fill(); ctx.stroke()
          if (small && !on) continue
          const left = x > W * 0.72, lx = left ? x - 30 : x + 30, ly = y - 26
          ctx.strokeStyle = `rgba(${col},${on ? 0.9 : 0.5})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + (left ? -8 : 8), y - 6); ctx.lineTo(lx, ly); ctx.stroke()
          ctx.font = `${on ? 600 : 500} ${fs}px Inter, system-ui, sans-serif`
          const tw = ctx.measureText(LABEL[id]).width + 18, bx = left ? lx - tw : lx
          ctx.fillStyle = on ? 'rgba(10,11,13,.92)' : 'rgba(10,11,13,.62)'; ctx.beginPath(); ctx.roundRect(bx, ly - fs - 2, tw, fs + 12, 6); ctx.fill()
          ctx.strokeStyle = `rgba(${col},${on ? 0.9 : 0.35})`; ctx.lineWidth = 1; ctx.stroke()
          ctx.fillStyle = on ? '#EEECE7' : 'rgba(238,236,231,.8)'; ctx.fillText(LABEL[id], bx + 9, ly + 2)
        }
        hits.current = hs
      } else hits.current = []
      if (p.mode === 'response' && st.nozzle && S.fire > 0.02) {
        const [x, y] = toScr(...F1)
        ctx.font = `500 ${fs}px "IBM Plex Mono", monospace`; ctx.fillStyle = 'rgba(238,236,231,.9)'; ctx.fillText('CO₂ EXTINGUISHER', x + 40, y + 60)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [])

  const toLocal = e => { const r = cv.current.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H, r.width] }
  const near = (x, y, w) => { let best = null, bd = (w < 700 ? 60 : 34); for (const h of hits.current) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h } } return best }
  return (
    <canvas ref={cv} role="img" aria-label={ariaLabel || 'Live illustration of the inside of a space station module'}
      onMouseMove={e => { const [x, y, w] = toLocal(e); mouse.current = { x: x / W * 2 - 1, y: y / H * 2 - 1, on: true }; cv.current.style.cursor = props.current.mode === 'hazard' && near(x, y, w) ? 'pointer' : 'default' }}
      onMouseLeave={() => { mouse.current.on = false }}
      onClick={e => { const [x, y, w] = toLocal(e); const h = near(x, y, w); if (h && props.current.onPick) props.current.onPick(h.id) }}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
