import { useState } from 'react'
import { Link, go } from '../lib/router'
import { Mark } from '../components/ui'
import { methods } from '../lib/data'

const STRIP = [
  ['BASS-II', 'PSI-25', 'Burning solids', 'linear-gradient(90deg,#0b0c0e 0%,#0b0c0e 46%,rgba(255,150,70,.9) 50%,rgba(80,120,255,.55) 53%,#1b2230 58%,#2a2e35 100%)'],
  ['FLEX', 'PSI-69', 'Fuel droplets', 'radial-gradient(circle at 50% 52%,#fff 0%,#dcebff 4%,#8fb8ff 9%,rgba(63,111,240,.55) 16%,#050607 34%)'],
  ['ACME CFI-G', 'PSI-159', 'Gas flames', 'radial-gradient(circle at 50% 52%,#fff 0%,#dcebff 7%,#8fb8ff 15%,rgba(63,111,240,.6) 26%,rgba(255,150,70,.18) 34%,#050607 52%)'],
  ['Saffire-I', 'PSI-98', 'Spacecraft-scale fire', 'linear-gradient(100deg,#0b0c0e 0%,#0b0c0e 30%,rgba(255,150,70,.85) 36%,rgba(80,120,255,.5) 40%,#1b2230 50%,#2a2e35 100%)'],
  ['SAME-R', 'PSI-101', 'Smoke', 'radial-gradient(ellipse at 40% 55%,rgba(200,204,210,.35) 0%,rgba(200,204,210,.12) 30%,#050607 62%)'],
  ['SPICE', 'PSI-107', 'Soot', 'radial-gradient(ellipse at 50% 80%,#fff 0%,#dcebff 4%,rgba(255,170,80,.7) 12%,rgba(63,111,240,.3) 24%,#050607 45%)'],
]
export { STRIP }

export default function Landing() {
  const [q, setQ] = useState('')
  return (
    <section style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div aria-hidden="true" className="breathe" style={{ position: 'absolute', left: '50%', top: 330, marginLeft: -550, marginTop: -550, width: 1100, height: 1100, borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,.9) 0%, rgba(220,235,255,.75) 6%, rgba(143,184,255,.55) 14%, rgba(63,111,240,.35) 25%, rgba(46,72,190,.16) 36%, rgba(0,0,0,0) 52%)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,11,13,0) 40%, rgba(10,11,13,.92) 66%, #0A0B0D 78%)' }} />
      <header style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 1344, margin: '0 auto', padding: '24px 32px', display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" className="row" style={{ gap: 10 }}><Mark /><span className="disp" style={{ fontWeight: 600, fontSize: 17 }}>Flame in Freefall</span></Link>
          <nav aria-label="Main" className="wrap-row" style={{ gap: 26, fontSize: 14 }}>
            {[['Learn', '/learn/1'], ['Fire Lab', '/lab'], ['Investigations', '/explore'], ['Briefing', '/briefing'], ['Methods', '/methods']].map(([n, to]) => <Link key={n} to={to} style={{ color: '#C9CDD3' }}>{n}</Link>)}
          </nav>
        </div>
      </header>
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center', padding: '110px 24px 0' }}>
        <div className="eyebrow" style={{ color: '#C9CDD3' }}>NASA microgravity combustion archive · ISS and Cygnus</div>
        <h1 className="h1" style={{ fontSize: 'clamp(48px, 8vw, 96px)', lineHeight: .95, maxWidth: 1000 }}>Twenty-four fires NASA lit in orbit.</h1>
        <p style={{ margin: 0, fontSize: 18, color: '#C9CDD3', maxWidth: 620, lineHeight: 1.5 }}>Why fires start on a spacecraft, how they behave without gravity, and what {methods.ledger.tests.toLocaleString()} NASA tests say about the Moon bases and rovers we are about to build.</p>
        <div className="wrap-row" style={{ gap: 12, justifyContent: 'center', marginTop: 8 }}>
          <Link to="/learn/1" className="btn primary" style={{ fontSize: 16, padding: '16px 26px' }}>▶ Start learning · 5 steps</Link>
          <Link to="/explore" className="btn" style={{ fontSize: 16, padding: '16px 26px', background: 'rgba(10,11,13,.6)' }}>Go straight to the archive</Link>
        </div>
        <form onSubmit={e => { e.preventDefault(); try { sessionStorage.setItem('fif-q', q) } catch {} ; go('/explore') }} style={{ display: 'flex', width: 560, maxWidth: '100%', border: '1px solid var(--line2)', borderRadius: 8, background: 'rgba(17,19,23,.85)', overflow: 'hidden' }}>
          <label htmlFor="sb" className="sr">Search the archive</label>
          <input id="sb" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Or search a fuel, a material, an investigation…" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, color: 'var(--text)', fontSize: 14, padding: '13px 16px' }} />
          <button type="submit" className="btn sm" style={{ border: 0, borderLeft: '1px solid var(--line2)', borderRadius: 0 }}>Search</button>
        </form>
      </div>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1344, width: '100%', margin: 'auto auto 0', padding: '64px 32px 48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 20 }}>
        {STRIP.map(([a, id, f, g]) => (
          <Link key={id} to={'/investigation/' + id} className="col" style={{ gap: 10, minWidth: 0 }}>
            <div style={{ height: 120, borderRadius: 6, border: '1px solid var(--line)', background: g }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>{a}</span>
            <span className="mono faint" style={{ fontSize: 11 }}>{id} · {f}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
