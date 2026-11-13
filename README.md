# Flame in Freefall: NASA Space Apps 2026

**Which microgravity fire experiments matter most for a crewed habitat at ~30 % O2 and ~0.69 atm, what do they
predict, and what has never been tested?**

This repository turns NASA Physical Sciences Informatics (PSI) combustion investigations into one validated,
traceable dataset, then uses it to rank investigations by habitat relevance, train predictive models with
honest uncertainty, and map the research gaps.

| Component | State |
|---|---|
| Data layer: 13 PSI investigations + NASA Saffire IV-VI literature | ✅ dataset v1, frozen 2026-11-13 |
| ML tables A-D (`ml/v1/`) | ✅ built |
| Predictive models | in progress |
| Ranking engine + gap map | in progress |
| Dashboard (Streamlit) | in progress |

Team: Mohammed Ayman (lead), Mostafa, Hafez, Omar Abdelhamed, Ahmed Khaled, Mokhtar.

## Dataset v1 at a glance

1,517 test rows, 10,107 measured values, 101 logged data corrections, 14 sources. Full summary, per-source
condition ranges and known limits: [`ml/v1/DATASET_v1.md`](ml/v1/DATASET_v1.md).

| Family | Investigations loaded |
|---|---|
| Burning solids | BASS (PSI-26), BASS-II (PSI-25), Saffire I-III (PSI-98/99/100), Saffire IV-VI (NASA NTRS 20240002981, external) |
| Fuel droplets | FLEX (PSI-69), CFI (PSI-39, conditions only), cool-flame data (PSI-117) |
| Gas flames | ACME BRE (PSI-20, emulated solids), ACME CFI-G (PSI-159), SPICE (PSI-107, conditions only) |
| Smoke / detection | SAME (PSI-102), SAME-R (PSI-101), conditions only |
| Catalogued only | FLEX-2 (68), SLICE (106), PSI-62, 142, 115, 60, 10, 21, 22, 23 |

## ML tables (`ml/v1/`)

| Table | Question | Ready rows |
|---|---|---|
| `A_solids_flammability.csv` | Does a solid keep burning at this O2, pressure and air speed? | 414 (23 flame-outs) |
| `B_solids_spread.csv` | How fast does flame spread over a thin fabric? | 10 (descriptive only) |
| `C_droplets.csv` | How fast does a fuel droplet burn, and at what size does its flame go out? | 299 |
| `D_gas_flames.csv` | Does a still-air gas flame ignite, and how long does it burn? | 172 |

Column definitions, validation rules and limits: [`ml/SPEC.md`](ml/SPEC.md).

## Run it

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt          # Windows: .venv\Scripts\pip ...
python scripts/build_data.py                        # all investigations -> data/processed/
python scripts/build_data.py PSI-25                 # just one
python scripts/build_ml.py                          # ML tables -> ml/v1/
pytest -q
```

## How it is organised

```
catalog/investigations.csv     every PSI investigation found + the external source: family, fuels,
                               O2 / pressure / flow ranges, priority tier, data status, notes
data/raw/<id>/                 source files exactly as downloaded or pasted (never edited) + README.txt
data/processed/
  tests.csv                    one row per test/run: fuel, size, pressure, O2, diluent, flow, gravity,
                               outcome, flags, confidence, source file and line
  evidence.csv                 one row per measured value, linked to tests.test_id
  issues.csv                   every data-quality finding and the fix applied
  coverage.csv                 conditions covered per investigation
  <id>/                        that investigation's own cleaned tables
ml/SPEC.md                     ML table definitions and rules
ml/v1/                         ML tables A-D, sources_summary.csv, DATASET_v1.md, fill_report.md
qa/                            label spot-check against the original notes
reports/phase1_status.md       load and schema status per investigation
reports/PSI-117/               figures and findings for PSI-117
src/fif/
  schema.py                    shared contract (columns and units)
  registry.py, build.py        plug-in registration, validation, merge
  ml_tables.py                 builds ml/v1 from data/processed
  investigations/              one loader per investigation (+ shared helpers for Saffire and BASS-II)
src/psi117/                    PSI-117 parsing package
tests/                         pytest checks on the data layer
```

## Rules every loader follows

* Pressure in **atm**, oxygen as a **mole fraction** (0.21, not 21), flow in **cm/s**, sizes in **mm**,
  gravity in **g** (0 = microgravity). The schema check rejects O2 > 1 and pressures that look like kPa.
* Raw files are never edited. Every correction happens in a loader and writes an issue.
* Missing stays blank (never 0, never an average). A fixed condition is stored as one value.
* When a PSI table and a verified paper table disagree, the paper value is used and the PSI value is kept in `flags`.
* `source_type` (experiment / simulation) is on every row; the two are never mixed in a model.
* External literature rows are marked `source_kind = external_literature`.

## Adding an investigation

1. Put its files in `data/raw/PSI-xx/` (with a README.txt) and run `python scripts/inspect_raw.py PSI-xx`.
2. Copy `src/fif/investigations/_template.py` to `psi_xx.py`, fill it in, import it in `investigations/__init__.py`.
3. Run `python scripts/build_data.py PSI-xx` and check `reports/phase1_status.md` says `OK`.

## Data sources and licence

NASA PSI investigation data are CC0-1.0 (DOIs in `catalog/` and on every row). Saffire IV-VI values are transcribed
from Urban et al., ICES-2024-365 (NTRS 20240002981) and Olson et al. (UCL Discovery eprint 10164340), and verified
against the published tables.
