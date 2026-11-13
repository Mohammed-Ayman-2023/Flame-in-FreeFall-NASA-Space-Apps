# Data dictionary

## Output files (data/processed/)

* `catalog.csv`: 9 rows, 17 columns
* `heptane_cool_flame_sim.csv`: 883 rows, 24 columns
* `c12_three_stage_expt.csv`: 1298 rows, 13 columns
* `c12_three_stage_sim.csv`: 570 rows, 14 columns
* `c12_three_stage_sim_radiance.csv`: 72 rows, 4 columns
* `alkane_extinction_1atm.csv`: 33 rows, 14 columns
* `c12_extinction_vs_pressure.csv`: 31 rows, 9 columns
* `c12_cool_flame_kavg_vs_pressure.csv`: 25 rows, 7 columns
* `psi117_tidy_long.csv`: 8581 rows, 22 columns
* `results_heptane_quasi_steady.csv`: 2 rows, 9 columns
* `results_heptane_oscillation_peaks.csv`: 10 rows, 6 columns
* `results_c12_model_stages.csv`: 3 rows, 10 columns
* `results_c12_expt_burning_rate.csv`: 166 rows, 4 columns
* `results_c12_k_by_stage.csv`: 3 rows, 5 columns
* `results_extinction_summary.csv`: 6 rows, 9 columns
* `results_extinction_threshold.csv`: 3 rows, 4 columns
* `results_c12_matched_extinction.csv`: 4 rows, 8 columns
* `results_kavg_powerlaw_fits.csv`: 3 rows, 7 columns
* `results_kavg_by_pressure.csv`: 7 rows, 6 columns
* `results_dext_by_pressure.csv`: 5 rows, 7 columns
* `data_quality_issues.csv`: 35 rows, 5 columns

## Columns

| column | meaning |
|---|---|
| `dataset_id` | which PSI-117 file the row comes from |
| `source_type` | experiment (ISS FLEX measurement, digitized) or simulation (model output) |
| `case` | n-heptane only: stable (21% O2) or oscillatory (10% O2) |
| `quantity` | what the value measures; '(interpreted)' marks a reinterpreted column label |
| `value` | the number; never altered from the raw file except where status says otherwise |
| `x_name / x_value / x_unit` | the independent variable (time, t/d0², d0 or pressure) |
| `status` | ok, or why the value is set aside (not_detected, duplicate, no_extinction_recorded, ...) |
| `d0_mm_condition, pressure_atm_condition` | test conditions from the corrected catalog |
| `x_o2, x_n2, x_he, x_o3` | ambient mole fractions (sum to 1) |
| `t_ambient_k` | ambient temperature |
| `doi, figure` | paper and figure the data reproduce |
| `source_file, source_line` | raw file and 1-based line number, for tracing any value back |
| `t_over_d02_s_mm2` | time divided by initial diameter squared (s/mm²) |
| `d2_over_d02` | (D/D0)², normalised droplet surface area |
| `k_mm2_s` | burning rate K = -d(D²)/dt |
| `tmax_k` | peak gas-phase temperature anywhere around the droplet |
| `d_tmax_over_d` | radius of peak temperature over droplet radius = flame standoff ratio |
| `*_masked` | same column with values hidden where D/D0 < 0.1 (ratio diverges) |
| `stage` | model stage from tmax_k: hot >= 1200 K, warm 870-1200 K, cool < 870 K |
