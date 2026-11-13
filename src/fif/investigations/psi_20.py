"""PSI-20 ACME BRE (Burning Rate Emulator): gaseous CH4 / C2H4 (pure or 50 % in N2) fed through
25 or 50 mm porous burners on the ISS to EMULATE burning solids, in QUIESCENT air (no flow), at the
spacecraft atmospheres NASA is considering: 14.7 psia / 21 %, 10.2 psia / 26.5 %, 8.2 psia / 34 % O2.

Source: the PSI page's summary table, ONE ROW PER OPERATIONS DAY, not per flame. It lists the O2
levels at which flames ignited that day and how many flames ignited; chamber pressure varied but is
not given. So each (day, O2 level) becomes one condition row with no per-flame outcome: usable for
coverage and ranking, not as an ML label. Key published finding (page, Research Impacts): quasi-steady
burning with NO air flow in elevated O2, while 21 % O2 flames self-extinguished quickly.
Fixes: '3400%' / '2100%' are spreadsheet percent-format artefacts for 34 / 21.
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register

PSI = "PSI-20"
TABLE = "PSI-20_Experimental_table_from_page.tsv"
MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sept",
                                      "Oct", "Nov", "Dec"], start=1)}
# NASA spacecraft atmospheres named in the objectives: O2 % -> pressure (psia)
NAMED_ATM = {21.0: 14.7, 26.5: 10.2, 34.0: 8.2}
PSI_TO_ATM = 1 / 14.696


def _o2_levels(text: str) -> tuple[list[float], bool]:
    t = str(text).strip()
    m = re.fullmatch(r"(\d{2})00%", t)
    if m:
        return [float(m.group(1))], True
    return [float(x) for x in re.split(r"[;,]\s*", t) if x.strip()], False


@register(PSI, required=[TABLE])
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    df = pd.read_csv(raw_dir / TABLE, sep="\t", dtype=str).fillna("")
    tests, ev, fixed = [], [], []
    for i, r in df.iterrows():
        date = f"{r['Year']}-{MONTHS[r['Month']]:02d}-{int(r['Date']):02d}"
        levels, was_fixed = _o2_levels(r["Oxygen Conc (percent)"])
        if was_fixed:
            fixed.append(date)
        bottle = re.sub(r"%\s*", "% ", r["Fuel Bottle"]).strip()
        gas = "CH4" if "CH4" in bottle else "C2H4"
        fuel = f"{gas} (pure)" if bottle.startswith("100") else f"{gas} 50% in N2"
        n_ign = int(r["Flames Ignited"])
        for o2 in levels:
            flags = ["session summary row (one per ops day); per-flame outcome not in table",
                     "chamber pressure varied but not given in the table"]
            p_atm = None
            if o2 in NAMED_ATM:
                flags.append(f"{o2:g} % O2 is a named NASA atmosphere ({NAMED_ATM[o2]} psia) in the objectives; "
                             "pressure NOT confirmed for this day")
            if was_fixed:
                flags.append(f"O2 '{r['Oxygen Conc (percent)']}' read as {o2:g} % (percent-format artefact)")
            tid = f"{PSI}:{date}:O2-{o2:g}"
            tests.append(dict(
                investigation_id=PSI, test_id=tid, source_type="experiment", platform="ISS-CIR (ACME)",
                fuel=fuel, fuel_class="emulated_solid", geometry=f"porous burner {r['Burner Size (mm)']} mm",
                size_mm=float(r["Burner Size (mm)"]), pressure_atm=p_atm, x_o2=o2 / 100, diluent="N2",
                flow_cm_s=0.0, flow_direction="none (quiescent)", gravity_g=0.0, setup="BRE porous burner (ACME/CIR)",
                test_date=date, ignited=True if n_ign > 0 else None,
                outcome_note=(f"{n_ign} flames ignited on {date} across O2 levels {r['Oxygen Conc (percent)']}"
                              if n_ign else "no flames ignited that day"),
                confidence="medium", flags="; ".join(flags), doi="10.60555/vb93-3y72", source_file=TABLE))
        ev.append(dict(investigation_id=PSI, test_id=tests[-1]["test_id"], dataset_id="bre_sessions",
                       source_type="experiment", quantity="flames_ignited_in_session", unit="count", value=float(n_ign),
                       status="session total (all O2 levels that day)", source_file=TABLE, source_line=i + 2))
    if fixed:
        log.add("experimental_table", "low", "percent format", f"days {fixed}: O2 written as '3400%'/'2100%'",
                "read as 34 / 21 %")
    log.add("experimental_table", "high", "no per-flame results", "one row per day; pressure not given",
            "used for coverage/ranking only; not an ML label")
    log.add("page", "low", "key finding", "elevated-O2 flames burned quasi-steadily with no air flow; "
            "21 % O2 flames self-extinguished (Research Impacts)", "carried into catalog notes and ranking")
    return PluginResult(tests=pd.DataFrame(tests), evidence=pd.DataFrame(ev), issues=log.frame())
