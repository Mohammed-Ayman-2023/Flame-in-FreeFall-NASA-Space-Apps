"""Records the website and its API share: mission presets, investigation records and model queries.

Used by scripts/export_web.py (static JSON for the site) and server/main.py (the live API), so both
always describe the same investigations and run the models the same way.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import knowledge as KN
from . import models as MD
from . import ranking as RK

MISSIONS = [
    dict(id="habitat", name="Challenge habitat", x_o2=0.30, p=0.69, air="30% O₂ · 0.69 atm",
         note="The Moon-base and pressurized-rover air in the challenge brief: 30% oxygen or more at 10.2 psi or less."),
    dict(id="iss", name="ISS cabin", x_o2=0.21, p=1.0, air="21% O₂ · 1 atm",
         note="Earth-like air. Almost every NASA fire test in PSI ran here."),
    dict(id="exploration", name="NASA exploration", x_o2=0.265, p=round(10.2 / 14.696, 3), air="26.5% O₂ · 10.2 psia",
         note="An exploration atmosphere NASA has studied, also run in ACME BRE."),
    dict(id="lunar", name="Lunar base", x_o2=0.34, p=round(8.2 / 14.696, 3), air="34% O₂ · 8.2 psia",
         note="NASA's proposed lunar atmosphere, also run in ACME BRE."),
]


def investigations(K: dict) -> list[dict]:
    """One record per investigation, in habitat-relevance order."""
    cat = K["cat"].set_index("psi_id")
    rank_h = RK.rank(dict(x_o2=0.30, pressure_atm=0.69)).set_index("psi_id")
    invs = []
    for psi in rank_h.index:
        c = cat.loc[psi] if psi in cat.index else pd.Series(dtype=object)
        meta = KN.INVESTIGATIONS.get(psi, {})
        try:
            var = KN.variables(K, psi)
        except Exception:
            var = dict(varied=[], same=[], n=0)
        doi = KN.doi_of(K, psi)
        invs.append(dict(
            id=psi, acronym=str(c.get("acronym", rank_h.loc[psi, "acronym"])), name=str(c.get("name", "")),
            family=str(c.get("family", "")), fire_type=str(rank_h.loc[psi, "fire_type"]),
            platform=meta.get("platform", str(c.get("platform", ""))), years=meta.get("years", ""),
            area=meta.get("area", ""), what=meta.get("what", ""), fuels=str(c.get("fuels", "")),
            geometry=str(c.get("geometry", "")), o2=[c.get("o2_min"), c.get("o2_max")], p=[c.get("p_min_atm"), c.get("p_max_atm")],
            flow_max=c.get("flow_max_cm_s"), data_level=str(rank_h.loc[psi, "data_level"]), n_tests=int(rank_h.loc[psi, "n_tests"]),
            key_result=KN.key_result(K, psi), hardware=KN.hardware_text(K, psi), sample=KN.sample_text(K, psi),
            measurements=KN.measurements_text(K, psi), varied=var["varied"], same=var["same"],
            context=KN.CONTEXT.get(psi, ""), derived=KN.derived_from(K, psi), doi=doi, link=KN.link_of(psi, doi),
            hardware_group=KN.HW_OF.get(psi),
        ))
    return invs


RANK_COLS = ["rank", "psi_id", "acronym", "fire_type", "data_level", "n_tests", "n_near_mission", "closest_condition",
             "score_atmosphere", "score_fire_type", "score_data", "score_volume", "relevance", "why"]


def ranking(x_o2: float, p: float) -> list[dict]:
    return RK.rank(dict(x_o2=x_o2, pressure_atm=p)).reset_index(drop=True)[RANK_COLS].to_dict("records")


# ------------------------------------------------------------------ model queries (vectorised)
def gas(K: dict, rows: list[dict]) -> pd.DataFrame:
    """Model D: Weibull survival, still-air gas flames. rows: fuel, x_o2 (fraction), pressure_atm."""
    m, feats = K["D_pack"]["model"], K["D_pack"]["features"]
    G = pd.DataFrame([dict(x_o2=r["x_o2"], pressure_atm=r["pressure_atm"], log_mdot=0.0, fuel_mole_fraction=0.3,
                           fuel_propane=int(r["fuel"] == "propane"), fuel_butane=int(r["fuel"] == "butane")) for r in rows])
    out = pd.DataFrame(dict(median=m.predict_median(G[feats]).to_numpy()))
    sf = m.predict_survival_function(G[feats], times=[10.0, 30.0, 60.0]).T
    out["s10"], out["s30"], out["s60"] = sf.iloc[:, 0].to_numpy(), sf.iloc[:, 1].to_numpy(), sf.iloc[:, 2].to_numpy()
    return out


def solids(A_pack: dict, shapes: dict, rows: list[dict]) -> pd.DataFrame:
    """Model A: gradient boosting with physics constraints. rows: material, x_o2, pressure_atm, flow_cm_s.
    Band = 10-90 % of the bootstrap ensemble."""
    q = pd.DataFrame([dict(material_family=r["material"], geometry_class=shapes[r["material"]]["geometry"],
                           flow_direction=shapes[r["material"]]["direction"], x_o2=r["x_o2"],
                           pressure_atm=r["pressure_atm"], flow_cm_s=float(r["flow_cm_s"])) for r in rows])
    X = MD._a_features(q)
    bp = np.array([b.predict_proba(X)[:, 1] for b in A_pack["boots"]])
    return pd.DataFrame(dict(p=A_pack["model"].predict_proba(X)[:, 1], lo=np.percentile(bp, 10, axis=0),
                             hi=np.percentile(bp, 90, axis=0)))


def solid_shapes(A_pack: dict) -> tuple[dict, list[str]]:
    """The modelled materials (>= MIN_ROWS rows), each with its most-tested shape and flow direction."""
    dA = A_pack["train"]
    combos = (dA.groupby(["material_family", "geometry_class", "flow_direction"]).size().reset_index(name="n")
              .sort_values("n", ascending=False).groupby("material_family").head(1))
    n_mat = dA["material_family"].value_counts()
    mods = [c for _, c in combos.iterrows() if n_mat.get(c.material_family, 0) >= MD.MIN_ROWS_PER_MATERIAL]
    shapes = {c.material_family: dict(geometry=c.geometry_class, direction=c.flow_direction) for c in mods}
    return shapes, sorted(set(n_mat.index) - set(shapes))


def droplets(K: dict, rows: list[dict]) -> pd.DataFrame:
    """Model C: Gaussian processes. rows: fuel, x_o2, pressure_atm, x_co2, x_he, d0_mm. ± = model std."""
    qq = pd.DataFrame(rows)
    out = pd.DataFrame(index=qq.index)
    for target, key in (("burning_rate_mm2_s", "br"), ("extinction_diameter_mm", "ext")):
        pk = K["C_pack"][target]
        X = MD._c_features(qq, pk["fuels"])
        Xs = np.column_stack([pk["scaler"].transform(X[:, :len(MD.C_NUM)]), X[:, len(MD.C_NUM):]])
        mu, sd = pk["model"].predict(Xs, return_std=True)
        out[key], out[key + "_sd"] = mu, sd
    return out
