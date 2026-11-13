"""PSI-102 SAME (Smoke and Aerosol Measurement Experiment), ISS glovebox, 2001-2008: smoke from overheated
Teflon, Kapton, silicone rubber, lampwick (cotton) and dibutyl phthalate (DBP); igniter heated 15-60 s,
~2 min smoke events, detector response + TEM particle sizes (TEM grids later found contaminated, see PSI-101).

Source: the PSI page's test matrix. It gives 4 conditions for Teflon (samples 1-4: air flow, target weight
loss rate, aging time) and says the other four materials used the 'same conditions as 1-4'. That template is
expanded to 4 x 5 = 20 condition rows (flagged as expanded). Conditions only; ISS cabin atmosphere assumed.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register

PSI = "PSI-102"
TABLE = "PSI-102_Experimental_table_from_page.tsv"


@register(PSI, required=[TABLE])
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    df = pd.read_csv(raw_dir / TABLE, sep="\t", dtype=str).fillna("")
    base = df[df["Air Flow (cm/s)"] != ""]
    others = [(r["Sample #"], r["Sample Material"].split(":")[0].strip())
              for _, r in df[df["Air Flow (cm/s)"] == ""].iterrows()]
    tests = []
    for mat_no, mat, expanded in [(None, "Teflon", False)] + [(n, m, True) for n, m in others]:
        for _, c in base.iterrows():
            flags = ["ISS cabin atmosphere assumed (~21 % O2, ~1 atm): not given", "conditions only (no results)"]
            if expanded:
                flags.append(f"conditions copied from Teflon sample {c['Sample #']} (page: 'same conditions as 1-4')")
            tests.append(dict(
                investigation_id=PSI, test_id=f"{PSI}:{mat.replace(' ', '_')}:c{c['Sample #']}", source_type="experiment",
                platform="ISS (MSG)", fuel=mat, fuel_class="smoke_source", geometry="heated sample (smoke generator)",
                pressure_atm=1.0, x_o2=0.21, diluent="N2 (cabin air)", flow_cm_s=float(c["Air Flow (cm/s)"]),
                flow_direction="through-flow", gravity_g=0.0, setup="SAME smoke generator (MSG) + far-field box",
                target_mass_loss_mg_min=float(c["Weight loss rate (mg/min)"]),
                net_aging_s=float(c["Aging Duration (minutes)"]) * 60,
                outcome_note="test-matrix condition", confidence="medium" if expanded else "high",
                flags="; ".join(flags), doi="10.60555/gd4k-8h62", source_file=TABLE))
    log.add("experimental_table", "medium", "template rows", "samples 5-8 say 'same conditions as 1-4'",
            "expanded to 4 conditions per material (flagged)")
    log.add("experimental_table", "high", "no results", "matrix only; TEM grids contaminated (per PSI-101 page)",
            "used for coverage/ranking only")
    return PluginResult(tests=pd.DataFrame(tests), evidence=pd.DataFrame(), issues=log.frame())
