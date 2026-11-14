import { useRoute } from './lib/router'
import { MissionProvider } from './lib/mission'
import Chat from './components/Chat'
import Landing from './pages/Landing'
import { Learn1, Learn2, Learn3, Learn4 } from './pages/Learn'
import FireLab from './pages/FireLab'
import { Equipment } from './pages/Evidence'
import { Explore, Investigation, Compare, Briefing, Gaps, Methods } from './pages/Archive'

function Page({ route }) {
  const path = route.split('?')[0]
  if (path === '/' || path === '') return <Landing />
  if (path === '/learn/1') return <Learn1 />
  if (path === '/learn/2') return <Learn2 />
  if (path === '/learn/3') return <Learn3 />
  if (path === '/learn/4') return <Learn4 />
  if (path === '/lab') return <FireLab />
  if (path === '/explore') return <Explore />
  if (path.startsWith('/investigation/')) return <Investigation id={decodeURIComponent(path.slice(15))} />
  if (path === '/compare') return <Compare />
  if (path === '/briefing') return <Briefing />
  if (path === '/gaps') return <Gaps />
  if (path === '/equipment') return <Equipment />
  if (path === '/methods') return <Methods />
  return <Landing />
}

export default function App() {
  const route = useRoute()
  return (
    <MissionProvider>
      <Page key={route.split('?')[0]} route={route} />
      <Chat />
    </MissionProvider>
  )
}
