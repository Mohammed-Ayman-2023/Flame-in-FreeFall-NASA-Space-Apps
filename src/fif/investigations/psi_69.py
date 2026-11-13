"""PSI-69 FLEX: 274 single-droplet burns (methanol, n-heptane) on the ISS (CIR / MDCA), in
O2/N2 with CO2 or He added as suppressant, at ~0.7, 1, 2 and 3 atm.

Source: the experimental table on the PSI page, copied in three parts (tests 1-100, 101-200, 201-274).
One row per test with conditions AND results: visible flame extinction diameter, burning rate,
burn time and how the test ended (Extinction / Disruption / Completion).

Header symbols lost in the export, read as follows (logged):
  'O' / 'N' / 'CO' / 'He' initial composition  -> O2, N2, CO2, He mole fractions
  'Burning rate; mm'                            -> mm^2/s (d-squared law burning constant)
Missing cells are written as the replacement character '?' in the export.
Extinction diameter 0 is stored as blank: the flame did not extinguish at a finite size.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register

PSI = "PSI-69"
PARTS = ["PSI-69_Experimental_table_part1.tsv", "PSI-69_Experimental_table_part2.tsv",
         "PSI-69_Experimental_table_part3.tsv"]
C = dict(test="FLEX Test #", ident="FLEX Identifier", fuel="Fuel", p="Ambient pressure; mmHg",
         o2="O initial ambient composition; mole fraction", n2="N initial ambient composition; mole fraction",
         co2="CO initial ambient composition; mole fraction", he="He initial ambient composition; mole fraction",
         d0="Droplet initial diameter; mm", dext="Visible flame extinction diameter; mm",
         k="Burning rate; mm", tb="Burn time; s", end="Test end")
MMHG_PER_ATM = 760.0


def _num(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None, ""
    s = str(v).strip()
    if s in {"", "�"}:
        return None, ""
    approx = s.startswith("~")
    try:
        return float(s.lstrip("~")), ("approximate" if approx else "")
    except ValueError:
        return None, f"unreadable '{s}'"


@register(PSI, required=[PARTS[0]])
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    frames = []
    for f in PARTS:
        if not (raw_dir / f).exists():
            log.add("experimental_table", "high", "missing part", f"{f} not found", "tests from that part absent")
            continue
        d = pd.read_csv(raw_dir / f, sep="\t", dtype=str, encoding="utf-8")
        d["source_file"], d["source_line"] = f, range(2, len(d) + 2)
        frames.append(d)
    df = pd.concat(frames, ignore_index=True)
    log.add("experimental_table", "low", "header symbols", "headers 'O', 'N', 'CO', 'He' lost subscripts",
            "read as O2, N2, CO2, He mole fractions")
    log.add("experimental_table", "medium", "unit", "'Burning rate; mm' lost its exponent",
            "read as mm^2/s (values 0.05-1.06 match d^2-law constants)")
    n_missing = int(df.apply(lambda col: col.astype(str).str.contains("�")).sum().sum())
    log.add("experimental_table", "low", "encoding", f"{n_missing} cells hold the replacement character",
            "treated as missing")
    dup = df[C["ident"]][df[C["ident"]].duplicated(keep=False)].unique().tolist()
    if dup:
        log.add("experimental_table", "medium", "duplicate", f"identifier(s) {dup} appear on two test rows "
                "with slightly different values", "both kept; test_id uses the test number")
    log.add("experimental_table", "medium", "missing condition",
            "fiber-supported vs free droplet and slow-drift velocity are not columns",
            "flow_cm_s = 0 (quiescent); identifier letters F/R kept in 'identifier' for later decoding")

    tests, ev = [], []
    for _, r in df.iterrows():
        flags = []
        tid = f"{PSI}:{r[C['test']]}"
        vals = {}
        for key in ("p", "o2", "n2", "co2", "he", "d0", "dext", "k", "tb"):
            v, note = _num(r[C[key]])
            vals[key] = v
            if note:
                flags.append(f"{C[key].split(';')[0]}: {note}")
        if vals["p"] == 0:
            flags.append("pressure recorded as 0 mmHg (entry error); left blank")
            log.add("experimental_table", "medium", "bad value", f"test {r[C['test']]}: pressure 0 mmHg", "left blank")
            vals["p"] = None
        comp = [vals[k] for k in ("o2", "n2", "co2", "he") if vals[k] is not None]
        if comp and abs(sum(comp) - 1) > 0.03:
            flags.append(f"composition sums to {sum(comp):.2f}")
        end = str(r[C["end"]]).strip()
        if vals["dext"] == 0:
            flags.append("extinction diameter 0 = no finite extinction size; stored blank")
            vals["dext"] = None
        if end == "Completion" and vals["dext"] is not None:
            flags.append("extinction diameter given for a 'Completion' test")
        if r[C["ident"]] in dup:
            flags.append(f"identifier {r[C['ident']]} duplicated in the table")
        dil = [n for n, k in (("N2", "n2"), ("CO2", "co2"), ("He", "he")) if (vals[k] or 0) > 0]
        other = vals["co2"] if (vals["co2"] or 0) > 0 else (vals["he"] if (vals["he"] or 0) > 0 else 0.0)
        fuel = {"Heptane": "n-heptane", "Methanol": "methanol"}.get(r[C["fuel"]], r[C["fuel"]])
        tests.append(dict(
            investigation_id=PSI, test_id=tid, source_type="experiment", platform="ISS-CIR (MDCA)",
            fuel=fuel, fuel_class="liquid", geometry="droplet", size_mm=vals["d0"], d0_mm=vals["d0"],
            pressure_atm=round(vals["p"] / MMHG_PER_ATM, 4) if vals["p"] is not None else None,
            x_o2=vals["o2"], x_n2=vals["n2"], x_co2=vals["co2"], x_he=vals["he"],
            diluent=" + ".join(dil), x_diluent_other=other,
            suppressant="CO2" if (vals["co2"] or 0) > 0 else ("He" if (vals["he"] or 0) > 0 else "none"),
            flow_cm_s=0.0, flow_direction="none", gravity_g=0.0, setup="FLEX droplet (CIR/MDCA)",
            end_state=end.lower(), ignited=True if vals["d0"] is not None or vals["tb"] is not None else None,
            extinguished=end == "Extinction", identifier=r[C["ident"]], test_date=r["Test Date"],
            outcome_note=f"test end: {end}", confidence="high" if not flags else "medium",
            flags="; ".join(flags), doi="10.60555/mbq8-0451", source_file=r["source_file"]))
        for q, unit, key in (("extinction_diameter", "mm", "dext"), ("burning_rate", "mm2/s", "k"),
                             ("burn_time", "s", "tb")):
            if vals[key] is not None:
                ev.append(dict(investigation_id=PSI, test_id=tid, dataset_id="flex_tests", source_type="experiment",
                               quantity=q, unit=unit, value=vals[key],
                               status="ok" if q != "burning_rate" else "ok (unit read as mm2/s)",
                               source_file=r["source_file"], source_line=int(r["source_line"])))
    return PluginResult(tests=pd.DataFrame(tests), evidence=pd.DataFrame(ev), issues=log.frame(),
                        notes=f"{len(tests)} droplet tests")
