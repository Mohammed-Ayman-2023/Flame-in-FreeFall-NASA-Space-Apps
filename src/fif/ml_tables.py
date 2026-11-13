"""Build the ML-ready tables from the merged data layer (data/processed/tests.csv + evidence.csv).

A  solids_flammability   one row per OBSERVED CONDITION on a solid sample in microgravity:
                         'at this O2 / flow / direction, was a flame sustained?'  (classification)
B  solids_spread         one row per microgravity burn with a measured spread rate (regression)
C  droplets              one row per droplet test (experiments): extinction diameter, burning rate,
                         burn time, how the test ended (regression + classification)
Side tables: A_1g_comparison (Saffire 1-g ground tests, conditions not reported) and
C_droplets_simulation (model results, never mixed with experiments).

Rules (see ml/SPEC.md):
  * no averaging-in of missing values; a row missing a required input gets ready_for_model = False
  * every row keeps investigation_id, test_id, source_type, confidence, flags and its source
  * group_id = test_id (A) so that cross-validation never splits one test across train and test
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC, OUT = ROOT / "data" / "processed", ROOT / "ml" / "v0"
CABIN_P = 1.0
CABIN_NOTE = "assumed ~1 atm: ISS/Cygnus cabin air (not stated in the PSI files)"


def material_family(fuel: str | float) -> str | None:
    f = str(fuel).lower()
    if f == "nan":
        return None
    for key, fam in (("ultem", "Ultem"), ("pmma", "PMMA"), ("sibal", "cotton-fiberglass"), ("fiberglass", "cotton-fiberglass"), ("cotton jersey", "cotton"), ("cotton", "cotton-fiberglass"),
                     ("silicone", "silicone"), ("nomex", "Nomex"), ("wax", "wax"), ("candle", "wax")):
        if key in f:
            return fam
    return f


def geometry_class(geom: str | float, size: float | None) -> str | None:
    g = str(geom).lower()
    if "rod" in g:
        return "rod"
    if "spher" in g:
        return "sphere"
    if "fabric" in g:
        return "fabric sheet"
    if "candle" in g:
        return "candle"
    if "slab" in g:
        return "thick slab"
    if "film" in g or "sheet" in g:
        return "thin sheet" if size is None or pd.isna(size) or size <= 0.5 else "thick slab"
    return None


def _ev(evidence: pd.DataFrame, quantity: str) -> pd.Series:
    e = evidence[evidence["quantity"] == quantity]
    return e.groupby("test_id")["value"].first()


def build_A(tests: pd.DataFrame, ev: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    s = tests[(tests["fuel_class"] == "solid")].copy()
    s["material_family"] = s["fuel"].map(material_family)
    s["geometry_class"] = [geometry_class(g, z) for g, z in zip(s["geometry"], s["size_mm"])]
    s["pmma_colour"] = s["fuel"].str.extract(r"\((clear|black)\)", expand=False)
    base_cols = ["investigation_id", "test_id", "source_type", "platform", "setup", "fuel", "material_family",
                 "pmma_colour", "geometry_class", "size_mm", "x_o2", "pressure_atm", "flow_direction",
                 "gravity_g", "confidence", "flags", "source_file"]
    rows, stats = [], dict(bass2_presence=0, bass2_precise_limits=0, bass2_censored_limits=0, saffire=0)

    def add(r, flow, label, label_type, label_source):
        d = {c: r.get(c) for c in base_cols}
        d.update(flow_cm_s=flow, flame_sustained=label, label_type=label_type, label_source=label_source)
        rows.append(d)

    ug = s[s["gravity_g"] == 0]
    for _, r in ug.iterrows():
        if r["investigation_id"] == "PSI-25":
            pres = ev[(ev["test_id"] == r["test_id"]) & (ev["quantity"] == "flame_present_at_flow")]
            for _, p in pres.iterrows():
                add(r, p["x_value"], 1, "flame present at this air speed (BASS-II flow step)",
                    f"{p['source_file']} {p['source_line']}")
                stats["bass2_presence"] += 1
            if r.get("end_state") in ("extinguished_low_flow", "blowoff", "would_not_stay_lit"):
                if pd.notna(r.get("limit_speed_cm_s")) and pd.isna(r.get("limit_speed_bound")):
                    add(r, r["limit_speed_cm_s"], 0, f"{r['end_state']} at this air speed (fan calibration)",
                        str(r.get("limit_speed_method")))
                    stats["bass2_precise_limits"] += 1
                else:
                    stats["bass2_censored_limits"] += 1
            if r.get("end_state") == "no_ignition":
                add(r, r.get("flow_cm_s"), 0, "no ignition", "test matrix")
        elif r["investigation_id"] == "PSI-26":
            pres = ev[(ev["test_id"] == r["test_id"]) & (ev["quantity"] == "flame_present_at_flow")]
            for _, p in pres.iterrows():
                add(r, p["x_value"], 1, "flame present at this air speed (BASS run, outcome from notes)",
                    f"{p['source_file']} {p['source_line']}")
                stats["bass_presence"] = stats.get("bass_presence", 0) + 1
            neg = ev[(ev["test_id"] == r["test_id"]) & (ev["quantity"] == "flame_not_sustained_at_flow")]
            for _, p in neg.iterrows():
                add(r, p["x_value"], 0, f"{r.get('run_outcome')} at this air speed (BASS run notes)",
                    f"{p['source_file']} {p['source_line']}: {p['status']}")
                stats["bass_negative"] = stats.get("bass_negative", 0) + 1
        else:  # Saffire flight burns
            ext = r.get("burn_extent")
            if ext is None or pd.isna(ext):
                continue
            add(r, r.get("flow_cm_s"), int(ext != "none"), f"micro-g burn extent: {ext}", str(r["source_file"]))
            stats["saffire"] += 1
    A = pd.DataFrame(rows)
    A["pressure_source"] = np.where(A["pressure_atm"].isna(), CABIN_NOTE, "reported")
    A["pressure_atm"] = A["pressure_atm"].fillna(CABIN_P)
    A["p_o2_atm"] = (A["x_o2"] * A["pressure_atm"]).round(4)
    A["group_id"] = A["test_id"]
    req = ["material_family", "geometry_class", "x_o2", "flow_cm_s", "flow_direction"]
    A["pressure_note"] = np.where(A["investigation_id"] == "PSI-25",
                                  "BASS (same MSG on ISS) measured 0.97-1.01 atm per run", "")
    A["ready_for_model"] = A[req].notna().all(axis=1)
    # QA (manual spot-check 2026-11-13 23:05): a BASS "no ignition" is evidence about the material only when the
    # igniter worked. Exclude it when the material is known to burn in the same rig (PMMA, wax, SIBAL) or the
    # note blames the hardware/sample. Ignited-then-went-out rows stay: those are real flame-out observations.
    note = A["test_id"].map(s.set_index("test_id")["outcome_note"]).fillna("").str.lower()
    outcome = A["test_id"].map(s.set_index("test_id")["run_outcome"]).fillna("")
    equip = note.str.contains(r"popped|broke|readjust|out of wax|not enough fuel|crooked|haze|bend it|then g$", regex=True)
    known_burner = A["material_family"].isin(["PMMA", "wax", "cotton-fiberglass"])
    bad = (A["investigation_id"] == "PSI-26") & (outcome == "no_ignition") & (known_burner | equip)
    A["exclude_reason"] = np.where(bad, "no-ignition likely igniter/sample problem (material burns in other runs); "
                                        "not used as a flammability negative", "")
    A.loc[bad, "ready_for_model"] = False
    A.insert(0, "row_id", [f"A{i:04d}" for i in range(1, len(A) + 1)])

    g1 = s[s["gravity_g"] == 1].copy()
    g1 = g1[["investigation_id", "test_id", "fuel", "material_family", "geometry_class", "size_mm",
             "flow_direction", "burn_extent", "confidence", "flags", "source_file"]]
    return A, g1, stats


def build_B(tests: pd.DataFrame, ev: pd.DataFrame) -> pd.DataFrame:
    s = tests[(tests["fuel_class"] == "solid") & (tests["gravity_g"] == 0)].copy()
    sr = _ev(ev[ev["investigation_id"].isin(s["investigation_id"].unique())], "flame_spread_rate")
    s = s[s["test_id"].isin(sr.index)].copy()
    s["spread_rate_mm_s"] = s["test_id"].map(sr)
    s["burn_length_cm"] = s["test_id"].map(_ev(ev, "burn_length"))
    s["material_family"] = s["fuel"].map(material_family)
    s["geometry_class"] = [geometry_class(g, z) for g, z in zip(s["geometry"], s["size_mm"])]
    s["pressure_source"] = np.where(s["pressure_atm"].isna(), CABIN_NOTE, "reported")
    s["pressure_atm"] = s["pressure_atm"].fillna(CABIN_P)
    s["p_o2_atm"] = (s["x_o2"] * s["pressure_atm"]).round(4)
    s["value_source"] = s["test_id"].map(ev[ev["quantity"] == "flame_spread_rate"].groupby("test_id")["status"].first())
    cols = ["investigation_id", "test_id", "source_type", "setup", "fuel", "material_family", "geometry_class",
            "size_mm", "sample_width_cm", "sample_length_cm", "x_o2", "pressure_atm", "pressure_source", "p_o2_atm",
            "flow_cm_s", "flow_direction", "spread_rate_mm_s", "burn_length_cm", "value_source", "confidence",
            "flags", "source_file"]
    B = s[cols].reset_index(drop=True)
    B["ready_for_model"] = B[["material_family", "x_o2", "flow_cm_s", "flow_direction", "spread_rate_mm_s"]].notna().all(axis=1)
    B.insert(0, "row_id", [f"B{i:04d}" for i in range(1, len(B) + 1)])
    return B


def build_C(tests: pd.DataFrame, ev: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    d = tests[(tests["fuel_class"] == "liquid")].copy()
    # FLEX-style scalars + PSI-117 scalars
    qmap = {"extinction_diameter": "extinction_diameter_mm", "hot_extinction_diameter": "extinction_diameter_mm",
            "dext_hot": "extinction_diameter_mm", "cool_extinction_diameter": "cool_extinction_diameter_mm",
            "dext_cool": "cool_extinction_diameter_mm", "burning_rate": "burning_rate_mm2_s",
            "cool_flame_burning_rate": "cool_flame_burning_rate_mm2_s", "burn_time": "burn_time_s"}
    e = ev[ev["quantity"].isin(qmap) & ev["test_id"].isin(d["test_id"])]
    e = e[e["x_name"].isna() | (e["dataset_id"].isin(["alkane_dext_1atm", "c12_dext_vs_p", "c12_kavg"]))]
    wide = e.assign(col=e["quantity"].map(qmap)).groupby(["test_id", "col"])["value"].first().unstack()
    d = d[d["test_id"].isin(wide.index)].join(wide, on="test_id")
    d["d0_mm"] = d["d0_mm"].fillna(d["size_mm"])
    d["fuel_family"] = d["fuel"].map(lambda f: "alcohol" if "methanol" in str(f) else "n-alkane")
    for c in ("x_co2", "x_he", "x_n2"):
        if c not in d:
            d[c] = np.nan
    he_guess = pd.Series(np.where(d["diluent"].astype(str).str.contains("He"), d["x_diluent_other"], 0.0), index=d.index)
    d["x_he"] = d["x_he"].fillna(he_guess)
    d["x_co2"] = d["x_co2"].fillna(0.0)
    d["x_n2"] = d["x_n2"].fillna(1 - d["x_o2"] - d["x_co2"] - d["x_he"])
    sup_guess = pd.Series(np.where(d["x_he"] > 0, "He", "none"), index=d.index)
    d["suppressant"] = d["suppressant"].fillna(sup_guess) if "suppressant" in d else sup_guess
    d["p_o2_atm"] = (d["x_o2"] * d["pressure_atm"]).round(4)
    d["dext_over_d0"] = (d["extinction_diameter_mm"] / d["d0_mm"]).round(4)
    d["extinguished_flag"] = np.where(d["end_state"].isin(["extinction"]), 1,
                                      np.where(d["end_state"].isin(["completion", "disruption"]), 0, np.nan))
    d.loc[d["investigation_id"] == "PSI-117", "extinguished_flag"] = np.where(
        d.loc[d["investigation_id"] == "PSI-117", "extinction_diameter_mm"].notna(), 1, np.nan)
    cols = ["investigation_id", "test_id", "source_type", "setup", "fuel", "fuel_family", "d0_mm", "x_o2",
            "pressure_atm", "p_o2_atm", "x_n2", "x_co2", "x_he", "suppressant", "extinction_diameter_mm",
            "dext_over_d0", "cool_extinction_diameter_mm", "burning_rate_mm2_s", "cool_flame_burning_rate_mm2_s",
            "burn_time_s", "end_state", "extinguished_flag", "confidence", "flags", "source_file"]
    for c in cols:
        if c not in d:
            d[c] = np.nan
    d = d[cols].reset_index(drop=True)
    d["ready_for_model"] = d[["fuel", "d0_mm", "x_o2", "pressure_atm"]].notna().all(axis=1)
    exp, sim = d[d["source_type"] == "experiment"].copy(), d[d["source_type"] == "simulation"].copy()
    exp.insert(0, "row_id", [f"C{i:04d}" for i in range(1, len(exp) + 1)])
    sim.insert(0, "row_id", [f"CS{i:03d}" for i in range(1, len(sim) + 1)])
    return exp, sim


def fill_report(df: pd.DataFrame, name: str) -> str:
    cols = [c for c in df.columns if c not in ("row_id", "flags")]
    by = df.groupby("investigation_id")[cols].agg(lambda s: s.notna().mean() * 100).round(0)
    lines = [f"### {name}: {len(df)} rows, {int(df['ready_for_model'].sum())} ready for modelling", "",
             "Percent of rows filled, per investigation:", "",
             "| column | " + " | ".join(by.index) + " | all |", "|---|" + "---|" * (len(by.index) + 1)]
    for c in cols:
        lines.append(f"| {c} | " + " | ".join(f"{v:.0f}" for v in by[c]) + f" | {df[c].notna().mean() * 100:.0f} |")
    return "\n".join(lines) + "\n"


def build_D(tests: pd.DataFrame, ev: pd.DataFrame) -> pd.DataFrame:
    """D: quiescent gaseous diffusion flames (ACME CFI-G). One row per test.
    Targets: hot_ignition (0/1; igniter-voltage trials excluded), burn_time_s with self_extinguished as the event
    flag (flow-terminated = still burning = right-censored), so survival-style or censoring-aware models apply."""
    d = tests[tests["investigation_id"] == "PSI-159"].copy()
    bt = ev[(ev["investigation_id"] == "PSI-159") & (ev["quantity"] == "burn_time")].groupby("test_id")["value"].first()
    d["burn_time_s"] = d["test_id"].map(bt)
    d["hot_ignition"] = d["ignited"].map({True: 1, False: 0, "True": 1, "False": 0})
    d["self_extinguished"] = d["extinguished"].map({True: 1, False: 0, "True": 1, "False": 0})
    d["p_o2_atm"] = (d["x_o2"] * d["pressure_atm"]).round(4)
    d["fuel_family"] = d["fuel"].str.extract(r"(ethane|propane|butane)", expand=False)
    hw = d["hardware_attempt"].astype(str).isin(["True", "1"])
    d["ready_ignition"] = d[["x_o2", "pressure_atm", "fuel_mole_fraction", "fuel_flow_mg_s", "hot_ignition"]].notna().all(axis=1) & ~hw
    d["ready_burn_time"] = (d["hot_ignition"] == 1) & d["burn_time_s"].notna() & d["self_extinguished"].notna()
    cols = ["investigation_id", "test_id", "fuel", "fuel_family", "fuel_mole_fraction", "fuel_flow_mg_s", "x_o2",
            "x_o2_final", "pressure_atm", "p_o2_atm", "t_adiabatic_k", "z_st", "hot_ignition", "burn_time_s",
            "self_extinguished", "end_state", "cool_flame_obs", "confidence", "flags", "source_file",
            "ready_ignition", "ready_burn_time"]
    D = d[cols].reset_index(drop=True)
    D["ready_for_model"] = D["ready_ignition"]
    D.insert(0, "row_id", [f"D{i:04d}" for i in range(1, len(D) + 1)])
    return D


def run() -> dict:
    tests = pd.read_csv(PROC / "tests.csv", low_memory=False)
    ev = pd.read_csv(PROC / "evidence.csv", low_memory=False)
    OUT.mkdir(parents=True, exist_ok=True)
    A, A1g, stats = build_A(tests, ev)
    B = build_B(tests, ev)
    C, Csim = build_C(tests, ev)
    D = build_D(tests, ev)
    D.to_csv(OUT / "D_gas_flames.csv", index=False)
    A.to_csv(OUT / "A_solids_flammability.csv", index=False)
    A1g.to_csv(OUT / "A_1g_comparison.csv", index=False)
    B.to_csv(OUT / "B_solids_spread.csv", index=False)
    C.to_csv(OUT / "C_droplets.csv", index=False)
    Csim.to_csv(OUT / "C_droplets_simulation.csv", index=False)
    rep = ["# ML tables v0: fill report", "", f"stats: {stats}", "",
           f"A label sources: {stats['saffire']} Saffire burns, {stats['bass2_presence']} BASS-II 'flame present' "
           f"steps, {stats['bass2_precise_limits']} BASS-II extinction/blowoff speeds from the fan calibration; "
           f"{stats['bass2_censored_limits']} BASS-II limits known only as upper bounds (not used as labels).", "",
           fill_report(A, "A_solids_flammability"), fill_report(B, "B_solids_spread"),
           fill_report(C, "C_droplets"), fill_report(Csim, "C_droplets_simulation"), fill_report(D, "D_gas_flames")]
    (OUT / "fill_report.md").write_text("\n".join(rep), encoding="utf-8")
    return dict(A=A, A1g=A1g, B=B, C=C, Csim=Csim, D=D, stats=stats)
