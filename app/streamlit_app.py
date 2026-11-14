"""Flame in Freefall: dashboard. Run locally with `streamlit run app/streamlit_app.py`."""
from __future__ import annotations

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from fif import models as M  # noqa: E402
from fif import ranking as R  # noqa: E402

# ---------------------------------------------------------------- look and feel (reference data-viz palette)
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
INK, INK2, MUTED, GRID, SURFACE = "#0b0b0b", "#52514e", "#8a8984", "#e6e5e1", "#fcfcfb"
SEQ = ["#fcfcfb", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]
CRITICAL, GOOD, WARNING = "#d03b3b", "#0ca30c", "#fab219"

st.set_page_config(page_title="Flame in Freefall", page_icon="🔥", layout="wide")
st.markdown("""<style>
.block-container {padding-top: 1.6rem; max-width: 1250px;}
h1, h2, h3 {letter-spacing: -0.01em;}
.kpi {border: 1px solid #e6e5e1; border-radius: 10px; padding: 14px 16px; background: #ffffff; height: 100%;}
.kpi .v {font-size: 2.0rem; font-weight: 700; color: #0b0b0b; line-height: 1.1;}
.kpi .l {font-size: 0.86rem; color: #52514e; margin-top: 4px;}
.tag {display:inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.78rem; font-weight: 600;}
.inside {background:#e3f4e3; color:#006300;} .outside {background:#fdecdc; color:#8a3a12;}
.gap {background:#fbe3e3; color:#9b2020;} .thin {background:#fff3d6; color:#7a5200;} .covered {background:#e3f4e3; color:#006300;}
.small {font-size:0.85rem; color:#52514e;}
</style>""", unsafe_allow_html=True)


def base_layout(fig: go.Figure, height=380, **kw) -> go.Figure:
    fig.update_layout(template="simple_white", height=height, margin=dict(l=10, r=10, t=40, b=10),
                      font=dict(family="Inter, Arial, sans-serif", color=INK, size=13), paper_bgcolor="white",
                      plot_bgcolor="white", hoverlabel=dict(bgcolor="white", font_color=INK),
                      legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0), **kw)
    fig.update_xaxes(showgrid=False, linecolor=GRID, tickcolor=GRID, title_font_color=INK2)
    fig.update_yaxes(showgrid=True, gridcolor=GRID, linecolor=GRID, tickcolor=GRID, title_font_color=INK2)
    return fig


def kpi(col, value, label):
    col.markdown(f'<div class="kpi"><div class="v">{value}</div><div class="l">{label}</div></div>',
                 unsafe_allow_html=True)


def tag(label: str) -> str:
    cls = "inside" if label.startswith("inside") else "outside"
    return f'<span class="tag {cls}">{label}</span>'


# ---------------------------------------------------------------- data
@st.cache_data
def load_tables():
    D = pd.read_csv(ROOT / "ml" / "v1" / "D_gas_flames.csv")
    grid = pd.read_csv(ROOT / "models" / "v1" / "D_burn_time_grid.csv")
    tests = pd.read_csv(ROOT / "data" / "processed" / "tests.csv", low_memory=False)
    ev = pd.read_csv(ROOT / "data" / "processed" / "evidence.csv", low_memory=False)
    src = pd.read_csv(ROOT / "ml" / "v1" / "sources_summary.csv")
    cat = pd.read_csv(ROOT / "catalog" / "investigations.csv")
    B = pd.read_csv(ROOT / "ml" / "v1" / "B_solids_spread.csv")
    return D, grid, tests, ev, src, cat, B


@st.cache_data
def load_explain():
    import json
    return (json.loads((ROOT / "models" / "v1" / "explain.json").read_text()),
            pd.read_csv(ROOT / "models" / "v1" / "A_effect_curves.csv"),
            pd.read_csv(ROOT / "models" / "v1" / "C_effect_curves.csv"))


def hbar(labels, values, title, fmt="{:.2f}", color=BLUE, height=260, xrange=None, err=None):
    fig = go.Figure(go.Bar(x=values, y=labels, orientation="h", marker=dict(color=color, line=dict(color="white", width=2)),
                           text=[fmt.format(v) for v in values], textposition="outside",
                           error_x=dict(type="data", symmetric=False, array=err[0], arrayminus=err[1], color=INK2)
                           if err else None, hovertemplate="%{y}: %{x:.3f}<extra></extra>"))
    base_layout(fig, height, xaxis_title=title, showlegend=False)
    fig.update_yaxes(autorange="reversed", showgrid=False)
    if xrange:
        fig.update_xaxes(range=xrange)
    return fig


@st.cache_resource
def load_models():
    return (joblib.load(ROOT / "models" / "v1" / "A_solids.joblib"),
            joblib.load(ROOT / "models" / "v1" / "D_gas_flames.joblib"),
            joblib.load(ROOT / "models" / "v1" / "C_droplets.joblib"))


D, GRID_D, TESTS, EV, SRC, CAT, B = load_tables()

# ---------------------------------------------------------------- sidebar: the mission atmosphere
with st.sidebar:
    st.markdown("### Mission atmosphere")
    st.caption("Default: a crewed habitat at 30 % O2 and 0.69 atm, in microgravity.")
    def _reset():
        st.session_state["o2_pct"], st.session_state["p_atm"] = 30.0, 0.69
    st.session_state.setdefault("o2_pct", 30.0)
    st.session_state.setdefault("p_atm", 0.69)
    o2 = st.slider("Oxygen (%)", 15.0, 40.0, step=0.5, key="o2_pct") / 100
    p = st.slider("Pressure (atm)", 0.40, 1.20, step=0.01, key="p_atm")
    st.caption(f"O2 partial pressure: **{o2 * p:.3f} atm** (Earth sea level: 0.21 atm)")
    st.button("Reset to habitat (30 %, 0.69 atm)", on_click=_reset)
    st.divider()
    st.markdown("**Dataset v1** · 1,517 tests · 14 sources")
    st.caption("NASA PSI open data (CC0) + NASA technical reports. "
               "[Code & data on GitHub](https://github.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps)")
TARGET = dict(x_o2=o2, pressure_atm=p)

st.title("🔥 Flame in Freefall")
st.markdown("##### Which microgravity fire experiments matter for a crewed habitat at "
            f"**{o2:.0%} O2 and {p:.2f} atm**, what do they predict, and what has never been tested?")

tab_find, tab_rank, tab_pred, tab_gap, tab_data = st.tabs(
    ["Key findings", "Relevance ranking", "Predict a fire", "Gap map & recommendations", "Data & sources"])

# ================================================================= 1. KEY FINDINGS
with tab_find:
    g_h = GRID_D[(GRID_D.x_o2 == 0.30) & (GRID_D.pressure_atm == 0.69)].iloc[0]
    g_e = GRID_D[(GRID_D.x_o2 == 0.21) & (GRID_D.pressure_atm == 1.0)].iloc[0]
    c1, c2, c3, c4 = st.columns(4)
    kpi(c1, f"{g_h.median_burn_s / g_e.median_burn_s:.1f}×", "longer burn for a still-air gas flame at habitat vs Earth cabin air (model)")
    kpi(c2, f"{g_h.p_still_burning_30s:.0%}", "of habitat flames predicted still burning after 30 s with no air flow (Earth air: ~0 %)")
    kpi(c3, "0", "smoke-detection tests ever run above 21 % O2 or below 1 atm")
    kpi(c4, "5", "solid-fuel burns within ±5 % O2 and ±0.2 atm of the habitat, none of them in PSI")
    st.write("")

    st.subheader("1 · Cutting the ventilation may not put out a fire in an oxygen-rich habitat")
    st.markdown("Stopping air flow is a standard first step against a spacecraft fire: without flow, a microgravity "
                "flame starves. **ACME CFI-G** gas flames burning in still air did go out on their own at ≤ 25 % O2, "
                "within seconds. At 34-40 % O2 they kept burning, and 30 of 91 were still alight when the crew cut the fuel. "
                "**ACME BRE** reports the same for emulated burning solids.")
    d = D[D.ready_burn_time].copy()
    fig = go.Figure()
    for flag, name, color, sym in ((1, "Went out by itself", BLUE, "circle"),
                                   (0, "Still burning when fuel was cut (burn time is a minimum)", ORANGE, "triangle-up")):
        s = d[d.self_extinguished == flag]
        fig.add_trace(go.Scatter(x=s.x_o2 * 100, y=s.burn_time_s, mode="markers", name=name,
                                 marker=dict(color=color, size=9, symbol=sym, line=dict(color="white", width=1)),
                                 customdata=np.c_[s.fuel, s.pressure_atm.round(2), s.test_id],
                                 hovertemplate="%{customdata[2]}<br>%{customdata[0]}, %{customdata[1]} atm<br>"
                                               "O2 %{x:.1f} %<br>burn %{y:.0f} s<extra></extra>"))
    gm = GRID_D[GRID_D.pressure_atm == 0.69]
    fig.add_trace(go.Scatter(x=gm.x_o2 * 100, y=gm.median_burn_s, mode="lines", name="Model: median burn at 0.69 atm",
                             line=dict(color=INK, width=2), hovertemplate="model median %{y:.0f} s at %{x:.0f} % O2<extra></extra>"))
    fig.add_vrect(x0=25, x1=34, fillcolor=MUTED, opacity=0.08, line_width=0)
    fig.add_annotation(x=29.5, y=np.log10(400), text="no tests between 25 % and 34 % O2", showarrow=False,
                       font=dict(color=INK2, size=12))
    fig.add_vline(x=30, line=dict(color=CRITICAL, width=2, dash="dot"))
    fig.add_annotation(x=30, y=np.log10(1.3), text="habitat 30 %", showarrow=False, xanchor="left", xshift=6,
                       font=dict(color=CRITICAL, size=12))
    base_layout(fig, 430, xaxis_title="Oxygen (%)", yaxis_title="Burn time (s, log scale)")
    fig.update_yaxes(type="log", tickvals=[1, 3, 10, 30, 100, 300], minor=dict(showgrid=False, ticks=""))
    st.plotly_chart(fig, width="stretch")
    st.caption("179 ACME CFI-G tests (PSI-159), ethane / propane / n-butane on a spherical porous burner, 0.5-3 atm. "
               "Model: Weibull survival model, leave-one-ISS-day-out concordance 0.75.")

    a, b = st.columns(2)
    with a:
        st.subheader("2 · Cabin materials still burn near habitat air")
        st.markdown("Saffire IV-VI burned large samples on Cygnus at **26-31 % O2 and 0.53-0.70 atm**: fabric and "
                    "plastic burned, Nomex did not ignite. Thick plastic (PMMA) released far more CO2 and CO than fabric.")
        x = EV[EV.investigation_id == "EXT-SAFFIRE-456"].pivot_table(index="test_id", columns="quantity", values="value")
        lab = {"EXT-SAFFIRE-456:IV-1": "IV-1 fabric (SIBAL) 22 %", "EXT-SAFFIRE-456:V-2": "V-2 cotton 26 %",
               "EXT-SAFFIRE-456:VI-2": "VI-2 fabric (SIBAL) 31 %", "EXT-SAFFIRE-456:VI-3": "VI-3 PMMA 10 mm 30 %",
               "EXT-SAFFIRE-456:VI-4": "VI-4 PMMA 5 mm 29 %"}
        x = x.loc[list(lab)]
        fig = go.Figure(go.Bar(x=x["co2_increase_ffd"], y=[lab[i] for i in x.index], orientation="h",
                               marker=dict(color=[ORANGE if "PMMA" in lab[i] else BLUE for i in x.index],
                                           line=dict(color="white", width=2)),
                               text=[f"{v:,.0f} ppm" for v in x["co2_increase_ffd"]], textposition="outside",
                               hovertemplate="%{y}: +%{x:,.0f} ppm CO2<extra></extra>"))
        base_layout(fig, 300, xaxis_title="Cabin CO2 increase at the far-field sensor (ppm)", showlegend=False)
        fig.update_yaxes(autorange="reversed", showgrid=False)
        fig.update_xaxes(range=[0, 10500])
        st.plotly_chart(fig, width="stretch")
        st.caption("Urban et al., ICES-2024-365 (NASA NTRS 20240002981), Table 2. Orange: PMMA. Nomex (VI-1) did not ignite.")
    with b:
        st.subheader("3 · The enclosure changes how fast fire spreads")
        st.markdown("The same cotton-fiberglass fabric, in nearly the same air, spread at **1.8 to 5.1 mm/s** depending "
                    "on the duct around it. Habitat fire risk depends on room geometry, not only on the atmosphere.")
        bb = B[B.material_family == "cotton-fiberglass"].copy()
        duct = {"PSI-26": "BASS (7.6 cm duct)", "PSI-98": "Saffire I-III (51 cm duct)", "PSI-99": "Saffire I-III (51 cm duct)",
                "PSI-100": "Saffire I-III (51 cm duct)", "EXT-SAFFIRE-456": "Saffire IV (30.5 cm duct)"}
        bb["duct"] = bb.investigation_id.map(duct)
        bb = bb[bb.flow_direction == "concurrent"]
        order = ["Saffire I-III (51 cm duct)", "Saffire IV (30.5 cm duct)", "BASS (7.6 cm duct)"]
        fig = go.Figure()
        for i, dname in enumerate(order):
            s = bb[bb.duct == dname]
            fig.add_trace(go.Scatter(x=[dname] * len(s), y=s.spread_rate_mm_s, mode="markers", name=dname,
                                     marker=dict(color=[BLUE, ORANGE, AQUA][i], size=13, line=dict(color="white", width=1.5)),
                                     customdata=np.c_[s.test_id, s.flow_cm_s, (s.x_o2 * 100).round(1)],
                                     hovertemplate="%{customdata[0]}<br>%{y:.1f} mm/s at %{customdata[1]} cm/s, "
                                                   "%{customdata[2]} % O2<extra></extra>"))
        base_layout(fig, 300, yaxis_title="Flame spread rate (mm/s)", showlegend=False)
        fig.update_yaxes(range=[0, 6])
        st.plotly_chart(fig, width="stretch")
        st.caption("Concurrent flow, 19-25 cm/s, 21-23 % O2. Olson et al. Table 1; NASA NTRS 20180005168.")

    st.subheader("4 · Smoke detection has never been tested at habitat conditions")
    st.markdown("SAME and SAME-R measured how microgravity smoke can fool detectors; SPICE measured when flames start "
                "releasing soot. Together: **86 smoke tests and 469 soot-point settings, all at 21 % O2 and 1 atm.**")

# ================================================================= 2. RANKING
with tab_rank:
    st.subheader(f"Which investigations matter most at {o2:.0%} O2 and {p:.2f} atm?")
    st.markdown('<span class="small">A transparent score, not a black box: four parts between 0 and 1, weighted. '
                'Change the mission atmosphere in the sidebar or the weights below.</span>', unsafe_allow_html=True)
    with st.expander("Scoring weights"):
        w1, w2, w3, w4 = st.columns(4)
        wa = w1.slider("Atmosphere match", 0.0, 1.0, R.DEFAULT_WEIGHTS["atmosphere"], 0.05,
                       help="How close the investigation's tests come to the mission O2 and pressure")
        wf = w2.slider("Fire type importance", 0.0, 1.0, R.DEFAULT_WEIGHTS["fire_type"], 0.05,
                       help="Solids and smoke first, then droplets, then gas flames")
        wd = w3.slider("Data quality", 0.0, 1.0, R.DEFAULT_WEIGHTS["data"], 0.05,
                       help="Per-test outcomes > partial > conditions only > catalog only")
        wv = w4.slider("Number of tests", 0.0, 1.0, R.DEFAULT_WEIGHTS["volume"], 0.05)
    rk = R.rank(TARGET, dict(atmosphere=wa, fire_type=wf, data=wd, volume=wv))
    show = rk[["rank", "psi_id", "acronym", "fire_type", "relevance", "n_near_mission", "closest_condition",
               "data_level", "n_tests", "why"]]
    st.dataframe(show, hide_index=True, width="stretch", height=560, column_config={
        "rank": st.column_config.NumberColumn("#", width="small"),
        "psi_id": "ID", "acronym": "Investigation", "fire_type": "Fire type",
        "relevance": st.column_config.ProgressColumn("Relevance", min_value=0, max_value=100, format="%.0f"),
        "n_near_mission": st.column_config.NumberColumn("Tests near mission", help="within ±5 % O2 and ±0.2 atm"),
        "closest_condition": "Closest tested condition", "data_level": "Data available", "n_tests": "Tests",
        "why": st.column_config.TextColumn("Why", width="large")})
    st.caption("EXT-SAFFIRE-456 is NASA literature (NTRS 20240002981), not a PSI dataset. BRE pressures come from the "
               "atmospheres named in its objectives. Catalog-only investigations are scored from their published ranges.")
    st.markdown("#### The real tests closest to this mission atmosphere")
    ct = R.closest_tests(TARGET, k=12)
    st.dataframe(ct.drop(columns=["source_file"]), hide_index=True, width="stretch", column_config={
        "investigation_id": "ID", "test_id": "Test", "x_o2": st.column_config.NumberColumn("O2", format="%.3f"),
        "pressure_atm": st.column_config.NumberColumn("Pressure (atm)", format="%.2f"),
        "pressure_note": "Pressure source", "flow_cm_s": "Air speed (cm/s)", "outcome_note": "What happened",
        "proximity": st.column_config.ProgressColumn("Closeness", min_value=0, max_value=1, format="%.2f")})

# ================================================================= 3. PREDICT
with tab_pred:
    A_pack, D_pack, C_pack = load_models()
    st.subheader(f"Predict a fire at {o2:.0%} O2 and {p:.2f} atm")
    st.markdown('<span class="small">Each answer comes with its uncertainty and with the closest real test. '
                'Outside the tested range the number is shown but flagged.</span>', unsafe_allow_html=True)
    kind = st.radio("Fire type", ["Burning solid", "Gas flame in still air", "Fuel droplet"], horizontal=True)

    if kind == "Burning solid":
        tr = A_pack["train"]
        modelled = [m for m in tr.material_family.value_counts().index if (tr.material_family == m).sum() >= M.MIN_ROWS_PER_MATERIAL]
        c1, c2, c3 = st.columns(3)
        mat = c1.selectbox("Material", modelled, format_func=lambda m: {"cotton-fiberglass": "Cotton-fiberglass fabric (SIBAL)"}.get(m, m))
        dirs = tr[tr.material_family == mat].flow_direction.value_counts().index.tolist()
        direc = c2.selectbox("Air flow relative to the flame", dirs)
        flow = c3.slider("Air speed (cm/s)", 0.5, 40.0, 10.0, 0.5)
        geom = tr[(tr.material_family == mat) & (tr.flow_direction == direc)].geometry_class.mode().iat[0]
        q = pd.DataFrame([dict(material_family=mat, geometry_class=geom, flow_direction=direc, flow_cm_s=flow, **TARGET)])
        X = M._a_features(q)
        bp = np.array([b.predict_proba(X)[0, 1] for b in A_pack["boots"]])
        pm = float(bp.mean())  # bagged estimate: smoother and more stable than one tree ensemble
        app = M.applicability(q.assign(log_flow=np.log(flow)), tr.assign(log_flow=np.log(tr.flow_cm_s)),
                              ["material_family", "flow_direction"], dict(x_o2=0.04, pressure_atm=0.2, log_flow=np.log(2.5))).iloc[0]
        r1, r2 = st.columns([1, 2])
        kpi(r1, f"{pm:.0%}", f"chance the flame keeps burning<br>(80 % band {np.percentile(bp, 10):.0%}-{np.percentile(bp, 90):.0%})")
        with r2:
            st.markdown(tag(app.label), unsafe_allow_html=True)
            st.markdown(f"Closest real test: **{app.nearest_test}** · gap {app.get('gap_x_o2', 0):.0%} O2, "
                        f"{app.get('gap_pressure_atm', 0):.2f} atm · geometry: {geom}")
            st.caption("Gradient boosting on 414 observations from 212 tests (BASS, BASS-II, Saffire I-VI); held-out "
                       "ROC-AUC 0.96. More oxygen or pressure may only raise the risk. Cotton, Nomex and silicone have too few tests to model.")
        flows = np.linspace(0.5, 40, 80)
        qq = pd.DataFrame(dict(material_family=mat, geometry_class=geom, flow_direction=direc, flow_cm_s=flows, **TARGET))
        Xq = M._a_features(qq)
        jit = np.exp(np.linspace(-0.15, 0.15, 5))  # light smoothing over ±15 % air speed (tree models are step-shaped)

        def smooth(frame):
            out = []
            for j in jit:
                Xj = M._a_features(frame.assign(flow_cm_s=frame.flow_cm_s * j))
                out.append([b.predict_proba(Xj)[:, 1] for b in A_pack["boots"]])
            return np.array(out).mean(axis=0)  # shape: boots x points
        bq = smooth(qq)
        curve = bq.mean(axis=0)
        earth = smooth(qq.assign(x_o2=0.21, pressure_atm=1.0)).mean(axis=0)
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=np.r_[flows, flows[::-1]], y=np.r_[np.percentile(bq, 90, 0), np.percentile(bq, 10, 0)[::-1]],
                                 fill="toself", fillcolor="rgba(42,120,214,0.15)", line=dict(width=0), name="80 % band",
                                 hoverinfo="skip"))
        fig.add_trace(go.Scatter(x=flows, y=curve, name=f"Mission ({o2:.0%} O2, {p:.2f} atm)", line=dict(color=BLUE, width=2.5),
                                 hovertemplate="%{x:.1f} cm/s: %{y:.0%}<extra></extra>"))
        fig.add_trace(go.Scatter(x=flows, y=earth, name="Earth cabin (21 %, 1 atm)", line=dict(color=MUTED, width=2, dash="dash"),
                                 hovertemplate="%{x:.1f} cm/s: %{y:.0%}<extra></extra>"))
        obs = tr[(tr.material_family == mat) & (tr.flow_direction == direc)]
        fig.add_trace(go.Scatter(x=obs.flow_cm_s, y=obs.flame_sustained, mode="markers", name="Real tests (1 burned, 0 went out)",
                                 marker=dict(color=INK, size=6, opacity=0.35), customdata=np.c_[obs.test_id, (obs.x_o2 * 100).round(1)],
                                 hovertemplate="%{customdata[0]}: %{customdata[1]} % O2, %{x} cm/s<extra></extra>"))
        base_layout(fig, 360, xaxis_title="Air speed (cm/s)", yaxis_title="Chance the flame keeps burning")
        st.caption("Curves: average of 40 bootstrap models, lightly smoothed over ±15 % air speed (tree models are "
                   "step-shaped); read the band rather than individual wiggles. Real tests are shown at their own O2 and pressure.")


        fig.update_yaxes(range=[-0.05, 1.05], tickformat=".0%")
        st.plotly_chart(fig, width="stretch")
        EX, ACURVE, _ = load_explain()
        with st.expander("How this model decides", expanded=True):
            e = EX["A_solids"]
            imp = dict(sorted(e["importance_auc_drop"].items(), key=lambda kv: -kv[1]))
            l, r = st.columns([1, 1])
            l.plotly_chart(hbar(list(imp), [max(v, 0) for v in imp.values()], "Drop in ROC-AUC when the input is scrambled",
                                fmt="{:.3f}", xrange=[0, max(imp.values()) * 1.3]), width="stretch")
            r.markdown(f"""**Air speed matters most.** Flames starve at very low air speed and blow off at high speed:
the "Goldilocks window" BASS-II found. **Material** comes next.

**Oxygen and pressure follow physics by construction:** the model can only raise the chance of burning
when either goes up. Most tests were run in cabin air, so their effect is learned from fewer tests.

**Glass-box check** (simple logistic model, held-out ROC-AUC 0.85): each **+1 % O2 multiplies the odds of
sustained burning by {e['glass_box_odds_ratios']['+1 % O2']:.2f}**, each +0.1 atm by
{e['glass_box_odds_ratios']['+0.1 atm pressure']:.2f}.""")

    elif kind == "Gas flame in still air":
        c1, c2 = st.columns(2)
        fuel = c1.selectbox("Fuel", ["propane", "butane", "ethane"])
        mdot = c2.slider("Fuel flow (mg/s)", 0.25, 3.0, 1.0, 0.05)
        m, feats = D_pack["model"], D_pack["features"]
        o2s = np.round(np.arange(0.18, 0.405, 0.005), 3)
        G = pd.DataFrame(dict(x_o2=o2s, pressure_atm=p, log_mdot=np.log(mdot), fuel_mole_fraction=0.3,
                              fuel_propane=int(fuel == "propane"), fuel_butane=int(fuel == "butane")))
        med = m.predict_median(G[feats]).to_numpy()
        surv = m.predict_survival_function(G[feats], times=[30.0]).T.iloc[:, 0].to_numpy()
        i = int(np.abs(o2s - o2).argmin())
        gap = 0.25 < o2 < 0.34
        r1, r2, r3 = st.columns([1, 1, 2])
        kpi(r1, f"{med[i]:.0f} s", "predicted median burn time before the flame goes out by itself")
        kpi(r2, f"{surv[i]:.0%}", "chance it is still burning after 30 s")
        with r3:
            lab = "outside tested range (no tests between 25 % and 34 % O2)" if gap or o2 > 0.40 or o2 < 0.18 else "inside tested range"
            st.markdown(tag(lab), unsafe_allow_html=True)
            st.caption("Weibull survival model on 132 ignited ACME CFI-G flames (PSI-159); flames still burning when "
                       "the fuel was cut count as 'at least this long'. Leave-one-ISS-day-out concordance 0.75. "
                       "Fuel diluted to 30 % in N2.")
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=o2s * 100, y=med, name=f"Median burn at {p:.2f} atm", line=dict(color=BLUE, width=2.5),
                                 hovertemplate="%{x:.1f} % O2: %{y:.0f} s<extra></extra>"))
        fig.add_vrect(x0=25, x1=34, fillcolor=MUTED, opacity=0.08, line_width=0)
        fig.add_vline(x=o2 * 100, line=dict(color=CRITICAL, width=2, dash="dot"))
        base_layout(fig, 340, xaxis_title="Oxygen (%)", yaxis_title="Median burn time (s, log)", showlegend=False)
        fig.update_yaxes(type="log", tickvals=[1, 3, 10, 30, 100, 300], minor=dict(showgrid=False, ticks=""))
        st.plotly_chart(fig, width="stretch")
        EX, _, _ = load_explain()
        with st.expander("How this model decides", expanded=True):
            trs = EX["D_gas_flames"]["time_ratios"]
            l, r = st.columns([1, 1])
            vals = [t["time_ratio"] for t in trs]
            err = ([t["ci95"][1] - t["time_ratio"] for t in trs], [t["time_ratio"] - t["ci95"][0] for t in trs])
            l.plotly_chart(hbar([t["effect"] for t in trs], vals, "Burn-time multiplier (1 = no effect)",
                                fmt="×{:.2f}", color=[ORANGE if v > 1 else BLUE for v in vals], height=300, err=err,
                                xrange=[0, 1.55]),
                           width="stretch")
            o2r = trs[0]["time_ratio"]
            pr = trs[1]["time_ratio"]
            r.markdown(f"""Each factor **multiplies** the burn time. Read the bars as "this change makes the flame
last ×N as long".

**Oxygen dominates:** every **+1 % O2 makes the flame last ×{o2r:.2f}** (95 % interval
{trs[0]['ci95'][0]:.2f}-{trs[0]['ci95'][1]:.2f}). From 21 % to 30 % O2 that compounds to
**×{o2r ** 9:.1f}**; the habitat's lower pressure adds about ×{pr ** -3.1:.2f}, for roughly ×{o2r ** 9 * pr ** -3.1:.1f} overall.

**More fuel flow shortens the burn** (×{trs[2]['time_ratio']:.2f} per doubling): bigger microgravity flames lose more heat by
radiation, consistent with radiative extinction reported for spherical flames.""")

    else:
        c1, c2, c3 = st.columns(3)
        fuel = c1.selectbox("Fuel", ["methanol", "n-heptane"])
        d0 = c2.slider("Initial droplet diameter (mm)", 1.5, 5.0, 3.0, 0.1)
        sup = c3.selectbox("Suppressant added", ["none", "CO2 (15 %)", "He (15 %)"])
        q = pd.DataFrame([dict(fuel=fuel, d0_mm=d0, x_co2=0.15 if sup.startswith("CO2") else 0.0,
                               x_he=0.15 if sup.startswith("He") else 0.0, **TARGET)])
        out = {}
        for target, pk in C_pack.items():
            X = M._c_features(q, pk["fuels"])
            Xs = np.column_stack([pk["scaler"].transform(X[:, :len(M.C_NUM)]), X[:, len(M.C_NUM):]])
            mu, sd = pk["model"].predict(Xs, return_std=True)
            out[target] = (float(mu[0]), float(sd[0]))
        train = C_pack["burning_rate_mm2_s"]["train"]
        app = M.applicability(q, train, "fuel", dict(x_o2=0.04, pressure_atm=0.2)).iloc[0]
        r1, r2, r3 = st.columns([1, 1, 2])
        kpi(r1, f"{out['burning_rate_mm2_s'][0]:.2f} ± {out['burning_rate_mm2_s'][1]:.2f}", "burning rate K (mm²/s)")
        kpi(r2, f"{out['extinction_diameter_mm'][0]:.2f} ± {out['extinction_diameter_mm'][1]:.2f}", "droplet size when the flame goes out (mm)")
        with r3:
            st.markdown(tag(app.label), unsafe_allow_html=True)
            st.markdown(f"Closest real test: **{app.nearest_test}**")
            st.caption("Gaussian process on FLEX (PSI-69) and PSI-117 experiments; 5-fold R² 0.70 (burning rate) and "
                       "0.90 (extinction diameter). ± is one standard deviation. Not valid for fuels it has not seen. "
                       "Suppressant (CO2, He) tests only go up to 25 % O2, so suppression at habitat oxygen is untested.")
        EX, _, CCURVE = load_explain()
        with st.expander("How this model decides", expanded=True):
            rel = EX["C_droplets"]["input_relevance"]
            l, r = st.columns([1, 1])
            for col_, tgt, ttl in ((l, "burning_rate_mm2_s", "Burning rate: input relevance"),
                                   (r, "extinction_diameter_mm", "Extinction size: input relevance")):
                rr = dict(sorted(rel[tgt].items(), key=lambda kv: -kv[1]))
                col_.plotly_chart(hbar(list(rr), list(rr.values()), ttl, fmt="{:.0%}", height=250,
                                       xrange=[0, max(rr.values()) * 1.3]), width="stretch")
            st.markdown("Relevance comes from the Gaussian process itself: an input the model needs to follow closely gets a "
                        "short length scale. **Oxygen drives when the flame goes out; droplet size, oxygen and CO2 drive how "
                        "fast it burns.** Pressure matters little in the tested range: the 1 atm and 0.69 atm curves "
                        "below lie on top of each other.")
            cc = CCURVE[(CCURVE.fuel == fuel) & (CCURVE.target == "burning_rate_mm2_s")]
            fig = go.Figure()
            for pp, col, nm in ((1.0, MUTED, "1 atm"), (0.69, BLUE, "0.69 atm")):
                c_ = cc[cc.pressure_atm == pp]
                fig.add_trace(go.Scatter(x=np.r_[c_.x_o2 * 100, c_.x_o2[::-1] * 100],
                                         y=np.r_[c_.value + c_.sd, (c_.value - c_.sd)[::-1]], fill="toself",
                                         fillcolor="rgba(42,120,214,0.12)" if pp == 0.69 else "rgba(138,137,132,0.12)",
                                         line=dict(width=0), hoverinfo="skip", showlegend=False))
                fig.add_trace(go.Scatter(x=c_.x_o2 * 100, y=c_.value, name=f"{fuel}, {nm}", line=dict(color=col, width=2.5),
                                         hovertemplate="%{x:.0f} % O2: %{y:.2f} mm²/s<extra></extra>"))
            base_layout(fig, 280, xaxis_title="Oxygen (%)  · 3 mm droplet, no suppressant", yaxis_title="Burning rate (mm²/s)")
            st.plotly_chart(fig, width="stretch")

# ================================================================= 4. GAPS
with tab_gap:
    st.subheader("What has never been tested near the mission atmosphere?")
    gaps = R.mission_gaps(TARGET)
    for _, g in gaps.iterrows():
        cls = "gap" if g.status.startswith("GAP") else ("thin" if g.status.startswith("thin") else "covered")
        st.markdown(f'<span class="tag {cls}">{g.status}</span> **{g.fire_type}**: {g.tests_near_mission} of '
                    f'{g.tests_total} tests within ±5 % O2 and ±0.2 atm · tested {g.o2_range}, {g.pressure_range} · '
                    f'closest {g.closest_test}', unsafe_allow_html=True)
    st.write("")
    ft = st.selectbox("Coverage map for", list(gaps.fire_type))
    gm = R.gap_matrix()
    gm = gm[gm.fire_type == ft]
    o2_lab = [f"{a * 100:.0f}-{b * 100:.0f} %" for a, b in zip(R.O2_BINS[:-1], R.O2_BINS[1:])]
    p_lab = [f"{a:.2f}-{b:.2f}" for a, b in zip(R.P_BINS[:-1], R.P_BINS[1:])]
    Z = np.zeros((len(p_lab), len(o2_lab)))
    H = np.empty_like(Z, dtype=object)
    o2_idx = {str(pd.Interval(a, b, closed="left")): i for i, (a, b) in enumerate(zip(R.O2_BINS[:-1], R.O2_BINS[1:]))}
    p_idx = {str(pd.Interval(a, b, closed="left")): i for i, (a, b) in enumerate(zip(R.P_BINS[:-1], R.P_BINS[1:]))}
    H[:] = "no tests"
    for _, r_ in gm.iterrows():
        if r_.o2_band in o2_idx and r_.p_band in p_idx and r_.n_tests > 0:
            Z[p_idx[r_.p_band], o2_idx[r_.o2_band]] = r_.n_tests
            H[p_idx[r_.p_band], o2_idx[r_.o2_band]] = f"{r_.n_tests} tests: {r_.investigations}"
    fig = go.Figure(go.Heatmap(z=np.log1p(Z), x=o2_lab, y=p_lab, customdata=H, colorscale=[[i / 7, c] for i, c in enumerate(SEQ)],
                               xgap=2, ygap=2, showscale=False,
                               hovertemplate="O2 %{x}, %{y} atm<br>%{customdata}<extra></extra>"))
    zmax = np.log1p(Z).max() or 1
    for yi_, xi_ in zip(*np.nonzero(Z)):
        fig.add_annotation(x=o2_lab[xi_], y=p_lab[yi_], text=str(int(Z[yi_, xi_])), showarrow=False,
                           font=dict(size=12, color="white" if np.log1p(Z[yi_, xi_]) / zmax > 0.5 else INK))
    xi = next(i for i, (a, b) in enumerate(zip(R.O2_BINS[:-1], R.O2_BINS[1:])) if a <= o2 < b) if R.O2_BINS[0] <= o2 < R.O2_BINS[-1] else None
    yi = next(i for i, (a, b) in enumerate(zip(R.P_BINS[:-1], R.P_BINS[1:])) if a <= p < b)
    if xi is not None:
        fig.add_shape(type="rect", x0=xi - 0.5, x1=xi + 0.5, y0=yi - 0.5, y1=yi + 0.5,
                      line=dict(color=CRITICAL, width=3), fillcolor="rgba(0,0,0,0)")
        if Z[yi, xi] == 0:
            fig.add_annotation(x=o2_lab[xi], y=p_lab[yi], text="mission: 0 tests", showarrow=False,
                               font=dict(color=CRITICAL, size=11))
    base_layout(fig, 420, xaxis_title="Oxygen (mole %)", yaxis_title="Pressure (atm)")
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(showgrid=False)
    st.plotly_chart(fig, width="stretch")
    st.caption("Microgravity tests in dataset v1, counted per cell (darker = more tests). Red box: the mission atmosphere.")

    st.subheader("Recommended next experiments")
    for rec in R.RECOMMENDATIONS:
        st.markdown(f"**{rec['priority']}. {rec['experiment']}**  \n{rec['why']}  \n"
                    f'<span class="small">Builds on: {rec["builds_on"]}</span>', unsafe_allow_html=True)

# ================================================================= 5. DATA
with tab_data:
    st.subheader("Dataset v1: 1,517 tests, 10,107 measured values, 14 sources")
    st.markdown("Every value traces to its source file and line. Raw files are never edited; all 101 corrections are "
                "logged. Units: O2 as mole fraction, pressure in atm, air speed in cm/s.")
    st.dataframe(SRC.merge(CAT[["psi_id", "doi"]] if "doi" in CAT else CAT[["psi_id"]], left_on="investigation_id",
                           right_on="psi_id", how="left").drop(columns=["psi_id"], errors="ignore"),
                 hide_index=True, width="stretch")
    c1, c2, c3 = st.columns(3)
    for col, f, lab in ((c1, "ml/v1/A_solids_flammability.csv", "Solids table (A)"),
                        (c2, "ml/v1/D_gas_flames.csv", "Gas flames table (D)"),
                        (c3, "reports/ranking/ranking_habitat.csv", "Habitat ranking")):
        col.download_button(f"Download {lab}", (ROOT / f).read_bytes(), file_name=Path(f).name, mime="text/csv")
    st.markdown("""
**Sources.** NASA Physical Sciences Informatics (CC0-1.0): BASS (PSI-26), BASS-II (PSI-25), Saffire I-III (PSI-98, 99, 100),
FLEX (PSI-69), CFI (PSI-39), PSI-117, ACME BRE (PSI-20), ACME CFI-G (PSI-159), SPICE (PSI-107), SAME (PSI-102),
SAME-R (PSI-101), and catalog entries for PSI-68, 106, 62, 142, 115, 60, 10, 21, 22, 23.
Urban et al., ICES-2024-365 (NASA NTRS 20240002981); Urban et al., ICES-2021-266 (NTRS 20210011521);
NASA NTRS 20180005168; Olson et al., UCL Discovery eprint 10164340; Ferkul et al. (2013).

**AI usage.** Built with the help of Claude (Anthropic), an AI assistant, for code, table transcription and
documentation; transcriptions were verified against the original tables. No data values and no images are AI-generated.
No NASA logos or insignia are used.

**Author.** Mohammed Ayman · NASA Space Apps Challenge 2026 ·
[GitHub repository](https://github.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps)
""")
