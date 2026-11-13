"""PSI-101 SAME-R (Smoke Aerosol Measurement Experiment - Reflight): smoke from HEATED (pyrolysing /
smouldering, not flaming) Kapton, silicone, lampwick (cotton), Teflon and Pyrell foam on the ISS, Jul-Sep
2010. Smoke droplet size vs. gravity matters because larger micro-g smoke particles can fool smoke detectors.

Source: the PSI page's experimental table. CONDITIONS ONLY (no particle sizes): inlet velocity (cm/s),
heater resistance ratio Rt/R0 (a proxy for heating temperature), heating duration and aging/mixing times.
Rows with an 'a' suffix are the same smoke sample re-measured after further aging. Atmosphere is the ISS
cabin (not varied, not given): ~21 % O2, ~1 atm. Fuel class 'smoke_source': not used in the flame models.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register

PSI = "PSI-101"
TABLE = "PSI-101_Experimental_table_from_page.tsv"
MONTHS = {"Jul": 7, "Aug": 8, "Sep": 9}


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


@register(PSI, required=[TABLE])
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    df = pd.read_csv(raw_dir / TABLE, sep="\t", dtype=str).fillna("")
    df = df[df["Sample Type"] != "Sample Type"]
    tests = []
    for i, r in df.iterrows():
        flags = ["ISS cabin atmosphere assumed (~21 % O2, ~1 atm): not given", "conditions only (no particle sizes)"]
        num = r["SAME Test #"].strip()
        mat = r["Sample Type"].strip()
        rt = _num(r["Rt/R0"])
        if mat == "Teflon" and num == "57":
            flags.append("Teflon row repeats Lampwick test 57 (same Rt/R0 1.253, Teflon runs at ~1.445): likely copy "
                         "error on the page; excluded")
            log.add("experimental_table", "medium", "duplicate test number", "test 57 listed under Lampwick and Teflon",
                    "kept Lampwick, flagged Teflon row (ready=false)")
        aged = num.endswith("a")
        day, mon = r["Date"].split("-")
        if "n/a" in r["Net aging time (sec)"]:
            flags.append("net aging time n/a")
        tests.append(dict(
            investigation_id=PSI, test_id=f"{PSI}:{mat}:{num}", source_type="experiment", platform="ISS (MSG)",
            fuel=mat, fuel_class="smoke_source", geometry="heated sample (smoke generator)", size_mm=None,
            pressure_atm=1.0, x_o2=0.21, diluent="N2 (cabin air)", flow_cm_s=_num(r["Inlet velocity (cm/s)"]),
            flow_direction="through-flow", gravity_g=0.0, setup="SAME smoke generator + diagnostics",
            test_date=f"2010-{MONTHS[mon]:02d}-{int(day):02d}", heater_rt_r0=rt,
            heating_duration_s=_num(r["Duration (sec)"]), primary_aging_s=_num(r["Primary aging time (sec)"]),
            primary_mixing_s=_num(r["Primary mixing time (sec)"]), net_aging_s=_num(r["Net aging time (sec)"]),
            parent_test=f"{PSI}:{mat}:{num[:-1]}" if aged else None,
            outcome_note=r["Description"].strip(), confidence="medium" if len(flags) > 2 else "high",
            exclude=(mat == "Teflon" and num == "57"),
            flags="; ".join(flags), doi="10.60555/2np7-jv14", source_file=TABLE, source_line=i + 2))
    log.add("experimental_table", "high", "no results", "particle size distributions are in the 5.87 GB raw data",
            "used for coverage/ranking only")
    t = pd.DataFrame(tests)
    return PluginResult(tests=t, evidence=pd.DataFrame(), issues=log.frame())
