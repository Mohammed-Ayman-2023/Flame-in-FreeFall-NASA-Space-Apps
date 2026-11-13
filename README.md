# Flame in Freefall: data layer (Phase 1)

NASA Space Apps 2026. Turns NASA PSI combustion investigations into one validated,
traceable dataset that the ranking, gap matrix, assistant and dashboard all read.

## Run it

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt          # Windows: .venv\Scripts\pip ...
python scripts/build_data.py                        # all investigations with files present
python scripts/build_data.py PSI-25                 # just one
python scripts/inspect_raw.py PSI-25                # first look at newly downloaded files
pytest -q
```

In VS Code: open the folder, pick the `.venv` interpreter, then **Terminal → Run Build Task**.

## How it is organised

```
catalog/investigations.csv     26 PSI search results: family, pillar, fuel class, known
                               condition ranges, priority tier, data status, sources
data/raw/PSI-xx/               downloaded files, one folder per investigation (never edited)
data/processed/
  tests.csv                    one row per test/run: fuel, size, pressure, O2, diluent, flow,
                               gravity, outcome, source  <- ranking and gap matrix read this
  evidence.csv                 one row per value, linked to tests.test_id, traceable to file+line
  issues.csv                   every data-quality finding, all investigations
  coverage.csv                 per investigation: conditions covered (from data, else catalog)
  PSI-xx/                      that investigation's own cleaned tables
reports/phase1_status.md       what is loaded, what is waiting, schema check per investigation
reports/PSI-117/               figures, findings, data-quality report for PSI-117
src/fif/
  schema.py                    the shared contract (columns and units)
  registry.py                  plug-in registration
  build.py                     runs plug-ins, validates, merges
  investigations/psi_117.py    first plug-in
  investigations/_template.py  copy this for each new investigation
src/psi117/                    PSI-117 parsing and cleaning (validated package)
```

## Units and rules (all plug-ins)

* Pressure in **atm**, oxygen as a **mole fraction** (0.21, not 21), flow in **cm/s**, sizes in **mm**,
  gravity in **g** (0 = microgravity). The schema check rejects O2 > 1 and pressures that look like kPa.
* `source_type` is `experiment` or `simulation` on every row; the two are never merged.
* Raw values are never overwritten; excluded values keep a `status` saying why.
* Every rule that changes or drops data writes an issue.

## Adding an investigation

1. Put its files in `data/raw/PSI-xx/` and run `python scripts/inspect_raw.py PSI-xx`.
2. Copy `src/fif/investigations/_template.py` to `psi_xx.py`, fill it in, import it in
   `investigations/__init__.py`.
3. `python scripts/build_data.py PSI-xx`, then check `reports/phase1_status.md` says `schema OK`.

## Status

| Tier | Investigations | State |
|---|---|---|
| 1 | PSI-117 | loaded (72 tests, 8,581 values) |
| 1 | BASS-II (25), Saffire-II (99), FLEX (69), FLEX-2 (68), SAME-R (101), BRE (20) | waiting for files |
| 2-3 | 16 others | catalogued; loaders on demand |
