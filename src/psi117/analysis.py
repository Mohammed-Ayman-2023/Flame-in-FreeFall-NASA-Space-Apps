"""Analysis on the cleaned tables. Every function returns plain DataFrames/dicts
so results can be written to CSV, quoted in the findings report, or shown in a
notebook. Nothing here re-reads raw files."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import signal, stats

from . import config


# ---------------------------------------------------------------- shared helpers
def local_slope(x: np.ndarray, y: np.ndarray, half_width: float) -> np.ndarray:
    """Least-squares slope of y(x) in a moving window of +/- half_width."""
    out = np.full(len(x), np.nan)
    for i, xi in enumerate(x):
        m = np.abs(x - xi) <= half_width
        if m.sum() >= 4 and np.ptp(x[m]) > 0:
            out[i] = np.polyfit(x[m], y[m], 1)[0]
    return out


def power_law_fit(p: np.ndarray, k: np.ndarray) -> dict:
    """Fit k = a * p**n by linear regression in log-log space; 95% CI on n."""
    res = stats.linregress(np.log(p), np.log(k))
    tcrit = stats.t.ppf(0.975, len(p) - 2)
    return dict(n=res.slope, n_ci_low=res.slope - tcrit * res.stderr,
                n_ci_high=res.slope + tcrit * res.stderr, a=np.exp(res.intercept),
                r2=res.rvalue ** 2, points=len(p))


# ---------------------------------------------------------------- n-heptane: stable vs oscillatory
def heptane_quasi_steady(hep: pd.DataFrame) -> pd.DataFrame:
    """Cool-flame quasi-steady averages for each case (0.8 > (D/D0)^2 > 0.2)."""
    rows = []
    for case, g in hep.groupby("case"):
        g = g.drop_duplicates("time_s")
        win = g[(g["d2_over_d02"] < 0.8) & (g["d2_over_d02"] > 0.2)]
        # average K = -(change in D^2)/(elapsed time) over the window
        k_avg = -(win["d_mm"].iat[-1] ** 2 - win["d_mm"].iat[0] ** 2) / (
            win["time_s"].iat[-1] - win["time_s"].iat[0])
        rows.append(dict(
            case=case, x_o2=g["x_o2"].iat[0], x_o3=g["x_o3"].iat[0],
            peak_tmax_ignition_k=g["tmax_k"].max(),
            t_peak_tmax_s=g.loc[g["tmax_k"].idxmax(), "time_s"],
            mean_tmax_cool_k=np.average(win["tmax_k"], weights=np.gradient(win["time_s"])),
            k_avg_mm2_s=k_avg,
            mean_fsr=win["d_tmax_over_d"].mean(),
            burn_time_s=g.loc[g["d2_over_d02"] > 1e-3, "time_s"].max(),
        ))
    return pd.DataFrame(rows)


def heptane_oscillations(hep: pd.DataFrame, case: str = "oscillatory",
                         t_start: float = 0.05, prominence_k: float = 2.0) -> tuple[pd.DataFrame, dict]:
    """Peaks of the peak gas temperature during cool-flame burning."""
    g = hep[(hep["case"] == case)].drop_duplicates("time_s")
    # stop before burn-out, where the temperature falls for reasons unrelated to oscillation
    g = g[(g["time_s"] > t_start) & (g["d2_over_d02"] > 0.05)]
    t, T = g["time_s"].to_numpy(), g["tmax_k"].to_numpy()
    peaks, props = signal.find_peaks(T, prominence=prominence_k)
    troughs, _ = signal.find_peaks(-T, prominence=prominence_k)
    pk = pd.DataFrame(dict(cycle=np.arange(1, len(peaks) + 1), time_s=t[peaks], tmax_k=T[peaks],
                           prominence_k=props["prominences"]))
    pk["period_s"] = pk["time_s"].diff()
    # peak-to-trough swing: each peak minus the trough just before it
    swing = []
    for p in peaks:
        before = troughs[troughs < p]
        swing.append(T[p] - T[before[-1]] if len(before) else np.nan)
    pk["swing_k"] = swing
    summary = dict(case=case, cycles=len(peaks))
    if len(peaks) >= 3:
        fit = stats.linregress(pk["cycle"], pk["prominence_k"])
        summary.update(
            first_peak_s=pk["time_s"].iat[0], last_peak_s=pk["time_s"].iat[-1],
            period_first_s=pk["period_s"].iat[1], period_last_s=pk["period_s"].iat[-1],
            swing_first_k=pk["swing_k"].dropna().iat[0], swing_last_k=pk["swing_k"].iat[-1],
            prominence_growth_k_per_cycle=fit.slope, prominence_growth_p=fit.pvalue)
        # are Tmax and the flame standoff ratio out of phase? correlate detrended signals
        fsr = g["d_tmax_over_d"].to_numpy()
        win = (t > pk["time_s"].iat[0]) & (t < pk["time_s"].iat[-1])
        detr = lambda v: signal.detrend(v[win])  # noqa: E731
        summary["corr_tmax_vs_fsr_detrended"] = float(np.corrcoef(detr(T), detr(fsr))[0, 1])
    return pk, summary


# ---------------------------------------------------------------- n-dodecane three stage
def three_stage_model_stages(sim: pd.DataFrame) -> pd.DataFrame:
    """Durations and averages of the hot / warm / cool stages in the model."""
    s = sim.sort_values("time_s").reset_index(drop=True)
    s["run"] = (s["stage"] != s["stage"].shift()).cumsum()
    rows = []
    for _, g in s.groupby("run"):
        if len(g) < 3:
            continue
        t0, t1 = g["time_s"].iat[0], g["time_s"].iat[-1]
        rows.append(dict(
            stage=g["stage"].iat[0], t_start_s=t0, t_end_s=t1, duration_s=t1 - t0,
            t_over_d02_start=g["t_over_d02_s_mm2"].iat[0], t_over_d02_end=g["t_over_d02_s_mm2"].iat[-1],
            mean_tmax_k=np.average(g["tmax_k"], weights=np.gradient(g["time_s"])) if t1 > t0 else np.nan,
            k_avg_mm2_s=-(g["d_mm"].iat[-1] ** 2 - g["d_mm"].iat[0] ** 2) / (t1 - t0) if t1 > t0 else np.nan,
            d_start_mm=g["d_mm"].iat[0], d_end_mm=g["d_mm"].iat[-1]))
    return pd.DataFrame(rows)


def three_stage_expt_burning_rate(expt: pd.DataFrame, half_width: float = 0.06) -> pd.DataFrame:
    """Measured K(t) = -d[(D/D0)^2]/d(t/d0^2), in mm^2/s (no d0 needed)."""
    d = expt[(expt["quantity_interpreted"] == "d2_over_d02") & (expt["status"] != "duplicate")]
    d = d[d["t_over_d02_s_mm2"] >= 0].sort_values("t_over_d02_s_mm2").drop_duplicates("t_over_d02_s_mm2")
    x, y = d["t_over_d02_s_mm2"].to_numpy(), d["value"].to_numpy()
    return pd.DataFrame(dict(t_over_d02_s_mm2=x, d2_over_d02=y,
                             k_mm2_s=-local_slope(x, y, half_width), source_type="experiment"))


def three_stage_compare_k(expt_k: pd.DataFrame, sim: pd.DataFrame, stages: pd.DataFrame) -> pd.DataFrame:
    """Average K over each model stage window, measured vs model."""
    rows = []
    for _, st in stages.iterrows():
        lo, hi = st["t_over_d02_start"], st["t_over_d02_end"]
        e = expt_k[(expt_k["t_over_d02_s_mm2"] >= lo) & (expt_k["t_over_d02_s_mm2"] <= hi)]
        e_avg = np.nan
        if len(e) >= 3:
            e_avg = -np.polyfit(e["t_over_d02_s_mm2"], e["d2_over_d02"], 1)[0]
        rows.append(dict(model_stage=st["stage"], t_over_d02_window=f"{lo:.2f}-{hi:.2f}",
                         k_model_mm2_s=st["k_avg_mm2_s"], k_expt_mm2_s=e_avg, expt_points=len(e)))
    return pd.DataFrame(rows)


def three_stage_expt_markers(expt: pd.DataFrame) -> dict:
    """Simple time markers in the measured signals (t/d0^2)."""
    ok = expt[expt["status"].isin(["ok", "below_zero_noise"])]
    cf = ok[ok["quantity_interpreted"] == "cool_flame_diameter_fwhm"]
    fd = ok[ok["quantity_interpreted"] == "flame_diameter_mm (interpreted)"]
    d2 = ok[(ok["quantity_interpreted"] == "d2_over_d02")]
    return dict(
        first_cool_flame_diameter_t=cf["t_over_d02_s_mm2"].min(),
        last_cool_flame_diameter_t=cf["t_over_d02_s_mm2"].max(),
        last_flame_diameter_t=fd["t_over_d02_s_mm2"].max(),
        last_droplet_t=d2["t_over_d02_s_mm2"].max(),
        final_d2_over_d02=d2.sort_values("t_over_d02_s_mm2")["value"].iat[-1],
    )


# ---------------------------------------------------------------- extinction diameters at 1 atm
def extinction_summary(dext: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (fuel, src), g in dext.groupby(["fuel", "source_type"], sort=False):
        rows.append(dict(
            fuel=fuel, source_type=src, cases=len(g),
            d0_range_mm=f"{g['d0_mm'].min():.2f}-{g['d0_mm'].max():.2f}",
            hot_dext_over_d0_mean=g["dext_hot_over_d0"].mean(),
            cool_dext_mm_mean=g["dext_cool_mm_clean"].mean(),
            cool_dext_mm_sd=g["dext_cool_mm_clean"].std(),
            cool_dext_over_d0_mean=g["dext_cool_over_d0"].mean(),
            no_extinction_cases=int((g["status_cool"] != "ok").sum())))
    return pd.DataFrame(rows)


def model_extinction_threshold(dext: pd.DataFrame) -> pd.DataFrame:
    """Smallest d0 the model extinguishes vs largest it burns to completion."""
    rows = []
    sim = dext[dext["source_type"] == "simulation"]
    for fuel, g in sim.groupby("fuel", sort=False):
        none = g.loc[g["status_hot"] != "ok", "d0_mm"]
        ext = g.loc[g["status_hot"] == "ok", "d0_mm"]
        expt = dext[(dext["fuel"] == fuel) & (dext["source_type"] == "experiment")]
        rows.append(dict(fuel=fuel,
                         model_largest_no_extinction_d0=none.max() if len(none) else np.nan,
                         model_smallest_extinction_d0=ext.min() if len(ext) else np.nan,
                         expt_smallest_extinction_d0=expt.loc[expt["status_hot"] == "ok", "d0_mm"].min()))
    return pd.DataFrame(rows)


def c12_matched_extinction(dext: pd.DataFrame) -> pd.DataFrame:
    """n-dodecane: the model was run at the measured d0 values, so compare directly."""
    c12 = dext[dext["fuel"] == "n-dodecane"]
    e = c12[c12["source_type"] == "experiment"].set_index("d0_mm")
    s = c12[c12["source_type"] == "simulation"].set_index("d0_mm")
    j = e[["dext_hot_mm_clean", "dext_cool_mm_clean", "status_cool"]].join(
        s[["dext_hot_mm_clean", "dext_cool_mm_clean"]], lsuffix="_expt", rsuffix="_model", how="inner")
    j["hot_error_mm"] = j["dext_hot_mm_clean_model"] - j["dext_hot_mm_clean_expt"]
    j["cool_error_mm"] = j["dext_cool_mm_clean_model"] - j["dext_cool_mm_clean_expt"]
    return j.reset_index()


# ---------------------------------------------------------------- pressure trends (n-dodecane)
def pressure_trends(dvp: pd.DataFrame, kavg: pd.DataFrame) -> dict[str, pd.DataFrame]:
    fits = []
    e = kavg[kavg["source_type"] == "experiment"]
    for label, sub in (("experiment, all points", e),
                       ("experiment, duplicates removed", e[e["status"] == "ok"]),
                       ("model", kavg[kavg["source_type"] == "simulation"])):
        fits.append(dict(series=label, **power_law_fit(sub["pressure_atm"].to_numpy(),
                                                       sub["k_mm2_s"].to_numpy())))
    k_stats = (e.groupby("pressure_atm")["k_mm2_s"].agg(["mean", "std", "count"])
               .rename(columns={"mean": "k_expt_mean", "std": "k_expt_sd", "count": "tests"}))
    model = kavg[kavg["source_type"] == "simulation"].set_index("pressure_atm")["k_mm2_s"]
    k_stats["k_model"] = model
    k_stats["model_minus_expt_pct"] = 100 * (k_stats["k_model"] / k_stats["k_expt_mean"] - 1)

    d = dvp[dvp["status"] == "ok"].pivot_table(index="pressure_atm",
                                                columns=["quantity", "source_type"],
                                                values="value_clean_mm", aggfunc="mean")
    d.columns = [f"{q}_{s}" for q, s in d.columns]
    rho = {}
    for col in d.columns:
        sub = d[col].dropna()
        if len(sub) >= 4:
            rho[col] = stats.spearmanr(sub.index, sub.to_numpy()).statistic
    return dict(k_fits=pd.DataFrame(fits), k_by_pressure=k_stats.reset_index(),
                dext_by_pressure=d.reset_index(),
                dext_spearman=pd.DataFrame([rho]).T.rename(columns={0: "spearman_rho_vs_pressure"}))
