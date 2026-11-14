# Flame in Freefall: dataset v1 (frozen 2026-11-13 23:30 Cairo)

**1,517 test rows, 10,107 evidence rows, 101 logged issues, 14 sources** (13 PSI investigations + 1 external NASA literature set).
Raw files are never edited; every correction is made in a loader and logged in `data/processed/issues.csv`. Every row carries source_file, flags and confidence.

## Sources
| investigation_id   | acronym                  | fuel_class     |   tests |   evidence_rows |   o2_min |   o2_max |   p_min |   p_max |
|:-------------------|:-------------------------|:---------------|--------:|----------------:|---------:|---------:|--------:|--------:|
| EXT-SAFFIRE-456    | Saffire IV-VI (external) | solid          |       6 |              50 |    0.22  |    0.31  |   0.534 |   0.987 |
| PSI-100            | Saffire-III              | solid          |       4 |               6 |    0.211 |    0.211 |   0.977 |   0.977 |
| PSI-101            | SAME-R                   | smoke_source   |     109 |               0 |    0.21  |    0.21  |   1     |   1     |
| PSI-102            | SAME                     | smoke_source   |      20 |               0 |    0.21  |    0.21  |   1     |   1     |
| PSI-107            | SPICE                    | gas            |     469 |               0 |    0.21  |    0.21  |   1     |   1     |
| PSI-117            | Cool-flame CFD (FLEX)    | liquid         |      72 |            8581 |    0.1   |    0.21  |   0.5   |   5     |
| PSI-159            | ACME CFI-G               | gas            |     179 |             265 |    0.18  |    0.4   |   0.5   |   3     |
| PSI-20             | ACME BRE                 | emulated_solid |      43 |              18 |    0.21  |    0.4   | nan     | nan     |
| PSI-25             | BASS-II                  | solid          |     129 |             309 |    0.136 |    0.222 | nan     | nan     |
| PSI-26             | BASS                     | solid          |     110 |             138 |    0.159 |    0.227 |   0.97  |   1.009 |
| PSI-39             | CFI                      | liquid         |      79 |               0 |    0.17  |    0.21  |   0.5   |   5     |
| PSI-69             | FLEX                     | liquid         |     274 |             715 |    0.12  |    0.34  |   0.692 |   3.052 |
| PSI-98             | Saffire-I                | solid          |       4 |               6 |    0.215 |    0.216 |   1.007 |   1.007 |
| PSI-99             | Saffire-II               | solid          |      19 |              19 |    0.215 |    0.221 |   1.016 |   1.016 |

Catalog only (no per-test data loaded): PSI-68 FLEX-2, PSI-106 SLICE, PSI-62, PSI-142, PSI-115, PSI-60, PSI-10, PSI-21, PSI-22, PSI-23.

## ML tables (ml/v1/)
| Table | Question | Rows | Ready | Target |
|---|---|---|---|---|
| A_solids_flammability | Does a solid keep burning at this O2 / pressure / air speed? | 431 | 414 (23 flame-outs) | flame_sustained (0/1); group by test_id |
| B_solids_spread | How fast does flame spread over a thin fabric? | 10 | 10 | spread_rate_mm_s (descriptive only) |
| C_droplets | Fuel droplet burning rate / extinction size | 308 | 299 | burning_rate, extinction_diameter |
| D_gas_flames | Does a still-air gas flame ignite, and how long does it burn? | 179 | 172 ignition / 132 burn time | hot_ignition; burn_time_s with self_extinguished as event flag |

## Key findings carried into the ranking
- Still-air flames: at <=25% O2 all 41 ACME CFI-G flames self-extinguished (median 8 s); at 33-40% O2 median 50 s and 30/91 still burning when fuel was cut (incl. 0.5 atm). ACME BRE reports the same: elevated-O2 emulated solids kept burning with no air flow.
- Saffire IV-VI (external, NTRS 20240002981): SIBAL, cotton and PMMA all burned at 26-31% O2 and 0.53-0.70 atm; Nomex did not ignite. PMMA raised cabin CO2 by ~8,100-8,500 ppm and CO by ~310-320 ppm.
- Spread rate of the same fabric depends on duct size (1.8-5.1 mm/s): enclosure geometry matters, not only atmosphere.
- Smoke detection (SAME, SAME-R, SPICE): 86 smoke tests + 469 soot-point settings, all in 21% O2 / 1 atm. None at habitat conditions.

## Known limits
- No PSI solid-fuel burn above 22% O2; the solids within ±5 % O2 and ±0.2 atm of the habitat are 5 external Saffire V-VI burns (incl. the Nomex that did not ignite).
- Pressure for BASS-II rows is 1 atm (same MSG; BASS measured 0.97-1.01 atm). Saffire I-III cabin pressure from Olson et al. Table 1.
- 5 BASS "no ignition" rows excluded as hardware/sample problems (exclude_reason column). 7 CFI-G igniter-voltage trials excluded.
- Smoke/soot investigations are conditions only (results are in raw data not downloaded).

## AI usage (NASA Space Apps declaration)
The loaders and build code that produced these tables were written with AI assistance (Claude, Anthropic) and run
and reviewed by the author. Values transcribed from paper tables were read with AI assistance and verified against
the original PDFs where marked "VERIFIED" in each transcription file's header; flame-out labels were spot-checked
against the original notes (qa/). No data values are AI-generated: every value comes from NASA PSI or a cited paper.
