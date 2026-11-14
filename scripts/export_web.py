"""Export everything the website needs to web/public/data/*.json.

Run after build_data.py, build_ml.py, train_models.py and build_ranking.py:

    python scripts/export_web.py

Every number the website shows comes from these files. Model grids are evaluated here with the trained
models in models/v1, so the browser never needs Python.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from fif import knowledge as KN  # noqa: E402
from fif import models as MD  # noqa: E402
from fif import ranking as RK  # noqa: E402
from fif import webdata as WD  # noqa: E402

OUT = ROOT / "web" / "src" / "data"
OUT.mkdir(parents=True, exist_ok=True)


def clean(o):
    """JSON-safe: NaN -> None, numpy -> python."""
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if (o is None or math.isnan(o) or math.isinf(o)) else round(float(o), 4)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, pd.Timestamp):
        return str(o.date())
    return o


def dump(name, obj):
    p = OUT / f"{name}.json"
    p.write_text(json.dumps(clean(obj), ensure_ascii=False, separators=(",", ":")))
    print(f"{name}.json  {p.stat().st_size / 1024:.0f} KB")


K = KN.load()

# ------------------------------------------------------------------ missions and investigations
MISSIONS = WD.MISSIONS
dump("missions", MISSIONS)
inv = KN.investigation_table(K)
dump("investigations", WD.investigations(K))
dump("hardware", {k: dict(name=g.get("name", k), short=g.get("short", ""), members=g["members"]) for k, g in KN.HARDWARE.items()})

# ------------------------------------------------------------------ rankings and takeaways per mission
rankings, takeaways = {}, {}
for m in MISSIONS:
    r = RK.rank(dict(x_o2=m["x_o2"], pressure_atm=m["p"])).reset_index(drop=True)
    rankings[m["id"]] = r[["rank", "psi_id", "acronym", "fire_type", "data_level", "n_tests", "n_near_mission",
                           "closest_condition", "score_atmosphere", "score_fire_type", "score_data", "score_volume",
                           "relevance", "why"]].to_dict("records")
    takeaways[m["id"]] = KN.takeaways(K, m["x_o2"], m["p"])
dump("rankings", rankings)
dump("takeaways", takeaways)

# ------------------------------------------------------------------ tests for maps and nearest-test lookups
t = K["tests"]
FAM = {"solid": "solid", "emulated_solid": "solid", "liquid": "droplet", "gas": "gas", "smoke_source": "smoke"}
cov = t.dropna(subset=["x_o2", "pressure_atm"]).assign(fam=lambda d: d.fuel_class.map(FAM).fillna("other"))
cov = cov.assign(o=(cov.x_o2 * 100).round(1), pp=cov.pressure_atm.round(2))
dump("coverage", cov.groupby(["investigation_id", "fam", "o", "pp"]).size().reset_index(name="n").values.tolist())
D = K["D"]
g = D[D.hot_ignition == 1].dropna(subset=["burn_time_s"])
dump("gas_flames", g[["x_o2", "pressure_atm", "burn_time_s", "self_extinguished", "fuel_family"]]
     .assign(x_o2=lambda d: (d.x_o2 * 100).round(1)).values.tolist())

# ------------------------------------------------------------------ model D grid (gas flames, still air)
dp = K["D_pack"]
m, feats = dp["model"], dp["features"]
rows = []
for fuel in ("ethane", "propane", "butane"):
    for p in (0.5, 0.69, 1.0, 2.0):
        for o2 in np.round(np.arange(0.18, 0.405, 0.01), 2):
            rows.append(dict(fuel=fuel, x_o2=o2, pressure_atm=p, log_mdot=0.0, fuel_mole_fraction=0.3,
                             fuel_propane=int(fuel == "propane"), fuel_butane=int(fuel == "butane")))
G = pd.DataFrame(rows)
G["median"] = m.predict_median(G[feats]).to_numpy()
sf = m.predict_survival_function(G[feats], times=[10.0, 30.0, 60.0]).T
G["s10"], G["s30"], G["s60"] = sf.iloc[:, 0].to_numpy(), sf.iloc[:, 1].to_numpy(), sf.iloc[:, 2].to_numpy()
dump("model_gas", dict(
    note="Weibull survival model on 132 ACME CFI-G still-air flames (PSI-159); fuel 30% in N2, fuel flow 1 mg/s.",
    gap=[23.4, 33.2], tested_p=[0.5, 0.93, 1.0, 2.0, 3.0],
    time_ratios=K["explain"]["D_gas_flames"]["time_ratios"],
    grid=G[["fuel", "x_o2", "pressure_atm", "median", "s10", "s30", "s60"]].assign(x_o2=lambda d: (d.x_o2 * 100).round()).values.tolist()))

# ------------------------------------------------------------------ model A grid (solids)
pa = joblib.load(ROOT / "models/v1/A_solids.joblib")
dA = pa["train"]
combos = (dA.groupby(["material_family", "geometry_class", "flow_direction"]).size().reset_index(name="n")
          .sort_values("n", ascending=False).groupby("material_family").head(1))
n_mat = dA["material_family"].value_counts()
mods = [c for _, c in combos.iterrows() if n_mat.get(c.material_family, 0) >= MD.MIN_ROWS_PER_MATERIAL]
q = []
for c in mods:
    for o2 in np.round(np.arange(0.15, 0.405, 0.01), 2):
        for p in (0.5, 0.69, 1.0):
            for flow in (1, 2, 5, 10, 20, 30, 50):
                q.append(dict(material_family=c.material_family, geometry_class=c.geometry_class,
                              flow_direction=c.flow_direction, x_o2=o2, pressure_atm=p, flow_cm_s=float(flow)))
q = pd.DataFrame(q)
Xq = MD._a_features(q)
q["p"] = pa["model"].predict_proba(Xq)[:, 1]
bp = np.array([b.predict_proba(Xq)[:, 1] for b in pa["boots"]])
q["lo"], q["hi"] = np.percentile(bp, 10, axis=0), np.percentile(bp, 90, axis=0)
# tested envelope per material, for the "inside / outside" label
env = {mat: dict(o2=[float(s.x_o2.min() * 100), float(s.x_o2.max() * 100)], p=[float(s.pressure_atm.min()), float(s.pressure_atm.max())],
                 flow=[float(s.flow_cm_s.min()), float(s.flow_cm_s.max())], n=int(len(s)), tests=int(s.group_id.nunique()),
                 out=int((s.flame_sustained == 0).sum()))
       for mat, s in dA.groupby("material_family")}
dump("model_solids", dict(
    note="Gradient boosting with physics constraints on 414 rows from 212 NASA tests (BASS, BASS-II, Saffire); band = 10–90% bootstrap.",
    shapes={c.material_family: dict(geometry=c.geometry_class, direction=c.flow_direction) for c in mods},
    envelope=env, not_modelled=sorted(set(n_mat.index) - {c.material_family for c in mods}),
    explain=K["explain"]["A_solids"],
    grid=q[["material_family", "x_o2", "pressure_atm", "flow_cm_s", "p", "lo", "hi"]].assign(x_o2=lambda d: (d.x_o2 * 100).round()).values.tolist()))

# ------------------------------------------------------------------ model C grid (droplets)
pc = K["C_pack"]
cgrid = []
for target in ("burning_rate_mm2_s", "extinction_diameter_mm"):
    pk = pc[target]
    qq = []
    for fuel in ("methanol", "n-heptane"):
        for o2 in np.round(np.arange(0.15, 0.355, 0.01), 2):
            for p in (0.5, 0.69, 1.0, 2.0):
                for co2 in (0.0, 0.1, 0.2):
                    for he in (0.0, 0.2, 0.4):
                        for d0 in (2.0, 3.0, 4.0):
                            qq.append(dict(fuel=fuel, x_o2=o2, pressure_atm=p, x_co2=co2, x_he=he, d0_mm=d0))
    qq = pd.DataFrame(qq)
    X = MD._c_features(qq, pk["fuels"])
    Xs = np.column_stack([pk["scaler"].transform(X[:, :len(MD.C_NUM)]), X[:, len(MD.C_NUM):]])
    mu, sd = pk["model"].predict(Xs, return_std=True)
    qq[target], qq[target + "_sd"] = mu, sd
    cgrid.append(qq)
Cg = cgrid[0].merge(cgrid[1], on=["fuel", "x_o2", "pressure_atm", "x_co2", "x_he", "d0_mm"])
Cd = pd.read_csv(ROOT / "ml/v1/C_droplets.csv")
Cd = Cd[Cd.ready_for_model & (Cd.source_type == "experiment")]
cenv = {f: dict(o2=[float(s.x_o2.min() * 100), float(s.x_o2.max() * 100)], p=[float(s.pressure_atm.min()), float(s.pressure_atm.max())],
                co2_max=float(s.x_co2.fillna(0).max()), he_max=float(s.x_he.fillna(0).max()), n=int(len(s)))
        for f, s in Cd.groupby("fuel") if f in ("methanol", "n-heptane")}
near_c = Cd[Cd.fuel.isin(["methanol", "n-heptane"])][["fuel", "x_o2", "pressure_atm", "x_co2", "x_he", "d0_mm",
                                                      "burning_rate_mm2_s", "extinction_diameter_mm"]]
dump("model_droplets", dict(
    note="Gaussian process on FLEX droplets burned on the ISS (PSI-69); ± = model standard deviation.",
    envelope=cenv, explain=K["explain"]["C_droplets"],
    tests=near_c.assign(x_o2=lambda d: (d.x_o2 * 100).round(1)).fillna(0).values.tolist(),
    grid=Cg.assign(x_o2=lambda d: (d.x_o2 * 100).round()).values.tolist()))

# ------------------------------------------------------------------ physics constants (shared with the dashboard)
dump("physics", dict(gravity=KN.GRAVITY, gravity_source=KN.GRAVITY_SOURCE, physics_note=KN.PHYSICS_NOTE,
                     smoke_note=KN.SMOKE_NOTE, T_air=295.0))

# ------------------------------------------------------------------ gaps, recommendations, partial gravity
dump("recommendations", pd.read_csv(ROOT / "reports/ranking/recommendations.csv").to_dict("records"))
dump("partial_gravity", KN.PARTIAL_GRAVITY)
try:
    dump("gravity_bounds", KN.gravity_bounds(K).to_dict("records"))
except Exception as e:  # optional
    print("gravity_bounds skipped:", e)

# ------------------------------------------------------------------ methods: metrics, issues, held-out check
issues = pd.read_csv(ROOT / "data/processed/issues.csv")
dump("methods", dict(metrics=json.loads((ROOT / "models/v1/metrics.json").read_text()),
                     issues=issues.to_dict("records"),
                     issue_counts=issues.severity.value_counts().to_dict(),
                     ledger=dict(tests=int(len(t)), values=int(len(K["ev"])), corrections=int(len(issues)))))

# ------------------------------------------------------------------ evidence also shown on the Streamlit dashboard
dump("atmospheres", dict(rows=KN.ATMOSPHERES.to_dict("records"), source=KN.ATMOSPHERE_SOURCE))
dump("equipment", KN.equipment_table(K).to_dict("records"))
dump("earth", dict(uses=KN.EARTH_USES, benefits=KN.earth_benefits(K), scope=KN.SCOPE_NOTE))
_g2 = KN.bass2_gas()
dump("air_quality", dict(ranking=KN.bass2_ranking(_g2).to_dict("records"), note=KN.BASS2_GAS_NOTE, n_burns=int(len(_g2))))
_d2 = KN.d2_validation()
dump("d2_check", dict(n=_d2["n"], r2=_d2["r2"], median_ratio=_d2["median_ratio"],
                      median_abs_err_s=_d2["median_abs_err_s"], investigations=_d2["investigations"],
                      points=_d2["frame"][["burn_time_s", "t_d2"]].values.tolist()))
dump("solid_tests", dA[["material_family", "flow_direction", "x_o2", "pressure_atm", "flow_cm_s", "flame_sustained", "test_id"]]
     .assign(x_o2=lambda d: (d.x_o2 * 100).round(1)).values.tolist())

# ------------------------------------------------------------------ search corpus (cited, retrieval only)
dump("corpus", KN.corpus(K))
dump("synonyms", KN.SYNONYMS)
print("done")
