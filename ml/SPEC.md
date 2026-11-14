# ML dataset spec (v1, frozen 2026-11-13 23:30 Cairo)

Built by `python scripts/build_data.py && python scripts/build_ml.py` from the raw PSI files.
Every row traces back to a raw file (source_file) and keeps its quality flags.

## A_solids_flammability.csv: "is a flame sustained?" (classification)
One row = one observed condition on a solid sample in microgravity.
* BASS-II (PSI-25): every air-speed step at which the flame was burning (label 1), plus extinction /
  blow-off speeds converted with the fan calibration (label 0). Limits known only as an upper bound
  are NOT used as labels.
* BASS (PSI-26): air-speed steps with a flame (1) and flame-outs / no ignition from the run notes (0).
  "No ignition" caused by igniter or sample problems is kept but excluded (`exclude_reason`, see qa/).
* Saffire I-III (PSI-98/99/100): each flight burn; label = burned (partial or complete) vs did not burn.
* Saffire IV-VI (EXT-SAFFIRE-456, external NASA literature): 5 burns at 22-31 % O2 and 0.53-0.99 atm + Nomex
  that did not ignite. The only solids near habitat conditions.

| column | meaning | unit |
|---|---|---|
| material_family | PMMA, cotton-fiberglass (SIBAL), cotton, silicone, Nomex, Ultem, wax | - |
| geometry_class | thin sheet, thick slab, rod, sphere, fabric sheet, candle | - |
| size_mm | thickness (sheets, slabs) or diameter (rods, spheres) | mm |
| pmma_colour | clear / black (PMMA rods) | - |
| x_o2 | oxygen mole fraction | 0-1 |
| pressure_atm (+ pressure_source) | reported where known (BASS as-run, Saffire cabin, Saffire IV-VI); else 1 atm assumed and flagged | atm |
| p_o2_atm | O2 partial pressure = x_o2 x pressure | atm |
| flow_cm_s | forced air speed | cm/s |
| flow_direction | concurrent / opposed | - |
| setup | hardware (BASS-II wind tunnel, Saffire duct): different hardware gives different numbers | - |
| **flame_sustained** | TARGET: 1 burning, 0 extinguished / blew off / did not burn | 0/1 |
| label_type, label_source | how the label was obtained, and from which file/cell | - |
| group_id | test id: cross-validation must keep a test's rows together | - |
| ready_for_model | all required inputs present (material, geometry, O2, flow, direction) and not excluded | bool |
| exclude_reason | why a row is kept but not used (e.g. igniter failure) | - |

## B_solids_spread.csv: flame spread rate (regression)
One row = one microgravity burn with a measured spread rate: Saffire I-III (6), Saffire IV-V (2, from
Olson et al. Table 1) and BASS (2, same table). Target **spread_rate_mm_s** (mm/s). 10 rows: descriptive only.
Spread rate of the same fabric depends on duct size (1.8-5.1 mm/s), which is not a column.

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

## D_gas_flames.csv: still-air gas flames (classification + censored regression)
One row = one ACME CFI-G (PSI-159) test: spherical porous-burner diffusion flame, quiescent chamber.

| column | meaning | unit |
|---|---|---|
| fuel, fuel_family | ethane / propane / n-butane, pure or diluted | - |
| fuel_mole_fraction, fuel_flow_mg_s | fuel stream composition and flow | -, mg/s |
| x_o2 (x_o2_final) | O2 before (after) the test; O2 is consumed in the closed chamber | mole fraction |
| pressure_atm, p_o2_atm | pressure (table column labelled bar converted) | atm |
| t_adiabatic_k, z_st | adiabatic flame temperature, stoichiometric mixture fraction (from the table) | K, - |
| **hot_ignition** | TARGET: flame ignited (1/0); igniter-voltage trials excluded | 0/1 |
| **burn_time_s** + **self_extinguished** | TARGET: burn time; self_extinguished = 0 means the fuel was cut while still burning, so burn_time_s is a lower bound (right-censored) | s, 0/1 |
| ready_ignition, ready_burn_time | rows usable for each target | bool |

## Rules
1. Never fill a missing input with an average. Missing -> blank and ready_for_model = False.
2. Experiments and simulations are separate files.
3. Validate by leaving out whole tests (A) or whole investigations / test series (C, D), never random rows.
4. Keep O2 fraction AND pressure as inputs (not only partial pressure): the habitat (0.30 x 0.69 atm)
   has Earth-like O2 partial pressure but a higher O2 fraction.
5. External literature rows (source_kind) can be included or excluded; results must be reported both ways.

## Known limits of v1
* A is imbalanced (23 flame-outs in 414 ready rows). Only 5 solid burns lie within ±5 % O2 and ±0.2 atm of the habitat
  (external Saffire V-VI, including the Nomex that did not ignite); no PSI solid burn above 22 % O2. Models must report uncertainty and an applicability label.
* B has 10 rows: descriptive only.
* C covers 12-34 % O2 and 0.5-5 atm: the habitat point (30 %, 0.69 atm) is inside C's range (FLEX: 17 tests at 30-34 % O2, ~0.7 atm).
* D covers 18-40 % O2 at 0.5-3 atm but has no tests between 24 % and 33 % O2.
* Smoke / soot investigations (SAME, SAME-R, SPICE) are conditions only and are not in any ML table.
* Not loaded: FLEX-2 per-test results (PSI-68), SLICE (PSI-106, no per-test table).
