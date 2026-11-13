"""Relevance ranking and gap map. Transparent on purpose: four scores between 0 and 1, a weighted sum, and a
plain-language reason for every investigation. Any mission atmosphere can be scored; the habitat default is
30 % O2 at 0.69 atm in microgravity.

  atmosphere  how close the investigation's tests come to the mission O2 and pressure (nearest test, plus how
              many tests fall inside the mission window)
  fire_type   how much this kind of fire matters in a crewed habitat (editable weights; solids and smoke first)
  data        what the investigation actually gives: per-test outcomes > partial > conditions only > catalog
  volume      how many tests (log scale)

The gap map counts tests per fire type in O2 x pressure cells and lists the cells around the mission point that
no experiment has reached.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
HABITAT = dict(x_o2=0.30, pressure_atm=0.69)
WINDOW = dict(x_o2=0.05, pressure_atm=0.20)          # "near the mission atmosphere"
SCALE = dict(x_o2=0.05, pressure_atm=0.25)           # distance units for the proximity score

FIRE_TYPE = {  # label, default relevance for a crewed habitat
    "solid": ("Burning solids (cabin materials)", 1.0),
    "emulated_solid": ("Emulated burning solids", 0.9),
    "smoke_source": ("Smoke and fire detection", 0.9),
    "liquid": ("Fuel droplets (spilled liquids, sprays)", 0.6),
    "gas": ("Gas flames (leaks, fundamentals)", 0.5),
}
DATA_LEVEL = {  # what the loaded data can answer
    "per-test outcomes": 1.0, "partial outcomes": 0.6, "conditions only": 0.35, "catalog only": 0.1}
LEVEL_OF = {
    "PSI-25": "per-test outcomes", "PSI-26": "per-test outcomes", "PSI-98": "per-test outcomes",
    "PSI-99": "per-test outcomes", "PSI-100": "per-test outcomes", "EXT-SAFFIRE-456": "per-test outcomes",
    "PSI-69": "per-test outcomes", "PSI-117": "per-test outcomes", "PSI-159": "per-test outcomes",
    "PSI-20": "partial outcomes", "PSI-39": "conditions only", "PSI-101": "conditions only",
    "PSI-102": "conditions only", "PSI-107": "conditions only",
}
# BRE objectives name the NASA exploration atmospheres it was built to test; the day table omits pressure.
BRE_NAMED_P = {0.21: 1.0, 0.265: round(10.2 / 14.696, 3), 0.34: round(8.2 / 14.696, 3)}
DEFAULT_WEIGHTS = dict(atmosphere=0.40, fire_type=0.25, data=0.25, volume=0.10)


def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    t = pd.read_csv(ROOT / "data" / "processed" / "tests.csv", low_memory=False)
    t = t[(t["gravity_g"].fillna(0) == 0)].copy()
    t["pressure_note"] = np.where(t["pressure_atm"].isna(), "", "reported")
    bre = (t["investigation_id"] == "PSI-20") & t["pressure_atm"].isna()
    t.loc[bre, "pressure_atm"] = t.loc[bre, "x_o2"].round(3).map(BRE_NAMED_P)
    t.loc[bre & t["pressure_atm"].notna(), "pressure_note"] = "named atmosphere in BRE objectives"
    bass2 = (t["investigation_id"] == "PSI-25") & t["pressure_atm"].isna()
    t.loc[bass2, ["pressure_atm", "pressure_note"]] = [1.0, "1 atm (same ISS glovebox as BASS, measured 0.97-1.01)"]
    c = pd.read_csv(ROOT / "catalog" / "investigations.csv")
    c = c[c["in_scope"].astype(str).isin(["True", "true", "1"]) & ~c["psi_id"].str.contains(r"\?", regex=True)]
    return t, c


def _proximity(o2, p, target) -> np.ndarray:
    d2 = ((o2 - target["x_o2"]) / SCALE["x_o2"]) ** 2 + ((p - target["pressure_atm"]) / SCALE["pressure_atm"]) ** 2
    return np.exp(-d2 / 2)


def _envelope_point(row, target):
    """Closest point of a catalog O2 x pressure box to the target (catalog-only investigations)."""
    o2 = np.clip(target["x_o2"], row.o2_min if pd.notna(row.o2_min) else 0.21, row.o2_max if pd.notna(row.o2_max) else 0.21)
    p = np.clip(target["pressure_atm"], row.p_min_atm if pd.notna(row.p_min_atm) else 1.0,
                row.p_max_atm if pd.notna(row.p_max_atm) else 1.0)
    return float(o2), float(p)


def rank(target: dict | None = None, weights: dict | None = None, fire_weights: dict | None = None) -> pd.DataFrame:
    target = target or HABITAT
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    fw = {k: v[1] for k, v in FIRE_TYPE.items()} | (fire_weights or {})
    t, c = load()
    rows = []
    for _, r in c.iterrows():
        psi = r.psi_id
        tt = t[t["investigation_id"] == psi].dropna(subset=["x_o2", "pressure_atm"])
        fclass = r.fuel_class if isinstance(r.fuel_class, str) else (tt["fuel_class"].mode().iat[0] if len(tt) else "gas")
        level = LEVEL_OF.get(psi, "catalog only")
        if len(tt):
            prox = _proximity(tt["x_o2"].to_numpy(), tt["pressure_atm"].to_numpy(), target)
            near = ((tt["x_o2"] - target["x_o2"]).abs() <= WINDOW["x_o2"]) & \
                   ((tt["pressure_atm"] - target["pressure_atm"]).abs() <= WINDOW["pressure_atm"])
            n_near, best = int(near.sum()), tt.iloc[int(prox.argmax())]
            atm = 0.7 * prox.max() + 0.3 * min(1.0, np.log1p(n_near) / np.log1p(20))
            closest = f"{best['x_o2']:.0%} O2, {best['pressure_atm']:.2f} atm"
            n_tests = len(tt)
        else:
            o2, p = _envelope_point(r, target)
            atm = 0.7 * float(_proximity(np.array([o2]), np.array([p]), target)[0])
            n_near, closest, n_tests = 0, f"{o2:.0%} O2, {p:.2f} atm (catalog range)", 0
        volume = min(1.0, np.log1p(n_tests) / np.log1p(500))
        parts = dict(atmosphere=round(atm, 3), fire_type=fw.get(fclass, 0.5), data=DATA_LEVEL[level],
                     volume=round(volume, 3))
        score = sum(w[k] * parts[k] for k in w) / sum(w.values())
        label = FIRE_TYPE.get(fclass, (fclass, 0))[0]
        why = (f"{n_near} tests within ±{WINDOW['x_o2']:.0%} O2 and ±{WINDOW['pressure_atm']} atm of the mission; "
               f"closest test {closest}; {label.lower()}; {level}")
        rows.append(dict(psi_id=psi, acronym=r.acronym, fire_type=label, data_level=level, n_tests=n_tests,
                         n_near_mission=n_near, closest_condition=closest, **{f"score_{k}": v for k, v in parts.items()},
                         relevance=round(100 * score, 1), why=why,
                         notes=r.notes if isinstance(r.notes, str) else ""))
    out = pd.DataFrame(rows).sort_values("relevance", ascending=False).reset_index(drop=True)
    out.insert(0, "rank", range(1, len(out) + 1))
    return out


def closest_tests(target: dict | None = None, k: int = 10, fuel_class: str | None = None) -> pd.DataFrame:
    target = target or HABITAT
    t, _ = load()
    t = t.dropna(subset=["x_o2", "pressure_atm"])
    if fuel_class:
        t = t[t["fuel_class"] == fuel_class]
    t = t.assign(proximity=_proximity(t["x_o2"].to_numpy(), t["pressure_atm"].to_numpy(), target))
    cols = ["investigation_id", "test_id", "fuel", "fuel_class", "x_o2", "pressure_atm", "pressure_note", "flow_cm_s",
            "outcome_note", "source_file", "proximity"]
    return t.sort_values("proximity", ascending=False)[cols].head(k).round(3)


O2_BINS = [0.10, 0.15, 0.18, 0.21, 0.24, 0.27, 0.30, 0.33, 0.36, 0.41]
P_BINS = [0.0, 0.45, 0.6, 0.8, 0.95, 1.05, 1.6, 2.5, 5.5]


def gap_matrix() -> pd.DataFrame:
    """Tests per fire type in O2 x pressure cells (microgravity only)."""
    t, _ = load()
    t = t.dropna(subset=["x_o2", "pressure_atm"])
    t = t.assign(o2_band=pd.cut(t["x_o2"], O2_BINS, right=False), p_band=pd.cut(t["pressure_atm"], P_BINS, right=False),
                 fire_type=t["fuel_class"].map(lambda f: FIRE_TYPE.get(f, (f, 0))[0]))
    g = t.groupby(["fire_type", "o2_band", "p_band"], observed=False).agg(
        n_tests=("test_id", "size"), investigations=("investigation_id", lambda s: ", ".join(sorted(set(s)))))
    return g.reset_index().assign(o2_band=lambda d: d["o2_band"].astype(str), p_band=lambda d: d["p_band"].astype(str))


def mission_gaps(target: dict | None = None) -> pd.DataFrame:
    """For each fire type: how many tests sit near the mission atmosphere, the closest one, and a recommendation."""
    target = target or HABITAT
    t, _ = load()
    t = t.dropna(subset=["x_o2", "pressure_atm"])
    rows = []
    for fclass, (label, _) in FIRE_TYPE.items():
        tt = t[t["fuel_class"] == fclass]
        if tt.empty:
            continue
        near = ((tt["x_o2"] - target["x_o2"]).abs() <= WINDOW["x_o2"]) & \
               ((tt["pressure_atm"] - target["pressure_atm"]).abs() <= WINDOW["pressure_atm"])
        prox = _proximity(tt["x_o2"].to_numpy(), tt["pressure_atm"].to_numpy(), target)
        best = tt.iloc[int(prox.argmax())]
        n = int(near.sum())
        status = "covered" if n >= 10 else ("thin" if n > 0 else "GAP: never tested")
        assumed = tt.loc[near, "pressure_note"].str.startswith("named atmosphere").mean() if n else 0
        if n and assumed > 0.5:
            status += " (pressure from BRE objectives, not recorded per test)"
        rows.append(dict(fire_type=label, tests_total=len(tt), tests_near_mission=n, status=status,
                         o2_range=f"{tt.x_o2.min():.0%}-{tt.x_o2.max():.0%}",
                         pressure_range=f"{tt.pressure_atm.min():.2f}-{tt.pressure_atm.max():.2f} atm",
                         closest_test=f"{best['test_id']} ({best['x_o2']:.0%} O2, {best['pressure_atm']:.2f} atm)"))
    return pd.DataFrame(rows)


RECOMMENDATIONS = [
    dict(priority=1, experiment="Flammability and spread of cabin solids (PMMA, cotton, Nomex, foams) at 28-32 % O2, 0.6-0.8 atm, 0-20 cm/s air",
         why="No PSI solid-fuel burn above 22 % O2; only 5 burns lie near the habitat atmosphere (Saffire V-VI, NASA literature). Models cannot score cotton, Nomex or silicone.",
         builds_on="BASS-II (PSI-25), Saffire IV-VI"),
    dict(priority=2, experiment="Smoke-detector response to smoke made at 30 % O2 and 0.69 atm",
         why="SAME, SAME-R and SPICE: 86 smoke tests and 469 soot-point settings, all at 21 % O2 and 1 atm.",
         builds_on="SAME-R (PSI-101), SPICE (PSI-107)"),
    dict(priority=3, experiment="Still-air self-extinction of gas and emulated-solid flames at 26-33 % O2",
         why="ACME CFI-G has no tests between 25 % and 34 % O2, exactly where the habitat sits; burn time rises ~4.5x from Earth air to habitat air.",
         builds_on="ACME CFI-G (PSI-159), ACME BRE (PSI-20)"),
    dict(priority=4, experiment="Release per-test FLEX-2 results (multicomponent droplets, 0.5-3 atm, up to 40 % O2)",
         why="FLEX-2 covers the habitat atmosphere on paper, but only its condition ranges are published in PSI.",
         builds_on="FLEX (PSI-69), FLEX-2 (PSI-68)"),
]


def run() -> dict:
    out = ROOT / "reports" / "ranking"
    out.mkdir(parents=True, exist_ok=True)
    r = rank()
    r.to_csv(out / "ranking_habitat.csv", index=False)
    rank(dict(x_o2=0.21, pressure_atm=1.0)).to_csv(out / "ranking_earth_cabin.csv", index=False)
    closest_tests(k=25).to_csv(out / "closest_tests_habitat.csv", index=False)
    gap_matrix().to_csv(out / "gap_matrix.csv", index=False)
    mission_gaps().to_csv(out / "mission_gaps_habitat.csv", index=False)
    pd.DataFrame(RECOMMENDATIONS).to_csv(out / "recommendations.csv", index=False)
    return dict(ranking=r, gaps=mission_gaps())
