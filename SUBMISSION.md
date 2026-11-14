# Submission text (copy into the NASA Space Apps project form)

## Project name
Flame in Freefall

## High-level summary (short description)
Future crewed habitats are expected to run at about 30 % oxygen and 0.69 atm, an atmosphere where fire behaves
differently, and differently again in microgravity. Flame in Freefall turns NASA's Physical Sciences Informatics
(PSI) combustion archive into one traceable dataset (1,517 tests from 13 PSI investigations plus the Saffire IV-VI
NASA reports), then ranks the investigations by relevance to the habitat atmosphere, predicts fire behaviour there
with honest uncertainty, and maps what has never been tested. The headline finding: in still microgravity air,
flames at Earth-like oxygen go out on their own within seconds, but at raised oxygen they keep burning. Our model
predicts a flame at habitat conditions burns about 4.6 times longer, so cutting the ventilation, a standard first
response to a spacecraft fire, may not be enough. Smoke detection has never been tested near habitat air. An
interactive dashboard opens on a crew briefing for the chosen atmosphere (habitat, ISS, or NASA's proposed lunar
34 % / 8.2 psia air), with six takeaways, each with an action, a source and an evidence label, and lets anyone explore
the ranking, compare investigations, ask the archive questions answered with citations, and download the briefing.

## Project details
**What it does.** Four parts, all open source:
1. **Data layer.** One loader per investigation converts PSI test matrices, analysed data and NASA report tables to
   one set of units (O2 mole fraction, atm, cm/s, mm). Every value keeps its source file and line; 103 corrections
   and source conflicts are logged; raw files are never edited; transcribed tables were verified against the
   published PDFs.
2. **Models** (validated only on tests they never saw): solid-fuel flammability (gradient boosting with physics constraints, ROC-AUC 0.96),
   still-air gas-flame burn time (Weibull survival model, concordance 0.75 leaving out whole ISS days), droplet
   burning rate and extinction size (Gaussian process, R² 0.70 and 0.90). Every prediction carries an uncertainty
   band and an "inside / outside the tested range" label; materials with too few tests are not modelled.
3. **Relevance ranking and gap map.** A transparent score (atmosphere match, fire-type importance, data quality,
   number of tests) for any mission atmosphere, with a reason for each investigation, plus a map of tests per fire
   type across oxygen and pressure.
4. **Dashboard** (Streamlit): mission presets (challenge habitat, ISS, NASA's 26.5 % / 10.2 psia and 34 % /
   8.2 psia exploration atmospheres, or any O2 and pressure); a crew briefing of six takeaways that recompute for the
   chosen air, downloadable as a one-page HTML file; the live ranking; an investigation explorer that shows, for
   every investigation, its hardware, sample or burner shapes and sizes, instruments, and what changed between its
   tests versus what stayed the same, with side-by-side comparison and shared-hardware groups; "Ask the archive", which answers only from the project's NASA sources with citations and says so when
   it has no answer; predictions with "how this model decides" explanations; the gap map; data downloads and
   sources. Every number is labelled NASA measurement, model prediction, NASA literature or data gap.

**Benefits.** Mission and habitat designers get, in one place, which NASA experiments apply to their atmosphere,
what they predict, and how confident that is. Researchers get a prioritised list of the experiments still missing.

**Tools.** Python (pandas, NumPy, SciPy, scikit-learn, lifelines, Plotly, Streamlit), GitHub.

**Findings.**
- In still air, ACME CFI-G flames at ≤ 25 % O2 all self-extinguished (median 8 s); at 33-40 % O2 they burned a
  median 50 s and 30 of 91 were still burning when the fuel was cut. ACME BRE reports the same for emulated solids.
- Saffire V-VI: fabric, cotton and PMMA burned at 26-31 % O2 and 0.53-0.70 atm; Nomex did not ignite. PMMA raised
  cabin CO2 by 8,100-8,500 ppm and CO by about 320 ppm.
- The same fabric spread 1.8 to 5.1 mm/s depending on the duct size around it.
- SAME, SAME-R and SPICE: 86 smoke tests and 469 soot-point settings, all at 21 % O2 and 1 atm.
- At NASA's proposed lunar atmosphere (34 % O2, 8.2 psia), inside the range CFI-G tested, the model predicts a
  median still-air burn of about 49 s, with 71 % of flames still burning after 30 s.
- No PSI combustion investigation has burned anything at lunar or Martian gravity. Bounding with our own data:
  in Saffire I-III, silicone burned in NASA's 1 g companion tests but in none of 4 microgravity burns, so its
  partial-gravity behaviour is genuinely unknown; NASA's FM2 work reports some materials burn at lower oxygen
  levels at lunar gravity than at 1 g, so 0 g and 1 g results do not always bound the Moon safely.

**Recommended next experiments.** (1) Cabin solids at 28-32 % O2, 0.6-0.8 atm. (2) Smoke-detector response to smoke
made in habitat air. (3) Still-air self-extinction at 24-33 % O2, where ACME CFI-G has no tests. (4) Publication of
per-test FLEX-2 results. (5) Repeat key fabric and plastic burns at lunar (0.16 g) and Martian (0.38 g) gravity.

## NASA data used
NASA Physical Sciences Informatics (CC0-1.0): BASS (PSI-26), BASS-II (PSI-25), Saffire I-III (PSI-98, PSI-99,
PSI-100), FLEX (PSI-69), CFI (PSI-39), PSI-117, ACME BRE (PSI-20), ACME CFI-G (PSI-159), SPICE (PSI-107),
SAME (PSI-102), SAME-R (PSI-101); catalog entries for PSI-68, 106, 62, 142, 115, 60, 10, 21, 22, 23.
NASA Technical Reports Server: NTRS 20240002981 (Saffire VI, ICES-2024-365), NTRS 20210011521 (Saffire IV-V,
ICES-2021-266), NTRS 20180005168 (Saffire I-III).

## Other references
- NASA Space Apps 2026 challenge brief, *Flame in Freefall* (shared hardware, atmospheres, CFI-G, DAFT, E-FIELD).
- Ferkul et al., LUCI flammability results, NASA NTRS 20250010653; Zayac et al., FM2, NASA NTRS 20240015307;
  NASA FM2 page; NASA Glenn Combustion Science page (DAFT).
- BASS-II data FAQ and science requirements document (PSI-25).
- Olson et al., *The effect of duct size, sample size, and fuel composition on concurrent flame spread over large
  cellulose samples in microgravity*, accepted manuscript, UCL Discovery eprint 10164340.
- Ferkul et al. (2013), BASS fabric flammability tests, Table I.
- Open-source software: pandas, NumPy, SciPy, scikit-learn, lifelines, Plotly, Streamlit, Matplotlib, openpyxl, pytest.

## Use of artificial intelligence
This project used Claude (Anthropic), an AI assistant, as a development aid: writing and debugging code (data
loaders, models, ranking, dashboard), transcribing values from paper tables (verified by the author against the
original PDFs), and drafting documentation and slide text. All scientific data come from NASA and the cited
publications; no data values are AI-generated. No AI-generated images, audio or video are used, and no NASA logos,
flags or mission insignia are used or modified. AI use is also declared in the repository README and in commit
metadata.

## Links
- Code and data: https://github.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps
- Dashboard: [add the Streamlit link after deploying]
- Slides (7): [add the public link or PDF]
