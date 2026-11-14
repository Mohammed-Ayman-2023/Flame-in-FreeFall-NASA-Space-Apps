# 🔥 Flame in Freefall

### Ranking NASA's microgravity fire experiments for the habitats humans will actually live in

**NASA Space Apps Challenge 2026 · Built by [Mohammed Ayman](https://github.com/Mohammed-Ayman-2023)**

---

Future crewed habitats are expected to run at about **30 % oxygen and 0.69 atm**, an atmosphere with Earth-like
oxygen *pressure* but a much richer oxygen *fraction*. Fire behaves differently there, and differently again in
microgravity, where there is no buoyancy to carry hot gas away or bring fresh air in.

NASA has flown dozens of combustion experiments on the ISS and Cygnus. Their data sit in the
[Physical Sciences Informatics (PSI)](https://psi.ndc.nasa.gov/) system, in different formats, units and levels of
detail. **Flame in Freefall** answers three questions from that archive:

1. **Which investigations matter most for a 30 % O2 / 0.69 atm habitat?** A transparent relevance ranking.
2. **What do they predict?** Models trained on the measurements, with uncertainty and an "outside the tested range" warning.
3. **What has never been tested?** A gap map that turns missing conditions into research recommendations.

## What the data already show

| Finding | Evidence |
|---|---|
| **Cutting ventilation may not put out a fire in an oxygen-rich habitat.** In still microgravity air, flames at ≤ 25 % O2 went out on their own within seconds; at 33-40 % O2 they kept burning, often until the fuel was shut off. | ACME CFI-G (PSI-159): all 41 flames at ≤ 25 % O2 self-extinguished (median 8 s); at 33-40 % O2 median 50 s, 30 of 91 still burning when fuel was cut, including at 0.5 atm. ACME BRE (PSI-20) reports the same for emulated solids. |
| **Common cabin materials burn at habitat-like conditions; Nomex did not ignite.** | Saffire IV-VI: cotton-fiberglass fabric, cotton and PMMA all burned at 26-31 % O2 and 0.53-0.70 atm. |
| **Burning plastics are an air-quality hazard, not just a fire hazard.** | Saffire VI: PMMA raised cabin CO2 by ~8,100-8,500 ppm and CO by ~310-320 ppm, several times more than fabrics. |
| **Enclosure size changes how fast fire spreads.** | The same fabric spread at 1.8-5.1 mm/s depending only on the size of the duct around it. |
| **Thick plastic is the worst air polluter among cabin materials.** | BASS-II (129 ISS burns with O₂, CO₂ and CO measured): thick PMMA slabs raised CO by a median 335 ppm per burn, clear PMMA rods 135 ppm, cotton-fiberglass fabric 20 ppm; Nomex produced none. |
| **Smoke detection has never been tested at habitat conditions.** | SAME, SAME-R and SPICE: 86 smoke tests and 469 soot-point settings, all in 21 % O2 at 1 atm. |

The biggest gap: **no PSI solid-fuel burn above 22 % O2.** The only solid burns near habitat conditions come from
the Saffire IV-VI flights, published in the NASA literature rather than in PSI. And **no PSI combustion test has run
at lunar (0.16 g) or Martian (0.38 g) gravity**, so every Moon and Mars answer here is the nearest evidence, not a
measurement.

## The dashboard

Pick a mission atmosphere in the sidebar (presets: the challenge habitat 30 % O2 / 0.69 atm, ISS cabin air, and
NASA's proposed exploration atmospheres 26.5 % / 10.2 psia and lunar 34 % / 8.2 psia, or set any O2 and pressure).
Every tab recomputes for it.

| Tab | What it gives |
|---|---|
| **Crew briefing** | Why habitats use oxygen-rich air (spacesuit vs Earth vs Moon base) and six plain-language takeaways (ventilation, materials, toxic gases, spilled fuel, tight spaces, smoke detection), each with a number, an action, its source and an evidence label. **Download** the whole briefing as a one-page HTML file. |
| **Key findings** | The headline results with their charts, including a ranking of cabin materials by the carbon monoxide they produced in 129 BASS-II ISS burns (measured O₂, CO₂ and CO per test, downloadable with sheet and row). |
| **Ranking** | Transparent relevance score for every investigation, with adjustable weights and a reason per row. |
| **Investigations** | For each of the 24 investigations: objective, key result, hardware, sample or burner shape and size, instruments, **what changed between its tests and what stayed the same** (computed from the data), and context from the challenge brief. Side-by-side comparison of up to three with a similar / different summary, and the shared-hardware groups (ACME in the CIR, droplets in the MDCA, the glovebox flow duct, SAME smoke hardware, Saffire on Cygnus). |
| **Ask the archive** | Two modes. **Cited search** (always on, offline): answers only from the project's NASA sources, with citations and links, and says so when the archive has no answer; retrieval only (TF-IDF), no text generation. **AI answer (Gemini, optional)**: the team's RAG module retrieves 10 of 4,086 passages from NASA PSI reports and NASA pages, and Gemini writes an answer only from them, citing them and saying "insufficient data" otherwise; the passages it read are shown. Needs a `GOOGLE_API_KEY` Streamlit secret. |
| **Predict a fire** | Everything updates live as you change oxygen, pressure, fire type, material, fuel, air speed or droplet size. A **flame simulator** animates the fire side by side with ISS cabin air: droplets shrink by the d²-law and go out at the model's flame-out size, gas flames go out at the model's median time, solids keep spreading or die out according to the solids model; flame shape follows buoyancy physics for orbit, Moon, Mars or Earth gravity (colours and glow illustrative). A **flammability map** for solids (oxygen × air speed, NASA's kept-burning and went-out tests over the model's 50 % boundary, extrapolation shaded); a **d²-law burn-out timeline** for droplets, checked against 188 measured FLEX burn times (R² 0.975). The three models with uncertainty bands, an "inside / outside the tested range" label, global "how this model decides" explanations and a local **"Why this number?"** view: exact Shapley values (what SHAP estimates, computed exactly over every combination of inputs, no sampling) showing each input's share of this prediction, against the average NASA test and against Earth cabin air. For the gas-flame model the shares are exact burn-time multipliers. |
| **Gaps & next tests** | Tests near the mission atmosphere per fire type; Moon and Mars gravity: what PSI lacks, LUCI and FM2, E-FIELD Flames, a physics panel (buoyant flow and Richardson number at Earth, Mars and Moon gravity against fan air speed, clearly labelled as an estimate), and a 0 g vs 1 g bound from the Saffire burns (silicone burned on Earth but not in microgravity); five recommended experiments. |
| **Equipment & Earth** | Which research informs next-generation controls and equipment (detectors, extinguishers, ventilation procedures, material screening, air quality, layout), with numbers computed from the data; fire safety on Earth (fine-water-mist extinguishers, smoke detection, firefighter air tanks and clothing) from NASA Spinoff and NTRS; each NASA page's Earth-benefits text; scope note on rockets. |
| **Data & sources** | Downloads of every table and the source list. |

Every number carries an evidence label: **NASA measurement**, **Model prediction**, **NASA literature** or
**Data gap**, shown as text, not colour alone.

## Physics-informed by design

- **Solids model:** constrained so more oxygen or pressure can never lower the chance of burning; air speed enters on a
  log scale with a squared term so quenching (too little air) and blow-off (too much air) can be learned.
- **Gas-flame model:** a censored survival model, so flames still burning when the fuel was cut count as "at least
  this long".
- **Droplets:** burn-out time from the d²-law, which reproduces 188 measured FLEX burn times with R² = 0.975.
- **Physics estimates, kept separate and labelled:** buoyant flow and Richardson number at Earth, Mars and Moon
  gravity; time for smoke to reach a detector at 0 g, Moon, Mars and Earth.
- **Applicability:** every prediction is labelled inside or outside the conditions NASA tested.

## The dataset

**Dataset v1** (frozen 2026-11-13): **1,517 tests, 10,107 measured values, 14 sources, 103 logged corrections and source conflicts.**
Every value traces back to its source file and line; raw files are never edited.

| Fire type | Investigations |
|---|---|
| Burning solids | BASS (PSI-26), BASS-II (PSI-25), Saffire I-III (PSI-98, 99, 100), Saffire IV-VI (NASA literature) |
| Fuel droplets | FLEX (PSI-69), CFI (PSI-39), cool-flame data (PSI-117) |
| Gas flames | ACME BRE (PSI-20), ACME CFI-G (PSI-159), SPICE (PSI-107) |
| Smoke and detection | SAME (PSI-102), SAME-R (PSI-101) |
| Catalogued for ranking | FLEX-2 (68), SLICE (106), PSI-62, 142, 115, 60, 10, 21, 22, 23 |

Four machine-learning tables are built from it:

| Table | Question | Ready rows |
|---|---|---|
| **A** solids flammability | Does a solid keep burning at this O2, pressure and air speed? | 414 |
| **B** solids spread | How fast does flame spread over a thin fabric? | 10 (descriptive) |
| **C** droplets | How fast does a fuel droplet burn, and at what size does its flame go out? | 299 |
| **D** gas flames | Does a still-air gas flame ignite, and how long does it burn? | 172 |

Details, per-source condition ranges and known limits: [`ml/v1/DATASET_v1.md`](ml/v1/DATASET_v1.md) ·
column definitions and modelling rules: [`ml/SPEC.md`](ml/SPEC.md).

## Project status

| Component | Status |
|---|---|
| Data layer and dataset v1 | ✅ Done |
| ML tables A-D | ✅ Done |
| Predictive models (solids, gas flames, droplets) | ✅ Done: [`models/v1/MODELS.md`](models/v1/MODELS.md) |
| Relevance ranking and gap map | ✅ Done: `reports/ranking/` (`python scripts/build_ranking.py`) |
| Interactive dashboard (Streamlit) | ✅ Done: `streamlit run app/streamlit_app.py` |
| Crew briefing, mission presets, Ask the archive, explorer | ✅ Done: `src/fif/knowledge.py` |
| RAG assistant (Gemini over NASA reports) | ✅ Done: `RAG/` (team module), wired into the dashboard by `src/fif/genai.py` |
| Website (React) + API (FastAPI) running the models live | ✅ Done: `web/` and `server/`; how they connect: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| One-container deployment | ✅ Ready: `Dockerfile`, `render.yaml`; steps in [`DEPLOY.md`](DEPLOY.md) |

## Quick start

```bash
git clone https://github.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps.git
cd Flame-in-FreeFall-NASA-Space-Apps
python -m venv .venv
.venv/bin/pip install -r requirements.txt     # Windows: .venv\Scripts\pip install -r requirements.txt
python scripts/build_data.py                   # rebuild data/processed/ from the raw files
python scripts/build_ml.py                     # rebuild the ML tables in ml/v1/
python scripts/train_models.py                 # train the models into models/v1/
python scripts/build_ranking.py                # habitat ranking, gap map, recommendations -> reports/ranking/
pytest -q                                      # 46 checks: data layer, models, knowledge layer, website API
streamlit run app/streamlit_app.py             # open the dashboard
```

### The website and its API

```bash
pip install -r server/requirements.txt
cd web && npm ci && npm run build && cd ..      # builds the site into web/dist
uvicorn server.main:app --port 8000             # site at http://localhost:8000, API docs at /api/docs
```

For front-end work run `uvicorn server.main:app --port 8000` and, in `web/`, `npm run dev` (it forwards `/api`
to port 8000). Copy `.env.example` to `.env` to add an optional `GOOGLE_API_KEY` for Gemini answers. With no
API running, the site falls back to the model grids exported by `python scripts/export_web.py` and says so.
Deployment: [`DEPLOY.md`](DEPLOY.md).

## Repository layout

```
catalog/investigations.csv   every investigation: fuels, O2 / pressure / flow ranges, priority, status
data/raw/<id>/               source files exactly as downloaded or transcribed, with a README
data/processed/              tests.csv, evidence.csv (one row per value), issues.csv (every correction)
ml/v1/                       ML tables A-D and the dataset summary
ml/SPEC.md                   ML column definitions, rules and limits
models/v1/                   trained models, validation scores, habitat predictions (MODELS.md)
qa/                          label spot-check against the original crew notes
reports/                     load status per investigation, habitat ranking and gap map, PSI-117 findings
app/                         Streamlit dashboard (crew briefing, findings, ranking, explorer, Ask, predictions, gaps, sources)
web/                         the website (React + Vite): lessons, live simulations, Fire Lab, archive, compare, chat
server/                      FastAPI service: live models, records, ranking, compare, cited Ask; serves web/dist
docs/ARCHITECTURE.md         website feature → API → dataset / model map, and known limits
Dockerfile, render.yaml      one-container deployment (DEPLOY.md)
src/fif/                     shared schema, loaders (one per investigation), build, ML tables, models, ranking,
                             knowledge layer (mission presets, takeaways, investigation summaries, Ask, briefing)
tests/                       automated data checks
```

## How the data are handled

- **One set of units:** pressure in atm, oxygen as a mole fraction, air speed in cm/s, sizes in mm.
- **Nothing silently changed:** every correction (unit slips, swapped columns, typos, merged cells) is made in
  code and logged in `data/processed/issues.csv`.
- **Missing means missing:** gaps stay blank, never zero and never an average.
- **Checked against the source:** transcribed tables were verified against the published PDFs; where a PSI table
  and a verified paper disagree, the paper value is used and the PSI value is kept alongside.
- **Experiments and simulations are never mixed**, and external literature rows are labelled as such.

## Sources and references

| Source | What we used | Licence / access |
|---|---|---|
| NASA Physical Sciences Informatics (PSI): BASS (PSI-26), BASS-II (PSI-25), Saffire I-III (PSI-98, 99, 100), FLEX (PSI-69), CFI (PSI-39), PSI-117, ACME BRE (PSI-20), ACME CFI-G (PSI-159), SPICE (PSI-107), SAME (PSI-102), SAME-R (PSI-101), plus catalog entries for PSI-68, 106, 62, 142, 115, 60, 10, 21, 22, 23 | Test matrices, analysed data, investigation pages | CC0-1.0; DOI of each investigation in `catalog/investigations.csv` and on every data row |
| Urban et al., *Preliminary Results from the Saffire VI Experiment*, ICES-2024-365, NASA NTRS 20240002981 | Tables 1-2 (Saffire IV-VI conditions and results) | NASA Technical Reports Server, public |
| Urban et al., *Fire Safety Implications of Preliminary Results from Saffire IV and V*, ICES-2021-266, NASA NTRS 20210011521 | Background on Saffire IV-V | NASA Technical Reports Server, public |
| NASA NTRS 20180005168 (Saffire I-III results) | Table 1 (burn lengths, spread rates, conditions, and the 1 g companion burns used to bound partial gravity) | NASA Technical Reports Server, public |
| Olson et al., *The effect of duct size, sample size, and fuel composition on concurrent flame spread over large cellulose samples in microgravity* (accepted manuscript, UCL Discovery eprint 10164340) | Table 1 (spread rates, cabin pressures) | Open-access repository; values cited, not redistributed text |
| Ferkul et al. (2013), BASS fabric flammability paper | Table I (flow direction and speeds for BASS fabric tests); description of the SPICE flow duct and BASS instruments | Cited; values only |
| BASS-II data FAQ and science requirements document (PSI-25 science documents) | BASS-II instruments (video, still camera, radiometer, O₂, CO₂ and CO sensors) | NASA PSI, CC0-1.0 |
| NASA Space Apps 2026 challenge brief, *Flame in Freefall* | Shared-hardware groups, spacesuit and Moon-base atmospheres, CFI-G inverse flames, DAFT link, E-FIELD Flames | Challenge resource |
| Ferkul et al., *Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket*, NASA NTRS [20250010653](https://ntrs.nasa.gov/citations/20250010653) | LUCI description and result | NASA Technical Reports Server, public |
| NASA, [Flammability of Materials on the Moon (FM2)](https://www.nasa.gov/flammability-of-materials-on-the-moon-fm2/); Zayac et al., NASA NTRS [20240015307](https://ntrs.nasa.gov/citations/20240015307) | FM2 description; lunar-gravity flammability finding | NASA, public |
| NASA Spinoff: [fine-water-mist extinguisher valve](https://spinoff.nasa.gov/node/11065), [composite air tanks](https://spinoff.nasa.gov/node/11031), [PBI protective fabric](https://spinoff.nasa.gov/node/10564); NTRS 20130011664 (ISS fine-water-mist extinguisher), 20010074094 (spacecraft smoke detection), 20170000248 (detector sensitivity), 20090002489 (PBI) | Equipment & Earth tab | NASA, public |
| NASA Glenn, [Combustion Science](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/) | DAFT used SAME's modified P-Trak | NASA, public |
| Python: pandas, NumPy, SciPy, Matplotlib, openpyxl, pytest, Jupyter | Software | Open source (BSD / PSF / MIT) |

## AI usage declaration

This project used **Claude (Anthropic)**, an AI assistant, as a development aid. In line with the NASA Space Apps
rules, AI involvement is declared here and in commit metadata (`Co-Authored-By` trailers):

- **Code:** the data loaders, build pipeline, ML-table builder and tests were written with AI assistance and
  reviewed and run by the author.
- **Data:** values from images and PDFs (Saffire and BASS paper tables) were transcribed with AI assistance and
  verified by the author against the original tables; flame-out labels were spot-checked against the original
  crew notes (`qa/`).
- **Documentation:** this README and the files in `ml/` were drafted with AI assistance.
- **In the product:** the optional AI answer in *Ask the archive* uses **Google Gemini** (`gemini-3.1-flash-lite`, with
  `gemini-embedding-2` embeddings) through the team's RAG module in `RAG/`. It answers only from retrieved NASA
  passages, shows them, and is labelled "AI-generated (Gemini)" in the dashboard. The default cited search, the
  crew briefing, the models and every number in the dashboard do not use generative AI.
- No AI-generated images are used. No NASA logos, flags or mission insignia are used or modified.

All scientific data come from NASA and the cited publications; nothing in the dataset is AI-generated.

## Licence

Original code and documentation: [Apache License 2.0](LICENSE). NASA data remain CC0-1.0 under their original terms.

## Author

**Mohammed Ayman** · [GitHub](https://github.com/Mohammed-Ayman-2023)

Project lead: data collection, validation, dataset design, modelling and analysis (with AI assistance, see above).

RAG assistant (`RAG/`): Omar, team member.

### Running the AI answer locally or on Streamlit Cloud

Add a Google AI Studio key as `GOOGLE_API_KEY`: in a local `.env` file or environment variable, or in Streamlit
Cloud under *App settings → Secrets* as `GOOGLE_API_KEY = "..."`. Both `.env` and `.streamlit/secrets.toml` are in
`.gitignore`. Without a key the dashboard runs normally and the AI answer says it is switched off.

Developed for the NASA Space Apps Challenge 2026.
