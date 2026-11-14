import { createContext, useContext, useState } from 'react'

/* Audience views. The challenge names five audiences; each gets a guided path through the same pages and data
   (nothing is hidden or changed per view, only the order, the starting point and the framing). */
export const AUDIENCES = [
  { id: 'undergrad', label: 'Undergraduate students', short: 'Undergraduate', verb: 'Learn the physics of fire without gravity',
    path: [['Learn', '/learn/1', 'Five short steps: why fires start, how they behave without gravity'], ['Fire Lab', '/lab', 'Change the air and watch three models answer'], ['Findings', '/findings', 'What the NASA data already show'], ['Ask', '/ask', 'Ask the archive in plain English']] },
  { id: 'grad', label: 'Graduate students', short: 'Graduate', verb: 'Find a research question and the data to answer it',
    path: [['Gaps', '/gaps', 'What has never been tested, and five experiments NASA has not run'], ['Methods', '/methods', 'Data audit, model validation, downloads'], ['Ranking', '/ranking', 'Which investigations matter for your conditions'], ['Investigations', '/explore', 'Every investigation, its hardware and variables']] },
  { id: 'professor', label: 'Professors', short: 'Professor', verb: 'Teach microgravity combustion with real NASA data',
    path: [['Learn', '/learn/1', 'A ready lecture sequence in five steps'], ['Fire Lab', '/lab', 'Live in-class demonstrations'], ['Findings', '/findings', 'Figures with sources for slides'], ['Methods', '/methods', 'How the data were checked and the models validated']] },
  { id: 'researcher', label: 'Aerospace researchers', short: 'Researcher', verb: 'Rank, compare and query the PSI combustion archive',
    path: [['Ranking', '/ranking', 'Transparent relevance with adjustable weights'], ['Investigations', '/explore', 'Hardware, samples, instruments, variables'], ['Compare', '/compare', 'Up to three investigations side by side'], ['Ask', '/ask', 'Cited search and the Gemini RAG over NASA reports'], ['Gaps', '/gaps', 'Coverage and partial-gravity evidence']] },
  { id: 'engineer', label: 'Aerospace engineers', short: 'Engineer', verb: 'Design habitat fire safety for the air your crew will breathe',
    path: [['Briefing', '/briefing', 'Six takeaways for your mission air, downloadable'], ['Fire Lab', '/lab', 'Predictions with uncertainty and tested-range labels'], ['Equipment', '/equipment', 'Detectors, extinguishers, ventilation, materials, layout'], ['Findings', '/findings', 'Headline numbers for your air']] },
]
export const AUD_BY = Object.fromEntries(AUDIENCES.map(a => [a.id, a]))

const Ctx = createContext({ view: null, setView: () => {} })
export function AudienceProvider({ children }) {
  const [id, setId] = useState(() => { try { return localStorage.getItem('fif-view') || '' } catch { return '' } })
  const setView = v => { setId(v || ''); try { v ? localStorage.setItem('fif-view', v) : localStorage.removeItem('fif-view') } catch { /* private mode */ } }
  return <Ctx.Provider value={{ view: AUD_BY[id] || null, setView }}>{children}</Ctx.Provider>
}
export const useAudience = () => useContext(Ctx)
