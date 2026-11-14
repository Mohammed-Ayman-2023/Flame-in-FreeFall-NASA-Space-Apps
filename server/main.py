"""Flame in Freefall API: the website's backend.

One service that
  * runs the three trained models live (models/v1/*.joblib) at the exact conditions a user picks,
  * serves the investigation records, rankings and comparisons built from the dataset,
  * answers questions from the NASA sources: Gemini RAG over the team's vector database when
    GOOGLE_API_KEY is set, cited passage search (TF-IDF, no text generation) otherwise,
  * and, when web/dist exists, serves the built website itself, so one deploy gives site + API.

Run:  uvicorn server.main:app --port 8000      (from the repository root)
Docs: http://localhost:8000/api/docs
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from fif import genai  # noqa: E402
from fif import knowledge as KN  # noqa: E402
from fif import webdata as WD  # noqa: E402

t0 = time.time()
K = KN.load()
A_PACK = joblib.load(ROOT / "models/v1/A_solids.joblib")
SHAPES, NOT_MODELLED = WD.solid_shapes(A_PACK)
METRICS = json.loads((ROOT / "models/v1/metrics.json").read_text())
INVS = WD.investigations(K)
INV_BY_ID = {r["id"]: r for r in INVS}
INV_TABLE = KN.investigation_table(K).merge(
    WD.RK.rank(dict(x_o2=0.30, pressure_atm=0.69))[["psi_id", "fire_type"]], on="psi_id", how="left")
CORPUS = KN.corpus(K)
_vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
_X = _vec.fit_transform([f"{d['title']} {d['title']} {d['text']}" for d in CORPUS])
WEB = json.loads((ROOT / "web/src/data/model_gas.json").read_text())
GAS_GAP = WEB["gap"]
DA = A_PACK["train"]
ENV_A = {m: dict(o2=[float(s.x_o2.min()), float(s.x_o2.max())], p=[float(s.pressure_atm.min()), float(s.pressure_atm.max())],
                 flow=[float(s.flow_cm_s.min()), float(s.flow_cm_s.max())]) for m, s in DA.groupby("material_family")}
CD = K["C_pack"]["burning_rate_mm2_s"]["train"]
ENV_C = {f: dict(o2=[float(s.x_o2.min()), float(s.x_o2.max())], p=[float(s.pressure_atm.min()), float(s.pressure_atm.max())],
                 co2=float(s.x_co2.max()), he=float(s.x_he.max())) for f, s in CD.groupby("fuel")}
STARTUP_S = round(time.time() - t0, 2)
_rag = None

app = FastAPI(title="Flame in Freefall API", version="1.0", docs_url="/api/docs", openapi_url="/api/openapi.json",
              description="Live models and NASA microgravity-fire data behind the Flame in Freefall website. "
                          "Every model output is a prediction, not a measurement.")
origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"])


def clean(o):
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if math.isnan(o) or math.isinf(o) else round(float(o), 4)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


# ------------------------------------------------------------------------------------- status and data
@app.get("/api/health")
def health():
    ok, why = genai.status()
    return dict(status="ok", startup_s=STARTUP_S, dataset="v1", models=dict(
        A_solids=dict(method="Gradient boosting with physics constraints", held_out_roc_auc=METRICS["A_solids"]["gradient_boosting"]["roc_auc"]),
        D_gas_flames=dict(method="Weibull survival model", concordance_leave_one_day_out=METRICS["D_gas_flames"]["concordance_leave_one_day_out"]),
        C_droplets=dict(method="Gaussian process", cv5_r2={k: METRICS["C_droplets"][k]["cv5_r2"] for k in ("burning_rate_mm2_s", "extinction_diameter_mm")})),
        ai_answers=dict(available=ok, reason=why))


@app.get("/api/stats")
def stats():
    t = K["tests"]
    return clean(dict(tests=len(t), investigations_with_tests=int(t.investigation_id.nunique()),
                      investigations=len(INVS), measured_values=len(K["ev"]),
                      sources=int(K["ev"]["dataset_id"].nunique()),
                      o2_range=[float(t.x_o2.min()), float(t.x_o2.max())],
                      pressure_range=[float(t.pressure_atm.min()), float(t.pressure_atm.max())]))


@app.get("/api/missions")
def missions():
    return WD.MISSIONS


@app.get("/api/investigations")
def investigations(q: str = "", fire_type: str = "", x_o2: float | None = None, p: float | None = None):
    rows = INVS
    if x_o2 is not None and p is not None:
        order = {r["psi_id"]: r for r in WD.ranking(x_o2, p)}
        rows = sorted(rows, key=lambda r: order.get(r["id"], {}).get("rank", 999))
    if fire_type:
        rows = [r for r in rows if fire_type.lower() in r["fire_type"].lower()]
    if q:
        terms = q.lower().split()
        rows = [r for r in rows if all(t in json.dumps(r, ensure_ascii=False).lower() for t in terms)]
    return clean(rows)


@app.get("/api/investigations/{psi}")
def investigation(psi: str):
    r = INV_BY_ID.get(psi)
    if not r:
        raise HTTPException(404, f"No investigation {psi}")
    return clean(r)


@app.get("/api/ranking")
def ranking(x_o2: float = Query(0.30, ge=0.1, le=1.0), p: float = Query(0.69, gt=0, le=5)):
    return clean(WD.ranking(x_o2, p))


@app.get("/api/compare")
def compare(ids: str):
    ids_l = [i.strip() for i in ids.split(",") if i.strip()]
    missing = [i for i in ids_l if i not in INV_BY_ID]
    if missing or not 2 <= len(ids_l) <= 3:
        raise HTTPException(400, f"Give 2 or 3 known investigation ids; unknown: {missing}")
    ok = [i for i in ids_l if i in set(INV_TABLE.psi_id)]
    same, diff = KN.compare_summary(INV_TABLE, ok) if len(ok) >= 2 else ([], [])
    return clean(dict(investigations=[INV_BY_ID[i] for i in ids_l], same=same, different=diff))


# ------------------------------------------------------------------------------------- live models
class GasQ(BaseModel):
    fuel: str = Field("propane", pattern="^(ethane|propane|butane)$")
    o2: float = Field(30, ge=15, le=45, description="oxygen, % by volume")
    p: float = Field(0.69, gt=0.2, le=3.5, description="pressure, atm")


@app.post("/api/predict/gas")
def predict_gas(q: GasQ):
    """Model D: how long a still-air gas flame burns before going out by itself (ACME CFI-G)."""
    curve_o2 = np.round(np.arange(18, 40.01, 0.5), 1)
    rows = [dict(fuel=q.fuel, x_o2=q.o2 / 100, pressure_atm=q.p)] + [dict(fuel=q.fuel, x_o2=o / 100, pressure_atm=q.p) for o in curve_o2]
    r = WD.gas(K, rows)
    pt = r.iloc[0]
    return clean(dict(model="D_gas_flames", kind="prediction", median=pt["median"], s10=pt.s10, s30=pt.s30, s60=pt.s60,
                      in_gap=GAS_GAP[0] < q.o2 < GAS_GAP[1],
                      curve=[dict(o2=float(o), median=float(m), s30=float(s)) for o, m, s in zip(curve_o2, r["median"][1:], r["s30"][1:])]))


class SolidQ(BaseModel):
    material: str
    o2: float = Field(30, ge=10, le=45)
    p: float = Field(0.69, gt=0.2, le=3.5)
    flow: float = Field(10, gt=0, le=100, description="air speed past the sample, cm/s")
    sweep: str = Field("flow", pattern="^(flow|o2)$")


@app.post("/api/predict/solid")
def predict_solid(q: SolidQ):
    """Model A: chance a solid keeps burning (BASS, BASS-II, Saffire). Band = 10-90 % bootstrap."""
    if q.material not in SHAPES:
        return dict(model="A_solids", kind="not_modelled", material=q.material,
                    reason="Fewer than 12 NASA test rows for this material, so the model gives no number.")
    if q.sweep == "flow":
        xs = [1, 1.5, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50]
        rows = [dict(material=q.material, x_o2=q.o2 / 100, pressure_atm=q.p, flow_cm_s=x) for x in xs]
    else:
        xs = list(np.round(np.arange(15, 40.01, 0.5), 1))
        rows = [dict(material=q.material, x_o2=x / 100, pressure_atm=q.p, flow_cm_s=q.flow) for x in xs]
    r = WD.solids(A_PACK, SHAPES, [dict(material=q.material, x_o2=q.o2 / 100, pressure_atm=q.p, flow_cm_s=q.flow)] + rows)
    e = ENV_A[q.material]
    inside = (e["o2"][0] - 0.02 <= q.o2 / 100 <= e["o2"][1] + 0.02 and e["p"][0] - 0.1 <= q.p <= e["p"][1] + 0.1
              and e["flow"][0] * 0.8 <= q.flow <= e["flow"][1] * 1.2)
    pt = r.iloc[0]
    return clean(dict(model="A_solids", kind="prediction", p=pt.p, lo=pt.lo, hi=pt.hi, inside_tested_range=inside,
                      shape=SHAPES[q.material], curve=[dict(x=float(x), p=float(a), lo=float(b), hi=float(c))
                                                       for x, a, b, c in zip(xs, r.p[1:], r.lo[1:], r.hi[1:])]))


class DropQ(BaseModel):
    fuel: str = Field("n-heptane", pattern="^(n-heptane|methanol)$")
    o2: float = Field(30, ge=10, le=40)
    p: float = Field(0.69, gt=0.2, le=3.5)
    co2: float = Field(0, ge=0, le=0.5)
    he: float = Field(0, ge=0, le=0.6)
    d0: float = Field(3, ge=0.5, le=6, description="droplet diameter at ignition, mm")


@app.post("/api/predict/droplet")
def predict_droplet(q: DropQ):
    """Model C: droplet burning rate and flame-out size (FLEX, PSI-69); burn time from the d²-law."""
    curve_o2 = np.round(np.arange(15, 35.01, 0.5), 1)
    base = dict(fuel=q.fuel, pressure_atm=q.p, x_co2=q.co2, x_he=q.he, d0_mm=q.d0)
    r = WD.droplets(K, [dict(base, x_o2=q.o2 / 100)] + [dict(base, x_o2=o / 100) for o in curve_o2])
    pt = r.iloc[0]
    ext = min(max(pt.ext, 0.0), q.d0)
    burn = (q.d0 ** 2 - ext ** 2) / pt.br if pt.br > 0 else None
    e = ENV_C.get(q.fuel)
    inside = bool(e and e["o2"][0] <= q.o2 / 100 <= e["o2"][1] and e["p"][0] - 0.05 <= q.p <= e["p"][1]
                  and q.co2 <= e["co2"] and q.he <= e["he"] and not (q.o2 > 25 and (q.co2 > 0 or q.he > 0)))
    return clean(dict(model="C_droplets", kind="prediction", br=pt.br, br_sd=pt.br_sd, ext=pt.ext, ext_sd=pt.ext_sd,
                      burn_time_s=burn, inside_tested_range=inside,
                      curve=[dict(x=float(o), y=float(b), lo=float(b - s), hi=float(b + s)) for o, b, s in zip(curve_o2, r.br[1:], r.br_sd[1:])]))


# ------------------------------------------------------------------------------------- questions
def search(q: str, k: int = 3) -> list[dict]:
    s = (_X @ _vec.transform([q]).T).toarray().ravel()
    idx = [i for i in np.argsort(-s)[:k] if s[i] >= 0.05]
    return [dict(CORPUS[i], score=round(float(s[i]), 3)) for i in idx]


@app.get("/api/search")
def search_ep(q: str = Query(..., min_length=2, max_length=500)):
    return dict(kind="retrieval", passages=search(q))


class AskQ(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)


@app.post("/api/ask")
def ask(q: AskQ):
    """Gemini answer written only from retrieved NASA passages (when GOOGLE_API_KEY is set), plus cited search."""
    global _rag
    out = dict(passages=search(q.question), answer=None)
    ok, why = genai.status()
    if not ok:
        return dict(out, mode="retrieval", reason=why)
    try:
        if _rag is None:
            _rag = genai.GeminiRAG()
        r = _rag.answer(q.question)
        return dict(out, mode="ai", answer=r["answer"], model=r["model"],
                    rag_sources=[dict(section=d["section"], text=d["text"][:400]) for d in r["documents"]])
    except Exception as e:  # network, quota or key problems: still return the cited passages
        return dict(out, mode="retrieval", reason=f"AI answer unavailable: {type(e).__name__}")


# ------------------------------------------------------------------------------------- the website
DIST = ROOT / "web" / "dist"
if (DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def site(path: str):
        f = (DIST / path).resolve()
        if path and f.is_file() and DIST in f.parents:
            return FileResponse(f)
        return FileResponse(DIST / "index.html")
