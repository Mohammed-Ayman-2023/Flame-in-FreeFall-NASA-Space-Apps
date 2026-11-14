"""Predictive models on dataset v1 (ml/v1). Kept small and transparent on purpose.

A  solids: will a flame on this material keep burning at this O2, pressure and air speed?
   Logistic regression vs. gradient boosting (O2 constrained to only raise risk), class-weighted,
   validated with GroupKFold on test_id (rows of one test never split). Uncertainty: bootstrap over tests.
D  gas flames in still air: how long does a flame burn before it goes out by itself?
   Weibull accelerated-failure-time model; flames whose fuel was cut while burning are right-censored.
   Validated by leaving out whole ISS operations days (concordance index).
C  droplets: burning rate K and extinction diameter. Gaussian process (gives its own uncertainty),
   validated with 5-fold CV over tests and a harder leave-one-fuel-out check.

Every prediction carries an applicability label: how far the query is from the nearest real test of the
same kind. Outside the tested range the number is shown but marked as an extrapolation.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel, RBF, WhiteKernel
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, balanced_accuracy_score, brier_score_loss,
                             mean_absolute_error, r2_score, roc_auc_score)
from sklearn.model_selection import GroupKFold, KFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[2]
ML, OUT = ROOT / "ml" / "v1", ROOT / "models" / "v1"
HABITAT = dict(x_o2=0.30, pressure_atm=0.69)
EARTH = dict(x_o2=0.21, pressure_atm=1.0)
RNG = np.random.default_rng(7)

# --------------------------------------------------------------------------------------------- A
A_NUM = ["x_o2", "pressure_atm", "log_flow", "log_flow2"]
A_CAT = ["material_family", "geometry_class", "flow_direction"]
MIN_ROWS_PER_MATERIAL = 12


def _a_features(df: pd.DataFrame) -> pd.DataFrame:
    X = df.copy()
    X["log_flow"] = np.log(X["flow_cm_s"].clip(lower=0.3))
    X["log_flow2"] = X["log_flow"] ** 2
    return X[A_NUM + A_CAT]


def _a_logit() -> Pipeline:
    pre = ColumnTransformer([("num", StandardScaler(), A_NUM),
                             ("cat", OneHotEncoder(handle_unknown="ignore"), A_CAT)])
    return Pipeline([("pre", pre), ("clf", LogisticRegression(C=1.0, class_weight="balanced", max_iter=2000))])


def _a_gbm() -> Pipeline:
    pre = ColumnTransformer([("num", "passthrough", A_NUM),
                             ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), A_CAT)])
    pre.set_output(transform="pandas")
    # physics: more O2, or more pressure, can only raise the chance of sustained burning
    return Pipeline([("pre", pre), ("clf", HistGradientBoostingClassifier(
        max_depth=3, learning_rate=0.08, max_iter=200, class_weight="balanced", random_state=0,
        monotonic_cst={"num__x_o2": 1, "num__pressure_atm": 1}))])


def _clf_metrics(y, p) -> dict:
    return dict(roc_auc=round(roc_auc_score(y, p), 3), pr_auc_flameout=round(average_precision_score(1 - y, 1 - p), 3),
                balanced_accuracy=round(balanced_accuracy_score(y, (p >= 0.5).astype(int)), 3),
                brier=round(brier_score_loss(y, p), 4), n=int(len(y)), n_flameout=int((y == 0).sum()))


def _grouped_oof(make, X, y, groups, k=5) -> np.ndarray:
    oof = np.zeros(len(y))
    for tr, te in GroupKFold(n_splits=k).split(X, y, groups):
        m = make().fit(X.iloc[tr], y[tr])
        oof[te] = m.predict_proba(X.iloc[te])[:, 1]
    return oof


def applicability(query: pd.DataFrame, train: pd.DataFrame, by, tol: dict) -> pd.DataFrame:
    """Nearest real test of the same kind (by = column or list of columns, e.g. material + flow direction):
    gap per dimension and a plain label. Inside = every gap within its tolerance."""
    rows, by = [], ([by] if isinstance(by, str) else list(by or []))
    for _, q in query.iterrows():
        pool = train
        for b in by:
            pool = pool[pool[b] == q[b]]
        if pool.empty:
            rows.append(dict(nearest_test=None, label="outside: no tests of this kind"))
            continue
        d = sum(((pool[c] - q[c]) / t) ** 2 for c, t in tol.items()) ** 0.5
        j = d.idxmin()
        far = {c: round(abs(pool.at[j, c] - q[c]), 3) for c in tol}
        inside = all(far[c] <= t for c, t in tol.items())
        rows.append(dict(nearest_test=pool.at[j, "test_id"], **{f"gap_{c}": far[c] for c in tol},
                         label="inside tested range" if inside else "outside tested range (extrapolation)"))
    return pd.DataFrame(rows, index=query.index)


def train_A() -> dict:
    A = pd.read_csv(ML / "A_solids_flammability.csv")
    d = A[A["ready_for_model"]].reset_index(drop=True)
    X, y, g = _a_features(d), d["flame_sustained"].to_numpy(), d["group_id"].to_numpy()
    res = {}
    for name, make in (("logistic", _a_logit), ("gradient_boosting", _a_gbm)):
        res[name] = _clf_metrics(y, _grouped_oof(make, X, y, g))
    prior = d.groupby("material_family")["flame_sustained"].transform("mean").to_numpy()
    res["baseline_material_only"] = _clf_metrics(y, prior)
    best = max(("logistic", "gradient_boosting"), key=lambda k: res[k]["roc_auc"])
    make = _a_logit if best == "logistic" else _a_gbm
    final = make().fit(X, y)
    tests = d["group_id"].unique()
    boots = []
    for _ in range(40):  # bootstrap over whole tests
        pick = RNG.choice(tests, size=len(tests), replace=True)
        idx = np.concatenate([np.flatnonzero(g == t) for t in pick])
        if len(np.unique(y[idx])) < 2:
            continue
        boots.append(make().fit(X.iloc[idx], y[idx]))
    joblib.dump(dict(model=final, boots=boots, features=A_NUM + A_CAT, train=d), OUT / "A_solids.joblib")
    # habitat vs Earth predictions for each material with real tests
    combos = (d.groupby(["material_family", "geometry_class", "flow_direction"]).size().reset_index(name="n")
              .sort_values("n", ascending=False).groupby("material_family").head(1))
    q = []
    for _, c in combos.iterrows():
        for atm_name, atm in (("habitat", HABITAT), ("earth_cabin", EARTH)):
            for flow in (1.0, 5.0, 10.0, 20.0):
                q.append(dict(material_family=c.material_family, geometry_class=c.geometry_class,
                              flow_direction=c.flow_direction, flow_cm_s=flow, atmosphere=atm_name, **atm))
    q = pd.DataFrame(q)
    Xq = _a_features(q)
    q["p_sustained"] = final.predict_proba(Xq)[:, 1].round(3)
    bp = np.array([b.predict_proba(Xq)[:, 1] for b in boots])
    q["p_low"], q["p_high"] = np.percentile(bp, 10, axis=0).round(3), np.percentile(bp, 90, axis=0).round(3)
    q["log_flow"] = np.log(q["flow_cm_s"])
    app = applicability(q, d.assign(log_flow=np.log(d.flow_cm_s)), ["material_family", "flow_direction"],
                        dict(x_o2=0.04, pressure_atm=0.2, log_flow=np.log(2.5)))
    q = pd.concat([q, app], axis=1)
    # Materials with too few tests get no model number: the model would just copy other materials.
    n_mat = d["material_family"].value_counts()
    few = q["material_family"].map(n_mat).fillna(0) < MIN_ROWS_PER_MATERIAL
    q.loc[few, ["p_sustained", "p_low", "p_high"]] = np.nan
    q.loc[few, "label"] = "not modelled: too few tests of this material (see observed tests)"
    q.to_csv(OUT / "A_habitat_predictions.csv", index=False)
    # Out-of-fold predictions for every real row, so anyone can see where the model was right or wrong
    oof = _grouped_oof(make, X, y, g)
    d.assign(p_sustained_oof=oof.round(3))[["test_id", "investigation_id", "material_family", "flow_direction",
                                             "x_o2", "pressure_atm", "flow_cm_s", "flame_sustained",
                                             "p_sustained_oof"]].to_csv(OUT / "A_oof_predictions.csv", index=False)
    res["materials_modelled"] = sorted(n_mat[n_mat >= MIN_ROWS_PER_MATERIAL].index.tolist())
    res["chosen"] = best
    res["habitat_note"] = "probabilities with 10-90 % bootstrap band; applicability vs nearest test of the same material"
    return res


# --------------------------------------------------------------------------------------------- D
def train_D() -> dict:
    from lifelines import WeibullAFTFitter
    from lifelines.utils import concordance_index
    D = pd.read_csv(ML / "D_gas_flames.csv")
    t = pd.read_csv(ROOT / "data" / "processed" / "tests.csv", low_memory=False).set_index("test_id")
    d = D[D["ready_burn_time"]].copy()
    d["day"] = d["test_id"].map(t["test_date"])
    d["T"] = d["burn_time_s"].clip(lower=0.5)
    d["E"] = d["self_extinguished"].astype(int)
    d["log_mdot"] = np.log(d["fuel_flow_mg_s"].clip(lower=0.05))
    feats = ["x_o2", "pressure_atm", "log_mdot", "fuel_mole_fraction"]
    for f in ("propane", "butane"):
        d[f"fuel_{f}"] = (d["fuel_family"] == f).astype(int)
    feats += ["fuel_propane", "fuel_butane"]
    cols = feats + ["T", "E"]
    cis = []
    for day in d["day"].unique():
        tr, te = d[d["day"] != day], d[d["day"] == day]
        if te["E"].sum() == 0 or len(te) < 3:
            continue
        m = WeibullAFTFitter(penalizer=0.01).fit(tr[cols], "T", "E")
        pred = m.predict_median(te[feats])
        try:
            cis.append(concordance_index(te["T"], pred, te["E"]))
        except ZeroDivisionError:
            pass
    final = WeibullAFTFitter(penalizer=0.01).fit(d[cols], "T", "E")
    joblib.dump(dict(model=final, features=feats, train=d), OUT / "D_gas_flames.joblib")
    grid = []
    for p in (0.5, 0.69, 1.0):
        for o2 in np.round(np.arange(0.18, 0.405, 0.01), 2):
            grid.append(dict(x_o2=o2, pressure_atm=p, log_mdot=np.log(1.0), fuel_mole_fraction=0.3,
                             fuel_propane=1, fuel_butane=0))
    G = pd.DataFrame(grid)
    G["median_burn_s"] = final.predict_median(G[feats]).round(1).to_numpy()
    G["p_still_burning_30s"] = final.predict_survival_function(G[feats], times=[30.0]).T.iloc[:, 0].round(3).to_numpy()
    G["applicability"] = np.where((G.x_o2 > 0.234) & (G.x_o2 < 0.332),
                                  "outside tested range: no tests between 24 % and 33 % O2", "inside tested O2 range")
    G.to_csv(OUT / "D_burn_time_grid.csv", index=False)
    summ = final.summary[["coef", "exp(coef)", "p"]].round(4)
    return dict(concordance_leave_one_day_out=round(float(np.mean(cis)), 3), n_days=len(cis), n=int(len(d)),
                n_self_extinguished=int(d.E.sum()), n_censored=int((d.E == 0).sum()),
                o2_effect=summ.loc[("lambda_", "x_o2")].to_dict() if ("lambda_", "x_o2") in summ.index else None,
                habitat_median_burn_s=float(G[(G.x_o2 == 0.30) & (G.pressure_atm == 0.69)].median_burn_s.iloc[0]),
                earth_median_burn_s=float(G[(G.x_o2 == 0.21) & (G.pressure_atm == 1.0)].median_burn_s.iloc[0]))


# --------------------------------------------------------------------------------------------- C
C_NUM = ["x_o2", "log_p", "d0_mm", "x_co2", "x_he"]


def _c_features(df: pd.DataFrame, fuels: list[str]) -> np.ndarray:
    X = df.copy()
    X["log_p"] = np.log(X["pressure_atm"])
    num = X[C_NUM].to_numpy(float)
    oh = np.column_stack([(X["fuel"] == f).astype(float) for f in fuels])
    return np.column_stack([num, oh])


def _gp():
    k = ConstantKernel(1.0) * RBF(length_scale=np.ones(len(C_NUM) + 4), length_scale_bounds=(1e-2, 1e3)) \
        + WhiteKernel(1e-2, (1e-5, 1.0))
    return GaussianProcessRegressor(kernel=k, normalize_y=True, n_restarts_optimizer=1, random_state=0)


def train_C() -> dict:
    C = pd.read_csv(ML / "C_droplets.csv")
    d = C[C["ready_for_model"] & (C["source_type"] == "experiment")].copy()
    d[["x_co2", "x_he"]] = d[["x_co2", "x_he"]].fillna(0.0)
    fuels = sorted(d["fuel"].unique())[:4]
    res, models = {}, {}
    for target in ("burning_rate_mm2_s", "extinction_diameter_mm"):
        s = d[d[target].notna() & d["d0_mm"].notna()].reset_index(drop=True)
        X, y = _c_features(s, fuels), s[target].to_numpy()
        sc = StandardScaler().fit(X[:, :len(C_NUM)])
        Xs = np.column_stack([sc.transform(X[:, :len(C_NUM)]), X[:, len(C_NUM):]])
        oof = np.zeros(len(y))
        for tr, te in KFold(5, shuffle=True, random_state=0).split(Xs):
            oof[te] = _gp().fit(Xs[tr], y[tr]).predict(Xs[te])
        lofo = {}
        for f in s["fuel"].unique():
            te = (s["fuel"] == f).to_numpy()
            if te.sum() < 5 or (~te).sum() < 20:
                continue
            pr = _gp().fit(Xs[~te], y[~te]).predict(Xs[te])
            lofo[f] = dict(mae=round(mean_absolute_error(y[te], pr), 3), n=int(te.sum()))
        gp = _gp().fit(Xs, y)
        models[target] = dict(model=gp, scaler=sc, fuels=fuels, train=s)
        res[target] = dict(cv5_r2=round(r2_score(y, oof), 3), cv5_mae=round(mean_absolute_error(y, oof), 3),
                           target_mean=round(float(y.mean()), 3), n=int(len(y)), leave_one_fuel_out=lofo)
    joblib.dump(models, OUT / "C_droplets.joblib")
    q = []
    for fuel in ("methanol", "n-heptane"):
        for atm_name, atm in (("habitat", HABITAT), ("earth_cabin", EARTH)):
            q.append(dict(fuel=fuel, d0_mm=3.0, x_co2=0.0, x_he=0.0, atmosphere=atm_name, **atm))
    Q = pd.DataFrame(q)
    for target, m in models.items():
        X = _c_features(Q, m["fuels"])
        Xs = np.column_stack([m["scaler"].transform(X[:, :len(C_NUM)]), X[:, len(C_NUM):]])
        mu, sd = m["model"].predict(Xs, return_std=True)
        Q[target], Q[target + "_sd"] = mu.round(3), sd.round(3)
    app = applicability(Q, d, "fuel", dict(x_o2=0.04, pressure_atm=0.2, x_co2=0.05, x_he=0.05))
    pd.concat([Q, app], axis=1).to_csv(OUT / "C_habitat_predictions.csv", index=False)
    return res


# ------------------------------------------------------------------------------------ explanations
A_INPUTS = {"x_o2": "Oxygen", "pressure_atm": "Pressure", "flow_cm_s": "Air speed", "material_family": "Material",
            "geometry_class": "Shape", "flow_direction": "Flow direction"}


def explain_A() -> dict:
    """What the solids model relies on (permutation importance per real input, on the bagged ensemble),
    how each factor moves the answer (effect curves), and a glass-box logistic companion (odds ratios)."""
    pack = joblib.load(OUT / "A_solids.joblib")
    d, boots = pack["train"], pack["boots"]
    y = d["flame_sustained"].to_numpy()

    def score(frame):
        X = _a_features(frame)
        return roc_auc_score(y, np.mean([b.predict_proba(X)[:, 1] for b in boots], axis=0))

    base = score(d)
    rng = np.random.default_rng(0)
    imp = {}
    for col, name in A_INPUTS.items():
        drops = []
        for _ in range(8):
            shuffled = d.copy()
            shuffled[col] = rng.permutation(shuffled[col].to_numpy())
            drops.append(base - score(shuffled))
        imp[name] = round(float(np.mean(drops)), 4)
    # effect curves for each modelled material at its most common shape and flow direction
    curves = []
    n_mat = d["material_family"].value_counts()
    for mat in n_mat[n_mat >= MIN_ROWS_PER_MATERIAL].index:
        g = d[d.material_family == mat]
        geom, direc = g["geometry_class"].mode().iat[0], g["flow_direction"].mode().iat[0]
        ref = dict(material_family=mat, geometry_class=geom, flow_direction=direc, flow_cm_s=10.0, **EARTH)
        for factor, grid in (("x_o2", np.round(np.arange(0.15, 0.405, 0.01), 3)),
                             ("pressure_atm", np.round(np.arange(0.4, 1.21, 0.05), 3)),
                             ("flow_cm_s", np.round(np.geomspace(0.5, 40, 25), 3))):
            q = pd.DataFrame([ref] * len(grid))
            q[factor] = grid
            X = _a_features(q)
            pr = np.array([b.predict_proba(X)[:, 1] for b in boots])
            for v, m_, lo, hi in zip(grid, pr.mean(0), np.percentile(pr, 10, 0), np.percentile(pr, 90, 0)):
                curves.append(dict(material=mat, shape=geom, direction=direc, factor=factor, value=float(v),
                                   p_sustained=round(float(m_), 3), p_low=round(float(lo), 3), p_high=round(float(hi), 3)))
    pd.DataFrame(curves).to_csv(OUT / "A_effect_curves.csv", index=False)
    # glass-box companion: logistic regression in plain units
    X = _a_features(d)
    lg = _a_logit().fit(X, y)
    sc, coef = lg.named_steps["pre"].named_transformers_["num"], lg.named_steps["clf"].coef_[0]
    sd = dict(zip(A_NUM, sc.scale_))
    odds = {"+1 % O2": round(float(np.exp(coef[0] / sd["x_o2"] * 0.01)), 3),
            "+0.1 atm pressure": round(float(np.exp(coef[1] / sd["pressure_atm"] * 0.1)), 3)}
    cat_names = lg.named_steps["pre"].named_transformers_["cat"].get_feature_names_out(A_CAT)
    cats = {n.replace("material_family_", "material = ").replace("geometry_class_", "shape = ")
            .replace("flow_direction_", "direction = "): round(float(np.exp(c)), 3)
            for n, c in zip(cat_names, coef[len(A_NUM):])}
    return dict(baseline_auc_in_sample=round(base, 3), importance_auc_drop=imp,
                glass_box_odds_ratios=odds, glass_box_category_odds=cats,
                note="importance = drop in ROC-AUC when that input is shuffled (bigger = relied on more); "
                     "odds ratios from the logistic companion model (held-out ROC-AUC in metrics.json)")


def explain_D() -> dict:
    """Weibull AFT coefficients as time ratios: how much each factor stretches or shrinks the burn time."""
    pack = joblib.load(OUT / "D_gas_flames.joblib")
    m = pack["model"]
    c = m.params_.loc["lambda_"]
    ci = m.confidence_intervals_.loc["lambda_"] if hasattr(m, "confidence_intervals_") else None

    def tr(name, step, label):
        val = float(np.exp(c[name] * step))
        out = dict(effect=label, time_ratio=round(val, 3))
        if ci is not None:
            lo, hi = ci.loc[name].to_numpy()
            out["ci95"] = [round(float(np.exp(lo * step)), 3), round(float(np.exp(hi * step)), 3)]
        return out
    return dict(time_ratios=[tr("x_o2", 0.01, "+1 % oxygen"), tr("pressure_atm", 0.1, "+0.1 atm pressure"),
                             tr("log_mdot", np.log(2), "double the fuel flow"),
                             tr("fuel_mole_fraction", 0.1, "+10 % fuel in the fuel stream"),
                             tr("fuel_propane", 1, "propane instead of ethane"),
                             tr("fuel_butane", 1, "n-butane instead of ethane")],
                note="time ratio > 1: the flame burns longer before going out by itself; 1 = no effect")


def explain_C() -> dict:
    """Gaussian-process input relevance (1 / learned length scale on standardized inputs) and effect of O2."""
    models = joblib.load(OUT / "C_droplets.joblib")
    out = {}
    names = ["Oxygen", "Pressure (log)", "Droplet size", "CO2 added", "Helium added"]
    for target, pk in models.items():
        ls = pk["model"].kernel_.k1.k2.length_scale
        rel = 1 / np.asarray(ls)[:len(C_NUM)]
        rel = rel / rel.sum()
        out[target] = {n: round(float(r), 3) for n, r in zip(names, rel)}
    curves = []
    for target, pk in models.items():
        for fuel in ("methanol", "n-heptane"):
            for p in (0.69, 1.0):
                q = pd.DataFrame(dict(fuel=fuel, d0_mm=3.0, x_co2=0.0, x_he=0.0, pressure_atm=p,
                                      x_o2=np.round(np.arange(0.15, 0.355, 0.01), 3)))
                X = _c_features(q, pk["fuels"])
                Xs = np.column_stack([pk["scaler"].transform(X[:, :len(C_NUM)]), X[:, len(C_NUM):]])
                mu, sd = pk["model"].predict(Xs, return_std=True)
                for o2, a, b in zip(q.x_o2, mu, sd):
                    curves.append(dict(target=target, fuel=fuel, pressure_atm=p, x_o2=float(o2),
                                       value=round(float(a), 3), sd=round(float(b), 3)))
    pd.DataFrame(curves).to_csv(OUT / "C_effect_curves.csv", index=False)
    tr = models["burning_rate_mm2_s"]["train"]
    sup = tr[(tr.x_co2.fillna(0) > 0) | (tr.x_he.fillna(0) > 0)]
    return dict(input_relevance=out, suppressant_tests_max_o2=round(float(sup.x_o2.max()), 3),
                note="relevance = share of 1/length-scale across the physical inputs (fuel identity excluded); "
                     "suppressant (CO2, He) tests only go up to the O2 shown, so suppression at habitat O2 is untested")


def run() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    metrics = dict(A_solids=train_A(), D_gas_flames=train_D(), C_droplets=train_C())
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str))
    explain = dict(A_solids=explain_A(), D_gas_flames=explain_D(), C_droplets=explain_C())
    (OUT / "explain.json").write_text(json.dumps(explain, indent=2, default=str))
    metrics["explain"] = explain
    return metrics
