"""PSI-117: cool-flame droplet data (FLEX-derived ground investigation).

All parsing and cleaning lives in the `psi117` package (validated earlier); this module
only maps its outputs onto the common contract (tests + evidence + issues).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from ..registry import PluginResult, register

PSI = "PSI-117"


@register(PSI, required=["PSI-117_Analyzed_Data_*.csv", "PSI-117_Analyzed_Data_ReadMe*.xlsx"])
def build(raw_dir: Path) -> PluginResult:
    from psi117 import config
    from psi117.pipeline import run as run_psi117, tidy_long

    res = run_psi117(verbose=False)  # also refreshes reports/PSI-117 (figures, findings)
    cleaned, issues = res["clean"], res["issues"]
    long = tidy_long(cleaned)
    cat = cleaned["catalog"].set_index("dataset_id")

    tests, keymap = [], {}

    def add_test(key, **kw):
        tid = f"{PSI}:{key}"
        kw.setdefault("platform", "ISS-CIR (FLEX/MDCA)" if kw.get("source_type") == "experiment" else "model")
        kw.setdefault("geometry", "fiber-supported droplet")
        kw.setdefault("fuel_class", "liquid")
        kw.setdefault("flow_cm_s", 0.0)
        kw.setdefault("flow_direction", "none")
        kw.setdefault("gravity_g", 0.0)
        kw.setdefault("t_ambient_k", 298.0)
        tests.append(dict(investigation_id=PSI, test_id=tid, **kw))
        return tid

    # n-heptane simulations (ozone-seeded)
    for case in ("stable", "oscillatory"):
        r = cat.loc[f"heptane_{case}"]
        keymap[("heptane_" + case, "simulation")] = add_test(
            f"heptane_{case}", source_type="simulation", fuel="n-heptane", size_mm=0.5,
            pressure_atm=1.0, x_o2=r["x_o2"], diluent="N2 + 5% O3", x_diluent_other=0.05,
            outcome_note=f"{case} cool flame", doi=r["doi"],
            source_file=config.FILES[f"heptane_{case}"])

    # n-dodecane three-stage: one experiment (FLEX 1268), one model run
    r = cat.loc["c12_three_stage"]
    for src, d0 in (("experiment", config.C12_THREE_STAGE_EXPT_D0_MM),
                    ("simulation", config.C12_THREE_STAGE_SIM_D0_MM)):
        keymap[("c12_three_stage", src)] = add_test(
            f"c12_three_stage_{src}", source_type=src, fuel="n-dodecane", size_mm=d0,
            pressure_atm=2.75, x_o2=0.21, diluent="N2 + He", x_diluent_other=0.29,
            extinguished=True, outcome_note="hot -> warm -> cool flame; expt hot-flame re-ignition",
            doi=r["doi"], source_file=config.FILES["c12_three_stage"])

    # extinction diameters at 1 atm: one test per droplet
    dx = cleaned["alkane_dext_1atm"]
    for _, row in dx.iterrows():
        key = f"dext1atm_{row['fuel_code']}_{row['source_type'][:3]}_{row['d0_mm']:g}"
        keymap[("alkane_dext_1atm", row["source_type"], row["fuel"], round(row["d0_mm"], 4))] = add_test(
            key, source_type=row["source_type"], fuel=row["fuel"], size_mm=row["d0_mm"],
            pressure_atm=1.0, x_o2=0.21, diluent="N2",
            extinguished=bool(row["status_hot"] == "ok"),
            outcome_note=("radiative hot-flame extinction" if row["status_hot"] == "ok"
                          else "no hot-flame extinction (burned to completion)"),
            doi=cat.loc["alkane_dext_1atm", "doi"], source_file=config.FILES["alkane_dext_1atm"])

    # n-dodecane vs pressure (d0 = 4.0 mm per ReadMe): one test per pressure and source
    dvp = cleaned["c12_dext_vs_p"]
    for (src, p), _ in dvp.groupby(["source_type", "pressure_atm"]):
        keymap[("c12_dext_vs_p", src, p)] = add_test(
            f"dextP_{src[:3]}_{p:g}atm", source_type=src, fuel="n-dodecane", size_mm=4.0,
            pressure_atm=p, x_o2=0.21, diluent="N2", extinguished=True,
            doi=cat.loc["c12_dext_vs_p", "doi"], source_file=config.FILES["c12_dext_vs_p"])

    # cool-flame burning rate vs pressure (d0 = 4.5 mm): one test per point
    kv = cleaned["c12_kavg"]
    for _, row in kv.iterrows():
        keymap[("c12_kavg", row["source_type"], int(row["source_line"]))] = add_test(
            f"kavg_{row['source_type'][:3]}_line{int(row['source_line'])}", source_type=row["source_type"],
            fuel="n-dodecane", size_mm=4.5, pressure_atm=row["pressure_atm"], x_o2=0.21, diluent="N2",
            doi=cat.loc["c12_kavg", "doi"], source_file=config.FILES["c12_kavg"])

    tests = pd.DataFrame(tests)

    # ---- link every evidence row to its test
    def link(r):
        ds, src = r["dataset_id"], r["source_type"]
        if ds.startswith("heptane_") or ds == "c12_three_stage":
            return keymap.get((ds, src))
        if ds == "alkane_dext_1atm":
            return keymap.get((ds, src, r["fuel"], round(r["x_value"], 4)))
        if ds == "c12_dext_vs_p":
            return keymap.get((ds, src, r["x_value"]))
        if ds == "c12_kavg":
            return keymap.get((ds, src, int(r["source_line"])))
        return None

    ev = long.copy()
    ev["investigation_id"] = PSI
    ev["test_id"] = ev.apply(link, axis=1)
    keep = ["investigation_id", "test_id", "dataset_id", "source_type", "quantity", "unit", "value",
            "x_name", "x_value", "x_unit", "status", "source_file", "source_line", "case"]
    ev = ev[keep]

    iss = issues.rename(columns={"dataset": "dataset"}).copy()
    iss.insert(0, "investigation_id", PSI)

    # psi117's own pipeline already wrote its cleaned tables to data/processed/PSI-117/
    return PluginResult(tests=tests, evidence=ev, issues=iss,
                        notes="Ground investigation re-using FLEX droplet data; n-heptane cases are simulation only.")
