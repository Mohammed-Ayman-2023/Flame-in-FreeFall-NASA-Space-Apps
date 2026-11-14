# 🔥 Flame in Freefall

### An evidence-labelled guide to NASA's microgravity fire experiments, for the habitats humans will actually live in

**NASA Space Apps Challenge 2026 · Challenge: *Flame in Freefall***
Team from **Zewail City of Science and Technology** and **Cairo University** ([team](#team))

| | |
|---|---|
| 🌐 **Website** (React, runs in any browser) | <https://mohammed-ayman-2023.github.io/Flame-in-FreeFall-NASA-Space-Apps/> |
| 📊 **Analyst dashboard** (Streamlit) | `streamlit run app/streamlit_app.py` ([deploy notes](DEPLOY.md)) |
| ⚙️ **Live API + website in one container** | `Dockerfile` ([DEPLOY.md](DEPLOY.md): Hugging Face Spaces or Render) |
| 📄 **Submission summary** | [`SUBMISSION.md`](SUBMISSION.md) |

---

## The idea

Moon bases and pressurised rovers are expected to breathe **about 30 % oxygen at 0.69 atm** (10.2 psi): the same
oxygen *pressure* as Earth air, so crews breathe normally, but a much richer oxygen *fraction*, so materials burn
more readily. On the ISS there is also no buoyancy: hot gas does not rise, fresh air only arrives if a fan brings it,
and flames become slow, round and hard to see.

NASA has burned solids, liquid droplets and gas jets on the ISS and on Cygnus cargo ships for two decades. The
results sit in NASA's [Physical Sciences Informatics (PSI)](https://psi.ndc.nasa.gov/) archive, spread over dozens
of investigations in different formats, units and levels of detail. A crew-safety engineer, a student or a researcher
cannot easily answer: *which of these results apply to my habitat, what do they predict, and what has never been tested?*

**Flame in Freefall** turns that archive into one evidence-labelled tool that:

1. **Ranks** every investigation by how relevant it is to a chosen mission atmosphere, with the reason shown.
2. **Summarises and interprets** each investigation: what was burned, how, with which hardware and instruments,
   what changed between tests, and its key result.
3. **Predicts** with models trained on NASA measurements, each with an uncertainty band, an "inside / outside the
   tested range" label and an explanation of why it gave that number.
4. **Simulates** the physics (flame shape under orbit, Moon, Mars and Earth gravity; buoyancy versus fan flow;
   droplet burn-out; smoke reaching a detector) so users can change the numbers and watch the result change.
5. **Finds the gaps**: the conditions NASA has never tested, turned into five concrete recommended experiments.
6. **Connects to hardware and Earth**: what the data mean for detectors, extinguishers, ventilation, materials and
   air quality, and which NASA fire technology is already used on Earth.

Every number carries an evidence label, shown as text and never by colour alone:
**NASA measurement · Model prediction · NASA literature · Physics estimate · Data gap**.

## What the data show

| Finding | Evidence |
|---|---|
| **Cutting ventilation may not put out a fire in an oxygen-rich habitat.** | ACME CFI-G (PSI-159): all 41 still-air gas flames at ≤ 25 % O₂ went out on their own (median 8 s); at 33-40 % O₂ the median was 50 s and 30 of 91 were still burning when the fuel was cut, including at 0.5 atm. ACME BRE (PSI-20) shows the same for emulated solids. Our survival model: median 25.1 s in habitat air vs 5.5 s in Earth air. |
| **Common cabin materials burn at habitat-like conditions; Nomex did not ignite.** | Saffire IV-VI (NASA literature): cotton-fiberglass fabric, cotton and PMMA burned at 26-31 % O₂ and 0.53-0.70 atm. |
| **Burning plastic is an air-quality hazard, not only a fire hazard.** | Saffire VI: PMMA raised cabin CO₂ by ~8,100-8,500 ppm. BASS-II (129 ISS burns with O₂, CO₂ and CO measured): thick PMMA slabs raised CO by a median 335 ppm per burn, cotton-fiberglass fabric 20 ppm, Nomex none. |
| **Enclosure size changes fire spread.** | The same fabric spread at 1.8 mm/s in a 51 cm duct and 5.1 mm/s in a 7.6 cm duct (Olson et al., Table 1). |
| **The d²-law describes droplet burn-out.** | Burn time = (d₀² − d_ext²)/K reproduces 188 measured FLEX burn times with R² 0.975 (median predicted/measured 0.95). |
| **Smoke detection has never been tested at habitat conditions.** | SAME, SAME-R and SPICE: 555 smoke and soot tests, all at 21 % O₂ and 1 atm. |

The two biggest gaps: **no PSI solid-fuel burn above 22 % O₂**, and **no PSI combustion test at lunar (0.16 g) or
Martian (0.38 g) gravity**. Moon and Mars answers here are bounded by our 0 g and 1 g data and by physics, never
presented as measurements.

## What we built

### 1. The website (`web/`, React + Vite)

A guided, visual product for crews, students and the public, which also works for researchers.

| Page | What it does |
|---|---|
| **Landing** | An interactive **3D scene** (three.js): Earth from NASA Blue Marble imagery with the ISS orbit, the Moon and Mars (sizes to scale, distances not). Pick orbit, Moon, Mars or Earth to fly the camera there and see the gravity, the buoyant flow a flame would draw there, and what the archive can and cannot say. Respects reduced motion, pauses off screen, has a non-3D fallback. Plus search, headline numbers and the six signature fires. A **mission picker** (challenge habitat 30 % / 0.69 atm, ISS air, NASA exploration atmospheres) drives every page. |
| **Key findings** | Four headline numbers recomputed for the chosen mission air (gas-flame burn time vs Earth air, chance still burning after 30 s, smoke and solid tests near this air) and the five findings with their charts: every ACME CFI-G flame with the survival-model curve, Saffire IV-VI cabin CO₂, flame spread vs duct size, smoke-detection gap, BASS-II carbon-monoxide ranking (CSV download). |
| **Ranking** | The transparent relevance score with **adjustable weights** (atmosphere match, fire-type importance, data quality, number of tests): the order updates live, every row shows its four parts and the reason; CSV download; the 12 real tests closest to the mission air. |
| **Learn (5 steps)** | Why fires start, how fire behaves without gravity, prevention, the second line of defence, then the Fire Lab. |
| **Fire Lab** | Three live labs: **gas leak** (ACME CFI-G survival model), **cabin material** (solids model), **spilled fuel** (droplet model). Sliders for oxygen, pressure, air speed, material, fuel, suppressant and droplet size. Each shows an animated flame on Earth vs in orbit, the prediction with its uncertainty, an inside/outside-tested-range label, a sweep chart, what moves the model most, exact **Shapley explanations** (against 50 real NASA tests over all six inputs, precomputed with the model for every grid point, and against Earth cabin air), the dashboard's **animated flame simulator** (ISS air vs your conditions, at orbit, Moon, Mars or Earth gravity), a **flammability map** (oxygen × air speed with every NASA test that kept burning or went out), the **flow regime** (buoyant speed and Richardson number at orbit, Moon, Mars, Earth gravity) and the **d²-law burn time** checked against 188 FLEX burns. |
| **Investigations** | Explorer of all 24 investigations with filters; a page each: objective, hardware, samples and sizes, instruments, what varied and what stayed the same (computed from the data), key result, DOI. |
| **Compare** | Up to three investigations side by side with a similar / different summary. |
| **Briefing** | Crew takeaways recomputed for the chosen mission air, a **downloadable one-page briefing (HTML)**, each with a number, an action, an evidence label and its source; the most relevant investigations; why habitats use this air (spacesuit / Earth / Moon base). |
| **Gaps** | Tested / thin / gap status per fire type near the mission air; coverage map of oxygen × pressure tested by NASA against your mission; partial-gravity evidence (LUCI, FM2, E-FIELD); the 0 g / 1 g bound from Saffire materials; an interactive buoyancy chart; five recommended experiments. |
| **Equipment** | Next-generation detectors, extinguishers, ventilation procedures, material screening, air quality and layout, each with numbers from the data; BASS-II carbon-monoxide ranking of cabin materials; interactive smoke-to-detector delay at 0 g, Moon, Mars and Earth; NASA fire technology used on Earth (water-mist extinguishers, smoke detection, firefighter air tanks and clothing). |
| **Methods** | Dataset audit (every logged correction), models tested on held-out data, the Saffire IV-VI hardest test, **how each model decides** (permutation importance, glass-box odds ratios, survival-model burn-time multipliers, Gaussian-process input relevance), and **data and sources** (per-investigation table, CSV downloads, references). |
| **Ask the archive** (page, plus a chat on every page) | **Cited search** over the NASA-sourced summaries and the mission findings (TF-IDF with fire-safety synonyms, as in the dashboard), and the team's **Gemini RAG** answer: written only from retrieved passages of the 4,086 NASA report chunks, with the team's prompt rules, showing the passages it read. With the API running it uses the team's vector database; on the static site it searches the passages in the browser (BM25) and calls Gemini with the visitor's own key, which never leaves their browser except to Google. |

The site calls the live API when one is running and otherwise works fully offline from model grids and data exported
by `scripts/export_web.py`, telling the user which mode it is in.

### 2. The analyst dashboard (`app/streamlit_app.py`, Streamlit)

Nine tabs for researchers, all driven by a sidebar atmosphere (presets or any O₂ and pressure): **Crew briefing**
(downloadable), **Key findings**, **Ranking** (adjustable weights), **Investigations** (explorer and comparison),
**Ask the archive**, **Predict a fire** (animated flame simulator under orbit / Moon / Mars / Earth gravity,
flammability map, d²-law timeline, Shapley explanations against the average NASA test and against Earth air),
**Gaps & next tests**, **Equipment & Earth**, **Data & sources** (every table downloadable).

### 3. The API (`server/main.py`, FastAPI)

Runs the three models live and serves the website. Interactive docs at `/api/docs`.

| Endpoint | Purpose |
|---|---|
| `GET /api/health`, `/api/stats` | status, model scores, dataset size |
| `GET /api/missions`, `/api/investigations`, `/api/investigations/{psi}` | mission presets and investigation records |
| `GET /api/ranking?x_o2=&p=`, `/api/compare?ids=` | relevance ranking, side-by-side comparison |
| `POST /api/predict/gas`, `/solid`, `/droplet` | live predictions with uncertainty, range label and sweep curves |
| `GET /api/search`, `POST /api/ask` | cited retrieval; optional Gemini answer (needs `GOOGLE_API_KEY`) |

### 4. The dataset and models

**Dataset v1** (frozen 2026-11-13): **1,517 tests · 10,107 measured values · 14 sources · 103 logged corrections and
source conflicts**. Every value traces back to its source file and row; raw files are never edited.

| Table | Question | Rows |
|---|---|---|
| **A** solids flammability | Does a solid keep burning at this O₂, pressure and air speed? | 414 (212 tests) |
| **B** solids spread | How fast does flame spread over thin fabric? | 10 (descriptive) |
| **C** droplets | How fast does a droplet burn, and at what size does its flame go out? | 299 |
| **D** gas flames | Does a still-air gas flame ignite, and how long does it burn? | 172 |

| Model | Method | Physics built in | Held-out score |
|---|---|---|---|
| **A · Solids** | Histogram gradient boosting, 40 bootstrap models for a 10-90 % band | Monotonic: more O₂ or pressure can never lower the chance of burning; air speed on log and log² scale (quenching at low flow, blow-off at high flow) | ROC-AUC **0.958** (5-fold grouped by test); 5 of 6 held-out Saffire IV-VI burns correct |
| **D · Gas flames** | Weibull accelerated-failure-time survival model (lifelines) | Censoring: flames still burning when fuel was cut count as "at least this long" | Concordance **0.753** (leave-one-ISS-day-out) |
| **C · Droplets** | Gaussian process regression (own ± uncertainty) | d²-law burn time (R² 0.975 on 188 FLEX burns) | R² **0.696** burning rate, **0.901** flame-out size (5-fold) |

**Explainability.** Exact interventional Shapley values (what SHAP estimates, computed exactly over every coalition of
inputs, no sampling; `src/fif/xai.py`), permutation importance, a logistic glass-box companion with odds ratios,
log-linear burn-time multipliers for the survival model, and an applicability label from the nearest real test.

**Physics estimates** (kept separate from the models and labelled): buoyant velocity u_b = √(g·ΔT/T·L), Richardson
number Ri = (u_b/u)², smoke delay = distance / √(u_fan² + u_b²), with gravity from the NASA Planetary Fact Sheet
(Earth 9.81, Mars 3.71, Moon 1.62 m/s²).

**Relevance ranking** (`src/fif/ranking.py`): 40 % atmosphere match (distance of tested O₂ and pressure from the
mission), 25 % fire-type importance for a crewed habitat, 25 % data quality, 10 % number of tests. Weights are
adjustable in the dashboard and every row explains its score.

## The investigations

24 entries: 14 with test-level data loaded, the rest catalogued from their NASA pages for ranking and comparison.

| ID | Investigation | Fire type | Platform, years | Tests loaded |
|---|---|---|---|---|
| PSI-26 | BASS, Burning and Suppression of Solids | solids (lab) | ISS glovebox, 2009-13 | 110 |
| PSI-25 | BASS-II | solids (lab) | ISS glovebox, 2011-13 | 129 |
| PSI-98 | Saffire-I | solids (spacecraft scale) | Cygnus, 2016 | 2 |
| PSI-99 | Saffire-II | solids (spacecraft scale) | Cygnus, 2016 | 10 |
| PSI-100 | Saffire-III | solids (spacecraft scale) | Cygnus, 2017 | 2 |
| EXT | Saffire IV-VI (NASA NTRS 20240002981, not in PSI) | solids (spacecraft scale) | Cygnus, 2019-23 | 6 |
| PSI-20 | ACME BRE, Burning Rate Emulator | emulated solids | ISS CIR, 2019-21 | 43 |
| PSI-159 | ACME CFI-G, Cool Flames Investigation with Gases | gas flames | ISS CIR, 2021 | 179 |
| PSI-69 | FLEX, Flame Extinguishment Experiment | droplets & suppression | ISS CIR, 2009-12 | 274 |
| PSI-39 | CFI, Cool Flames Investigation | droplets | ISS CIR, 2020-21 | 79 |
| PSI-117 | Cool-flame dynamics (FLEX data + simulation) | droplets | ISS + simulation | 72 |
| PSI-102 | SAME, Smoke and Aerosol Measurement Experiment | smoke & detection | ISS glovebox, 2001-08 | 20 |
| PSI-101 | SAME-R, reflight | smoke & detection | ISS glovebox, 2010 | 109 |
| PSI-107 | SPICE, Smoke Point In Co-flow Experiment | soot | ISS glovebox, 2010-12 | 469 |
| PSI-68 | FLEX-2 | droplets | ISS CIR, 2016-19 | catalogued (ranges only) |
| PSI-106 | SLICE, Structure and Liftoff in Combustion | soot / jet flames | ISS glovebox, 2012 | catalogued |
| PSI-21 | ACME CLD Flame, Coflow Laminar Diffusion | gas flames | ISS CIR | catalogued |
| PSI-10 | ACME Flame Design | gas flames | ISS CIR + drop towers | catalogued |
| PSI-23 | ACME s-Flame | gas flames | ISS CIR, 2015-19 | catalogued |
| PSI-22 | ACME E-FIELD Flames | gas flames | ISS CIR, 2016-20 | catalogued |
| PSI-142 | Cool-flame counterflow (FLEX) | droplets | analysis | catalogued |
| PSI-115 | SAME smoke-generation model | smoke | simulation | catalogued |
| PSI-60 | SPICE soot analysis | soot | analysis | catalogued |
| PSI-62 | BASS flame-spread model | solids | simulation | catalogued |

Hardware groups shared across investigations: ACME in the Combustion Integrated Rack (PSI-20, 159, 21, 10, 23, 22),
the Multi-user Droplet Combustion Apparatus (PSI-69, 68, 39), the glovebox flow duct (PSI-26, 25, 107, 106), the
SAME smoke hardware (PSI-102, 101) and Saffire on Cygnus.

## How the data are handled

- **One set of units:** pressure in atm, oxygen as a mole fraction, air speed in cm/s, sizes in mm.
- **Nothing silently changed:** every correction (unit slips, swapped columns, typos, merged cells, source conflicts)
  is made in code and logged in `data/processed/issues.csv`.
- **Missing means missing:** gaps stay blank, never zero and never an average.
- **Checked against the source:** transcribed tables were verified against the published PDFs; where a PSI table
  and a verified paper disagree, the paper value is used and the PSI value is kept alongside.
- **No leakage:** validation keeps whole tests (or whole ISS days) out of training.
- **Experiments, simulations and literature are never mixed**, and each row says which it is.

## Repository layout

```
app/
  streamlit_app.py             analyst dashboard (9 tabs)
  assets/flame_sim.html        animated flame simulator (canvas) used by the dashboard
web/                           the website (React + Vite)
  src/pages/                   Landing, Learn (5 steps), FireLab, Archive (explorer, investigation, compare,
                               briefing, gaps, methods), Evidence (equipment & Earth, physics panels, maps,
                               flame simulator), Dashboard (findings, ranking, ask, model explanations, sources)
  public/sim/, public/data/    the dashboard's flame simulator; RAG passages loaded on demand
  src/components/              shared UI, charts, habitat-module scene, Ask-the-archive chat
  src/lib/                     data access and offline model grids, physics and Shapley helpers, API client, router
  src/data/                    JSON exported from the Python layer (scripts/export_web.py)
server/main.py                 FastAPI: live models, records, ranking, compare, search, Gemini answers; serves web/dist
src/fif/                       the Python core
  schema.py, registry.py       test / evidence schema and the source registry
  investigations/              one loader per investigation (psi_26.py ... ext_saffire456.py)
  build.py, issues.py          builds data/processed/ and logs every correction
  ml_tables.py, models.py      ML tables A-D and the three models
  ranking.py                   relevance ranking, gap matrix, recommended experiments
  knowledge.py                 mission presets, takeaways, hardware, instruments, comparisons, partial gravity,
                               equipment & Earth, BASS-II gas, physics helpers, Ask corpus
  xai.py                       exact Shapley values and log-linear contributions
  genai.py                     adapter to the team's Gemini RAG module
  webdata.py                   shared data shaping for the API and the web export
RAG/                           retrieval-augmented Gemini assistant (LangGraph + Chroma vector DB of NASA reports)
scripts/                       build_data, build_ml, train_models, build_ranking, export_web, export_web_extras, inspect_raw
catalog/investigations.csv     every investigation: fuels, O₂ / pressure / flow ranges, DOI, status
data/raw/<id>/                 source files as downloaded or transcribed, each with a README
data/processed/                tests.csv, evidence.csv (one row per value), issues.csv
ml/                            ML tables, SPEC.md (column rules), DATASET_v1.md (ranges and limits)
models/v1/                     trained models, metrics, explanations, habitat predictions (MODELS.md)
reports/                       ranking and gap map, per-investigation load status, PSI-117 findings
notebooks/                     PSI-117 walkthrough
qa/                            label spot-check against the original crew notes
tests/                         46 automated checks (data, model physics, knowledge layer, Shapley, physics, API)
docs/ARCHITECTURE.md           website feature → API → dataset / model map
slides/                        presentation source
Dockerfile, render.yaml        one-container deployment; .github/workflows/pages.yml publishes the website
```

## Tools and frameworks

| Area | Used |
|---|---|
| Data and science | Python 3.13, pandas, NumPy, SciPy, openpyxl |
| Machine learning | scikit-learn (HistGradientBoosting, Gaussian process, logistic regression), lifelines (Weibull AFT), joblib |
| Explainability | own exact Shapley implementation (`src/fif/xai.py`), permutation importance |
| Generative AI (optional) | Google Gemini `gemini-3.1-flash-lite` and `gemini-embedding-2`, LangChain, LangGraph, ChromaDB (team RAG module) |
| Dashboard | Streamlit, Plotly, Matplotlib, HTML canvas simulator |
| Website | React 18, Vite, three.js (3D Earth / Moon / Mars scene), hand-built SVG charts and animated flames (no chart library); design pass guided by the UI/UX Pro Max skill checklist (focus states, reduced motion, 375-1440 px layouts) |
| API and deployment | FastAPI, Uvicorn, Pydantic, Docker, GitHub Actions / Pages, Render, Hugging Face Spaces |
| Quality | pytest (46 checks) |

## Run it

```bash
git clone https://github.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps.git
cd Flame-in-FreeFall-NASA-Space-Apps
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r server/requirements.txt

pytest -q                                   # 46 checks
streamlit run app/streamlit_app.py          # analyst dashboard

cd web && npm ci && npm run build && cd ..  # build the website into web/dist
uvicorn server.main:app --port 8000         # website + live API at http://localhost:8000 (docs at /api/docs)
```

Rebuild everything from the raw files: `python scripts/build_data.py`, `build_ml.py`, `train_models.py`,
`build_ranking.py`, then `export_web.py` and `export_web_extras.py` (Shapley grid, ranking extras, findings, RAG passages, flame simulator) for the website. For front-end work, run the API and `npm run dev` in `web/`.

**Optional Gemini answers:** copy `.env.example` to `.env` and set `GOOGLE_API_KEY` (or add it as a secret on the
host). `.env` and `.streamlit/secrets.toml` are git-ignored; never commit a key or paste it into a chat. Without a key
everything works and the cited search answers instead.

**Deploy:** the website is published to GitHub Pages by `.github/workflows/pages.yml` (Settings → Pages → Source:
GitHub Actions). The full site with the live API runs from the `Dockerfile`; see [`DEPLOY.md`](DEPLOY.md).

## NASA data and references

| Source | Used for |
|---|---|
| NASA Physical Sciences Informatics, <https://psi.ndc.nasa.gov/>: BASS (PSI-26), BASS-II (PSI-25), Saffire I-III (PSI-98, 99, 100), ACME BRE (PSI-20), ACME CFI-G (PSI-159), FLEX (PSI-69), CFI (PSI-39), PSI-117, SAME (PSI-102), SAME-R (PSI-101), SPICE (PSI-107); investigation pages of PSI-68, 106, 21, 10, 23, 22, 142, 115, 60, 62 | Test matrices, analysed data, data FAQs, science requirement documents and investigation pages (CC0-1.0; DOI of each in `catalog/investigations.csv` and on every data row) |
| Saffire-II Data Description Document (PSI-99) | Sample list, sensors (Table 3), airflow settings |
| Urban et al., *Preliminary Results from the Saffire VI Experiment*, ICES-2024-365, NASA NTRS [20240002981](https://ntrs.nasa.gov/citations/20240002981) | Saffire IV-VI conditions and results, cabin CO₂ and CO |
| Urban et al., *Fire Safety Implications of Preliminary Results from Saffire IV and V*, ICES-2021-266, NASA NTRS [20210011521](https://ntrs.nasa.gov/citations/20210011521) | Saffire IV-V background |
| NASA NTRS [20180005168](https://ntrs.nasa.gov/citations/20180005168) | Saffire I-III results and the 1 g companion burns (0 g / 1 g bounds) |
| Olson et al., duct size and sample size effects on concurrent flame spread in microgravity (UCL Discovery 10164340) | Spread rates vs duct size |
| Ferkul et al. (2013), BASS fabric flammability | Flow direction and speeds of BASS fabric tests |
| Ferkul et al., *Lunar Combustion Investigation (LUCI)*, NASA NTRS [20250010653](https://ntrs.nasa.gov/citations/20250010653) | Partial-gravity evidence |
| NASA, [Flammability of Materials on the Moon (FM2)](https://www.nasa.gov/flammability-of-materials-on-the-moon-fm2/); NTRS [20240015307](https://ntrs.nasa.gov/citations/20240015307) | Lunar-gravity flammability finding |
| ACME E-FIELD Flames, DOI [10.60555/se5a-8c73](https://doi.org/10.60555/se5a-8c73) | Electric-field flame control |
| NASA Glenn, [Combustion Science](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/) | DAFT and SAME smoke-meter link |
| NASA Spinoff [node 11065](https://spinoff.nasa.gov/node/11065), [11031](https://spinoff.nasa.gov/node/11031), [10564](https://spinoff.nasa.gov/node/10564); NTRS 20130011664, 20010074094, 20170000248, 20090002489 | Fine-water-mist extinguisher, smoke detection, firefighter air tanks and PBI clothing |
| NASA Planetary Fact Sheet, <https://nssdc.gsfc.nasa.gov/planetary/factsheet/> | Gravity of Earth, Moon, Mars |
| NASA Visible Earth, Blue Marble (public domain), via the `three-globe` npm package (MIT) | Earth texture, bump and water maps in the 3D scene |
| NASA Space Apps 2026 challenge brief, *Flame in Freefall* | Habitat, spacesuit and Moon-base atmospheres; hardware groups; out-of-scope note on propellants |

## AI usage declaration

In line with the NASA Space Apps rules:

- **Claude (Anthropic)** was used as a development assistant for code (loaders, pipeline, models, dashboard, website,
  API, tests), for transcribing values from paper tables (each verified by the team against the original) and for
  drafting documentation. AI-assisted commits carry `Co-Authored-By` trailers.
- **Google Gemini** powers the optional AI answer in *Ask the archive* (dashboard, API, and the website, where visitors may use their own Gemini key; it is sent only from their browser to Google and is never stored by the project). It answers only from retrieved NASA passages,
  shows them, and is labelled "AI-generated (Gemini)". The models, rankings, briefing and every number shown do not
  use generative AI.
- All scientific data come from NASA and the cited publications; nothing in the dataset is AI-generated.
- No AI-generated images are used. The Moon and Mars surfaces in the 3D scene are procedural illustrations generated in code. No NASA insignia, logotype, flags or mission insignia are used; the official NASA Space Apps Challenge logo (Space Apps brand page) is shown top left when its file is placed in `web/public/brand/`. This project is not
  affiliated with or endorsed by NASA, and it is a research and education tool, not a certified fire-safety system.

## Team

| Name | Affiliation |
|---|---|
| **Mohammed Ayman Elboghdadi** (team lead) | Zewail City of Science and Technology |
| Omar Abdelhamed | Zewail City of Science and Technology |
| Mostafa Abdelsamad | Zewail City of Science and Technology |
| Omar Hafez | Zewail City of Science and Technology |
| Omar Mokhtar | Zewail City of Science and Technology |
| Ahmed Khaled | Zewail City of Science and Technology |
| Abdelhameed | Cairo University |

## Licence

Code and documentation: [Apache License 2.0](LICENSE). NASA data remain CC0-1.0 under their original terms.
