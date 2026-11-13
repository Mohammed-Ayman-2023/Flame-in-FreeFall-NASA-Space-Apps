# ML dataset spec (v0, built 2026-11-13)

Built by `python scripts/build_data.py && python scripts/build_ml.py` from the raw PSI files.
Every row traces back to a raw file (source_file) and keeps its quality flags.

## A_solids_flammability.csv: "is a flame sustained?" (classification)
One row = one observed condition on a solid sample in microgravity.
* BASS-II (PSI-25): every air-speed step at which the flame was burning (label 1), plus extinction /
  blow-off speeds converted with the fan calibration (label 0). Limits known only as an upper bound
  are NOT used as labels.
* Saffire I-III (PSI-98/99/100): each flight burn; label = burned (partial or complete) vs did not burn.

| column | meaning | unit |
|---|---|---|
| material_family | PMMA, cotton-fiberglass, silicone, Nomex, wax | - |
| geometry_class | thin sheet, thick slab, rod, sphere, fabric sheet, candle | - |
| size_mm | thickness (sheets, slabs) or diameter (rods, spheres) | mm |
| pmma_colour | clear / black (PMMA rods) | - |
| x_o2 | oxygen mole fraction | 0-1 |
| pressure_atm (+ pressure_source) | pressure; solids are all ~1 atm cabin air (assumed, flagged) | atm |
| p_o2_atm | O2 partial pressure = x_o2 x pressure | atm |
| flow_cm_s | forced air speed | cm/s |
| flow_direction | concurrent / opposed | - |
| setup | hardware (BASS-II wind tunnel, Saffire duct): different hardware gives different numbers | - |
| **flame_sustained** | TARGET: 1 burning, 0 extinguished / blew off / did not burn | 0/1 |
| label_type, label_source | how the label was obtained, and from which file/cell | - |
| group_id | test id: cross-validation must keep a test's rows together | - |
| ready_for_model | all required inputs present (material, geometry, O2, flow, direction) | bool |

## B_solids_spread.csv: flame spread rate (regression)
One row = one microgravity burn with a measured spread rate (Saffire I-III only so far: 6 rows).
Target **spread_rate_mm_s** (mm/s). Too small to train on; used descriptively until BASS/BASS-II spread
rates are added from papers.

## C_droplets.csv: droplet fires (regression + classification)
One row = one droplet experiment (FLEX PSI-69, PSI-117 experimental points). Simulation results are in
C_droplets_simulation.csv and are never mixed in.

| column | meaning | unit |
|---|---|---|
| fuel, fuel_family | methanol (alcohol), n-heptane / n-decane / n-dodecane (n-alkane) | - |
| d0_mm | initial droplet diameter | mm |
| x_o2, x_n2, x_co2, x_he | gas composition | mole fraction |
| pressure_atm, p_o2_atm | pressure and O2 partial pressure | atm |
| suppressant | none / CO2 / He | - |
| **extinction_diameter_mm**, **dext_over_d0** | TARGET: droplet size when the (hot) flame went out | mm, - |
| cool_extinction_diameter_mm | PSI-117: size when the cool flame went out | mm |
| **burning_rate_mm2_s** | TARGET: d-squared burning constant (FLEX unit read as mm2/s) | mm2/s |
| cool_flame_burning_rate_mm2_s | PSI-117 cool-flame burning rate (different regime) | mm2/s |
| burn_time_s | burn duration | s |
| end_state, **extinguished_flag** | TARGET: extinction (1) vs completion / disruption (0) | - |

## Rules
1. Never fill a missing input with an average. Missing -> blank and ready_for_model = False.
2. Experiments and simulations are separate files.
3. Validate by leaving out whole tests (A) or whole investigations / test series (C), never random rows.
4. Keep O2 fraction AND pressure as inputs (not only partial pressure): the habitat (0.30 x 0.69 atm)
   has Earth-like O2 partial pressure but a higher O2 fraction.

## Known limits of v0
* A is imbalanced (272 burning vs 16 extinguished rows) and all solids are ~1 atm and <= 22 % O2:
  the model cannot say anything reliable about 30 % O2 for solids -> this is a data gap, report it.
* C covers 12-34 % O2 and 0.5-5 atm: the habitat point (30 %, 0.69 atm) is INSIDE C's range.
* Pending sources: BASS (PSI-26) as-run matrix, FLEX-2 (PSI-68) per-test file, CFI (PSI-39) results.
