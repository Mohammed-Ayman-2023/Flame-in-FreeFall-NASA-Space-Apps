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
| **Cutting ventilation may not put out a fire in an oxygen-rich habitat.** In still microgravity air, flames at ≤ 25 % O2 went out on their own within seconds; at 34-40 % O2 they kept burning, often until the fuel was shut off. | ACME CFI-G (PSI-159): all 41 flames at ≤ 25 % O2 self-extinguished (median 8 s); at 34-40 % O2 median 50 s, 30 of 91 still burning when fuel was cut, including at 0.5 atm. ACME BRE (PSI-20) reports the same for emulated solids. |
| **Common cabin materials burn at habitat-like conditions; Nomex did not ignite.** | Saffire IV-VI: cotton-fiberglass fabric, cotton and PMMA all burned at 26-31 % O2 and 0.53-0.70 atm. |
| **Burning plastics are an air-quality hazard, not just a fire hazard.** | Saffire VI: PMMA raised cabin CO2 by ~8,100-8,500 ppm and CO by ~310-320 ppm, several times more than fabrics. |
| **Enclosure size changes how fast fire spreads.** | The same fabric spread at 1.8-5.1 mm/s depending only on the size of the duct around it. |
| **Smoke detection has never been tested at habitat conditions.** | SAME, SAME-R and SPICE: 86 smoke tests and 469 soot-point settings, all in 21 % O2 at 1 atm. |

The biggest gap: **no PSI solid-fuel burn above 22 % O2.** The only solid burns near habitat conditions come from
the Saffire IV-VI flights, published in the NASA literature rather than in PSI.

## The dataset

**Dataset v1** (frozen 2026-11-13): **1,517 tests, 10,107 measured values, 14 sources, 101 logged corrections.**
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
| Predictive models | 🔄 In progress |
| Relevance ranking and gap map | 🔄 In progress |
| Interactive dashboard | 🔄 In progress |

## Quick start

```bash
git clone https://github.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps.git
cd Flame-in-FreeFall-NASA-Space-Apps
python -m venv .venv
.venv/bin/pip install -r requirements.txt     # Windows: .venv\Scripts\pip install -r requirements.txt
python scripts/build_data.py                   # rebuild data/processed/ from the raw files
python scripts/build_ml.py                     # rebuild the ML tables in ml/v1/
pytest -q                                      # data checks
```

## Repository layout

```
catalog/investigations.csv   every investigation: fuels, O2 / pressure / flow ranges, priority, status
data/raw/<id>/               source files exactly as downloaded or transcribed, with a README
data/processed/              tests.csv, evidence.csv (one row per value), issues.csv (every correction)
ml/v1/                       ML tables A-D and the dataset summary
ml/SPEC.md                   ML column definitions, rules and limits
qa/                          label spot-check against the original crew notes
reports/                     load status per investigation, PSI-117 findings
src/fif/                     shared schema, loaders (one per investigation), build and ML-table code
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

## Sources and licence

NASA PSI data are released under CC0-1.0; each investigation's DOI is recorded in the catalog and on every row.
Saffire IV-VI values are from Urban et al., *Preliminary Results from the Saffire VI Experiment*, ICES-2024-365
(NASA NTRS 20240002981) and Olson et al., *The effect of duct size, sample size, and fuel composition on concurrent
flame spread over large cellulose samples in microgravity* (UCL Discovery eprint 10164340).

## Author

**Mohammed Ayman** · [GitHub](https://github.com/Mohammed-Ayman-2023)

Data collection, cleaning and validation, dataset design, modelling and analysis.

Developed for the NASA Space Apps Challenge 2026.
