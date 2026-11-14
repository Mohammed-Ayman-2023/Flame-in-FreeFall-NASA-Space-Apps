/* The fire triangle, alive: heat, fuel and oxygen stream into a flickering flame.
   Take one side away and its stream stops, the flame starves and goes out in smoke. */
import { useEffect, useRef } from 'react'

const W = 520, H = 470
const V = { top: [260, 40], left: [40, 420], right: [480, 420] }
const SIDES = {
  heat: { a: V.top, b: V.left, col: '255,122,61' },
  oxy: { a: V.top, b: V.right, col: '125,180,255' },
  fuel: { a: V.left, b: V.right, col: '230,180,90' },
}
const BASE = [260, 318]
const rnd = (a, b) => a + Math.random() * (b - a)

export default function FireTriangle({ removed }) {
  const cv = useRef(null), rm = useRef(removed)
  rm.current = removed
  useEffect(() => {
    const c = cv.current, ctx = c.getContext('2d')
    const resize = () => { const r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); c.width = Math.round(r.width * d); c.height = Math.round(r.height * d) }
    resize(); const ro = new ResizeObserver(resize); ro.observe(c)
    let fire = [], smoke = [], feed = [], level = 1, T = 0, last = performance.now(), raf
    const sideAlive = { heat: 1, oxy: 1, fuel: 1 }
    const loop = now => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt
      const r = rm.current
      for (const k in sideAlive) sideAlive[k] += ((r === k ? 0 : 1) - sideAlive[k]) * Math.min(1, dt * 4)
      const target = r ? 0 : 1
      level += (target - level) * Math.min(1, dt * (target > level ? 1.6 : 0.7))
      if (level < 0.015 && r) level = 0

      // flame
      const n = 170 * level * dt
      for (let k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); k > 0; k--) {
        const s = 0.55 + 0.45 * level
        fire.push({ x: BASE[0] + rnd(-30, 30) * s, y: BASE[1] + rnd(-4, 4), vx: rnd(-14, 14), vy: rnd(-95, -150) * s, life: rnd(0.55, 1.05) * s, max: 0, r: rnd(15, 25) * s })
        fire[fire.length - 1].max = fire[fire.length - 1].life
      }
      if (r && level > 0.02 || (r && level < 0.4 && Math.random() < 0.3)) {
        const m = (r ? 22 : 0) * (0.3 + (1 - level)) * dt
        for (let k = Math.floor(m) + (Math.random() < m % 1 ? 1 : 0); k > 0; k--) smoke.push({ x: BASE[0] + rnd(-20, 20), y: BASE[1] - 40 * level - rnd(0, 20), vx: rnd(-10, 10), vy: rnd(-30, -55), life: rnd(1.8, 3), max: 3, r: rnd(10, 18) })
      }
      // feed streams from each side towards the flame
      for (const k in SIDES) {
        if (r === k || level < 0.05) continue
        const S = SIDES[k], m = 7 * dt
        if (Math.random() < m) { const u = rnd(0.25, 0.75); feed.push({ k, x: S.a[0] + (S.b[0] - S.a[0]) * u, y: S.a[1] + (S.b[1] - S.a[1]) * u, t: 0, ph: rnd(0, 6) }) }
      }
      for (const p of fire) { p.vx += Math.sin(T * 3 + p.y * 0.04) * 30 * dt; p.vx *= 0.97; p.vy -= 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt }
      for (const p of smoke) { p.vx += Math.sin(T + p.y * 0.02) * 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 10 * dt; p.life -= dt }
      for (const p of feed) { p.t += dt * 0.55 }
      fire = fire.filter(p => p.life > 0); smoke = smoke.filter(p => p.life > 0); feed = feed.filter(p => p.t < 1 && !(rm.current === p.k))

      const sx = c.width / W, sy = c.height / H
      ctx.setTransform(sx, 0, 0, sy, 0, 0); ctx.clearRect(0, 0, W, H)
      // sides
      for (const k in SIDES) {
        const S = SIDES[k], al = sideAlive[k]
        ctx.lineCap = 'round'
        ctx.setLineDash(al < 0.5 ? [6, 12] : [])
        ctx.strokeStyle = al < 0.5 ? 'rgba(80,84,92,.9)' : `rgba(${S.col},${0.25 + 0.2 * Math.sin(T * 2 + k.length)})`
        ctx.lineWidth = 18 * al + 2; ctx.beginPath(); ctx.moveTo(...S.a); ctx.lineTo(...S.b); ctx.stroke()
        ctx.setLineDash(al < 0.5 ? [6, 12] : [14, 10]); ctx.lineDashOffset = -T * 40
        ctx.strokeStyle = al < 0.5 ? 'rgba(80,84,92,.9)' : `rgb(${S.col})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(...S.a); ctx.lineTo(...S.b); ctx.stroke()
        ctx.setLineDash([])
        if (al < 0.5) { const mx = (S.a[0] + S.b[0]) / 2, my = (S.a[1] + S.b[1]) / 2; ctx.strokeStyle = 'rgba(255,90,80,.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(mx - 12, my - 12); ctx.lineTo(mx + 12, my + 12); ctx.moveTo(mx + 12, my - 12); ctx.lineTo(mx - 12, my + 12); ctx.stroke() }
      }
      // feed particles
      for (const p of feed) {
        const S = SIDES[p.k], e = p.t * p.t * (3 - 2 * p.t)
        const x = p.x + (BASE[0] - p.x) * e + Math.sin(p.t * 9 + p.ph) * 8 * (1 - e), y = p.y + (BASE[1] - 30 - p.y) * e
        const al = Math.min(1, p.t * 5, (1 - p.t) * 4)
        if (p.k === 'oxy') { ctx.fillStyle = `rgba(125,180,255,${al})`; ctx.beginPath(); ctx.arc(x - 4, y, 4.5, 0, 7); ctx.arc(x + 4, y, 4.5, 0, 7); ctx.fill() }
        else if (p.k === 'heat') { ctx.strokeStyle = `rgba(255,140,70,${al})`; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 4; i++) { const xx = x - 9 + i * 6, yy = y + (i % 2 ? -5 : 5); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy) } ctx.stroke() }
        else { ctx.fillStyle = `rgba(230,180,90,${al})`; ctx.beginPath(); ctx.ellipse(x, y, 5, 3.5, p.ph, 0, 7); ctx.fill() }
      }
      // fuel sample
      ctx.fillStyle = '#2a2622'; ctx.beginPath(); ctx.roundRect(200, BASE[1] + 6, 120, 16, 4); ctx.fill()
      ctx.fillStyle = `rgba(255,90,40,${0.15 + 0.5 * level})`; ctx.fillRect(206, BASE[1] + 6, 108, 3)
      // glow
      if (level > 0.01) {
        const g = ctx.createRadialGradient(BASE[0], BASE[1] - 50, 0, BASE[0], BASE[1] - 50, 190 * level)
        g.addColorStop(0, `rgba(255,140,50,${0.32 * level})`); g.addColorStop(1, 'rgba(255,140,50,0)')
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      }
      for (const p of smoke) { const a = Math.min(1, (p.max - p.life) * 2, p.life / 1.2) * 0.18; ctx.fillStyle = `rgba(150,150,155,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill() }
      ctx.globalCompositeOperation = 'lighter'
      for (const p of fire) {
        const a = 1 - p.life / p.max
        const col = a < 0.18 ? '255,245,215' : a < 0.45 ? '255,180,70' : a < 0.75 ? '240,95,35' : '150,40,20'
        const rr = p.r * (1 - a * 0.55)
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr)
        g.addColorStop(0, `rgba(${col},${0.42 * (1 - a)})`); g.addColorStop(1, `rgba(${col},0)`)
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 7); ctx.fill()
      }
      if (level > 0.05) { const g = ctx.createRadialGradient(BASE[0], BASE[1] - 4, 0, BASE[0], BASE[1] - 4, 30 * level); g.addColorStop(0, `rgba(110,150,255,${0.5 * level})`); g.addColorStop(1, 'rgba(110,150,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(BASE[0], BASE[1] - 4, 30 * level, 0, 7); ctx.fill() }
      ctx.globalCompositeOperation = 'source-over'
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])
  return <canvas ref={cv} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
}
