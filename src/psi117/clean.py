"""Cleaning rules and data-quality checks.

Principles
----------
* Never overwrite a raw value. Cleaned values go in new columns
  (`value_clean`, `*_masked`) next to the originals, with a `status` column
  that says why a value was set aside.
* Every rule that fires records an `Issue`, which becomes a row in
  reports/data_quality.md.
* Measured and simulated values always stay distinguishable (`source_type`).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from . import config, io


@dataclass
class Issue:
    dataset: str
    severity: str  # "high" (changes a result), "medium" (needs a decision), "low" (cosmetic)
    check: str
    detail: str
    action: str


class IssueLog:
    def __init__(self) -> None:
        self.items: list[Issue] = []

    def add(self, *args) -> None:
        self.items.append(Issue(*args))

    def frame(self) -> pd.DataFrame:
        order = {"high": 0, "medium": 1, "low": 2}
        df = pd.DataFrame([asdict(i) for i in self.items])
        if df.empty:
            return df
        return df.sort_values("severity", key=lambda s: s.map(order), kind="stable")


# ---------------------------------------------------------------- catalog
def clean_catalog(log: IssueLog) -> pd.DataFrame:
    readme = io.load_readme()
    hep = readme[readme["Fuel"] == "n-heptane"]
    if (hep["XN2"] > 1).any():
        log.add("readme", "high", "units",
                f"XN2 for the n-heptane rows is {hep['XN2'].tolist()} (percent) while XO2 is a "
                "fraction; the XO3 column reads 'Balance'.",
                "Set XO3=0.05 and XN2=0.74 / 0.85 (fractions), per dissertation ch. 7: "
                "'XO3 = 5%, balance N2'.")
    listed = set(readme["Data File"].dropna())
    for name in config.MISSING_FROM_UPLOAD:
        if name in listed:
            log.add(name.lower(), "medium", "missing file",
                    f"'{name}' is listed in the ReadMe but was not in the upload.",
                    "Catalogued as unavailable; download from PSI-117 to include it.")
    cat = pd.DataFrame(config.CATALOG)
    cat["x_sum"] = cat[["x_o2", "x_n2", "x_he", "x_o3"]].sum(axis=1).round(6)
    bad = cat.loc[cat["available"] & (cat["x_sum"] != 1.0), "dataset_id"].tolist()
    if bad:
        log.add("catalog", "high", "composition", f"mole fractions do not sum to 1 for {bad}",
                "fix config.CATALOG")
    return cat


# ---------------------------------------------------------------- n-heptane simulations
def clean_heptane(log: IssueLog) -> pd.DataFrame:
    frames = []
    for case in ("stable", "oscillatory"):
        df = io.load_heptane(case).copy()
        did = df["dataset_id"].iat[0]
        d0 = df["d_mm"].iat[0]

        # 1) d^2 consistency: recompute (D/D0)^2 and compare with the file's column
        df["d2_over_d02"] = (df["d_mm"] / d0) ** 2
        err = (df["d2_over_d02"] - df["d2_over_d02_given"]).abs().max()
        log.add(did, "low", "consistency",
                f"recomputed (D/D0)^2 matches the file's column to within {err:.1e}.",
                "Recomputed column used.")

        # 2) burning rate consistency: K = -d(D^2)/dt (on unique time stamps)
        dups = int(df["time_s"].duplicated().sum())
        if dups:
            log.add(did, "low", "precision",
                    f"{dups} repeated time stamps: early times were exported with 3 significant "
                    "figures (e.g. 3.65E-03 appears twice).",
                    "Kept; numerical derivatives use the first row of each time stamp.")
        u = df.drop_duplicates("time_s")
        k_u = -np.gradient(u["d_mm"] ** 2, u["time_s"])
        k_num = pd.Series(k_u, index=u.index).reindex(df.index).ffill().to_numpy()
        df["k_numeric_mm2_s"] = k_num
        quasi = (df["time_s"] > 0.1) & (df["d2_over_d02"] > 0.05)
        rel = np.nanmedian(np.abs(k_num[quasi] - df.loc[quasi, "k_mm2_s"]) /
                           np.abs(df.loc[quasi, "k_mm2_s"]))
        log.add(did, "low", "consistency",
                f"file K vs numerical -d(D^2)/dt during quasi-steady burning: median relative "
                f"difference {rel:.2%}.", "File K kept; numerical K stored as k_numeric_mm2_s.")

        # 3) negative K at the start = liquid heat-up / thermal swelling (D grows slightly)
        heat = df["k_mm2_s"] < 0
        t_end = df.loc[heat, "time_s"].max()
        log.add(did, "low", "physics flag",
                f"K < 0 for {heat.sum()} points up to t = {t_end:.4f} s while D rises to "
                f"{df['d_mm'].max():.6f} mm (droplet heat-up and swelling).",
                "Kept; phase labelled 'heat-up'.")

        # 4) t = 0 initial-condition value for D_OHmax/D
        if df["d_ohmax_over_d"].iat[0] == 1.0 and df["d_ohmax_over_d"].iat[1] > 2:
            log.add(did, "low", "initial condition",
                    "D_OHm/D_drop = 1 at t = 0, then about 7 one step later (initialisation value).",
                    "First row masked for that column.")

        # 5) ratios divide by D, which goes to zero
        small = df["d2_over_d02"] ** 0.5 < config.RATIO_MASK_BELOW_D_OVER_D0
        for col in ("d_tmax_over_d", "d_ohmax_over_d"):
            masked = df[col].where(~small)
            if col == "d_ohmax_over_d":
                masked.iloc[0] = np.nan
            df[f"{col}_masked"] = masked
        log.add(did, "medium", "ratio singularity",
                f"D_Tmax/D and D_OHm/D reach {df['d_tmax_over_d'].max():.0f} and "
                f"{df['d_ohmax_over_d'].max():.0f} as D -> 0 ({small.sum()} points with "
                f"D/D0 < {config.RATIO_MASK_BELOW_D_OVER_D0}).",
                "Masked in *_masked columns; raw values kept.")

        df["phase"] = np.where(heat, "heat-up", "burning")
        df.loc[df["d2_over_d02"] < 1e-3, "phase"] = "burn-out"
        frames.append(df)
    out = pd.concat(frames, ignore_index=True)
    meta = pd.DataFrame(config.CATALOG).set_index("dataset_id")
    for col in ("fuel", "d0_mm", "pressure_atm", "x_o2", "x_n2", "x_o3", "t_ambient_k", "doi"):
        out[col] = out["dataset_id"].map(meta[col])
    return out


# ---------------------------------------------------------------- n-dodecane three stage
SUSPECTED_SWAP = {
    "Dflame/Dodrop (as labelled)": ("flame_diameter_mm (interpreted)", "mm"),
    "Dflame mm (as labelled)": ("unidentified (labelled Dflame mm)", "unknown"),
}


def clean_three_stage(log: IssueLog) -> dict[str, pd.DataFrame]:
    raw = io.load_three_stage()
    expt = raw["expt"].copy()

    # label check. If the 'Dflame/Dodrop' block were a ratio, the flame would be 12-24 droplet
    # diameters (55-100 mm) across, wider than the 50 mm camera view. Read as mm and divided by
    # the measured droplet diameter it gives a standoff ratio, which can be checked for realism.
    sim, flame = raw["sim"], raw["sim_flame"]
    model_fd = flame.loc[flame["t_over_d02_s_mm2"].between(0.05, 0.42), "dflame_mm"].median()
    b2 = expt[expt["quantity_as_labelled"] == "Dflame/Dodrop (as labelled)"].sort_values("t_over_d02_s_mm2")
    b3 = expt[expt["quantity_as_labelled"] == "Dflame mm (as labelled)"].sort_values("t_over_d02_s_mm2")
    d2 = (expt[expt["quantity_as_labelled"] == "d2_over_d02"].sort_values("t_over_d02_s_mm2")
          .drop_duplicates("t_over_d02_s_mm2"))
    d_drop = config.C12_THREE_STAGE_EXPT_D0_MM * np.sqrt(
        np.interp(b2["t_over_d02_s_mm2"], d2["t_over_d02_s_mm2"], d2["value"]).clip(min=0))
    implied = (b2["value"].to_numpy() / d_drop)[b2["t_over_d02_s_mm2"].to_numpy() < 0.36]
    log.add("c12_three_stage", "high", "column labels",
            f"Block labelled 'Dflame/Dodrop' reaches {b2['value'].max():.0f}. "
            f"As a ratio, the flame would be up to {b2['value'].max() * 4.35:.0f} mm across, wider "
            f"than the 50 mm camera view. Read as mm (model flame diameter: median "
            f"{model_fd:.0f} mm), it implies a standoff ratio of {implied.min():.1f}-"
            f"{implied.max():.1f}, which is typical. Block labelled 'Dflame (mm)' runs "
            f"0-{b3['value'].max():.1f}: too small to be a flame diameter "
            "for a 4.35 mm droplet, and it does not equal the implied standoff ratio.",
            "Kept the original labels; quantity_interpreted = flame diameter (mm) for the first "
            "block and 'unidentified' for the second. Confirm against paper Fig. 7.")
    expt["quantity_interpreted"] = expt["quantity_as_labelled"].map(
        lambda q: SUSPECTED_SWAP.get(q, (q, None))[0])
    expt["unit_interpreted"] = expt.apply(
        lambda r: SUSPECTED_SWAP.get(r["quantity_as_labelled"], (None, r["unit_as_labelled"]))[1],
        axis=1)
    log.add("c12_three_stage", "low", "column labels",
            "Header reads 'Cool Flame Dia (HWFM)'; the paper defines a full width at half maximum.",
            "Renamed cool_flame_diameter_fwhm.")

    # digitized curves: non-monotonic x and exact duplicates
    expt["status"] = "ok"
    for q, g in expt.groupby("quantity_as_labelled"):
        back = int((np.diff(g["t_over_d02_s_mm2"].to_numpy()) < 0).sum())
        dup = g.duplicated(subset=["t_over_d02_s_mm2", "value"], keep="first")
        expt.loc[dup[dup].index, "status"] = "duplicate"
        if back or dup.any():
            log.add("c12_three_stage", "low", "digitized curve",
                    f"'{q}': {back} backward steps in t/d0^2 and {int(dup.sum())} exact duplicate "
                    "points (typical of curves digitized from a figure).",
                    "Duplicates flagged; derivatives use points sorted by t/d0^2.")

    # zeros in the cool-flame diameters mean "not detected"
    cf = expt["quantity_as_labelled"].str.startswith("cool_flame_diameter")
    zero = cf & (expt["value"] == 0)
    expt.loc[zero, "status"] = "not_detected"
    log.add("c12_three_stage", "medium", "sentinel zeros",
            f"{int(zero.sum())} cool-flame diameter values are exactly 0 (no cool flame "
            "resolved), mostly near the start and around t/d0^2 = 1.35-1.55.",
            "Status 'not_detected'; excluded from statistics and plots.")

    # negative values near zero (sensor baseline / digitizing noise)
    neg = expt["value"] < 0
    log.add("c12_three_stage", "low", "negative values",
            f"{int(neg.sum())} values are slightly negative (min {expt['value'].min():.3f}).",
            "Status 'below_zero_noise'; kept in the data, clipped to 0 in plots.")
    expt.loc[neg & (expt["status"] == "ok"), "status"] = "below_zero_noise"
    expt["value_clean"] = expt["value"].where(~expt["status"].isin(["not_detected", "duplicate"]))

    log.add("c12_three_stage", "medium", "initial diameter",
            "ReadMe and model use d0 = 4.5 mm; paper Fig. 7 gives the experiment (FLEX 1268) "
            "d0 = 4.35 mm.",
            "Experiment kept on the t/d0^2 axis it was digitized on; 4.35 mm used to convert to mm.")
    expt["d_mm_from_ratio"] = np.where(
        expt["quantity_interpreted"] == "d2_over_d02",
        config.C12_THREE_STAGE_EXPT_D0_MM * np.sqrt(expt["value"].clip(lower=0)), np.nan)

    # simulation blocks
    sim = sim.copy()
    sim["t_over_d02_s_mm2"] = sim["time_s"] / config.C12_THREE_STAGE_SIM_D0_MM ** 2
    sim["d2_over_d02"] = (sim["d_mm"] / config.C12_THREE_STAGE_SIM_D0_MM) ** 2
    merged = pd.merge_asof(sim.sort_values("t_over_d02_s_mm2"),
                           flame[["t_over_d02_s_mm2", "d2_over_d02", "dflame_mm"]]
                           .rename(columns={"d2_over_d02": "d2_block2"})
                           .sort_values("t_over_d02_s_mm2"),
                           on="t_over_d02_s_mm2", direction="nearest")
    err = (merged["d2_over_d02"] - merged["d2_block2"]).abs().max()
    log.add("c12_three_stage", "low", "consistency",
            f"simulation blocks 1 and 2 agree: t/d0^2 = t/4.5^2 and (d/d0)^2 match to {err:.1e}.",
            "Blocks merged into one simulation table.")
    small = np.sqrt(merged["d2_over_d02"]) < config.RATIO_MASK_BELOW_D_OVER_D0
    merged["d_tmax_over_d_masked"] = merged["d_tmax_over_d"].where(~small)
    merged["stage"] = label_stage(merged["tmax_k"])
    merged = merged.drop(columns="d2_block2")
    log.add("c12_three_stage", "low", "coverage",
            f"simulated radiance has {len(raw['sim_radiance'])} points and stops at t/d0^2 = "
            f"{raw['sim_radiance']['t_over_d02_s_mm2'].max():.2f}.", "Plotted over its own range.")
    return {"expt": expt, "sim": merged, "sim_radiance": raw["sim_radiance"]}


def label_stage(tmax: pd.Series) -> pd.Series:
    return pd.Series(np.select([tmax >= config.HOT_MIN_K, tmax >= config.WARM_MIN_K],
                               ["hot", "warm"], default="cool"), index=tmax.index)


# ---------------------------------------------------------------- extinction diameters at 1 atm
def clean_alkane_dext(log: IssueLog) -> pd.DataFrame:
    df = io.load_alkane_dext_1atm().copy()
    for col, label in (("dext_hot_mm", "hot"), ("dext_cool_mm", "cool")):
        zero = df[col] == 0
        df[f"{col}_clean"] = df[col].where(~zero)
        df[f"status_{label}"] = np.where(zero, "no_extinction_recorded", "ok")
        if zero.any():
            who = df.loc[zero, ["fuel_code", "source_type", "d0_mm"]].astype(str).agg(" ".join, axis=1)
            log.add("alkane_dext_1atm", "high", "sentinel zeros",
                    f"{label}-flame extinction diameter = 0 for: {', '.join(who)}. A diameter of "
                    "0 is not an extinction diameter (burned to completion, or no transition).",
                    "Set to NaN with a status; excluded from fits and ratios.")
    df["dext_hot_over_d0"] = df["dext_hot_mm_clean"] / df["d0_mm"]
    df["dext_cool_over_d0"] = df["dext_cool_mm_clean"] / df["d0_mm"]
    return df


# ---------------------------------------------------------------- n-dodecane extinction vs pressure
def clean_c12_dext_vs_p(log: IssueLog) -> pd.DataFrame:
    df = io.load_c12_dext_vs_p().copy()
    zero = (df["value_mm"] == 0) & (df["source_type"] == "experiment")
    df["value_clean_mm"] = df["value_mm"].where(~zero)
    df["status"] = np.where(zero, "no_cool_flame_extinction", "ok")
    log.add("c12_dext_vs_p", "high", "sentinel zeros",
            "Experimental cool-flame extinction diameter and its bounds are 0 at 3 atm (no cool "
            "flame extinction recorded; the paper reports hot/cool cycling above 1 atm).",
            "Set to NaN with a status.")
    log.add("c12_dext_vs_p", "medium", "interpretation",
            "'Dext_CF_ErrorBar+/-' read as absolute bounds (mm). Read as offsets, the 0.5 atm upper "
            "bound would be 1.89 + 2.29 = 4.18 mm, larger than the hot-flame extinction diameter.",
            "Plotted as a bound band labelled 'interpretation to confirm'.")
    return df


# ---------------------------------------------------------------- cool-flame burning rate vs pressure
def clean_c12_kavg(log: IssueLog) -> pd.DataFrame:
    df = io.load_c12_kavg().copy()
    dup = df.duplicated(subset=["source_type", "pressure_atm", "k_mm2_s"], keep="first")
    df["status"] = np.where(dup, "duplicate_value", "ok")
    if dup.any():
        log.add("c12_kavg", "medium", "duplicates",
                f"{int(dup.sum())} experimental points repeat an identical value at the same "
                f"pressure ({df.loc[dup, 'pressure_atm'].tolist()} atm). They may be overlapping "
                "markers digitized twice, or two tests with the same rate.",
                "Kept (cannot tell which); fit run with and without them.")
    return df


# ---------------------------------------------------------------- run everything
def clean_all() -> tuple[dict[str, pd.DataFrame], pd.DataFrame]:
    log = IssueLog()
    out = {
        "catalog": clean_catalog(log),
        "heptane": clean_heptane(log),
        **{f"c12_three_stage_{k}": v for k, v in clean_three_stage(log).items()},
        "alkane_dext_1atm": clean_alkane_dext(log),
        "c12_dext_vs_p": clean_c12_dext_vs_p(log),
        "c12_kavg": clean_c12_kavg(log),
    }
    log.add("all", "medium", "provenance",
            "PSI-117 is a ground (analysis) investigation: the n-heptane cases are simulation "
            "only; the n-dodecane and alkane files mix ISS FLEX measurements with model output.",
            "Every row carries source_type = experiment | simulation.")
    return out, log.frame()
