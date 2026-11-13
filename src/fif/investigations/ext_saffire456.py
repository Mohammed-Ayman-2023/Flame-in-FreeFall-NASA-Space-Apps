"""EXTERNAL LITERATURE: Saffire IV, V and VI (not in PSI). Large SIBAL, cotton, PMMA and Nomex samples
burned on Cygnus at 54-100 kPa and 22-31 % O2: the only microgravity solid-fuel burns we have near
the habitat atmosphere (~30 % O2, ~0.69 atm).

Source: Urban et al., ICES-2024-365 (NASA NTRS 20240002981), Tables 1-2, transcribed by the team.
Every row is flagged source_kind = external_literature so it can be shown or excluded separately.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register

PSI = "EXT-SAFFIRE-456"
FILE = "Urban2024_ICES-2024-365_Table1_transcribed.csv"
KPA_PER_ATM = 101.325


@register(PSI, required=[FILE])
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    t = pd.read_csv(raw_dir / FILE, comment="#", dtype=str)
    vi2 = t[t["sample"] == "VI-2"].iloc[0]
    tests, ev = [], []
    for i, r in t.iterrows():
        flags = ["EXTERNAL literature (not PSI): NTRS 20240002981 Table 1-2, verified vs PDF"]
        p, o2 = r["pressure_kpa"], r["o2_mol_percent"]
        if pd.isna(p) and r["sample"].startswith("VI"):
            p, o2 = vi2["pressure_kpa"], vi2["o2_mol_percent"]
            flags.append("atmosphere not listed for this sample; VI-2 values used (same flight, burned next)")
            log.add("table1", "medium", "missing condition", f"{r['sample']}: no atmosphere in Table 1",
                    "used VI-2 (same Saffire-VI flight)")
        mat = str(r["material"])
        fuel = {"SIBAL cloth": "Cotton-fiberglass (SIBAL)"}.get(mat, mat)
        thick = float(r["thickness_mm"]) if isinstance(r["thickness_mm"], str) else None
        if fuel.startswith("Cotton-fiberglass"):
            thick = 0.37
            flags.append("SIBAL thickness 0.37 mm from Saffire I-III Table 1 (same fabric)")
        geom = "thick slab" if "PMMA" in mat else "fabric sheet"
        if "One-sided" in mat:
            geom = "thick slab (1-sided burning)"
        if "Two-sided" in mat:
            geom = "thick slab (2-sided burning)"
        ignited = r["ignited"] == "yes"
        tid = f"{PSI}:{r['sample']}"
        tests.append(dict(
            investigation_id=PSI, test_id=tid, source_type="experiment", platform="Cygnus (post-ISS)",
            fuel="PMMA" if "PMMA" in mat else fuel, fuel_class="solid", geometry=geom, size_mm=thick,
            thickness_mm=thick, sample_width_cm=float(r["width_cm"]), sample_length_cm=float(r["length_cm"]),
            pressure_atm=round(float(p) / KPA_PER_ATM, 4) if isinstance(p, str) else None,
            x_o2=round(float(o2) / 100, 4) if isinstance(o2, str) else None, diluent="N2 (cabin air)",
            flow_cm_s=float(r["flow_cm_s"]), flow_direction=r["direction"].lower(), gravity_g=0.0,
            setup="Saffire IV-VI flow tunnel (30 x 45 cm)",
            burn_extent="complete" if ignited else "none", ignited=ignited, source_kind="external_literature",
            outcome_note=str(r["note"]) if isinstance(r["note"], str) else ("burned" if ignited else "did not ignite"),
            confidence="high" if r["sample"] != "VI-1" else "medium", flags="; ".join(flags), doi="NTRS 20240002981 (ICES-2024-365)", source_file=FILE))
        for q, unit, col in (("burn_time", "s", "burn_duration_s"),
                             ("peak_heat_release_o2cal", "W", "peak_hrr_o2cal_w"),
                             ("total_heat_release_o2cal", "kJ", "total_hr_o2cal_kj"),
                             ("avg_heat_release_fuelcal", "W", "avg_hrr_fuelcal_w"),
                             ("total_heat_release_fuelcal", "kJ", "total_hr_fuelcal_kj"),
                             ("max_temp_sfu_outlet", "C", "max_temp_sfu_outlet_c"),
                             ("max_temp_ffd", "C", "max_temp_ffd_c"),
                             ("co2_increase_ffd", "ppm", "ffd_co2_increase_ppm"),
                             ("co2_partial_pressure_increase", "mmHg", "co2_partial_pressure_increase_mmhg"),
                             ("co_increase_ffd", "ppm", "ffd_co_increase_ppm")):
            if isinstance(r[col], str):
                ev.append(dict(investigation_id=PSI, test_id=tid, dataset_id="saffire456", source_type="experiment",
                               quantity=q, unit=unit, value=float(r[col]), status="external literature (verified vs PDF)",
                               source_file=FILE, source_line=i + 2))
    olson_file = raw_dir / "Olson_SIBAL-cotton_Table1_transcribed.csv"
    olson = pd.read_csv(olson_file, comment="#", dtype={"our_test_id": str}).set_index("our_test_id") if olson_file.exists() else None
    if olson is not None:
        for t_ in tests:
            if t_["test_id"] in olson.index:
                o = olson.loc[t_["test_id"]]
                t_["flags"] += (f"; Olson et al. Table 1 lists {o['o2_pct']}% O2 / {o['pressure_kpa']} kPa for this burn "
                                f"(recorded at hatch closing / after O2 addition; ICES-2024 Table 1 test values kept); duct height {o['duct_h_cm']} cm")
                for q, unit, v in (("flame_spread_rate", "mm/s", o["vf_cm_s"] * 10), ("pyrolysis_length", "cm", o["lp_cm"]),
                                   ("flame_length", "cm", o["lf_cm"]), ("flame_height", "cm", o["hf_cm"])):
                    ev.append(dict(investigation_id=PSI, test_id=t_["test_id"], dataset_id="olson_sibal_cotton",
                                   source_type="experiment", quantity=q, unit=unit, value=float(v),
                                   status="external literature (Olson et al. Table 1; verified vs PDF)",
                                   source_file=olson_file.name, source_line=None))
    return PluginResult(tests=pd.DataFrame(tests), evidence=pd.DataFrame(ev), issues=log.frame())
