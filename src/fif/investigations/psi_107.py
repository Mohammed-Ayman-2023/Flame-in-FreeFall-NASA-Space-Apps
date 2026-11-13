"""PSI-107 SPICE (Smoke Point In Co-flow Experiment): laminar gas jet flames (methane, ethylene, propane,
propylene, 50/75 % propylene in N2) from 0.41 / 0.76 / 1.6 mm nozzles in co-flowing air, ISS glovebox (cabin air).
Purpose: SOOT / smoke point, i.e. when a flame starts releasing smoke (relevant to smoke production and detection).

Source: the PSI page table, pasted in five parts. CONDITIONS ONLY (no flame length or smoke-point flag):
one row per fuel-flow setting within a flame run (same ignition time = same run). Cleaning: times written with
dots or as 'Ku LOS'/'no ku'/'LOS'/'n/a' (lost video link) kept as text; rows with blank fuel rate flagged;
negative co-flow readings (-0.28, -5.92) flagged as no co-flow (sensor offset).
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register

PSI = "PSI-107"
PARTS = [f"PSI-107_table_part{i}.tsv" for i in range(1, 6)]


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


@register(PSI, required=PARTS)
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    tests, k = [], 0
    for part in PARTS:
        for n, line in enumerate((raw_dir / part).read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip() or line.startswith("GMT date"):
                continue
            c = (line.split("\t") + [""] * 9)[:9]
            k += 1
            flags = ["ISS cabin atmosphere assumed (~21 % O2, ~1 atm)", "conditions only (smoke point / flame length not in table)"]
            fuel = re.sub(r"\s*%\s*", "% ", " ".join(c[3].split()))
            mdot, air = _f(c[6]), _f(c[8])
            if mdot in (None, 0.0):
                flags.append("fuel rate blank/zero (lost data or no flame)")
            if air is not None and air < 0:
                flags.append(f"co-flow {air} cm/s read as ~0 (sensor offset)")
            if any(s in (c[1] + c[2]).upper() for s in ("LOS", "KU", "N/A")) or not c[2].strip():
                flags.append("ignition/flame-off time missing (video link loss)")
            run = f"day{c[0]}_{c[1].replace('.', ':').strip()}"
            tests.append(dict(
                investigation_id=PSI, test_id=f"{PSI}:{k:04d}", source_type="experiment", platform="ISS (MSG)",
                fuel=fuel.strip(), fuel_class="gas", geometry=f"round jet nozzle {float(c[4]):.2f} mm",
                size_mm=_f(c[4]), pressure_atm=1.0, x_o2=0.21, diluent="N2 (cabin air)",
                flow_cm_s=max(air, 0.0) if air is not None else None, flow_direction="co-flow", gravity_g=0.0,
                setup="SPICE co-flow duct (MSG)", fuel_flow_mg_s=mdot, hc_fuel_flow_mg_s=_f(c[7]),
                fuel_flow_sccm=_f(c[5]), test_date=f"GMT day {c[0]}", run_id=run,
                outcome_note=f"ignition {c[1]} / off {c[2]}", confidence="medium" if len(flags) > 2 else "high",
                flags="; ".join(flags), doi="10.60555/9kbh-e962", source_file=part, source_line=n))
    t = pd.DataFrame(tests)
    log.add("table", "medium", "row count", f"{len(t)} rows pasted; page says 526 flames studied",
            "rows are fuel-flow settings within runs; any missing rows do not change coverage")
    log.add("table", "high", "no results", "smoke point and flame length not in the table", "coverage/ranking only")
    return PluginResult(tests=t, evidence=pd.DataFrame(), issues=log.frame())
