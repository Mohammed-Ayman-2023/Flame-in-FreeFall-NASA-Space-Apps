# QA: label spot-check

`spot_check_labels.csv` lists every "flame went out / no flame" label in the solids table (ml/v1/A) from BASS
(PSI-26) and BASS-II (PSI-25), plus 3 random "flame sustained" labels, each next to the original crew note or
test-matrix text it came from.

Result (reviewed against the notes, 2026-11-13): 26 of 31 labels confirmed. 5 BASS "no ignition" rows were
igniter or sample problems (bent or broken igniter, candle out of wax, sample popped loose), not evidence that
the material cannot burn. They stay in the table with `ready_for_model = False` and an `exclude_reason`.

Still to do by a human reviewer: tick `correct_yes_no` for any row you re-check and add a `comment`.
