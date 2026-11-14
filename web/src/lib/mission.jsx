import { createContext, useContext, useState } from 'react'
import { missions } from './data'

const Ctx = createContext(null)
export function MissionProvider({ children }) {
  const [id, setId] = useState(() => { try { return localStorage.getItem('fif-mission') || 'habitat' } catch { return 'habitat' } })
  const set = v => { setId(v); try { localStorage.setItem('fif-mission', v) } catch {} }
  const mission = missions.find(m => m.id === id) || missions[0]
  return <Ctx.Provider value={{ mission, setMission: set }}>{children}</Ctx.Provider>
}
export const useMission = () => useContext(Ctx)
