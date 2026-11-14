import { useMemo, useState } from 'react'
import { useApi, useGet } from '../lib/api'
import { Link, go } from '../lib/router'
import { Nav, Footer, PageHead, Ev, Flame } from '../components/ui'
import { BurnChart, CoverageMap, CoverageLegend } from '../components/charts'
import { useMission } from '../lib/mission'
import { AtmosphereTable, GravityBounds, BuoyancyPanel } from './Evidence'
import { investigations, invById, rankings, takeaways, recommendations, partialGravity, methods, hardware } from '../lib/data'

const FAM = t => (t.startsWith('Burning') || t.startsWith('Emulated') ? 'solid' : t.startsWith('Fuel') ? 'droplet' : t.startsWith('Gas') ? 'gas' : 'smoke')
const FAMNAME = { solid: 'Burning solids', droplet: 'Fuel droplets', gas: 'Gas flames', smoke: 'Smoke & detection' }
const VIS = {
  solid: 'linear-gradient(90deg, #0b0c0e 0%, #0b0c0e 46%, rgba(255,150,70,0.9) 50%, rgba(80,120,255,0.55) 53%, #1b2230 58%, #2a2e35 100%)',
  droplet: 'radial-gradient(circle at 50% 52%, #fff 0%, #dcebff 4%, #8fb8ff 9%, rgba(63,111,240,0.55) 16%, rgba(30,40,120,0.12) 26%, #050607 34%)',
  gas: 'radial-gradient(circle at 50% 52%, #fff 0%, #dcebff 7%, #8fb8ff 15%, rgba(63,111,240,0.6) 26%, rgba(255,150,70,0.18) 34%, rgba(30,40,120,0.1) 42%, #050607 52%)',
  smoke: 'radial-gradient(ellipse at 40% 55%, rgba(200,204,210,0.35) 0%, rgba(200,204,210,0.12) 30%, #050607 62%)',
}
const BADGE = { nasa: 'measurement', model: 'prediction', lit: 'literature', literature: 'literature', gap: 'gap', measurement: 'measurement', prediction: 'prediction', physics: 'physics' }

function useCompare() {
  const read = () => { try { return JSON.parse(localStorage.getItem('fif-compare') || '["PSI-159","PSI-20"]') } catch { return ['PSI-159', 'PSI-20'] } }
  const [sel, setSel] = useState(read)
  const save = v => { setSel(v); try { localStorage.setItem('fif-compare', JSON.stringify(v)) } catch {} }
  const toggle = id => save(sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id].slice(-3))
  return [sel, toggle, save]
}

/* ------------------------------------------------------------------ explore */
export function Explore() {
  const { mission } = useMission()
  const q0 = (() => { try { const v = sessionStorage.getItem('fif-q') || ''; sessionStorage.removeItem('fif-q'); return v } catch { return '' } })()
  const [q, setQ] = useState(q0)
  const [fam, setFam] = useState('all')
  const [view, setView] = useState('grid')
  const [sel, toggle] = useCompare()
  const rank = rankings[mission.id]
  const api = useApi()
  // With the API up, search runs over every field of every record on the server; offline, over the main fields here.
  const qs = q.trim()
  const srv = useGet(qs.length >= 2 ? `/api/investigations?q=${encodeURIComponent(qs)}` : null, !!api)
  const hitIds = srv.data ? new Set(srv.data.map(r => r.id)) : null
  const rows = useMemo(() => rank.map(r => ({ ...r, inv: invById[r.psi_id], fam: FAM(r.fire_type) })).filter(r => r.inv)
    .filter(r => fam === 'all' || r.fam === fam)
    .filter(r => !qs || (hitIds ? hitIds.has(r.psi_id) : `${r.inv.acronym} ${r.inv.name} ${r.inv.fuels} ${r.inv.what} ${r.psi_id} ${r.inv.measurements}`.toLowerCase().includes(qs.toLowerCase()))), [rank, fam, qs, srv.data]) // eslint-disable-line react-hooks/exhaustive-deps
  return (<>
    <Nav active="Investigations" />
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 120 }}>
      <PageHead eyebrow="NASA Physical Sciences Informatics · combustion science" title={`${investigations.length} investigations, ordered by how much they tell your mission.`}
        right={<p className="p" style={{ maxWidth: 360, fontSize: 14 }}>Sorted by relevance to <span style={{ color: 'var(--ember)' }}>{mission.air}</span>. Change the mission air in the top bar and the order changes.</p>} />
      <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', gap: 12 }}>
        <div className="wrap-row" style={{ alignItems: 'center' }}>
          <label htmlFor="q" className="sr">Search investigations</label>
          <input id="q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search fuel, material, instrument…" style={{ width: 280, maxWidth: '100%', background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 6, color: 'var(--text)', fontSize: 14, padding: '10px 14px' }} />
          {[['all', 'All'], ['solid', 'Burning solids'], ['droplet', 'Fuel droplets'], ['gas', 'Gas flames'], ['smoke', 'Smoke & detection']].map(([k, n]) => <button key={k} type="button" className={'chip' + (fam === k ? ' on' : '')} onClick={() => setFam(k)}>{n}</button>)}
        </div>
        <div className="seg" role="group" aria-label="View">{[['grid', 'Gallery'], ['table', 'Table']].map(([k, n]) => <button key={k} type="button" className={view === k ? 'on' : ''} onClick={() => setView(k)}>{n}</button>)}</div>
      </div>
      <div className="mono faint" role="status" style={{ fontSize: 12, padding: '14px 0 22px' }}>{rows.length} SHOWN · DIMMED = CATALOGUED ONLY, NO PER-TEST DATA{qs && (srv.loading ? ' · SEARCHING THE FULL RECORDS…' : srv.data ? ' · FULL-RECORD SEARCH ON THE SERVER' : '')}</div>
      {rows.length === 0 && <div className="card pad col" style={{ gap: 8, marginBottom: 24 }}><strong>No investigation matches “{qs}”{fam !== 'all' ? ' in this category' : ''}.</strong><span className="muted" style={{ fontSize: 14 }}>NASA’s PSI combustion data may not cover it. Try a fuel (propane, cotton), an instrument (camera, radiometer) or an experiment name (Saffire, FLEX).</span><button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setQ(''); setFam('all') }}>Clear search</button></div>}
      {view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {rows.map(r => (
            <article key={r.psi_id} className="card col" style={{ overflow: 'hidden', opacity: r.data_level === 'catalog only' ? .62 : 1, borderColor: sel.includes(r.psi_id) ? 'var(--ember)' : 'var(--line)' }}>
              <Link to={'/investigation/' + r.psi_id} style={{ display: 'block' }}>
                <div style={{ height: 140, background: VIS[r.fam], position: 'relative', borderBottom: '1px solid var(--line)' }}>
                  <span className="mono" style={{ position: 'absolute', left: 14, top: 12, fontSize: 11, color: '#C9CDD3' }}>{FAMNAME[r.fam]}</span>
                  <span className="mono" style={{ position: 'absolute', right: 14, top: 12, fontSize: 11, color: '#C9CDD3' }}>#{r.rank} · {r.psi_id.replace('EXT-SAFFIRE-456', 'NASA lit.')}</span>
                </div>
                <div className="col" style={{ padding: '18px 18px 0', gap: 6 }}>
                  <h2 className="h2" style={{ fontSize: 24 }}>{r.inv.acronym.replace(' (external)', '')}</h2>
                  <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.4, minHeight: 40 }}>{r.inv.name}</p>
                </div>
              </Link>
              <div className="col" style={{ padding: '14px 18px 18px', gap: 12, marginTop: 'auto' }}>
                <div className="row"><span className="lab" style={{ width: 80 }}>Relevance</span><div className="bar" style={{ flex: 1 }}><span style={{ width: r.relevance + '%' }} /></div><span className="mono" style={{ fontSize: 13, width: 26, textAlign: 'right' }}>{Math.round(r.relevance)}</span></div>
                <div className="mono muted" style={{ fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}><span>{r.n_tests} tests</span><span>{r.n_near_mission} near your air</span><span className="faint" style={{ gridColumn: '1 / -1' }}>Closest: {r.closest_condition}</span></div>
                <button type="button" className="btn sm" style={sel.includes(r.psi_id) ? { background: 'var(--ember)', borderColor: 'var(--ember)', color: '#0A0B0D', justifyContent: 'center' } : { justifyContent: 'center' }} onClick={() => toggle(r.psi_id)}>{sel.includes(r.psi_id) ? 'Added to compare' : 'Add to compare'}</button>
              </div>
            </article>))}
        </div>
      ) : (
        <div className="card scroll-x"><table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>#</th><th>Investigation</th><th>Fire type</th><th>Platform</th><th>Tests</th><th>Near your air</th><th>Closest test</th><th>Relevance</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.psi_id} style={{ opacity: r.data_level === 'catalog only' ? .62 : 1 }}>
            <td className="mono faint">{r.rank}</td><td><Link to={'/investigation/' + r.psi_id} style={{ fontWeight: 600 }}>{r.inv.acronym}</Link> <span className="mono faint" style={{ fontSize: 12 }}>{r.psi_id}</span></td>
            <td className="muted">{FAMNAME[r.fam]}</td><td className="muted">{r.inv.platform}</td><td className="mono">{r.n_tests}</td><td className="mono">{r.n_near_mission}</td><td className="mono muted">{r.closest_condition}</td><td className="mono" style={{ color: 'var(--ember)' }}>{Math.round(r.relevance)}</td></tr>)}</tbody>
        </table></div>
      )}
    </main>
    {sel.length > 0 && (
      <div style={{ position: 'sticky', bottom: 0, borderTop: '1px solid var(--line2)', background: 'rgba(17,19,23,.97)', zIndex: 20 }}>
        <div className="wrap row" style={{ padding: '14px 32px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="wrap-row" style={{ alignItems: 'center' }}><span className="lab">Compare {sel.length} / 3</span>{sel.map(id => <span key={id} className="chip" style={{ cursor: 'default' }}>{invById[id]?.acronym}</span>)}</div>
          <Link to="/compare" className="btn primary">Compare side by side →</Link>
        </div>
      </div>)}
    <Footer />
  </>)
}

/* ------------------------------------------------------------------ investigation detail */
export function Investigation({ id }) {
  const { mission } = useMission()
  const inv = invById[id]
  const [sel, toggle] = useCompare()
  if (!inv) return <><Nav /><main className="wrap" style={{ padding: 80 }}><h1 className="h2">Investigation not found</h1><Link to="/explore" className="btn">Back to the archive</Link></main></>
  const r = rankings[mission.id].find(x => x.psi_id === id)
  const fam = FAM(inv.fire_type)
  const group = inv.hardware_group && hardware[inv.hardware_group]
  const fact = (k, v) => v ? <div className="col rule" style={{ gap: 6, padding: '14px 0' }}><span className="lab">{k}</span><span style={{ fontSize: 15, lineHeight: 1.45 }}>{v}</span></div> : null
  return (<>
    <Nav active="Investigations" />
    <main className="wrap" style={{ paddingTop: 28, paddingBottom: 60 }}>
      <nav aria-label="Breadcrumb" className="mono faint row" style={{ fontSize: 12, gap: 8 }}><Link to="/explore" className="muted">Investigations</Link><span>/</span><span>{FAMNAME[fam]}</span><span>/</span><span style={{ color: 'var(--text)' }}>{inv.acronym}</span></nav>
      <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'space-between', gap: 24, alignItems: 'flex-end', padding: '32px 0 36px' }}>
        <div className="col" style={{ gap: 14, maxWidth: 860 }}>
          <div className="wrap-row">{[inv.id.replace('EXT-SAFFIRE-456', 'NASA reports'), FAMNAME[fam], [inv.platform, inv.years].filter(Boolean).join(' · ')].map(t => <span key={t} className="mono muted" style={{ fontSize: 12, border: '1px solid var(--line2)', borderRadius: 4, padding: '4px 8px' }}>{t}</span>)}</div>
          <h1 className="h1" style={{ fontSize: 'clamp(44px, 6vw, 72px)' }}>{inv.acronym.replace(' (external)', '')}</h1>
          <p style={{ margin: 0, fontSize: 21, lineHeight: 1.4, color: 'var(--muted)' }}>{inv.name}. {inv.what}</p>
        </div>
        <div className="row"><button type="button" className="btn" onClick={() => toggle(id)}>{sel.includes(id) ? '✓ In compare' : 'Add to compare'}</button><Link to="/compare" className="btn light">Compare →</Link></div>
      </div>
      <div className="split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 48 }}>
        <div className="col" style={{ gap: 36, minWidth: 0 }}>
          <div className="card" style={{ height: 300, background: VIS[fam], position: 'relative', overflow: 'hidden' }}>
            <span className="mono" style={{ position: 'absolute', left: 16, bottom: 14, fontSize: 11, color: '#C9CDD3' }}>Illustration of the fire type studied by {inv.acronym}, not flight imagery · see the NASA page for videos and images</span>
          </div>
          <div className="col" style={{ gap: 14 }}>
            <div className="eyebrow">Key result</div>
            <p className="disp" style={{ margin: 0, fontSize: 28, lineHeight: 1.3, fontWeight: 500 }}>{inv.key_result}</p>
          </div>
          {id === 'PSI-159' && <div className="card" style={{ padding: '16px 10px 6px' }}><div style={{ fontSize: 15, fontWeight: 600, padding: '0 10px 8px' }}>Burn time against oxygen, every flame</div><BurnChart /></div>}
          {(inv.varied.length > 0 || inv.same.length > 0) && <div className="grid2" style={{ gap: 32 }}>
            <div><div className="eyebrow">What changed between tests</div><ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>{inv.varied.map(v => <li key={v} className="rule" style={{ padding: '10px 0', fontSize: 14, lineHeight: 1.5 }}>{v}</li>)}</ul></div>
            <div><div className="eyebrow">What stayed the same</div><ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>{inv.same.map(v => <li key={v} className="rule" style={{ padding: '10px 0', fontSize: 14, lineHeight: 1.5 }}>{v}</li>)}</ul></div>
          </div>}
          {inv.context && <div style={{ padding: '16px 20px', borderLeft: '2px solid var(--line2)', background: 'var(--panel)', fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}><div className="lab" style={{ marginBottom: 6 }}>Context from the challenge brief</div>{inv.context}</div>}
        </div>
        <aside className="col" style={{ gap: 28 }}>
          {r && <div className="col" style={{ border: '1px solid var(--ember)', borderRadius: 12, padding: 22, gap: 12, background: 'var(--ember-soft)' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ember)', letterSpacing: '.06em' }}>FOR {mission.air.toUpperCase()}</span>
            <div className="row" style={{ alignItems: 'baseline' }}><span className="h1" style={{ fontSize: 56 }}>{Math.round(r.relevance)}</span><span className="mono muted" style={{ fontSize: 13 }}>relevance · rank {r.rank} of 24</span></div>
            <span style={{ fontSize: 14, lineHeight: 1.55 }}>{r.n_near_mission} of {r.n_tests} tests within ±5% O₂ and ±0.2 atm of this air. Closest: {r.closest_condition}.</span>
            <div className="mono muted" style={{ fontSize: 12, display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', borderTop: '1px solid rgba(255,122,61,.3)', paddingTop: 12 }}>
              <span>Atmosphere match</span><span>{r.score_atmosphere.toFixed(2)}</span><span>Fire-type importance</span><span>{r.score_fire_type.toFixed(2)}</span><span>Data quality</span><span>{r.score_data.toFixed(2)}</span><span>Number of tests</span><span>{r.score_volume.toFixed(2)}</span>
            </div>
          </div>}
          <div><div className="eyebrow">At a glance</div>
            {fact('Tests loaded', `${inv.n_tests} · ${inv.data_level}`)}{fact('Fuels or materials', inv.fuels)}{fact('Sample or burner', inv.sample)}{fact('Hardware', inv.hardware)}{fact('Measurements', inv.measurements)}{fact('Derived from', inv.derived)}
          </div>
          {group && <div><div className="eyebrow">Same hardware</div><div className="wrap-row" style={{ marginTop: 12 }}>{group.members.filter(m => m !== id && invById[m]).map(m => <Link key={m} to={'/investigation/' + m} className="chip">{invById[m].acronym}</Link>)}</div></div>}
          <div><div className="eyebrow">Source</div><div className="col" style={{ gap: 8, marginTop: 12 }}>
            <a href={inv.link} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12, color: 'var(--plasma)' }}>{inv.doi ? (inv.doi.startsWith('NTRS') ? inv.doi : 'doi:' + inv.doi) : 'NASA PSI record'} ↗</a>
            <span className="src">NASA PSI data are CC0-1.0. Every value on this page traces to its source file and line in the repository.</span>
          </div></div>
        </aside>
      </div>
    </main>
    <Footer />
  </>)
}

/* ------------------------------------------------------------------ compare */
export function Compare() {
  const { mission } = useMission()
  const [sel, toggle, save] = useCompare()
  const [adding, setAdding] = useState(false)
  const list = sel.map(id => invById[id]).filter(Boolean)
  const rank = Object.fromEntries(rankings[mission.id].map(r => [r.psi_id, r]))
  const rows = [
    ['Platform', i => i.platform], ['Fuels or materials', i => i.fuels], ['Sample or burner', i => i.sample],
    ['Oxygen', i => i.o2[0] != null ? `${Math.round(i.o2[0] * 100)}–${Math.round(i.o2[1] * 100)}%` : '—'],
    ['Pressure', i => i.p[0] != null ? `${i.p[0]}–${i.p[1]} atm` : '—'], ['Max air speed', i => i.flow_max != null ? `${i.flow_max} cm/s` : '—'],
    ['Tests loaded', i => `${i.n_tests} · ${i.data_level}`], ['Near your air', i => rank[i.id] ? `${rank[i.id].n_near_mission} tests` : '—'],
    ['Closest test', i => rank[i.id]?.closest_condition || '—'], ['Hardware', i => i.hardware], ['Measurements', i => i.measurements], ['Key result', i => i.key_result],
  ]
  const same = rows.filter(([, f]) => list.length > 1 && new Set(list.map(f)).size === 1).map(([k]) => k)
  const api = useApi()
  const cmp = useGet(list.length >= 2 ? `/api/compare?ids=${list.map(i => i.id).join(',')}` : null, !!api)
  const gaps = list.length > 1 ? rows.filter(([, f]) => list.some(i => f(i) === '—' || !f(i))).map(([k]) => k) : []
  return (<>
    <Nav active="Compare" />
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <PageHead eyebrow="Compare · up to three" title="Side by side." right={<button type="button" className="btn" onClick={() => setAdding(!adding)}>+ Add investigation</button>} />
      {adding && <div className="card pad wrap-row" style={{ marginBottom: 24 }}>{investigations.map(i => <button key={i.id} type="button" className={'chip' + (sel.includes(i.id) ? ' on' : '')} onClick={() => toggle(i.id)}>{i.acronym}</button>)}</div>}
      {list.length === 0 ? <p className="p">Nothing selected yet. <Link to="/explore" style={{ color: 'var(--ember)' }}>Pick investigations in the archive.</Link></p> : <>
        {list.length > 1 && <div className="grid2" style={{ marginBottom: 32 }}>
          <div className="card pad col" style={{ gap: 8 }}><span className="lab">The same in all</span><span style={{ fontSize: 15 }}>{same.length ? same.join(' · ') : 'Nothing: these differ in every attribute shown.'}</span></div>
          <div className="card pad col" style={{ gap: 8 }}><span className="lab">Relevance to {mission.air}</span><span style={{ fontSize: 15 }}>{list.map(i => `${i.acronym} ${rank[i.id] ? Math.round(rank[i.id].relevance) : '—'}`).join(' · ')}</span></div>
        </div>}
        {list.length > 1 && (cmp.data || cmp.loading) && <div className="card pad col" style={{ gap: 10, marginBottom: 24, borderColor: 'var(--plasma)' }}>
          <span className="eyebrow plasma" style={{ fontSize: 11 }}>Can these results be compared? · computed from the test records on the server</span>
          {cmp.loading && !cmp.data ? <span className="muted" style={{ fontSize: 14 }}>Checking hardware, conditions and measurements…</span> : <div className="grid2" style={{ gap: 20 }}>
            <div className="col" style={{ gap: 6 }}><span className="lab">Shared</span>{cmp.data.same.length ? cmp.data.same.map(t => <span key={t} style={{ fontSize: 14, lineHeight: 1.5 }}>✓ {t}</span>) : <span className="muted" style={{ fontSize: 14 }}>No shared hardware or conditions: compare trends, not exact numbers.</span>}</div>
            <div className="col" style={{ gap: 6 }}><span className="lab">Different</span>{cmp.data.different.map(t => <span key={t} style={{ fontSize: 14, lineHeight: 1.5 }}>≠ {t}</span>)}</div>
          </div>}
        </div>}
        {gaps.length > 0 && <p className="muted" style={{ fontSize: 13, margin: '0 0 20px' }}>— marks data the archive does not have for that investigation ({gaps.join(', ')}). Those rows cannot be compared.</p>}
        <div className="scroll-x"><div style={{ minWidth: 300 + list.length * 280 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(${list.length}, minmax(0,1fr))`, gap: '0 28px', paddingBottom: 20 }}>
            <span />
            {list.map(i => <div key={i.id} className="col" style={{ gap: 12 }}>
              <div style={{ height: 120, borderRadius: 8, border: '1px solid var(--line)', background: VIS[FAM(i.fire_type)] }} />
              <div className="row" style={{ justifyContent: 'space-between' }}><Link to={'/investigation/' + i.id} className="h2" style={{ fontSize: 24 }}>{i.acronym}</Link><button type="button" aria-label={`Remove ${i.acronym}`} onClick={() => toggle(i.id)} style={{ background: 'transparent', border: 0, color: 'var(--faint)', cursor: 'pointer', fontSize: 20 }}>×</button></div>
              <span className="mono faint" style={{ fontSize: 12 }}>{i.id} · {FAMNAME[FAM(i.fire_type)]}</span>
            </div>)}
          </div>
          {rows.map(([k, f]) => <div key={k} style={{ display: 'grid', gridTemplateColumns: `200px repeat(${list.length}, minmax(0,1fr))`, gap: '0 28px', borderTop: '1px solid var(--line)', padding: '14px 0', background: same.includes(k) ? 'transparent' : 'transparent' }}>
            <span className="lab" style={{ paddingTop: 2, color: same.includes(k) ? 'var(--faint)' : 'var(--ember)' }}>{k}</span>
            {list.map(i => <span key={i.id} style={{ fontSize: 14, lineHeight: 1.5, color: same.includes(k) ? 'var(--muted)' : 'var(--text)' }}>{f(i)}</span>)}
          </div>)}
        </div></div>
        <p className="src" style={{ marginTop: 16 }}>Orange labels mark rows that differ between the selected investigations.</p>
      </>}
    </main>
    <Footer />
  </>)
}

/* ------------------------------------------------------------------ briefing */
export function Briefing() {
  const { mission } = useMission()
  const tk = takeaways[mission.id]
  const rank = rankings[mission.id].slice(0, 8)
  return (<>
    <Nav active="Briefing" />
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <PageHead eyebrow={`Crew briefing · recomputed for ${mission.name}`} title={`What the evidence says about fire in ${mission.air}.`}>
        <p className="p" style={{ fontSize: 16 }}>{mission.note}</p>
      </PageHead>
      {tk.map((t, i) => (
        <article key={t.key} className="split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: '18px 48px', padding: '32px 0', borderTop: '1px solid var(--line)' }}>
          <div className="row" style={{ alignItems: 'baseline', gap: 20 }}><span className="mono" style={{ color: 'var(--ember)', fontSize: 13 }}>0{i + 1}</span><div className="col" style={{ gap: 10 }}><h2 className="h2" style={{ fontSize: 26 }}>{t.title}</h2><span className="h1" style={{ fontSize: 40, color: 'var(--ember)' }}>{t.number}</span></div></div>
          <div className="col" style={{ gap: 12 }}>
            <p className="p" style={{ fontSize: 16 }}>{t.text}</p>
            <p style={{ margin: 0, fontSize: 15 }}><strong>Action:</strong> {t.action}</p>
            {t.caveat && <p className="faint" style={{ margin: 0, fontSize: 13 }}>{t.caveat}</p>}
            <div className="wrap-row" style={{ alignItems: 'center' }}><Ev kind={BADGE[t.badge] || t.badge} /><span className="src">{t.source}</span></div>
          </div>
        </article>))}
      <section style={{ marginTop: 56 }}>
        <div className="eyebrow">Most relevant investigations for this air</div>
        <div className="card scroll-x" style={{ marginTop: 16 }}><table className="tbl" style={{ minWidth: 800 }}>
          <thead><tr><th>#</th><th>Investigation</th><th>Relevance</th><th>Near this air</th><th>Why</th></tr></thead>
          <tbody>{rank.map(r => <tr key={r.psi_id}><td className="mono faint">{r.rank}</td><td><Link to={'/investigation/' + r.psi_id} style={{ fontWeight: 600 }}>{r.acronym}</Link></td><td className="mono" style={{ color: 'var(--ember)' }}>{Math.round(r.relevance)}</td><td className="mono">{r.n_near_mission} / {r.n_tests}</td><td className="muted" style={{ fontSize: 13 }}>{r.why}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section style={{ marginTop: 56 }}><AtmosphereTable /></section>
    </main>
    <Footer />
  </>)
}

/* ------------------------------------------------------------------ gaps */
export function Gaps() {
  const { mission } = useMission()
  return (<>
    <Nav active="Gaps" />
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <PageHead eyebrow="Where the archive goes quiet" title="NASA has burned almost everything at 21% oxygen. Your mission air is somewhere else." />
      <div className="split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 32 }}>
        <div className="col" style={{ gap: 14 }}>
          <div className="card" style={{ padding: '22px 10px 8px' }}><CoverageMap target={mission} /></div>
          <CoverageLegend />
        </div>
        <div className="col" style={{ gap: 14 }}>
          <Ev kind="gap" />
          {partialGravity.map(([t, d, s, u]) => <div key={t} className="card pad col" style={{ gap: 8 }}><strong style={{ fontSize: 15 }}>{t}</strong><span className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>{d}</span><span className="src">{u ? <a href={u} target="_blank" rel="noreferrer">{s} ↗</a> : s}</span></div>)}
        </div>
      </div>
      <section style={{ marginTop: 56 }} className="col">
        <h2 className="h2" style={{ fontSize: 30, marginBottom: 4 }}>Moon and Mars: what we can say without partial-gravity data</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}><GravityBounds /><BuoyancyPanel /></div>
      </section>
      <section style={{ marginTop: 64 }}>
        <h2 className="h2" style={{ fontSize: 34, marginBottom: 12 }}>Five experiments NASA has not run yet</h2>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>{recommendations.map(r => (
          <li key={r.priority} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0,1fr)', gap: 16, padding: '22px 0', borderTop: '1px solid var(--line)' }}>
            <span className="mono faint">P{r.priority}</span>
            <div className="col" style={{ gap: 8 }}><span style={{ fontSize: 17, fontWeight: 500 }}>{r.experiment}</span><span className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>{r.why}</span><span className="src">Builds on {r.builds_on}</span></div>
          </li>))}</ol>
      </section>
    </main>
    <Footer />
  </>)
}

/* ------------------------------------------------------------------ methods */
export function Methods() {
  const m = methods.metrics
  const models = [
    ['Gas flames', 'How long does a still-air gas flame burn?', `${m.D_gas_flames.n} ISS flames on ${m.D_gas_flames.n_days} ISS days (${m.D_gas_flames.n_censored} still burning at fuel cut)`, 'Leave one ISS day out', `Concordance ${m.D_gas_flames.concordance_leave_one_day_out}`, 'No tests between 24% and 33% O₂'],
    ['Cabin solids', 'Will a solid keep burning?', `${m.A_solids.gradient_boosting.n} rows, ${m.A_solids.gradient_boosting.n_flameout} flame-outs`, '5-fold, whole tests held out', `ROC-AUC ${m.A_solids.gradient_boosting.roc_auc} (material-only baseline ${m.A_solids.baseline_material_only.roc_auc})`, `Only ${m.A_solids.materials_modelled.join(', ')} have enough tests`],
    ['Fuel droplets', 'Droplet burning rate and flame-out size', `${m.C_droplets.burning_rate_mm2_s.n} and ${m.C_droplets.extinction_diameter_mm.n} FLEX droplets`, '5-fold + leave one fuel out', `R² ${m.C_droplets.burning_rate_mm2_s.cv5_r2} and ${m.C_droplets.extinction_diameter_mm.cv5_r2}`, 'CO₂ and helium tests only up to 25% O₂'],
  ]
  const saffire = [['IV-1', 'Cotton-fiberglass', '22% · 0.99 atm', 'Burned', '0.99', 1], ['VI-2', 'Cotton-fiberglass', '31% · 0.53 atm', 'Burned', '0.99', 1], ['VI-3', 'Acrylic 10 mm', '30% · 0.54 atm', 'Burned', '0.91', 1], ['VI-4', 'Acrylic 5 mm', '29% · 0.54 atm', 'Burned', '0.85', 1], ['VI-1', 'Nomex', '~31% · 0.53 atm', 'Did not ignite', '0.03', 1], ['V-2', 'Cotton (only 1 test)', '26% · 0.70 atm', 'Burned', '0.00', 0]]
  const [sev, setSev] = useState('high')
  const iss = methods.issues.filter(i => sev === 'all' || i.severity === sev)
  return (<>
    <Nav active="Methods" />
    <main className="wrap col" style={{ paddingTop: 48, paddingBottom: 60, gap: 64 }}>
      <PageHead eyebrow="Methods · data and model audit" title="How much should you trust each number?">
        <p className="p" style={{ fontSize: 17 }}>Every number on this site is labelled. This page shows where the data came from, how each model was tested on data it never saw, and where it is wrong.</p>
        <div className="wrap-row"><Ev kind="measurement" /><Ev kind="literature" /><Ev kind="prediction" /><Ev kind="physics" /><Ev kind="gap" /></div>
      </PageHead>
      <section className="split" style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 48 }}>
        <div className="col">
          <h2 className="h2" style={{ fontSize: 28, marginBottom: 12 }}>The data</h2>
          {[[methods.ledger.tests.toLocaleString(), 'tests'], [methods.ledger.values.toLocaleString(), 'measured values'], [methods.ledger.corrections, 'corrections and source conflicts logged'], ['0', 'raw files edited']].map(([n, t]) => <div key={t} className="col rule" style={{ padding: '16px 0', gap: 4 }}><span className="h1" style={{ fontSize: 40 }}>{n}</span><span className="muted" style={{ fontSize: 14 }}>{t}</span></div>)}
        </div>
        <div className="col" style={{ gap: 12, minWidth: 0 }}>
          <p className="p" style={{ fontSize: 15 }}>One set of units. Missing stays missing, never zero. Experiments and simulations are never mixed. Where a PSI table and a verified paper disagree, the paper value is used and the PSI value kept alongside. Every logged issue:</p>
          <div className="seg">{[['high', `High (${methods.issue_counts.high})`], ['medium', `Medium (${methods.issue_counts.medium})`], ['low', `Low (${methods.issue_counts.low})`], ['all', 'All']].map(([k, n]) => <button key={k} type="button" className={sev === k ? 'on' : ''} onClick={() => setSev(k)}>{n}</button>)}</div>
          <div className="card scroll-x" style={{ maxHeight: 420, overflowY: 'auto' }}><table className="tbl" style={{ minWidth: 720 }}>
            <thead><tr><th>Where</th><th>Check</th><th>What the source said</th><th>What we did</th></tr></thead>
            <tbody>{iss.map((i, k) => <tr key={k}><td className="mono">{i.investigation_id}</td><td>{i.check}</td><td className="muted">{i.detail}</td><td>{i.action}</td></tr>)}</tbody>
          </table></div>
        </div>
      </section>
      <section className="col" style={{ gap: 16 }}>
        <h2 className="h2" style={{ fontSize: 28 }}>The models, tested on data they never saw</h2>
        <div className="card scroll-x"><table className="tbl" style={{ minWidth: 1000 }}>
          <thead><tr><th>Model</th><th>Question</th><th>Trained on</th><th>Held out</th><th>Score</th><th>Where it stops</th></tr></thead>
          <tbody>{models.map(r => <tr key={r[0]}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td className="muted">{r[2]}</td><td className="mono" style={{ fontSize: 13 }}>{r[3]}</td><td className="mono" style={{ fontSize: 13, color: 'var(--ember)' }}>{r[4]}</td><td className="muted">{r[5]}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section className="split" style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 48 }}>
        <div className="col" style={{ gap: 14 }}>
          <h2 className="h2" style={{ fontSize: 28 }}>The hardest test</h2>
          <p className="p" style={{ fontSize: 15 }}>The Saffire IV–VI burns are the only solid fires near habitat air. They were kept out of training and the solids model was asked to predict them.</p>
          <div className="row" style={{ alignItems: 'baseline' }}><span className="h1" style={{ fontSize: 56 }}>5 of 6</span><span className="muted">correct</span></div>
          <p className="p" style={{ fontSize: 14 }}>The miss is cotton, a material with a single test. That is why cotton, Nomex and silicone are shown as “not modelled” in the Fire Lab.</p>
        </div>
        <div className="card scroll-x"><table className="tbl" style={{ minWidth: 640 }}>
          <thead><tr><th>Burn</th><th>Material</th><th>Air</th><th>What happened</th><th>Model: chance of burning</th><th>Result</th></tr></thead>
          <tbody>{saffire.map(r => <tr key={r[0]}><td className="mono">{r[0]}</td><td>{r[1]}</td><td className="mono">{r[2]}</td><td>{r[3]}</td><td className="mono">{r[4]}</td><td>{r[5] ? <span style={{ color: 'var(--good)' }}>✓ correct</span> : <span style={{ color: 'var(--ember)' }}>✗ missed</span>}</td></tr>)}</tbody>
        </table></div>
      </section>
    </main>
    <Footer />
  </>)
}
