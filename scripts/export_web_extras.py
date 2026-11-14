"""Export the remaining dashboard features for the static website (run after scripts/export_web.py).

Writes into web/src/data/ (bundled) and web/public/data/ (fetched on demand):
  shap_solids.json      exact Shapley values of the solids model against 50 real NASA tests, for every point of the
                        website's model grid (same reference sample and players as the dashboard's "Why this number?")
  closest_tests.json    the 12 real tests closest to each mission preset (ranking.closest_tests)
  mission_gaps.json     tested / thin / gap status per fire type for each mission preset (ranking.mission_gaps)
  findings.json         Key findings: tests near each mission, Saffire IV-VI CO2, flame spread vs duct size
  sources.json          dataset v1 source summary (one row per investigation)
  bass2_gas.json        BASS-II per-burn gas readings (for the CSV download)
  public/data/rag_passages.json   the 4,086 passages of the team's RAG database (text and section headers)
"""
from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
from itertools import combinations
from math import factorial
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from fif import knowledge as KN  # noqa: E402
from fif import models as MD  # noqa: E402
from fif import ranking as R  # noqa: E402
from fif import webdata as WD  # noqa: E402

OUT = ROOT / "web/src/data"
PUB = ROOT / "web/public/data"
PUB.mkdir(parents=True, exist_ok=True)


def dump(name, obj, where=OUT):
    (where / f"{name}.json").write_text(json.dumps(obj, separators=(",", ":"), default=float))
    print(f"  {name}.json  {(where / f'{name}.json').stat().st_size / 1024:.0f} kB")


def clean(v):
    if isinstance(v, float) and not np.isfinite(v):
        return None
    return v


# ------------------------------------------------------------------ exact Shapley over the solids grid
A = joblib.load(ROOT / "models/v1/A_solids.joblib")
SHAPES, _ = WD.solid_shapes(A)
tr = A["train"]
COLS = ["material_family", "geometry_class", "flow_direction", "flow_cm_s", "x_o2", "pressure_atm"]
PLAYERS = {"Oxygen": ["x_o2"], "Pressure": ["pressure_atm"], "Air speed": ["flow_cm_s"],
           "Material": ["material_family"], "Sample shape": ["geometry_class"], "Flow direction": ["flow_direction"]}
NAMES = list(PLAYERS)
bg = tr[COLS].sample(n=min(50, len(tr)), random_state=0).reset_index(drop=True)   # same reference as the dashboard
SUBSETS = [frozenset(c) for k in range(len(NAMES) + 1) for c in combinations(NAMES, k)]
W = {}
for name in NAMES:
    others = [n for n in NAMES if n != name]
    W[name] = [(frozenset(S), factorial(k) * factorial(len(NAMES) - k - 1) / factorial(len(NAMES)))
               for k in range(len(NAMES)) for S in combinations(others, k)]
f = lambda d: A["model"].predict_proba(MD._a_features(d))[:, 1]  # noqa: E731  (the model the website shows)

O2S, PS, FLOWS = list(range(15, 41)), [0.5, 0.69, 1.0], [1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 50.0]
rows = []
SKIP = (OUT / "shap_solids.json").exists() and "--force" not in sys.argv
for mat, sh in ({} if SKIP else SHAPES).items():
    pts = [dict(material_family=mat, geometry_class=sh["geometry"], flow_direction=sh["direction"], flow_cm_s=fl,
                x_o2=o / 100, pressure_atm=p) for o in O2S for p in PS for fl in FLOWS]
    frames = []
    for x in pts:
        for S in SUBSETS:
            fr = bg.copy()
            for pl in S:
                for col in PLAYERS[pl]:
                    fr[col] = x[col]
            frames.append(fr)
    pred = f(pd.concat(frames, ignore_index=True)).reshape(len(pts), len(SUBSETS), len(bg)).mean(axis=2)
    idx = {S: i for i, S in enumerate(SUBSETS)}
    for x, v in zip(pts, pred):
        phi = [sum(w * (v[idx[S | {n}]] - v[idx[S]]) for S, w in W[n]) for n in NAMES]
        rows.append([mat, round(x["x_o2"] * 100), x["pressure_atm"], x["flow_cm_s"], round(float(v[idx[frozenset()]]), 4),
                     *[round(float(q), 4) for q in phi]])
    print(f"  shapley {mat}: {len(pts)} points")
if not SKIP:
  dump("shap_solids", dict(players=NAMES, reference="50 real NASA tests (random sample of the training data, seed 0)",
                         rows=rows))

# ------------------------------------------------------------------ ranking extras per mission preset
missions = json.loads((OUT / "missions.json").read_text())
closest, gaps = {}, {}
for m in missions:
    tgt = dict(x_o2=m["x_o2"], pressure_atm=m["p"])
    ct = R.closest_tests(tgt, k=12).drop(columns=["source_file"])
    closest[m["id"]] = [{k: clean(v) for k, v in r.items()} for r in ct.to_dict("records")]
    gaps[m["id"]] = [{k: clean(v) for k, v in r.items()} for r in R.mission_gaps(tgt).to_dict("records")]
dump("closest_tests", closest)
dump("mission_gaps", gaps)

# ------------------------------------------------------------------ key findings
P = ROOT / "data/processed"
T = pd.read_csv(P / "tests.csv", low_memory=False)
EV = pd.read_csv(P / "evidence.csv", low_memory=False)
near = {}
for m in missions:
    nt = T[(T.gravity_g.fillna(0) == 0) & ((T.x_o2 - m["x_o2"]).abs() <= 0.05) & ((T.pressure_atm - m["p"]).abs() <= 0.2)]
    excl = nt["exclude"].astype("boolean").fillna(False).astype(bool) if "exclude" in nt else False
    sm = nt[(nt.fuel_class.eq("smoke_source") | nt.investigation_id.eq("PSI-107")) & nt.parent_test.isna() & ~excl]
    so = nt[nt.fuel_class.eq("solid")]
    near[m["id"]] = dict(smoke=int(len(sm)), solids=int(len(so)), solids_psi=int((~so.investigation_id.str.startswith("EXT")).sum()))
x = EV[EV.investigation_id == "EXT-SAFFIRE-456"].pivot_table(index="test_id", columns="quantity", values="value")
lab = {"EXT-SAFFIRE-456:IV-1": "IV-1 fabric (SIBAL) 22 %", "EXT-SAFFIRE-456:V-2": "V-2 cotton 26 %",
       "EXT-SAFFIRE-456:VI-2": "VI-2 fabric (SIBAL) 31 %", "EXT-SAFFIRE-456:VI-3": "VI-3 PMMA 10 mm 30 %",
       "EXT-SAFFIRE-456:VI-4": "VI-4 PMMA 5 mm 29 %"}
saffire_co2 = [[lab[i], float(x.at[i, "co2_increase_ffd"])] for i in lab if i in x.index and pd.notna(x.at[i, "co2_increase_ffd"])]
B = pd.read_csv(ROOT / "ml/v1/B_solids_spread.csv")
duct = {"PSI-26": "BASS (7.6 cm duct)", "PSI-98": "Saffire I-III (51 cm duct)", "PSI-99": "Saffire I-III (51 cm duct)",
        "PSI-100": "Saffire I-III (51 cm duct)", "EXT-SAFFIRE-456": "Saffire IV (30.5 cm duct)"}
bb = B[(B.material_family == "cotton-fiberglass") & (B.flow_direction == "concurrent")].copy()
bb["duct"] = bb.investigation_id.map(duct)
spread = [[r.duct, r.test_id, float(r.spread_rate_mm_s), clean(float(r.flow_cm_s)), round(float(r.x_o2) * 100, 1)]
          for r in bb.dropna(subset=["duct", "spread_rate_mm_s"]).itertuples()]
dump("findings", dict(near=near, saffire_co2=saffire_co2, spread=spread,
                      saffire_source="Urban et al., ICES-2024-365 (NASA NTRS 20240002981), Table 2",
                      spread_source="Concurrent flow, 19-25 cm/s, 21-23 % O2. Olson et al. Table 1; NASA NTRS 20180005168"))

# ------------------------------------------------------------------ data and sources
src = pd.read_csv(ROOT / "ml/v1/sources_summary.csv")
cat = pd.read_csv(ROOT / "catalog/investigations.csv")
inv_web = pd.DataFrame(json.loads((OUT / "investigations.json").read_text()))
if "doi" in inv_web:
    src = src.merge(inv_web[["id", "doi"]], left_on="investigation_id", right_on="id", how="left").drop(columns=["id"])
dump("sources", [{k: clean(v) if not (isinstance(v, float) and np.isnan(v)) else None for k, v in r.items()}
                 for r in src.to_dict("records")])
g2 = KN.bass2_gas()
dump("bass2_gas", dict(columns=list(g2.columns), rows=[[clean(v) if not (isinstance(v, float) and np.isnan(v)) else None
                                                       for v in r] for r in g2.itertuples(index=False)]))

# ------------------------------------------------------------------ RAG passages (team database, read-only copy)
tmp = Path(tempfile.mkdtemp()) / "c.db"
shutil.copy(ROOT / "RAG/database/chroma.sqlite3", tmp)
con = sqlite3.connect(tmp)
meta = {}
for i, k, s in con.execute("select id, key, string_value from embedding_metadata"):
    meta.setdefault(i, {})[k] = s
passages = []
for i in sorted(meta):
    d = meta[i]
    if d.get("chroma:document"):
        passages.append([d.get("Header 1") or "", d.get("Header 2") or "", d.get("Header 3") or "", d["chroma:document"]])
con.close()
dump("rag_passages", passages, PUB)
print("done")

# ------------------------------------------------------------------ the team's RAG prompt rules (verbatim)
sys.path.insert(0, str(ROOT / "RAG/src"))
import importlib.util  # noqa: E402
spec = importlib.util.spec_from_file_location("rag_prompts", ROOT / "RAG/src/prompts.py")
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
dump("rag_prompt", dict(system=mod.SYSTEM_PROMPT, model="gemini-3.1-flash-lite"))

# ------------------------------------------------------------------ the dashboard's flame simulator, parameters from the URL hash
sim = (ROOT / "app/assets/flame_sim.html").read_text()
(ROOT / "web/public/sim").mkdir(parents=True, exist_ok=True)
(ROOT / "web/public/sim/flame_sim.html").write_text(
    sim.replace("const P = PARAMS;", "const P = JSON.parse(decodeURIComponent(location.hash.slice(1)));"))
print("  sim/flame_sim.html")
