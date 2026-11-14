# Phase 1 status: data layer

Built 2026-11-14 04:52. 14 of 25 in-scope investigations loaded; 1517 tests and 10107 values in the merged tables.

| psi_id | acronym | priority_tier | data_status | state | tests | evidence | high_issues | schema |
|---|---|---|---|---|---|---|---|---|
| PSI-142 | Cool-flame counterflow (FLEX) | 2 | not requested | catalog only (no files) | 0 | 0 | 0 |  |
| PSI-115 | SAME smoke model | 2 | not requested | catalog only (no files) | 0 | 0 | 0 |  |
| PSI-60 | SPICE soot analysis | 2 | not requested | catalog only (no files) | 0 | 0 | 0 |  |
| PSI-62 | BASS flame-spread model | 2 | catalog only (model; metadata only) | catalog only (no files) | 0 | 0 | 0 |  |
| PSI-21 | ACME CLD Flame | 3 | not requested | catalog only (no files) | 0 | 0 | 0 |  |
| PSI-10 | ACME Flame Design | 3 | not requested | catalog only (no files) | 0 | 0 | 0 |  |
| PSI-23 | ACME s-Flame | 3 | not requested | catalog only (no files) | 0 | 0 | 0 |  |
| PSI-22 | ACME E-FIELD Flames | 3 | not requested | catalog only (no files) | 0 | 0 | 0 |  |
| PSI-?? | ? | ? | unknown | catalog only (no files) | 0 | 0 | 0 |  |
| PSI-68 | FLEX-2 | 1 | catalog only (per-test data not downloaded) | catalog only (page text saved; no per-test table) | 0 | 0 | 0 |  |
| PSI-106 | SLICE | 3 | catalog only | catalog only (page text saved; no per-test table) | 0 | 0 | 0 |  |
| PSI-25 | BASS-II | 1 | loaded | loaded | 129 | 309 | 0 | OK |
| PSI-99 | Saffire-II | 1 | loaded | loaded | 19 | 19 | 0 | OK |
| PSI-20 | ACME BRE | 1 | loaded | loaded | 43 | 18 | 1 | OK |
| PSI-69 | FLEX | 1 | loaded | loaded | 274 | 715 | 0 | OK |
| PSI-117 | Cool-flame CFD (FLEX) | 1 | loaded | loaded | 72 | 8581 | 5 | OK |
| PSI-101 | SAME-R | 1 | loaded | loaded | 109 | 0 | 1 | OK |
| PSI-159 | ACME CFI-G | 1 | loaded | loaded | 179 | 265 | 0 | OK |
| PSI-26 | BASS | 1 (bonus) | loaded | loaded | 110 | 138 | 0 | OK |
| PSI-98 | Saffire-I | 1 (bonus) | loaded | loaded | 4 | 6 | 2 | OK |
| PSI-100 | Saffire-III | 1 (bonus) | loaded | loaded | 4 | 6 | 2 | OK |
| PSI-102 | SAME | 1 (bonus) | loaded | loaded | 20 | 0 | 1 | OK |
| EXT-SAFFIRE-456 | Saffire IV-VI (external) | 1 (external) | loaded | loaded | 6 | 50 | 0 | OK |
| PSI-107 | SPICE | 2 | loaded | loaded | 469 | 0 | 1 | OK |
| PSI-39 | CFI | 2 (bonus) | loaded | loaded | 79 | 0 | 1 | OK |

## Condition coverage (data where loaded, catalog otherwise)

| psi_id | acronym | coverage_source | fuel_classes | o2_min | o2_max | p_min_atm | p_max_atm | tests |
|---|---|---|---|---|---|---|---|---|
| PSI-26 | BASS | data | solid | 0.159 | 0.227 | 0.97 | 1.01 | 110 |
| PSI-25 | BASS-II | data | solid | 0.136 | 0.222 |  |  | 129 |
| PSI-98 | Saffire-I | data | solid | 0.215 | 0.216 | 1.01 | 1.01 | 4 |
| PSI-99 | Saffire-II | data | solid | 0.215 | 0.221 | 1.02 | 1.02 | 19 |
| PSI-100 | Saffire-III | data | solid | 0.211 | 0.211 | 0.977 | 0.977 | 4 |
| PSI-20 | ACME BRE | data | emulated_solid | 0.21 | 0.4 |  |  | 43 |
| PSI-69 | FLEX | data | liquid | 0.12 | 0.34 | 0.693 | 3.05 | 274 |
| PSI-68 | FLEX-2 | catalog | liquid | 0.1 | 0.4 | 0.5 | 3 | 0 |
| PSI-39 | CFI | data | liquid | 0.17 | 0.21 | 0.5 | 5 | 79 |
| PSI-142 | Cool-flame counterflow (FLEX) | catalog | liquid |  |  |  |  | 0 |
| PSI-117 | Cool-flame CFD (FLEX) | data | liquid | 0.1 | 0.21 | 0.5 | 5 | 72 |
| PSI-102 | SAME | data | smoke_source | 0.21 | 0.21 | 1 | 1 | 20 |
| PSI-101 | SAME-R | data | smoke_source | 0.21 | 0.21 | 1 | 1 | 109 |
| PSI-115 | SAME smoke model | catalog | smoke_source |  |  |  |  | 0 |
| PSI-107 | SPICE | data | gas | 0.21 | 0.21 | 1 | 1 | 469 |
| PSI-60 | SPICE soot analysis | catalog | gas |  |  |  |  | 0 |
| PSI-106 | SLICE | catalog | gas | 0.21 | 0.21 | 1 | 1 | 0 |
| PSI-21 | ACME CLD Flame | catalog | gas |  |  |  |  | 0 |
| PSI-159 | ACME CFI-G | data | gas | 0.18 | 0.4 | 0.5 | 3 | 179 |
| PSI-10 | ACME Flame Design | catalog | gas |  |  |  |  | 0 |
| PSI-23 | ACME s-Flame | catalog | gas |  |  |  |  | 0 |
| PSI-22 | ACME E-FIELD Flames | catalog | gas |  |  |  |  | 0 |
| PSI-62 | BASS flame-spread model | catalog | solid |  |  |  |  | 0 |
| PSI-?? | ? | catalog |  |  |  |  |  | 0 |
| EXT-SAFFIRE-456 | Saffire IV-VI (external) | data | solid | 0.22 | 0.31 | 0.534 | 0.987 | 6 |
