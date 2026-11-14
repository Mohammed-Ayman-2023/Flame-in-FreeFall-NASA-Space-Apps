# Flame in Freefall · website

A static React site (Vite) that teaches why fires start on spacecraft, how they behave in microgravity,
how NASA prevents and fights them, and lets anyone play with the project's models. It reads only the JSON
files exported from this repository, so every number traces back to the dataset and models.

## Pages
| Route | What it is |
|---|---|
| `#` | Landing: the archive hero, start learning or go to the archive |
| `#learn-1` | Why fires start: combustion experiments vs malfunctions (tap the hardware) |
| `#learn-2` | How fire behaves: smoke-and-detector particle simulation + 2D hot-gas plume sandbox |
| `#learn-3` | Prevention: the fire triangle |
| `#learn-4` | Second line of defense: detect, cut power and air, masks, extinguish, clean up |
| `#lab` | Fire Lab: gas leak, cabin material and spilled fuel, on models A, C and D |
| `#explore`, `#investigation--PSI-159`, `#compare` | The archive: 24 investigations ranked for the chosen air |
| `#briefing`, `#gaps`, `#methods` | Crew briefing, gap map and recommendations, data and model audit |

The chat ("Ask the archive") searches the same cited corpus as the dashboard. If `VITE_ASK_URL` points at
`web/ask_server.py`, it also shows the team's Gemini RAG answer.

## Build
```bash
python scripts/export_web.py      # data + model grids -> web/src/data/*.json
cd web && npm install && npm run build   # -> web/dist (open dist/index.html or host the folder)
npm run dev                        # local development
```
Simulations are labelled: the particle and plume views are physics estimates, not CFD and not NASA imagery.
