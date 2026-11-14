// Every number shown on the site comes from these files, exported by scripts/export_web.py.
import missions from '../data/missions.json'
import investigations from '../data/investigations.json'
import hardware from '../data/hardware.json'
import rankings from '../data/rankings.json'
import takeaways from '../data/takeaways.json'
import coverage from '../data/coverage.json'
import gasFlames from '../data/gas_flames.json'
import modelGas from '../data/model_gas.json'
import modelSolids from '../data/model_solids.json'
import modelDroplets from '../data/model_droplets.json'
import physics from '../data/physics.json'
import recommendations from '../data/recommendations.json'
import partialGravity from '../data/partial_gravity.json'
import methods from '../data/methods.json'
import corpus from '../data/corpus.json'
import gravityBounds from '../data/gravity_bounds.json'
import atmospheres from '../data/atmospheres.json'
import equipment from '../data/equipment.json'
import earth from '../data/earth.json'
import airQuality from '../data/air_quality.json'
import d2Check from '../data/d2_check.json'
import solidTests from '../data/solid_tests.json'

export { missions, investigations, hardware, rankings, takeaways, coverage, gasFlames, modelGas, modelSolids,
  modelDroplets, physics, recommendations, partialGravity, methods, corpus, gravityBounds, atmospheres, equipment,
  earth, airQuality, d2Check, solidTests }

// smoke transport (same formula as src/fif/knowledge.py smoke_delay): delay = distance / sqrt(u_fan² + u_b²)
export function smokeDelay(distM, fanCmS, dT = 600, L = 0.05) {
  const places = [['Orbit (0 g)', 0], ['Moon', physics.gravity.Moon], ['Mars', physics.gravity.Mars], ['Earth', physics.gravity.Earth]]
  return places.map(([name, g]) => {
    const ub = buoyantVelocity(g, dT, L)
    const u = Math.hypot(fanCmS / 100, ub)
    return { name, g, ub: ub * 100, u: u * 100, delay: u > 0 ? distM / u : Infinity }
  })
}

export const invById = Object.fromEntries(investigations.map(i => [i.id, i]))

// gas model: grid rows [fuel, o2%, p, median, s10, s30, s60]
export function gasPredict(fuel, o2, p) {
  const r = modelGas.grid.find(g => g[0] === fuel && g[1] === o2 && g[2] === p)
  return r ? { median: r[3], s10: r[4], s30: r[5], s60: r[6] } : null
}
export function gasCurve(fuel, p) {
  return modelGas.grid.filter(g => g[0] === fuel && g[2] === p).map(g => ({ o2: g[1], median: g[3], s30: g[5] }))
}
export const gasInGap = o2 => o2 > modelGas.gap[0] && o2 < modelGas.gap[1]

// solids model: grid rows [material, o2%, p, flow, p, lo, hi]
export function solidPredict(mat, o2, p, flow) {
  const r = modelSolids.grid.find(g => g[0] === mat && g[1] === o2 && g[2] === p && g[3] === flow)
  return r ? { p: r[4], lo: r[5], hi: r[6] } : null
}
export function solidCurve(mat, o2, p, by) {
  const rows = modelSolids.grid.filter(g => g[0] === mat)
  if (by === 'flow') return rows.filter(g => g[1] === o2 && g[2] === p).map(g => ({ x: g[3], p: g[4], lo: g[5], hi: g[6] }))
  return rows.filter(g => g[2] === p && g[3] === by).map(g => ({ x: g[1], p: g[4], lo: g[5], hi: g[6] }))
}
export function solidInside(mat, o2, p, flow) {
  const e = modelSolids.envelope[mat]
  if (!e) return false
  return o2 >= e.o2[0] - 2 && o2 <= e.o2[1] + 2 && p >= e.p[0] - 0.1 && p <= e.p[1] + 0.1 && flow >= e.flow[0] * 0.8 && flow <= e.flow[1] * 1.2
}

// droplet model: grid rows [fuel, o2%, p, co2, he, d0, br, br_sd, ext, ext_sd]
export function dropPredict(fuel, o2, p, co2, he, d0) {
  const r = modelDroplets.grid.find(g => g[0] === fuel && g[1] === o2 && g[2] === p && g[3] === co2 && g[4] === he && g[5] === d0)
  return r ? { br: r[6], brSd: r[7], ext: r[8], extSd: r[9] } : null
}
export function dropInside(fuel, o2, p, co2, he) {
  const e = modelDroplets.envelope[fuel]
  return o2 >= e.o2[0] && o2 <= e.o2[1] && p >= e.p[0] - 0.05 && p <= e.p[1] && co2 <= e.co2_max && he <= e.he_max && !(o2 > 25 && (co2 > 0 || he > 0))
}

// physics (same formulas as src/fif/knowledge.py)
export const G = physics.gravity
export function buoyantVelocity(g, dT, L, Tair = 295) { return Math.sqrt(Math.max(g, 0) * dT / Tair * L) }
export function richardson(g, dT, L, u) { return Math.pow(buoyantVelocity(g, dT, L) / Math.max(u, 1e-6), 2) }
