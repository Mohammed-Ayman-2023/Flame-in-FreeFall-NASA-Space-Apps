# PSI-117: what the data show

Every number below is computed by `src/psi117/analysis.py` from the cleaned tables in `data/processed/`. 'Experiment' means ISS FLEX measurements digitized from the published figures; 'model' means the authors' detailed-chemistry droplet simulations.

## 1. n-heptane, 0.5 mm droplet, 5% ozone, 1 atm (simulation only)

* Ignition is the same in both cases: peak gas temperature reaches 1153 K at about 4.0 ms, then the flame settles into a cool flame.
* Cutting oxygen from 21% to 10% lowers the cool-flame temperature from 761 K to 700 K, lowers the burning rate from 0.348 to 0.268 mm²/s (-23%), pushes the flame out from 5.5 to 10.1 droplet diameters, and stretches burn-out from 0.81 s to 1.03 s.
* At 10% oxygen the cool flame oscillates: 10 cycles before burn-out, the temperature swing grows from 5 K to 88 K (+9.3 K per cycle) and the period lengthens from 0.054 s to 0.107 s. Temperature and flame standoff move in opposite directions (correlation of detrended signals -0.96). The 21% case shows 0 cycles at the same detection threshold.
* These match the authors' description (dissertation ch. 7): oscillations of ever-increasing amplitude, with temperature and standoff out of phase.

## 2. n-dodecane three-stage burning, 2.75 atm with 29% helium (experiment + model)

* The model passes through three stages: hot (1637 K average, 6.5 s), warm (969 K, 28.7 s) and cool (764 K, 2.5 s). The paper quotes about 970 K and 765 K for the warm and cool flames, which the cleaned data reproduce.
* Burning rate, measured vs model, averaged over the model's stage windows: hot 0.33 vs 0.29 mm²/s; warm 0.61 vs 0.59 mm²/s. The droplet-size history agrees well, as the paper states.
* Stage timing does not agree: the measured hot-flame diameter disappears and the cool-flame diameter appears at t/d0² ≈ 0.43 s/mm², while the model leaves its hot stage at 0.32. In the model's final window (t/d0² 1.74-1.86) the measured rate is 0.30 mm²/s against the model's 0.61; the paper notes the model's second stage is about twice the measured one.

## 3. Extinction diameters in air at 1 atm

* Cool-flame extinction diameter falls with carbon number. Measured means: n-heptane 1.19 mm, n-decane 1.05 mm, n-dodecane 0.45 mm. The model shows the same order (1.14, 0.73, 0.29 mm across its d0 range).
* For n-dodecane the model was run at the measured d0 values. It over-predicts hot-flame extinction diameter by 0.11-0.26 mm and under-predicts cool-flame extinction diameter by 0.17-0.28 mm (two of four tests recorded no cool-flame extinction).
* In the model, n-heptane and n-decane droplets of 3 mm burn to completion and 4 mm droplets extinguish, so the model's critical size lies between 3 and 4 mm. The smallest measured extinguishing droplets (3.34 mm n-heptane) fall inside that gap, so the data do not test it.

## 4. n-dodecane vs pressure

* Cool-flame extinction diameter drops steeply with pressure: measured 1.89 mm at 0.5 atm to 0.38 mm at 1.25 atm, and no cool-flame extinction recorded at 3 atm. Hot-flame extinction diameter barely moves (3.48-3.62 mm).
* Cool-flame burning rate rises with pressure as K ∝ P^0.20 (95% CI 0.17-0.23, R² 0.91, 19 tests); removing the two duplicate points gives 0.19. The model's exponent is flatter, 0.12 (0.04-0.19).
* The model is 10-16% too fast at 0.5-1.25 atm and within 4% at 3-5 atm.

## 5. Why this matters for spacecraft fire safety

* Cool flames keep a droplet burning after the visible flame is gone. In section 2 the measured hot flame is gone by t/d0² ≈ 0.43, yet the droplet keeps shrinking until 1.86: about 77% of its burn time with no hot flame for a hot-flame camera or sensor to see.
* Lower pressure makes cool-flame extinction happen at larger droplet sizes (section 4). Planned lunar habitats run below 1 atm, so this is the direction they move in, but these data stop at 0.5 atm and cover 21% oxygen only.
* None of these data are at elevated oxygen or in partial gravity. They cannot be extrapolated to a ~30% O2, 10.2 psi lunar habitat without saying so.

## Open questions (see data_quality.md)

1. Two column labels in the three-stage file look wrong (flame diameter vs ratio).
2. Whether 'Dext_CF_ErrorBar+/-' are absolute bounds or offsets.
3. Three data files listed in the ReadMe were not in the upload.
