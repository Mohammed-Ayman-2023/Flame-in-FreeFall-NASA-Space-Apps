# Models v1 (trained on dataset v1)

Rebuild: `python scripts/train_models.py` (after `build_data.py` and `build_ml.py`). Outputs in this folder:
the models (`*.joblib`), scores (`metrics.json`), explanations (`explain.json`, `*_effect_curves.csv`) and habitat
predictions. All validation keeps whole tests (or whole ISS operations days) out of training. Every prediction
carries an **applicability label** from its nearest real test.

| Model | Question | Method | Held-out score |
|---|---|---|---|
| A | Will a solid keep burning? | Gradient boosting with physics constraints | ROC-AUC **0.958** |
| D | How long does a still-air gas flame burn? | Weibull survival model (handles flames still burning when fuel was cut) | concordance **0.753** |
| C | Droplet burning rate and extinction size | Gaussian process (own ± uncertainty) | R² **0.696** and **0.901** |

## A. Solids: will the flame keep burning? (`A_solids.joblib`)
Inputs: O2 fraction, pressure, air speed (log and log²: flames starve at low flow and blow off at high flow),
material, shape, flow direction. 414 rows from 212 tests, 23 flame-outs.

**Physics constraints:** more oxygen, or more pressure, can only raise the predicted chance of burning.

| Model (5-fold, grouped by test) | ROC-AUC | Balanced accuracy | Flame-out PR-AUC | Brier |
|---|---|---|---|---|
| Material-only baseline | 0.784 | 0.716 | 0.452 | 0.0322 |
| Logistic regression (glass box) | 0.847 | 0.82 | 0.587 | 0.0879 |
| **Gradient boosting (chosen)** | **0.958** | **0.839** | **0.598** | **0.0309** |

Held-out check on the near-habitat Saffire IV-VI burns (left out of training):

| Burn | Real outcome | Predicted chance of burning |
|---|---|---|
| IV-1 SIBAL, 22 % O2, 0.99 atm | burned | 0.99 ✅ |
| VI-2 SIBAL, 31 % O2, 0.53 atm | burned | 0.99 ✅ |
| VI-3 PMMA 10 mm, 30 % O2, 0.54 atm | burned | 0.91 ✅ |
| VI-4 PMMA 5 mm, 29 % O2, 0.54 atm | burned | 0.85 ✅ |
| VI-1 Nomex, ~31 % O2, 0.53 atm | did not ignite | 0.03 ✅ |
| V-2 cotton (only 1 cotton test), 26 % O2, 0.70 atm | burned | 0.00 ❌ |

5 of 6 correct; the pressure constraint fixed the Nomex case. Materials with fewer than 12 rows (cotton, Nomex,
silicone) are still **not modelled**: only PMMA, SIBAL and wax get a number.

**How it decides.** Permutation importance (drop in ROC-AUC when one input is scrambled, bagged ensemble):

| Input | ROC-AUC drop |
|---|---|
| Air speed | 0.215 |
| Material | 0.051 |
| Oxygen | 0.022 |
| Shape | 0.007 |
| Pressure | 0.003 |
| Flow direction | -0.000 |

Air speed dominates (the low-flow and blow-off limits), then material. Oxygen and pressure vary little in the data
(most tests are cabin air), which is why their direction is fixed by physics rather than left to the data.
Glass-box companion (logistic regression): **+1 % O2 multiplies the odds of sustained burning by 1.54**;
+0.1 atm by 2.27. Effect curves per material: `A_effect_curves.csv`.

Habitat (30 % O2, 0.69 atm) vs Earth cabin (21 %, 1 atm), P(sustained):

| Material | Air speed | Habitat | Earth cabin |
|---|---|---|---|
| PMMA slab, opposed | 20 cm/s | 0.97 (0.87-1.00), outside tested range (extrapolation) | 0.85 (0.80-1.00), inside tested range |
| SIBAL fabric, concurrent | 20 cm/s | 0.99 (0.97-1.00), inside tested range | 0.99 (0.98-1.00), inside tested range |
| Wax candle | 10 cm/s | 0.92 (0.45-1.00), outside tested range (extrapolation) | 0.99 (0.92-1.00), inside tested range |

## D. Gas flames in still air: how long until the flame goes out by itself? (`D_gas_flames.joblib`)
Weibull accelerated-failure-time survival model (ACME CFI-G, 132 ignited flames; 30 were still burning
when the fuel was cut and count as "burned at least this long"). Inputs: O2, pressure, fuel flow, fuel dilution,
fuel. Leave-one-operations-day-out concordance **0.753** (11 days).

**How it decides.** The model is a product of factors: each multiplies the burn time.

| Change | Burn-time multiplier | 95 % interval |
|---|---|---|
| +1 % oxygen | ×1.17 | 1.15-1.19 |
| +0.1 atm pressure | ×0.97 | 0.95-0.99 |
| double the fuel flow | ×0.65 | 0.52-0.80 |
| +10 % fuel in the fuel stream | ×1.04 | 0.98-1.11 |
| propane instead of ethane | ×0.60 | 0.41-0.88 |
| n-butane instead of ethane | ×0.65 | 0.46-0.93 |

From 21 % to 30 % O2: ×1.17⁹ = **×4.1**; the habitat's lower pressure (1 → 0.69 atm) adds ×1.11, for
**about ×4.6 overall**. More fuel flow shortens the burn, consistent with radiative extinction of
larger microgravity flames.

| Atmosphere (propane 30 % in N2, 1 mg/s) | Median burn | Still burning at 30 s |
|---|---|---|
| Earth cabin, 21 % O2, 1 atm | 5.5 s | 0% |
| **Habitat, 30 % O2, 0.69 atm** | **25.1 s** | **41%** |
| 34 % O2, 0.69 atm | 47.1 s | 69% |

⚠ No CFI-G tests lie between 24 % and 33 % O2: the habitat value is interpolated and labelled as such.

## C. Droplets: burning rate and extinction size (`C_droplets.joblib`)
Gaussian process regression (FLEX + PSI-117 experiments), anisotropic RBF + noise kernel.

| Target | 5-fold R² | 5-fold MAE | Mean |
|---|---|---|---|
| Burning rate K | 0.696 | 0.047 mm²/s | 0.502 mm²/s |
| Extinction diameter | 0.901 | 0.225 mm | 2.129 mm |

Leaving a whole fuel out raises the error: not for fuels the model has not seen.

**How it decides.** Input relevance from the learned length scales (share across physical inputs):

| Input | Burning rate | Extinction size |
|---|---|---|
| Oxygen | 25% | 45% |
| Pressure (log) | 1% | 10% |
| Droplet size | 32% | 29% |
| CO2 added | 30% | 10% |
| Helium added | 13% | 6% |

Oxygen drives when the flame goes out; droplet size, CO2 and oxygen drive how fast it burns; pressure matters little
in the tested range. **Suppressant (CO2, He) tests only go up to 25% O2**: suppression at
habitat oxygen is untested, and queries with a suppressant at 30 % O2 are labelled outside the tested range.

3 mm droplets, no suppressant (habitat point is inside the FLEX test range):

| Fuel | Burning rate, habitat | Burning rate, Earth cabin | Extinction diameter, habitat | Extinction diameter, Earth cabin |
|---|---|---|---|---|
| Methanol | 0.652 ± 0.064 | 0.495 ± 0.063 | 0.583 ± 0.31 mm | 1.344 ± 0.249 mm |
| n-Heptane | 0.746 ± 0.064 | 0.538 ± 0.062 | 1.64 ± 1.037 mm | 1.39 ± 0.248 mm |

## What the three models agree on
At habitat conditions every fire type burns **faster and longer** than in Earth cabin air: solids that burn on Earth
keep burning, still-air gas flames last about 4.6 times longer, and droplet flames burn 30-40 % faster. The models
are screening tools; their uncertainty and applicability labels show where new experiments are needed.
