# Architecture: how the website uses the research

One product, one process: `server/main.py` (FastAPI) loads the dataset and the three trained models at
start-up (about 1.5 s, about 270 MB of memory), serves the API under `/api/*`, and serves the built website
(`web/dist`) at `/`. The website also ships a precomputed copy of the same data and model grids
(`web/src/data/*.json`, written by `scripts/export_web.py`), so it still works, and says so, if the API is
unreachable. `tests/test_api.py` checks that the live API and the exported grids give the same numbers.

```
                ┌──────────────────────── one container (Dockerfile) ───────────────────────┐
 browser ──►    │  FastAPI  server/main.py                                                  │
  React site    │   /            → web/dist (built React site)                              │
  (web/)        │   /api/stats, /api/investigations, /api/ranking, /api/compare             │
                │        └─ src/fif/knowledge.py · ranking.py · webdata.py                  │
                │             └─ data/processed/*.csv · catalog/ · data/raw/*/pages          │
                │   /api/predict/gas      → models/v1/D_gas_flames.joblib  (Weibull AFT)    │
                │   /api/predict/solid    → models/v1/A_solids.joblib      (gradient boost.)│
                │   /api/predict/droplet  → models/v1/C_droplets.joblib    (Gaussian proc.) │
                │   /api/search           → TF-IDF over the NASA passage corpus             │
                │   /api/ask              → search + Gemini RAG over RAG/database (optional) │
                └───────────────────────────────────────────────────────────────────────────┘
```

## Integration map: website feature → service → data / model → output

| Website feature | Backend | Dataset / model | Output |
|---|---|---|---|
| Home: test, value and investigation counts | `/api/stats` (site uses the same numbers from `methods.json`) | `data/processed/tests.csv`, `evidence.csv` | 1,517 tests, 10,107 measured values, 24 investigations, 14 sources |
| Learn 1–4 (cabin hazards, smoke race, fire triangle, fire response) | none: illustrations | NASA sources cited on each step | Teaching animations, labelled "illustration, not to scale" |
| Learn 2: plume sandbox | runs in the browser | buoyancy physics (`u_b = √(g·ΔT/T·L)`, Ri) | Physics estimate, labelled as such |
| Fire Lab · Gas leak | `POST /api/predict/gas` | Model D, trained on ACME CFI-G (PSI-159), 132 flames | Median burn time, chance still burning at 10/30/60 s, sweep over O₂, "no NASA tests in 24–33 % O₂" flag |
| Fire Lab · Cabin material | `POST /api/predict/solid` | Model A, trained on BASS, BASS-II, Saffire (212 tests) | Chance the material keeps burning, 10–90 % bootstrap band, inside/outside tested range; "not modelled" for materials with < 12 rows |
| Fire Lab · Spilled fuel | `POST /api/predict/droplet` | Model C, trained on FLEX / PSI-69 (265 droplets) | Burning rate ± sd, flame-out diameter ± sd, burn time by the d²-law |
| Investigations (explorer) | `GET /api/investigations?q=` (full-record search), `GET /api/ranking` | knowledge layer + ranking module | Ranked records for the chosen mission air; empty state when nothing matches |
| Investigation page | `GET /api/investigations/{id}` (site uses the identical export) | catalog, PSI pages, tests | Objective, hardware, sample, instruments, what varied, key result, DOI / PSI link |
| Compare | `GET /api/compare?ids=` | `knowledge.compare_summary` over the test records | Shared hardware and conditions vs differences, i.e. whether results are directly comparable; "—" marks data the archive lacks |
| Briefing, Gaps, Methods | exported with the site | takeaways, gap map, recommendations, `metrics.json`, QA issues | Mission briefing, test coverage, model scorecard |
| Ask the archive (chat) | `POST /api/ask`, `GET /api/search` | 4,086-passage RAG database + TF-IDF corpus | Cited NASA passages always; a Gemini answer, labelled "AI interpretation", only when `GOOGLE_API_KEY` is set |

## Models

| Model | Purpose | Inputs | Output | Held-out score | Live endpoint |
|---|---|---|---|---|---|
| A · solids | Will a solid keep burning? | material, O₂, pressure, air speed | probability + band | ROC-AUC 0.958 | `/api/predict/solid` |
| D · gas flames | How long does a still-air gas flame burn? | fuel, O₂, pressure | survival curve | concordance 0.753 (leave-one-day-out) | `/api/predict/gas` |
| C · droplets | Droplet burning rate and flame-out size | fuel, O₂, pressure, CO₂, He, diameter | mean ± sd | R² 0.696 / 0.901 (5-fold) | `/api/predict/droplet` |
| B · solids spread | Flame-spread rate over thin fabric | (10 rows) | none | none | **Not a model**: the table is descriptive only, too small to train on |

Scores come from `models/v1/metrics.json`; nothing was retrained for the website. Every model response carries
`"kind": "prediction"`, and the site labels it "Model prediction", never as a measurement.

## Known limits

- **No NASA flame photographs or videos are in the repository**, so the site draws flames (labelled
  illustrative). PSI holds imagery for several investigations; adding it needs download and licence checks.
- **AI-written answers need a Google API key.** Without it the assistant returns cited passages only.
- **No PSI test ran at lunar or Martian gravity**, so Moon and Mars answers are nearest-evidence estimates.
