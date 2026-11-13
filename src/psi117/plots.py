"""Figures. Conventions used in every chart:

* experiment = markers, simulation = lines, in the SAME color when they describe
  the same thing, so measured and modelled values are never confused;
* colors are assigned in a fixed order (validated for color-vision deficiency):
  slot 1 blue, slot 2 orange, slot 3 aqua;
* every series is named in a legend and, where there is room, labelled directly;
* model burning stages (hot / warm / cool) are shaded gray and labelled in text.
"""
from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import matplotlib.ticker  # noqa: E402,F401
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from . import config  # noqa: E402

SLOT = ["#2a78d6", "#eb6834", "#1baf7a"]
INK, INK2, MUTED, GRID, SURFACE = "#0b0b0b", "#52514e", "#8a8984", "#e6e5e1", "#fcfcfb"
STAGE_FILL = {"hot": "#ebeae6", "warm": "#f4f3ef", "cool": "#e2e1dc"}

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "axes.edgecolor": MUTED, "axes.labelcolor": INK2, "axes.titlecolor": INK,
    "axes.titlesize": 11, "axes.titleweight": "bold", "axes.titlelocation": "left",
    "axes.labelsize": 9.5, "xtick.color": INK2, "ytick.color": INK2,
    "xtick.labelsize": 8.5, "ytick.labelsize": 8.5, "axes.grid": True,
    "grid.color": GRID, "grid.linewidth": 0.6, "axes.spines.top": False,
    "axes.spines.right": False, "legend.frameon": False, "legend.fontsize": 8.5,
    "lines.linewidth": 1.6, "lines.markersize": 5.5, "font.size": 9.5,
})

EXPT = dict(linestyle="none", marker="o", markeredgecolor=SURFACE, markeredgewidth=0.6)


def _save(fig, name: str, note: str | None = None) -> str:
    if note:
        fig.text(0.01, 0.005, note, fontsize=7.5, color=INK2, ha="left", va="bottom")
    config.FIGURES.mkdir(parents=True, exist_ok=True)
    path = config.FIGURES / name
    fig.savefig(path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    return str(path)


def _shade_stages(ax, stages: pd.DataFrame, x0: str = "t_over_d02_start", x1: str = "t_over_d02_end",
                  label: bool = True) -> None:
    for _, s in stages.iterrows():
        ax.axvspan(s[x0], s[x1], color=STAGE_FILL[s["stage"]], zorder=0, lw=0)
        if label:
            ax.text((s[x0] + s[x1]) / 2, 0.98, f"model {s['stage']}", transform=ax.get_xaxis_transform(),
                    ha="center", va="top", fontsize=7.5, color=INK2)


# ---------------------------------------------------------------- n-heptane
def heptane_overview(hep: pd.DataFrame, qs: pd.DataFrame) -> str:
    cases = [("stable", "XO2 = 21%, steady cool flame"), ("oscillatory", "XO2 = 10%, oscillating")]
    fig, axes = plt.subplots(2, 2, figsize=(10, 6.6), sharex=True)
    panels = [("d2_over_d02", "(D/D0)²", "Droplet size"),
              ("tmax_k", "peak gas temperature (K)", "Peak gas temperature"),
              ("k_mm2_s", "burning rate K (mm²/s)", "Burning rate"),
              ("d_tmax_over_d_masked", "flame standoff ratio D_Tmax/D", "Flame standoff ratio")]
    for ax, (col, ylab, title) in zip(axes.flat, panels):
        for i, (case, lab) in enumerate(cases):
            g = hep[hep["case"] == case].drop_duplicates("time_s")
            ax.plot(g["time_s"], g[col], color=SLOT[i], label=lab)
        ax.set_title(title)
        ax.set_ylabel(ylab)
    axes[0, 1].set_ylim(600, 1200)
    axes[1, 0].set_ylim(-0.3, 0.4)
    axes[1, 1].set_ylim(0, 20)
    for ax in axes[1]:
        ax.set_xlabel("time (s)")
    axes[0, 0].legend(loc="upper right")
    # direct labels at the quasi-steady cool flame level
    for i, (case, _) in enumerate(cases):
        r = qs.set_index("case").loc[case]
        axes[0, 1].annotate(f"{r['mean_tmax_cool_k']:.0f} K", xy=(0.45, r["mean_tmax_cool_k"]),
                            xytext=(0, 6 if i == 0 else -12), textcoords="offset points",
                            color=INK, fontsize=8)
    fig.suptitle("n-heptane droplet, d0 = 0.5 mm, 5% ozone, 1 atm: simulation (Alam et al. 2019, Fig. 1)",
                 x=0.01, ha="left", fontsize=11, color=INK)
    fig.tight_layout(rect=(0, 0.03, 1, 0.97))
    return _save(fig, "fig01_heptane_stable_vs_oscillatory.png",
                 "Simulation only. Standoff ratio hidden where D/D0 < 0.1 (it diverges as the droplet vanishes).")


def heptane_oscillation(hep: pd.DataFrame, peaks: pd.DataFrame) -> str:
    g = hep[hep["case"] == "oscillatory"].drop_duplicates("time_s")
    fig = plt.figure(figsize=(10, 3.6))
    gs = fig.add_gridspec(1, 3, width_ratios=[2.2, 1, 1])
    ax = fig.add_subplot(gs[0])
    ax.plot(g["time_s"], g["tmax_k"], color=SLOT[1], label="peak gas temperature")
    ax.plot(peaks["time_s"], peaks["tmax_k"], linestyle="none", marker="v", color=INK,
            markersize=6, label="detected peaks")
    ax.set_ylim(640, 780)
    ax.set_xlim(0.05, 1.05)
    ax.set_xlabel("time (s)")
    ax.set_ylabel("K")
    ax.set_title("Oscillating cool flame, XO2 = 10%")
    ax.legend(loc="lower left")
    ax2 = fig.add_subplot(gs[1])
    ax2.plot(peaks["cycle"], peaks["swing_k"], marker="o", color=SLOT[1])
    ax2.set_title("Swing grows")
    ax2.set_xlabel("cycle")
    ax2.set_ylabel("peak minus prior trough (K)")
    ax3 = fig.add_subplot(gs[2])
    ax3.plot(peaks["cycle"], peaks["period_s"], marker="o", color=SLOT[1])
    ax3.set_title("Period lengthens")
    ax3.set_xlabel("cycle")
    ax3.set_ylabel("period (s)")
    fig.tight_layout(rect=(0, 0.05, 1, 1))
    return _save(fig, "fig02_heptane_oscillation_cycles.png",
                 "Simulation only. Peaks found with scipy find_peaks (prominence >= 2 K) before burn-out ((D/D0)² > 0.05).")


# ---------------------------------------------------------------- n-dodecane three stage
def three_stage(expt: pd.DataFrame, sim: pd.DataFrame, rad: pd.DataFrame, stages: pd.DataFrame) -> str:
    ok = expt[expt["status"].isin(["ok", "below_zero_noise"])].copy()
    ok["value_plot"] = ok["value"].clip(lower=0)
    q = lambda name: ok[ok["quantity_interpreted"] == name]  # noqa: E731
    fig, axes = plt.subplots(2, 2, figsize=(10.5, 7), sharex=True)

    ax = axes[0, 0]
    _shade_stages(ax, stages, label=False)
    d = q("d2_over_d02")
    ax.plot(d["t_over_d02_s_mm2"], d["value_plot"], color=SLOT[0], label="experiment (FLEX 1268)", **EXPT)
    ax.plot(sim["t_over_d02_s_mm2"], sim["d2_over_d02"], color=SLOT[0], label="model")
    ax.set_ylabel("(D/D0)²")
    ax.set_title("Droplet size")
    ax.legend(loc="lower left")

    ax = axes[0, 1]
    _shade_stages(ax, stages)
    ax.plot(sim["t_over_d02_s_mm2"], sim["tmax_k"], color=SLOT[1], label="model peak gas temperature")
    for _, s in stages.iterrows():
        if s["stage"] == "hot":
            xy, ha = ((s["t_over_d02_start"] + s["t_over_d02_end"]) / 2, 800), "center"
        elif s["stage"] == "warm":
            xy, ha = ((s["t_over_d02_start"] + s["t_over_d02_end"]) / 2, s["mean_tmax_k"] + 70), "center"
        else:
            xy, ha = (s["t_over_d02_end"] + 0.03, s["mean_tmax_k"]), "left"
        ax.text(*xy, f"avg {s['mean_tmax_k']:.0f} K", ha=ha, va="center", fontsize=8, color=INK)
    ax.set_ylabel("K")
    ax.set_title("Model peak gas temperature (no measurement)")
    ax.set_ylim(600, 2800)
    ax.set_xlim(right=2.15)

    ax = axes[1, 0]
    _shade_stages(ax, stages, label=False)
    fd = q("flame_diameter_mm (interpreted)")
    ax.plot(fd["t_over_d02_s_mm2"], fd["value_plot"], color=SLOT[0],
            label="expt flame diameter*", **EXPT)
    cf = q("cool_flame_diameter_fwhm")
    ax.plot(cf["t_over_d02_s_mm2"], cf["value_plot"], color=SLOT[1], label="expt cool-flame diameter, FWHM",
            **{**EXPT, "marker": "s"})
    m = sim[sim["t_over_d02_s_mm2"] > 0.01]
    ax.plot(m["t_over_d02_s_mm2"], m["dflame_mm"], color=SLOT[0], label="model flame diameter")
    ax.set_ylim(0, 40)
    ax.set_ylabel("mm")
    ax.set_xlabel("t / d0² (s/mm²)")
    ax.set_title("Flame diameter")
    ax.legend(loc="upper left", fontsize=7.5)

    ax = axes[1, 1]
    _shade_stages(ax, stages, label=False)
    for i, name in enumerate(["flame_radiance_I", "flame_radiance_II"]):
        r = q(name)
        ax.plot(r["t_over_d02_s_mm2"], r["value_plot"], color=SLOT[i],
                label=f"expt radiance {name[-2:].strip('_')}", **{**EXPT, "markersize": 4})
    ax.plot(rad["t_over_d02_s_mm2"], rad["radiance_w"], color=SLOT[2], label="model radiance")
    ax.annotate("hot-flame re-ignition\n(experiment only)", xy=(1.29, 55), xytext=(0.62, 48),
                fontsize=7.5, color=INK2, arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8))
    ax.set_ylabel("W")
    ax.set_xlabel("t / d0² (s/mm²)")
    ax.set_title("Radiant emission")
    ax.legend(loc="upper right")
    fig.suptitle("n-dodecane, 2.75 atm, 21% O2 / 29% He / 50% N2: ISS measurement vs model "
                 "(Farouk et al. 2019, Fig. 7)", x=0.01, ha="left", fontsize=11, color=INK)
    fig.tight_layout(rect=(0, 0.03, 1, 0.97))
    return _save(fig, "fig03_dodecane_three_stage.png",
                 "Gray bands: model stages from peak gas temperature (hot >= 1200 K, warm 870-1200 K, cool < 870 K). "
                 "*Column labelled 'Dflame/Dodrop' read as mm - see data_quality.md.")


def three_stage_k(expt_k: pd.DataFrame, sim: pd.DataFrame, stages: pd.DataFrame) -> str:
    fig, ax = plt.subplots(figsize=(8, 3.8))
    _shade_stages(ax, stages)
    ax.plot(expt_k["t_over_d02_s_mm2"], expt_k["k_mm2_s"], color=SLOT[0],
            label="experiment, local slope of (D/D0)² (±0.06 window)", **EXPT)
    m = sim[sim["t_over_d02_s_mm2"] > 0.003]
    ax.plot(m["t_over_d02_s_mm2"], m["k_mm2_s"], color=SLOT[0], label="model")
    ax.set_ylim(-0.2, max(1.0, float(np.nanmax(expt_k["k_mm2_s"]))) + 0.1)
    peak = expt_k.loc[expt_k["k_mm2_s"].idxmax()]
    ax.annotate("re-ignition (experiment)", xy=(peak["t_over_d02_s_mm2"], peak["k_mm2_s"]),
                xytext=(0.80, 0.90), fontsize=7.5, color=INK2, va="center",
                arrowprops=dict(arrowstyle="-", color=MUTED, lw=0.8))
    ax.set_xlabel("t / d0² (s/mm²)")
    ax.set_ylabel("burning rate K (mm²/s)")
    ax.set_title("n-dodecane burning rate, measured vs model")
    ax.legend(loc="lower center", bbox_to_anchor=(0.55, 0.0))
    fig.tight_layout(rect=(0, 0.05, 1, 1))
    return _save(fig, "fig04_dodecane_burning_rate.png",
                 "K = -d[(D/D0)²]/d(t/d0²) gives mm²/s directly, so the experiment needs no d0 value.")


# ---------------------------------------------------------------- extinction diameters
def extinction_1atm(dext: pd.DataFrame) -> str:
    fuels = ["n-heptane", "n-decane", "n-dodecane"]
    fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.2))
    for ax, col, status, title in [(axes[0], "dext_hot_mm_clean", "status_hot", "Hot-flame extinction"),
                                   (axes[1], "dext_cool_mm_clean", "status_cool", "Cool-flame extinction")]:
        for i, fuel in enumerate(fuels):
            f = dext[dext["fuel"] == fuel]
            e, s = f[f["source_type"] == "experiment"], f[f["source_type"] == "simulation"].sort_values("d0_mm")
            ax.plot(e["d0_mm"], e[col], color=SLOT[i], label=f"{fuel} experiment", **EXPT)
            ax.plot(s["d0_mm"], s[col], color=SLOT[i], marker=".", label=f"{fuel} model")
            none = f[f[status] != "ok"]
            ax.plot(none["d0_mm"] + (i - 1) * 0.06, np.zeros(len(none)), linestyle="none", marker="x",
                    color=SLOT[i], markersize=7)
        ax.set_title(title)
        ax.set_xlabel("initial droplet diameter d0 (mm)")
        ax.set_ylabel("extinction diameter (mm)")
        ax.set_ylim(bottom=-0.2)
    axes[0].plot([2, 7], [2, 7], color=MUTED, lw=0.8, ls="--")
    axes[0].text(6.0, 6.25, "Dext = d0", color=INK2, fontsize=7.5, rotation=33)
    handles, labels = axes[1].get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", ncol=3, bbox_to_anchor=(0.5, 0.03), fontsize=8)
    fig.suptitle("Extinction diameters in air, 1 atm (Farouk & Dryer 2023, Fig. 3)", x=0.01, ha="left",
                 fontsize=11, color=INK)
    fig.tight_layout(rect=(0, 0.17, 1, 0.95))
    return _save(fig, "fig05_extinction_diameter_1atm.png",
                 "x at 0 = no extinction recorded (file value 0; excluded from statistics).")


def pressure(dvp: pd.DataFrame, kavg: pd.DataFrame, fits: pd.DataFrame) -> str:
    fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.2))
    ax = axes[0]
    ok = dvp[dvp["status"] == "ok"]
    for i, (qty, lab) in enumerate([("dext_cool", "cool flame"), ("dext_hot", "hot flame")]):
        e = ok[(ok["quantity"] == qty) & (ok["source_type"] == "experiment")]
        s = ok[(ok["quantity"] == qty) & (ok["source_type"] == "simulation")].sort_values("pressure_atm")
        ax.plot(e["pressure_atm"], e["value_clean_mm"], color=SLOT[i], label=f"{lab}, experiment", **EXPT)
        ax.plot(s["pressure_atm"], s["value_clean_mm"], color=SLOT[i], marker=".", label=f"{lab}, model")
    lo = ok[ok["quantity"] == "dext_cool_bound_lower"].sort_values("pressure_atm")
    hi = ok[ok["quantity"] == "dext_cool_bound_upper"].sort_values("pressure_atm")
    ax.fill_between(lo["pressure_atm"], lo["value_clean_mm"], hi["value_clean_mm"], color=SLOT[0],
                    alpha=0.12, lw=0, label="cool-flame bounds (to confirm)")
    ax.set_xlabel("pressure (atm)")
    ax.set_ylabel("extinction diameter (mm)")
    ax.set_title("n-dodecane extinction diameter vs pressure")
    ax.legend(loc="center right", fontsize=7.5)

    ax = axes[1]
    e = kavg[kavg["source_type"] == "experiment"]
    s = kavg[kavg["source_type"] == "simulation"].sort_values("pressure_atm")
    ax.plot(e["pressure_atm"], e["k_mm2_s"], color=SLOT[0], label="experiment", **EXPT)
    ax.plot(s["pressure_atm"], s["k_mm2_s"], color=SLOT[0], marker=".", label="model")
    pp = np.linspace(0.45, 5.5, 50)
    for _, f in fits.iterrows():
        if f["series"] == "experiment, all points":
            ax.plot(pp, f["a"] * pp ** f["n"], color=MUTED, ls="--", lw=1)
            ax.text(2.1, f["a"] * 2.1 ** f["n"] - 0.03, f"fit to experiment: K ∝ P^{f['n']:.2f}",
                    color=INK2, fontsize=8)
    ax.set_xscale("log")
    ax.set_xticks([0.5, 1, 2, 5], ["0.5", "1", "2", "5"])
    ax.xaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
    ax.set_xlabel("pressure (atm, log scale)")
    ax.set_ylabel("cool-flame burning rate (mm²/s)")
    ax.set_title("n-dodecane cool-flame burning rate")
    ax.legend(loc="upper left")
    fig.tight_layout(rect=(0, 0.05, 1, 1))
    return _save(fig, "fig06_dodecane_pressure_trends.png",
                 "Left: Farouk & Dryer 2023, Fig. 7. Right: Dietrich et al. 2024, Fig. 4. "
                 "No cool-flame extinction recorded at 3 atm in the experiment.")
