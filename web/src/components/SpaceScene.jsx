import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/* Interactive 3D scene: Earth (NASA Blue Marble), the ISS orbit, the Moon and Mars.
   Sizes of the three bodies are to scale with each other; distances are not.
   Moon and Mars surfaces are procedural illustrations, not maps.
   Accessible: every body has a real button, reduced motion stops all automatic movement,
   rendering pauses when the scene is off screen or the tab is hidden, and there is a non-3D fallback. */

const BODIES = {
  earth: { pos: [0, 0, 0], r: 1 },
  moon: { pos: [1.75, 1.0, 0.35], r: 0.273 },
  mars: { pos: [-2.75, 1.25, -3.3], r: 0.532 },
}
const ORBIT_R = 1.16, ORBIT_TILT = THREE.MathUtils.degToRad(51.6)
const VIEWS = {
  overview: { cam: [0.35, 0.55, 6.3], target: [-0.1, 0.35, -0.9] },
  orbit: { cam: [0.55, 1.4, 3.35], target: [0, 0.05, 0] },
  earth: { cam: [3.05, 0.45, 2.05], target: [0, 0, 0] },
  moon: { cam: [2.3, 1.22, 1.85], target: BODIES.moon.pos },
  mars: { cam: [-1.5, 1.62, -0.5], target: BODIES.mars.pos },
}

// small seeded value noise for the procedural Moon and Mars
function makeNoise(seed) {
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const P = 256, g = Array.from({ length: P * P }, rnd)
  const at = (x, y) => g[((y % P + P) % P) * P + ((x % P + P) % P)]
  const sm = t => t * t * (3 - 2 * t)
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi)
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1)
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
  }
  const fbm = (x, y, o = 5) => { let v = 0, amp = .5, f = 1; for (let i = 0; i < o; i++) { v += amp * vn(x * f, y * f); f *= 2; amp *= .5 } return v }
  return { rnd, fbm }
}

function planetTexture(kind) {
  const W = 1024, H = 512
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data
  const N = makeNoise(kind === 'moon' ? 7 : 31)
  for (let y = 0; y < H; y++) {
    const lat = (y / H - .5) * Math.PI
    for (let x = 0; x < W; x++) {
      const lon = x / W * Math.PI * 2
      // sample noise on the sphere (seamless in longitude)
      const nx = Math.cos(lat) * Math.cos(lon) * 3 + 10, ny = Math.cos(lat) * Math.sin(lon) * 3 + 10, nz = Math.sin(lat) * 3
      const n = N.fbm(nx + nz * .7, ny - nz * .4, 6), big = N.fbm(nx * .35 + 40, ny * .35 + nz * .3, 3)
      let r, g, b
      if (kind === 'moon') {
        let v = .58 + (n - .5) * .35
        if (big > .55) v -= .17 * Math.min(1, (big - .55) * 6) // dark maria
        r = g = b = v * 255; r *= 1.02; b *= .97
      } else {
        const t = Math.min(1, Math.max(0, (n - .3) * 1.6))
        r = 150 + 70 * t; g = 62 + 48 * t; b = 34 + 26 * t
        if (big > .56) { const k = Math.min(1, (big - .56) * 5) * .45; r *= 1 - k; g *= 1 - k; b *= 1 - k } // dark albedo regions
        const cap = Math.abs(lat) > 1.32 + (n - .5) * .25
        if (cap) { r = 236; g = 232; b = 226 }
      }
      const i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  // craters (more on the Moon), stretched with latitude so they stay round on the sphere
  const nC = kind === 'moon' ? 520 : 45
  for (let k = 0; k < nC; k++) {
    const rr = Math.pow(N.rnd(), 3.2) * (kind === 'moon' ? 22 : 12) + 1.2
    const x = N.rnd() * W, y = H * (.12 + .76 * N.rnd()), stretch = 1 / Math.max(.25, Math.cos((y / H - .5) * Math.PI))
    ctx.save(); ctx.translate(x, y); ctx.scale(stretch, 1)
    const gr = ctx.createRadialGradient(-rr * .2, -rr * .2, rr * .1, 0, 0, rr)
    gr.addColorStop(0, 'rgba(0,0,0,0.16)'); gr.addColorStop(.7, 'rgba(0,0,0,0.07)'); gr.addColorStop(.9, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
  return tex
}

const atmoMat = (color, power, strength) => new THREE.ShaderMaterial({
  uniforms: { c: { value: new THREE.Color(color) }, p: { value: power }, s: { value: strength } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 c; uniform float p; uniform float s; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), p); gl_FragColor = vec4(c, 1.0) * f * s; }',
  blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
})

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))) } catch { return false }
}

export default function SpaceScene({ focus = 'overview', onPick, labels }) {
  const host = useRef(null), api = useRef(null), labelEls = useRef({})
  const [failed, setFailed] = useState(() => !webglOK())

  useEffect(() => {
    if (failed) return
    const el = host.current
    let renderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }) } catch { setFailed(true); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200)
    camera.position.set(...VIEWS.overview.cam)

    const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(6, 2.2, 4.5); scene.add(sun)
    scene.add(new THREE.AmbientLight(0x8899bb, 0.12))

    // stars
    const starGeo = new THREE.BufferGeometry(), N = 1800, sp = new Float32Array(N * 3), sc = new Float32Array(N * 3)
    const R0 = makeNoise(99)
    for (let i = 0; i < N; i++) {
      const u = R0.rnd() * 2 - 1, th = R0.rnd() * Math.PI * 2, r = 60 + R0.rnd() * 30, s = Math.sqrt(1 - u * u)
      sp.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3)
      const w = .55 + R0.rnd() * .45, tint = R0.rnd()
      sc.set(tint < .15 ? [w, w * .85, w * .7] : tint > .85 ? [w * .8, w * .9, w] : [w, w, w], i * 3)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: .9, depthWrite: false }))
    scene.add(stars)

    // Earth
    const loader = new THREE.TextureLoader(), base = import.meta.env.BASE_URL || './'
    const tex = (f, srgb) => { const t = loader.load(base + 'textures/' + f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t }
    const earthGroup = new THREE.Group(); earthGroup.rotation.z = THREE.MathUtils.degToRad(23.4) * .5; scene.add(earthGroup)
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), new THREE.MeshPhongMaterial({
      map: tex('earth-blue-marble-2k.jpg', true), bumpMap: tex('earth-topology-2k.jpg'), bumpScale: 2.2,
      specularMap: tex('earth-water-2k.jpg'), specular: new THREE.Color(0x3a4d66), shininess: 18,
    }))
    earth.rotation.y = -1.9
    earthGroup.add(earth)
    earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.004, 64, 64), atmoMat(0x7db4ff, 3.2, 0.85)))
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 64), atmoMat(0x4f86ff, 5.5, 0.9)); halo.material.side = THREE.BackSide
    scene.add(halo)

    // ISS orbit and marker
    const orbit = new THREE.Group(); orbit.rotation.x = Math.PI / 2 - ORBIT_TILT; orbit.rotation.y = .5; scene.add(orbit)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ORBIT_R, 0.0035, 8, 256), new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: .75 }))
    orbit.add(ring)
    const iss = new THREE.Group(); orbit.add(iss)
    const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,170,110,.9)'); g.addColorStop(1, 'rgba(255,122,61,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t })()
    const issSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    issSprite.scale.setScalar(0.16); iss.add(issSprite)

    // Moon and Mars (procedural, illustrative)
    const mk = (kind, b) => {
      const t = planetTexture(kind)
      const m = new THREE.Mesh(new THREE.SphereGeometry(b.r, 64, 64), new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: kind === 'moon' ? 1.4 : 0.9, roughness: .96, metalness: 0 }))
      m.position.set(...b.pos); scene.add(m); return m
    }
    const moon = mk('moon', BODIES.moon), mars = mk('mars', BODIES.mars)
    const marsHalo = new THREE.Mesh(new THREE.SphereGeometry(BODIES.mars.r * 1.06, 48, 48), atmoMat(0xff9a6a, 4, .5)); marsHalo.material.side = THREE.BackSide; marsHalo.position.copy(mars.position); scene.add(marsHalo)

    // controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = .07; controls.enablePan = false; controls.enableZoom = false
    controls.rotateSpeed = .55; controls.target.set(...VIEWS.overview.target)
    const tween = { pos: new THREE.Vector3(...VIEWS.overview.cam), target: new THREE.Vector3(...VIEWS.overview.target), active: true }
    controls.addEventListener('start', () => { tween.active = false; el.style.cursor = 'grabbing' })
    controls.addEventListener('end', () => { el.style.cursor = 'grab' })
    el.style.cursor = 'grab'
    // touch screens: keep page scrolling; the bodies are picked with the buttons instead of dragging
    if (window.matchMedia('(pointer: coarse)').matches) { controls.enabled = false; renderer.domElement.style.touchAction = 'pan-y'; el.style.cursor = 'default' }

    // live reduced-motion preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    let still = mq.matches
    const onMq = e => { still = e.matches }
    mq.addEventListener?.('change', onMq)

    // size
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'
      camera.aspect = w / h
      camera.fov = w / h < .9 ? 50 : 38
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize); ro.observe(el); resize()

    // pause when off screen or hidden
    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }); io.observe(el)

    // label placement with occlusion by the Earth
    const v = new THREE.Vector3(), camDir = new THREE.Vector3()
    const hiddenByEarth = p => {
      const c = camera.position
      camDir.copy(p).sub(c); const L = camDir.length(); camDir.normalize()
      const t = -c.dot(camDir), closest = c.clone().addScaledVector(camDir, t)
      return t > 0 && t < L && closest.length() < 0.99
    }
    const issWorld = new THREE.Vector3(), moonTop = new THREE.Vector3(), marsTop = new THREE.Vector3(), earthBot = new THREE.Vector3()
    const place = () => {
      const w = el.clientWidth, h = el.clientHeight
      issSprite.getWorldPosition(issWorld)
      const pts = { orbit: issWorld, moon: moonTop.copy(moon.position).addScaledVector(camera.up, BODIES.moon.r * 1.25), mars: marsTop.copy(mars.position).addScaledVector(camera.up, BODIES.mars.r * 1.15), earth: earthBot.set(0, -1.06, 0) }
      for (const [k, p] of Object.entries(pts)) {
        const node = labelEls.current[k]; if (!node) continue
        v.copy(p).project(camera)
        const off = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1 || (k !== 'earth' && hiddenByEarth(k === 'moon' ? moon.position : k === 'mars' ? mars.position : p))
        node.style.opacity = off ? 0 : 1
        node.style.pointerEvents = off ? 'none' : 'auto'
        node.style.transform = `translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px) translate(-50%, ${k === 'earth' ? '6px' : k === 'orbit' ? '-150%' : '-100%'})`
      }
    }

    const clock = new THREE.Clock()
    let issAngle = 0.9, raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!visible || document.hidden) { clock.getDelta(); return }
      const dt = Math.min(clock.getDelta(), .05)
      if (!still) {
        earth.rotation.y += dt * .035
        moon.rotation.y += dt * .02; mars.rotation.y += dt * .03
        issAngle += dt * .32
        stars.rotation.y += dt * .002
      }
      iss.position.set(Math.cos(issAngle) * ORBIT_R, Math.sin(issAngle) * ORBIT_R, 0)
      if (tween.active) {
        const a = still ? 1 : 1 - Math.exp(-dt * 3.2)
        camera.position.lerp(tween.pos, a); controls.target.lerp(tween.target, a)
        if (camera.position.distanceTo(tween.pos) < .002) tween.active = false
      }
      controls.update()
      renderer.render(scene, camera)
      place()
    }
    loop()

    api.current = {
      go: name => { const V = VIEWS[name] || VIEWS.overview; tween.pos.set(...V.cam); tween.target.set(...V.target); tween.active = true },
    }
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mq.removeEventListener?.('change', onMq); controls.dispose()
      scene.traverse(o => { o.geometry?.dispose(); const m = o.material; if (m) { (Array.isArray(m) ? m : [m]).forEach(mm => { Object.values(mm).forEach(val => val?.isTexture && val.dispose()); mm.dispose() }) } })
      renderer.dispose(); renderer.domElement.remove()
    }
  }, [failed])

  useEffect(() => { api.current?.go(focus) }, [focus])

  if (failed) {
    return (
      <div role="img" aria-label="Earth, with the ISS orbit; the Moon and Mars beyond. 3D view unavailable in this browser." style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: '62%', aspectRatio: '1', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #7db4ff 0%, #2a5fb8 35%, #0c2350 70%, #050b1c 100%)', boxShadow: '0 0 80px rgba(79,134,255,.45)' }} />
      </div>
    )
  }
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={host} style={{ position: 'absolute', inset: 0, touchAction: 'pan-y' }} />
      {labels && Object.entries(labels).map(([k, txt]) => (
        <button key={k} ref={n => { labelEls.current[k] = n }} type="button" onClick={() => onPick?.(k)} aria-pressed={focus === k}
          className={'space-label' + (focus === k ? ' on' : '')} style={{ position: 'absolute', left: 0, top: 0, opacity: 0 }}>
          <i aria-hidden="true" />{txt}
        </button>))}
    </div>
  )
}
