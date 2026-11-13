# Models v1 (trained on dataset v1)

Rebuild: `python scripts/train_models.py` (after `build_data.py` and `build_ml.py`). Outputs in this folder.
All validation keeps whole tests (or whole ISS operations days) out of training, so the scores are not inflated
by near-duplicate rows. Every prediction carries an **applicability label** from its nearest real test.

## A. Solids: will the flame keep burning? (`A_solids.joblib`)
Inputs: O2 fraction, pressure, air speed (log and log²: flames die at low flow *and* blow off at high flow),
material, geometry, flow direction. 414 rows from 212 tests, 23 flame-outs.

| Model (5-fold, grouped by test) | ROC-AUC | Balanced accuracy | Flame-out PR-AUC |
|---|---|---|---|
| Material-only baseline | 0.784 | 0.716 | 0.452 |
| Logistic regression | 0.847 | 0.82 | 0.587 |
| **Gradient boosting (chosen; O2 may only raise risk)** | **0.948** | **0.839** | **0.601** |

Held-out check on the near-habitat Saffire IV-VI burns: SIBAL (31 % O2, 0.53 atm) and both PMMA samples
(29-30 % O2, 0.54 atm) were predicted to burn (0.88-1.00), as they did. Cotton (1 test) and Nomex (7 tests) were
predicted wrongly, so **materials with fewer than 12 rows are not modelled**; only PMMA, SIBAL and wax get a number,
with a 10-90 % bootstrap band. `A_oof_predictions.csv` shows every held-out prediction next to the real outcome.

Habitat (30 % O2, 0.69 atm) vs Earth cabin (21 %, 1 atm), P(sustained):

| Material | Air speed | Habitat | Earth cabin |
|---|---|---|---|
| PMMA slab, opposed | 20 cm/s | 0.99 (0.91-1.00), outside tested range (extrapolation) | 0.82 (0.80-1.00), inside tested range |
| SIBAL fabric, concurrent | 20 cm/s | 1.00 (0.98-1.00), inside tested range | 0.99 (0.98-1.00), inside tested range |
| Wax candle | 10 cm/s | 0.92 (0.47-1.00), outside tested range (extrapolation) | 0.99 (0.93-1.00), inside tested range |

## D. Gas flames in still air: how long until the flame goes out by itself? (`D_gas_flames.joblib`)
Weibull accelerated-failure-time survival model (ACME CFI-G, 132 ignited flames; 30 flames were still
burning when the fuel was cut and are treated as "burned at least this long"). Inputs: O2, pressure, fuel flow,
fuel dilution, fuel. Leave-one-operations-day-out concordance: **0.753** (11 days).

Propane (30 % in N2, 1 mg/s), predicted median burn time and chance of still burning after 30 s:

| Atmosphere | Median burn | Still burning at 30 s |
|---|---|---|
| Earth cabin, 21 % O2, 1 atm | 5.5 s | 0% |
| **Habitat, 30 % O2, 0.69 atm** | **25.1 s** | **41%** |
| 34 % O2, 0.69 atm | 47.1 s | 69% |

⚠ No CFI-G tests lie between 25 % and 34 % O2: the habitat value is interpolated and labelled as such.
Full grid: `D_burn_time_grid.csv`.

## C. Droplets: burning rate and extinction size (`C_droplets.joblib`)
Gaussian process regression (FLEX + PSI-117 experiments; reports its own ± uncertainty).

| Target | 5-fold R² | 5-fold MAE | Mean |
|---|---|---|---|
| Burning rate K | 0.696 | 0.047 mm²/s | 0.502 mm²/s |
| Extinction diameter | 0.901 | 0.225 mm | 2.129 mm |

Leaving a whole fuel out raises the error (burning rate MAE 0.062-0.112; extinction MAE 0.25-0.71 mm):
the model should not be used for fuels it has not seen.

3 mm droplets, no suppressant (habitat point is inside the FLEX test range):

| Fuel | Burning rate, habitat | Burning rate, Earth cabin | Extinction diameter, habitat | Extinction diameter, Earth cabin |
|---|---|---|---|---|
| Methanol | 0.652 ± 0.064 | 0.495 ± 0.063 | 0.583 ± 0.31 mm | 1.344 ± 0.249 mm |
| n-Heptane | 0.746 ± 0.064 | 0.538 ± 0.062 | 1.64 ± 1.037 mm | 1.39 ± 0.248 mm |

## What the three models agree on
At habitat conditions every fire type burns **faster and longer** than in Earth cabin air: solids that burn on
Earth keep burning, gas flames in still air are predicted to last about 4.5 times longer, and droplet flames burn ~30-40 %
faster. The models are screening tools; their uncertainty and the applicability labels say where new
experiments are needed (see the gap map).
