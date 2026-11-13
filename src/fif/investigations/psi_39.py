"""PSI-39 CFI (Cool Flames Investigation): n-dodecane and n-dodecane/iso-dodecane droplets on the
ISS (CIR / MDCA) at 0.5-5 atm, 17-21 % O2, N2 with optional He dilution.

Source: the experimental table on the PSI page. It lists CONDITIONS ONLY (no droplet size, no
extinction diameter, no burning rate). Results for some of these runs appear as analysed data in
PSI-117 (n-dodecane extinction diameters vs pressure); the link by test number is not given.
Copy artefacts handled here: 8 rows repeated at the end of the paste, one row with a merged cell.
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register

PSI = "PSI-39"
TABLE = "PSI-39_Experimental_table_from_page.tsv"


def _fuel(text: str) -> tuple[str, str]:
    t = str(text).strip()
    m = re.match(r"\[(\.\d+)\]/\[(\.\d+)\]", t)
    if m:
        return f"n-dodecane/iso-dodecane {float(m.group(1)):.2f}/{float(m.group(2)):.2f}", "mixture"
    return ("n-dodecane", "pure") if t == "C12H26" else (t, "unknown")


@register(PSI, required=[TABLE])
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    lines = (raw_dir / TABLE).read_text(encoding="utf-8").splitlines()
    header = lines[0].split("\t")
    recs, fixes = [], []
    for i, l in enumerate(lines[1:], start=2):
        cells = l.split("\t")
        if len(cells) == len(header) - 1 and re.search(r"\d(Yes|No)$", cells[7]):  # '0No' merged cell
            m = re.match(r"(.*\d)(Yes|No)$", cells[7])
            cells = cells[:7] + [m.group(1), m.group(2)] + cells[8:]
            fixes.append(cells[0])
        cells = (cells + [""] * len(header))[:len(header)]
        recs.append(cells + [i])
    df = pd.DataFrame(recs, columns=header + ["source_line"])
    if fixes:
        log.add("experimental_table", "low", "merged cell", f"tests {fixes}: helium and fiber merged ('0No')",
                "split back into two cells")
    before = len(df)
    df = df.drop_duplicates(subset=header, keep="first")
    if len(df) < before:
        log.add("experimental_table", "low", "duplicate rows", f"{before - len(df)} rows repeated in the copy",
                "kept the first occurrence")
    log.add("experimental_table", "high", "no results", "table has conditions only: no droplet size, "
            "extinction diameter or burning rate", "tests usable for coverage/ranking, not as ML targets; "
            "results needed from Raw Data or papers (PSI-117 holds some)")
    tests = []
    for _, r in df.iterrows():
        flags = []
        p = float(re.match(r"[\d.]+", r["Pressure"]).group())
        o2, n2, he = float(r["Oxygen"]), float(r["Nitrogen"]), float(r["Helium"])
        if abs(o2 + n2 + he - 1) > 0.02:
            flags.append(f"composition sums to {o2 + n2 + he:.2f} (N2 {n2})")
            log.add("experimental_table", "low", "composition", f"test {r['Flex Number']}: O2+N2+He = {o2+n2+he:.2f}",
                    "kept as given")
        fiber = {"Yes": "fiber-supported", "No": "free (needle-deployed)"}.get(r["Fiber"].strip(), None)
        if fiber is None:
            flags.append("fiber column blank")
        if "xx" in r["Local Time"]:
            flags.append("time partly missing")
        fuel, kind = _fuel(r["Fuel"])
        tests.append(dict(
            investigation_id=PSI, test_id=f"{PSI}:{r['Flex Number']}", source_type="experiment",
            platform="ISS-CIR (MDCA)", fuel=fuel, fuel_class="liquid",
            geometry=f"droplet ({fiber})" if fiber else "droplet", size_mm=None, pressure_atm=p, x_o2=o2,
            x_n2=n2, x_he=he, diluent="N2 + He" if he > 0 else "N2", x_diluent_other=he,
            suppressant="He" if he > 0 else "none", flow_cm_s=0.0, flow_direction="none", gravity_g=0.0,
            setup="CFI droplet (CIR/MDCA)", identifier=r["CIR"], test_date=r["Test Date"], fiber=fiber,
            outcome_note="conditions only (results not in table)", confidence="medium" if flags else "high",
            flags="; ".join(flags), doi="10.60555/m6pj-a914", source_file=TABLE))
    return PluginResult(tests=pd.DataFrame(tests), evidence=pd.DataFrame(), issues=log.frame(),
                        notes=f"{len(tests)} tests, conditions only")
