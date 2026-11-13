"""PSI-159 ACME CFI-G (Cool Flames Investigation with Gases): spherical diffusion flames from a porous
burner on the ISS, QUIESCENT closed chamber, ethane / propane / n-butane (pure or diluted), 18-40 % O2 at
0.5-3 atm. Per test: hot ignition (yes/no), burn time, and how it ended: SE = self-extinguished,
FT = fuel flow terminated by the operator (flame still burning -> burn time is a lower bound).

Source: the PSI page table, pasted in two parts. Cleaning:
  * pressure column is labelled bar but holds atm x 1.0133 (0.50665, 1.0133, 2.0266, 3.0399): converted to atm;
  * a quoted cell with an internal tab ('"yes<TAB>PCI-D"') is re-joined; unclosed quotes are stripped;
  * '#DIV/0!' and '-' -> blank;
  * x_o2 = O2 before the test (O2 is consumed in the closed chamber; 'after' kept as x_o2_final);
  * day-2 no-ignition rows whose comment is an igniter-voltage trial are flagged as hardware attempts.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register

PSI = "PSI-159"
PARTS = ["PSI-159_table_part1.tsv", "PSI-159_table_part2.tsv"]
COLS = ["flame_type", "day", "fuel", "test", "cool_flame", "xo2_before", "xo2_after", "p_bar", "xf", "mdot_mg_s",
        "tfp", "tad_k", "zst", "hot_ignition", "burn_time_s", "end", "peak_burner_t_c", "comments"]
BAR_PER_ATM = 1.01325


def _tokens(line: str) -> list[str]:
    raw, out, i = line.rstrip("\n").split("\t"), [], 0
    while i < len(raw):
        tok = raw[i]
        if tok.startswith('"') and not tok.endswith('"') and i + 1 < len(raw) and raw[i + 1].endswith('"') \
                and not raw[i + 1].startswith('"'):
            out.append((tok + " " + raw[i + 1]).strip('"'))
            i += 2
            continue
        out.append(tok.strip('"'))
        i += 1
    return out


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


@register(PSI, required=PARTS)
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    rows = []
    for part in PARTS:
        for n, line in enumerate((raw_dir / part).read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip() or line.startswith("Flame Type"):
                continue
            tok = (_tokens(line) + [""] * len(COLS))[:len(COLS)]
            rows.append(dict(zip(COLS, tok), source_file=part, source_line=n))
    df = pd.DataFrame(rows)
    dup = df.duplicated("test", keep="first")
    if dup.any():
        log.add("table", "low", "duplicate test id", f"{dup.sum()} repeated rows across the two pastes", "kept first")
        df = df[~dup]
    tests, ev = [], []
    for _, r in df.iterrows():
        flags = []
        tid = f"{PSI}:{r['test'].replace(' ', '')}"
        p_atm = round(float(r["p_bar"]) / BAR_PER_ATM, 3)
        hot = {"Yes": True, "No": False}.get(r["hot_ignition"].strip())
        bt = _f(r["burn_time_s"])
        end = {"SE": "self-extinguished", "FT": "flow terminated (still burning)"}.get(r["end"].strip())
        c = r["comments"].lower()
        hardware = hot is False and "igniter voltage" in c
        if hardware:
            flags.append("no-ignition during an igniter-voltage trial (hardware attempt, not a flammability result)")
        if hot is False and bt and bt > 0:
            flags.append(f"hot ignition 'No' but burn time {bt:g} s and comment '{r['comments']}': ignition column doubtful")
            log.add("table", "medium", "contradiction", f"{r['test']}: ignition No with burn time {bt}", "flagged")
        if "#DIV" in r["tad_k"]:
            flags.append("Tad/Zst #DIV/0! (zero fuel flow)")
        if "direct cool" in c:
            flags.append("direct cool flame (no hot ignition)")
        if "limit" in c:
            flags.append("hit burner temperature limit")
        fuel = r["fuel"].strip()
        fuel = fuel.replace("butane", "n-butane") if "butane" in fuel else fuel
        tests.append(dict(
            investigation_id=PSI, test_id=tid, source_type="experiment", platform="ISS-CIR (ACME)", fuel=fuel,
            fuel_class="gas", geometry="spherical porous burner (normal flame)" if r["flame_type"] == "Normal"
            else f"spherical porous burner ({r['flame_type']})", pressure_atm=p_atm, x_o2=_f(r["xo2_before"]),
            x_o2_final=_f(r["xo2_after"]), diluent="N2", flow_cm_s=0.0, flow_direction="none (quiescent)",
            gravity_g=0.0, setup="ACME spherical burner (CIR)", fuel_mole_fraction=_f(r["xf"]),
            fuel_flow_mg_s=_f(r["mdot_mg_s"]), t_adiabatic_k=_f(r["tad_k"]), z_st=_f(r["zst"]),
            cool_flame_obs=r["cool_flame"].strip() or None, tfp=r["tfp"].strip() or None, ignited=hot,
            extinguished=True if r["end"].strip() == "SE" else (False if r["end"].strip() == "FT" else None),
            end_state=end, hardware_attempt=hardware, test_date=f"ops day {r['day']}",
            outcome_note=r["comments"] or None, confidence="medium" if flags else "high",
            flags="; ".join(flags), doi="10.60555/cyt1-kh64", source_file=r["source_file"],
            source_line=r["source_line"]))
        for q, unit, v in (("burn_time", "s", bt if hot else None), ("peak_burner_temperature", "C", _f(r["peak_burner_t_c"]))):
            if v is not None:
                ev.append(dict(investigation_id=PSI, test_id=tid, dataset_id="cfig_tests", source_type="experiment",
                               quantity=q, unit=unit, value=v,
                               status="lower bound (flow terminated)" if q == "burn_time" and r["end"].strip() == "FT"
                               else "measured", source_file=r["source_file"], source_line=r["source_line"]))
    log.add("table", "low", "units", "pressure column labelled bar holds atm x 1.0133", "converted to atm")
    return PluginResult(tests=pd.DataFrame(tests), evidence=pd.DataFrame(ev), issues=log.frame())
