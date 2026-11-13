"""End-to-end run: raw files -> cleaned tables -> analysis -> figures -> reports."""
from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from . import analysis as A
from . import clean, config, plots


# ---------------------------------------------------------------- one long table for dashboards
def tidy_long(c: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Every value in PSI-117 as one row, with conditions and provenance attached."""
    cat = c["catalog"].set_index("dataset_id")
    parts = []

    def add(df, dataset, x_name, x_unit, value_cols, extra=None, file_key=None):
        for vcol, (qty, unit) in value_cols.items():
            d = df[[c_ for c_ in [x_name, vcol, "source_type", "source_line", "status", "case"]
                    if c_ in df.columns]].copy()
            d = d.rename(columns={x_name: "x_value", vcol: "value"})
            d["x_name"], d["x_unit"], d["quantity"], d["unit"] = x_name, x_unit, qty, unit
            d["dataset_id"] = dataset
            d["source_file"] = config.FILES[file_key or dataset]
            if extra:
                for k, v in extra.items():
                    d[k] = v
            parts.append(d)

    hep = c["heptane"].copy()
    hep["status"] = hep["phase"]
    for case in ("stable", "oscillatory"):
        add(hep[hep["case"] == case], f"heptane_{case}", "time_s", "s",
            {"d_mm": ("droplet_diameter", "mm"), "k_mm2_s": ("burning_rate", "mm2/s"),
             "tmax_k": ("peak_gas_temperature", "K"),
             "d_tmax_over_d_masked": ("flame_standoff_ratio", "-"),
             "d_ohmax_over_d_masked": ("oh_peak_location_over_d", "-")})

    ex = c["c12_three_stage_expt"]
    for q, g in ex.groupby("quantity_interpreted"):
        unit = g["unit_interpreted"].iat[0]
        add(g, "c12_three_stage", "t_over_d02_s_mm2", "s/mm2", {"value": (q, unit)})
    sim = c["c12_three_stage_sim"].copy()
    sim["status"] = sim["stage"]
    add(sim, "c12_three_stage", "t_over_d02_s_mm2", "s/mm2",
        {"d2_over_d02": ("d2_over_d02", "-"), "k_mm2_s": ("burning_rate", "mm2/s"),
         "tmax_k": ("peak_gas_temperature", "K"), "dflame_mm": ("flame_diameter_mm", "mm"),
         "d_tmax_over_d_masked": ("flame_standoff_ratio", "-")})
    rad = c["c12_three_stage_sim_radiance"].copy()
    add(rad, "c12_three_stage", "t_over_d02_s_mm2", "s/mm2", {"radiance_w": ("radiance", "W")})

    dx = c["alkane_dext_1atm"].copy()
    for col, status, qty in (("dext_hot_mm_clean", "status_hot", "hot_extinction_diameter"),
                             ("dext_cool_mm_clean", "status_cool", "cool_extinction_diameter")):
        d = dx.copy()
        d["status"] = d[status]
        for fuel, g in d.groupby("fuel"):
            add(g, "alkane_dext_1atm", "d0_mm", "mm", {col: (qty, "mm")}, extra={"fuel_row": fuel})

    dvp = c["c12_dext_vs_p"]
    for q, g in dvp.groupby("quantity"):
        add(g, "c12_dext_vs_p", "pressure_atm", "atm", {"value_clean_mm": (q, "mm")})
    add(c["c12_kavg"], "c12_kavg", "pressure_atm", "atm", {"k_mm2_s": ("cool_flame_burning_rate", "mm2/s")})

    out = pd.concat(parts, ignore_index=True)
    cols = ["fuel", "d0_mm", "pressure_atm", "x_o2", "x_n2", "x_he", "x_o3", "t_ambient_k", "doi", "figure"]
    out = out.join(cat[cols].rename(columns={"pressure_atm": "pressure_atm_condition",
                                             "d0_mm": "d0_mm_condition"}), on="dataset_id")
    out["fuel"] = out.pop("fuel_row").fillna(out["fuel"]) if "fuel_row" in out else out["fuel"]
    order = ["dataset_id", "source_type", "case", "fuel", "quantity", "unit", "value", "x_name",
             "x_value", "x_unit", "status", "d0_mm_condition", "pressure_atm_condition", "x_o2",
             "x_n2", "x_he", "x_o3", "t_ambient_k", "doi", "figure", "source_file", "source_line"]
    out = out[order]
    out["status"] = out["status"].fillna("ok")
    return out.dropna(subset=["value"]).reset_index(drop=True)


# ---------------------------------------------------------------- markdown helpers
def md_table(df: pd.DataFrame, floatfmt: str = "{:.3g}") -> str:
    def fmt(v):
        if isinstance(v, (float, np.floating)):
            return "" if np.isnan(v) else floatfmt.format(v)
        return str(v)
    head = "| " + " | ".join(map(str, df.columns)) + " |"
    sep = "|" + "|".join("---" for _ in df.columns) + "|"
    body = ["| " + " | ".join(fmt(v).replace("|", "/") for v in row) + " |" for row in df.itertuples(index=False)]
    return "\n".join([head, sep, *body])


# ---------------------------------------------------------------- run
def run(verbose: bool = True) -> dict:
    config.PROCESSED.mkdir(parents=True, exist_ok=True)
    config.FIGURES.mkdir(parents=True, exist_ok=True)
    c, issues = clean.clean_all()

    # ---- analysis
    hep = c["heptane"]
    qs = A.heptane_quasi_steady(hep)
    peaks, osc = A.heptane_oscillations(hep, "oscillatory")
    _, osc_stable = A.heptane_oscillations(hep, "stable")
    stages = A.three_stage_model_stages(c["c12_three_stage_sim"])
    expt_k = A.three_stage_expt_burning_rate(c["c12_three_stage_expt"])
    k_cmp = A.three_stage_compare_k(expt_k, c["c12_three_stage_sim"], stages)
    markers = A.three_stage_expt_markers(c["c12_three_stage_expt"])
    ext = A.extinction_summary(c["alkane_dext_1atm"])
    thr = A.model_extinction_threshold(c["alkane_dext_1atm"])
    c12m = A.c12_matched_extinction(c["alkane_dext_1atm"])
    pt = A.pressure_trends(c["c12_dext_vs_p"], c["c12_kavg"])

    # ---- processed data
    files = {
        "catalog.csv": c["catalog"],
        "heptane_cool_flame_sim.csv": hep,
        "c12_three_stage_expt.csv": c["c12_three_stage_expt"],
        "c12_three_stage_sim.csv": c["c12_three_stage_sim"],
        "c12_three_stage_sim_radiance.csv": c["c12_three_stage_sim_radiance"],
        "alkane_extinction_1atm.csv": c["alkane_dext_1atm"],
        "c12_extinction_vs_pressure.csv": c["c12_dext_vs_p"],
        "c12_cool_flame_kavg_vs_pressure.csv": c["c12_kavg"],
        "psi117_tidy_long.csv": tidy_long(c),
        "results_heptane_quasi_steady.csv": qs,
        "results_heptane_oscillation_peaks.csv": peaks,
        "results_c12_model_stages.csv": stages,
        "results_c12_expt_burning_rate.csv": expt_k,
        "results_c12_k_by_stage.csv": k_cmp,
        "results_extinction_summary.csv": ext,
        "results_extinction_threshold.csv": thr,
        "results_c12_matched_extinction.csv": c12m,
        "results_kavg_powerlaw_fits.csv": pt["k_fits"],
        "results_kavg_by_pressure.csv": pt["k_by_pressure"],
        "results_dext_by_pressure.csv": pt["dext_by_pressure"],
        "data_quality_issues.csv": issues,
    }
    for name, df in files.items():
        df.to_csv(config.PROCESSED / name, index=False)

    # ---- figures
    figs = [
        plots.heptane_overview(hep, qs),
        plots.heptane_oscillation(hep, peaks),
        plots.three_stage(c["c12_three_stage_expt"], c["c12_three_stage_sim"],
                          c["c12_three_stage_sim_radiance"], stages),
        plots.three_stage_k(expt_k, c["c12_three_stage_sim"], stages),
        plots.extinction_1atm(c["alkane_dext_1atm"]),
        plots.pressure(c["c12_dext_vs_p"], c["c12_kavg"], pt["k_fits"]),
    ]

    # ---- reports
    write_quality_report(issues)
    write_findings(c, qs, osc, osc_stable, stages, k_cmp, markers, ext, thr, c12m, pt)
    write_data_dictionary(files)
    if verbose:
        print(f"wrote {len(files)} tables to {config.PROCESSED}")
        print(f"wrote {len(figs)} figures to {config.FIGURES}")
        print(f"wrote reports to {config.REPORTS}")
        print(f"data-quality issues: {issues['severity'].value_counts().to_dict()}")
    return dict(clean=c, issues=issues, qs=qs, peaks=peaks, osc=osc, stages=stages, k_cmp=k_cmp,
                markers=markers, ext=ext, thr=thr, c12m=c12m, pt=pt, figures=figs)


def write_quality_report(issues: pd.DataFrame) -> None:
    lines = [
        "# PSI-117 data-quality report",
        "",
        f"Generated by `scripts/run_pipeline.py` on {dt.date.today():%Y-%m-%d}. "
        "Raw values are never overwritten: every rule below adds a cleaned column or a status "
        "next to the original. Severity: **high** changes a result if ignored, **medium** needs "
        "a decision, **low** is informational.",
        "",
        md_table(issues),
        "",
    ]
    (config.REPORTS / "data_quality.md").write_text("\n".join(lines), encoding="utf-8")


def write_findings(c, qs, osc, osc_stable, stages, k_cmp, markers, ext, thr, c12m, pt) -> None:
    q = qs.set_index("case")
    st = stages.set_index("stage")
    fit = pt["k_fits"].set_index("series")
    kbp = pt["k_by_pressure"]
    dvp = pt["dext_by_pressure"].set_index("pressure_atm")
    e_c = ext.set_index(["fuel", "source_type"])
    low_p = kbp[kbp["pressure_atm"] <= 1.25]["model_minus_expt_pct"]
    high_p = kbp[kbp["pressure_atm"] >= 3]["model_minus_expt_pct"]
    hot_win = k_cmp.set_index("model_stage")

    L = [
        "# PSI-117: what the data show",
        "",
        "Every number below is computed by `src/psi117/analysis.py` from the cleaned tables in "
        "`data/processed/`. 'Experiment' means ISS FLEX measurements digitized from the published "
        "figures; 'model' means the authors' detailed-chemistry droplet simulations.",
        "",
        "## 1. n-heptane, 0.5 mm droplet, 5% ozone, 1 atm (simulation only)",
        "",
        f"* Ignition is the same in both cases: peak gas temperature reaches "
        f"{q.loc['stable', 'peak_tmax_ignition_k']:.0f} K at about {1000 * q.loc['stable', 't_peak_tmax_s']:.1f} ms, "
        "then the flame settles into a cool flame.",
        f"* Cutting oxygen from 21% to 10% lowers the cool-flame temperature from "
        f"{q.loc['stable', 'mean_tmax_cool_k']:.0f} K to {q.loc['oscillatory', 'mean_tmax_cool_k']:.0f} K, "
        f"lowers the burning rate from {q.loc['stable', 'k_avg_mm2_s']:.3f} to "
        f"{q.loc['oscillatory', 'k_avg_mm2_s']:.3f} mm²/s "
        f"({100 * (q.loc['oscillatory', 'k_avg_mm2_s'] / q.loc['stable', 'k_avg_mm2_s'] - 1):.0f}%), "
        f"pushes the flame out from {q.loc['stable', 'mean_fsr']:.1f} to {q.loc['oscillatory', 'mean_fsr']:.1f} "
        f"droplet diameters, and stretches burn-out from {q.loc['stable', 'burn_time_s']:.2f} s to "
        f"{q.loc['oscillatory', 'burn_time_s']:.2f} s.",
        f"* At 10% oxygen the cool flame oscillates: {osc['cycles']} cycles before burn-out, the "
        f"temperature swing grows from {osc['swing_first_k']:.0f} K to {osc['swing_last_k']:.0f} K "
        f"(+{osc['prominence_growth_k_per_cycle']:.1f} K per cycle) and the period lengthens from "
        f"{osc['period_first_s']:.3f} s to {osc['period_last_s']:.3f} s. Temperature and flame "
        f"standoff move in opposite directions (correlation of detrended signals "
        f"{osc['corr_tmax_vs_fsr_detrended']:.2f}). The 21% case shows {osc_stable['cycles']} "
        "cycles at the same detection threshold.",
        "* These match the authors' description (dissertation ch. 7): oscillations of ever-increasing "
        "amplitude, with temperature and standoff out of phase.",
        "",
        "## 2. n-dodecane three-stage burning, 2.75 atm with 29% helium (experiment + model)",
        "",
        f"* The model passes through three stages: hot ({st.loc['hot', 'mean_tmax_k']:.0f} K average, "
        f"{st.loc['hot', 'duration_s']:.1f} s), warm ({st.loc['warm', 'mean_tmax_k']:.0f} K, "
        f"{st.loc['warm', 'duration_s']:.1f} s) and cool ({st.loc['cool', 'mean_tmax_k']:.0f} K, "
        f"{st.loc['cool', 'duration_s']:.1f} s). The paper quotes about 970 K and 765 K for the warm "
        "and cool flames, which the cleaned data reproduce.",
        f"* Burning rate, measured vs model, averaged over the model's stage windows: hot "
        f"{hot_win.loc['hot', 'k_expt_mm2_s']:.2f} vs {hot_win.loc['hot', 'k_model_mm2_s']:.2f} mm²/s; "
        f"warm {hot_win.loc['warm', 'k_expt_mm2_s']:.2f} vs {hot_win.loc['warm', 'k_model_mm2_s']:.2f} mm²/s. "
        "The droplet-size history agrees well, as the paper states.",
        f"* Stage timing does not agree: the measured hot-flame diameter disappears and the cool-flame "
        f"diameter appears at t/d0² ≈ {markers['first_cool_flame_diameter_t']:.2f} s/mm², while the model "
        f"leaves its hot stage at {st.loc['hot', 't_over_d02_end']:.2f}. In the model's final window "
        f"(t/d0² {st.loc['cool', 't_over_d02_start']:.2f}-{st.loc['cool', 't_over_d02_end']:.2f}) the "
        f"measured rate is {hot_win.loc['cool', 'k_expt_mm2_s']:.2f} mm²/s against the model's "
        f"{hot_win.loc['cool', 'k_model_mm2_s']:.2f}; the paper notes the model's second stage is "
        "about twice the measured one.",
        "",
        "## 3. Extinction diameters in air at 1 atm",
        "",
        f"* Cool-flame extinction diameter falls with carbon number. Measured means: n-heptane "
        f"{e_c.loc[('n-heptane', 'experiment'), 'cool_dext_mm_mean']:.2f} mm, n-decane "
        f"{e_c.loc[('n-decane', 'experiment'), 'cool_dext_mm_mean']:.2f} mm, n-dodecane "
        f"{e_c.loc[('n-dodecane', 'experiment'), 'cool_dext_mm_mean']:.2f} mm. The model shows the same order "
        f"({e_c.loc[('n-heptane', 'simulation'), 'cool_dext_mm_mean']:.2f}, "
        f"{e_c.loc[('n-decane', 'simulation'), 'cool_dext_mm_mean']:.2f}, "
        f"{e_c.loc[('n-dodecane', 'simulation'), 'cool_dext_mm_mean']:.2f} mm across its d0 range).",
        f"* For n-dodecane the model was run at the measured d0 values. It over-predicts hot-flame "
        f"extinction diameter by {c12m['hot_error_mm'].min():.2f}-{c12m['hot_error_mm'].max():.2f} mm "
        f"and under-predicts cool-flame extinction diameter by "
        f"{-c12m['cool_error_mm'].max():.2f}-{-c12m['cool_error_mm'].min():.2f} mm "
        f"(two of four tests recorded no cool-flame extinction).",
        f"* In the model, n-heptane and n-decane droplets of 3 mm burn to completion and 4 mm droplets "
        f"extinguish, so the model's critical size lies between 3 and 4 mm. The smallest measured "
        f"extinguishing droplets ({thr.set_index('fuel').loc['n-heptane', 'expt_smallest_extinction_d0']:.2f} mm "
        "n-heptane) fall inside that gap, so the data do not test it.",
        "",
        "## 4. n-dodecane vs pressure",
        "",
        f"* Cool-flame extinction diameter drops steeply with pressure: measured "
        f"{dvp.loc[0.5, 'dext_cool_experiment']:.2f} mm at 0.5 atm to {dvp.loc[1.25, 'dext_cool_experiment']:.2f} mm "
        f"at 1.25 atm, and no cool-flame extinction recorded at 3 atm. Hot-flame extinction diameter "
        f"barely moves ({dvp['dext_hot_experiment'].min():.2f}-{dvp['dext_hot_experiment'].max():.2f} mm).",
        f"* Cool-flame burning rate rises with pressure as K ∝ P^{fit.loc['experiment, all points', 'n']:.2f} "
        f"(95% CI {fit.loc['experiment, all points', 'n_ci_low']:.2f}-{fit.loc['experiment, all points', 'n_ci_high']:.2f}, "
        f"R² {fit.loc['experiment, all points', 'r2']:.2f}, {int(fit.loc['experiment, all points', 'points'])} tests); "
        f"removing the two duplicate points gives {fit.loc['experiment, duplicates removed', 'n']:.2f}. "
        f"The model's exponent is flatter, {fit.loc['model', 'n']:.2f} "
        f"({fit.loc['model', 'n_ci_low']:.2f}-{fit.loc['model', 'n_ci_high']:.2f}).",
        f"* The model is {low_p.min():.0f}-{low_p.max():.0f}% too fast at 0.5-1.25 atm and within "
        f"{abs(high_p).max():.0f}% at 3-5 atm.",
        "",
        "## 5. Why this matters for spacecraft fire safety",
        "",
        "* Cool flames keep a droplet burning after the visible flame is gone. In section 2 the "
        f"measured hot flame is gone by t/d0² ≈ {markers['first_cool_flame_diameter_t']:.2f}, yet the "
        f"droplet keeps shrinking until {markers['last_droplet_t']:.2f}: about "
        f"{100 * (1 - markers['first_cool_flame_diameter_t'] / markers['last_droplet_t']):.0f}% of its burn "
        "time with no hot flame for a hot-flame camera or sensor to see.",
        "* Lower pressure makes cool-flame extinction happen at larger droplet sizes (section 4). "
        "Planned lunar habitats run below 1 atm, so this is the direction they move in, but these "
        "data stop at 0.5 atm and cover 21% oxygen only.",
        "* None of these data are at elevated oxygen or in partial gravity. They cannot be "
        "extrapolated to a ~30% O2, 10.2 psi lunar habitat without saying so.",
        "",
        "## Open questions (see data_quality.md)",
        "",
        "1. Two column labels in the three-stage file look wrong (flame diameter vs ratio).",
        "2. Whether 'Dext_CF_ErrorBar+/-' are absolute bounds or offsets.",
        "3. Three data files listed in the ReadMe were not in the upload.",
        "",
    ]
    (config.REPORTS / "findings.md").write_text("\n".join(L), encoding="utf-8")


DICTIONARY = {
    "dataset_id": "which PSI-117 file the row comes from",
    "source_type": "experiment (ISS FLEX measurement, digitized) or simulation (model output)",
    "case": "n-heptane only: stable (21% O2) or oscillatory (10% O2)",
    "quantity": "what the value measures; '(interpreted)' marks a reinterpreted column label",
    "value": "the number; never altered from the raw file except where status says otherwise",
    "x_name / x_value / x_unit": "the independent variable (time, t/d0², d0 or pressure)",
    "status": "ok, or why the value is set aside (not_detected, duplicate, no_extinction_recorded, ...)",
    "d0_mm_condition, pressure_atm_condition": "test conditions from the corrected catalog",
    "x_o2, x_n2, x_he, x_o3": "ambient mole fractions (sum to 1)",
    "t_ambient_k": "ambient temperature",
    "doi, figure": "paper and figure the data reproduce",
    "source_file, source_line": "raw file and 1-based line number, for tracing any value back",
    "t_over_d02_s_mm2": "time divided by initial diameter squared (s/mm²)",
    "d2_over_d02": "(D/D0)², normalised droplet surface area",
    "k_mm2_s": "burning rate K = -d(D²)/dt",
    "tmax_k": "peak gas-phase temperature anywhere around the droplet",
    "d_tmax_over_d": "radius of peak temperature over droplet radius = flame standoff ratio",
    "*_masked": "same column with values hidden where D/D0 < 0.1 (ratio diverges)",
    "stage": "model stage from tmax_k: hot >= 1200 K, warm 870-1200 K, cool < 870 K",
}


def write_data_dictionary(files: dict) -> None:
    lines = ["# Data dictionary", "", "## Output files (data/processed/)", ""]
    for name, df in files.items():
        lines.append(f"* `{name}`: {len(df)} rows, {df.shape[1]} columns")
    lines += ["", "## Columns", "", "| column | meaning |", "|---|---|"]
    lines += [f"| `{k}` | {v} |" for k, v in DICTIONARY.items()]
    (config.REPORTS / "data_dictionary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
