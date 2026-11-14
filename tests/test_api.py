"""The website's API: live models agree with the exported grids, data endpoints and errors behave."""
import json
from pathlib import Path

import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from server.main import app  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web" / "src" / "data"
c = TestClient(app)


def j(name):
    return json.loads((WEB / f"{name}.json").read_text())


def test_health_and_stats():
    h = c.get("/api/health").json()
    assert h["status"] == "ok" and h["models"]["A_solids"]["held_out_roc_auc"] == 0.958
    s = c.get("/api/stats").json()
    assert s["tests"] == 1517 and s["measured_values"] == 10107 and s["sources"] == 14 and s["investigations"] == 24


def test_investigations_match_site_data():
    api = c.get("/api/investigations").json()
    assert [r["id"] for r in api] == [r["id"] for r in j("investigations")]
    one = c.get("/api/investigations/PSI-159").json()
    assert one["acronym"] and one["key_result"]
    assert c.get("/api/investigations/PSI-0").status_code == 404
    assert all("Saffire" in json.dumps(r) for r in c.get("/api/investigations?q=saffire").json())


def test_ranking_and_compare():
    r = c.get("/api/ranking?x_o2=0.3&p=0.69").json()
    assert r[0]["rank"] == 1 and [x["psi_id"] for x in r] == [x["psi_id"] for x in j("rankings")["habitat"]]
    cmp = c.get("/api/compare?ids=PSI-159,PSI-20").json()
    assert len(cmp["investigations"]) == 2 and (cmp["same"] or cmp["different"])
    assert c.get("/api/compare?ids=PSI-159").status_code == 400


@pytest.mark.parametrize("fuel,o2,p", [("propane", 30, 0.69), ("ethane", 21, 1.0), ("butane", 38, 0.5)])
def test_gas_live_equals_grid(fuel, o2, p):
    g = next(r for r in j("model_gas")["grid"] if r[0] == fuel and r[1] == o2 and r[2] == p)
    a = c.post("/api/predict/gas", json=dict(fuel=fuel, o2=o2, p=p)).json()
    assert a["median"] == pytest.approx(g[3], rel=1e-3) and a["s30"] == pytest.approx(g[5], abs=1e-3)
    assert a["kind"] == "prediction" and len(a["curve"]) == 45


def test_gas_exact_inputs_and_validation():
    a = c.post("/api/predict/gas", json=dict(fuel="propane", o2=26.5, p=0.694)).json()
    lo = c.post("/api/predict/gas", json=dict(fuel="propane", o2=26, p=0.694)).json()["median"]
    hi = c.post("/api/predict/gas", json=dict(fuel="propane", o2=27, p=0.694)).json()["median"]
    assert lo < a["median"] < hi and a["in_gap"]
    assert c.post("/api/predict/gas", json=dict(fuel="hydrogen", o2=30, p=1)).status_code == 422


def test_solid_live_equals_grid():
    g = j("model_solids")["grid"][123]
    a = c.post("/api/predict/solid", json=dict(material=g[0], o2=g[1], p=g[2], flow=g[3])).json()
    assert a["p"] == pytest.approx(g[4], abs=1e-3) and a["lo"] == pytest.approx(g[5], abs=1e-3)
    n = c.post("/api/predict/solid", json=dict(material="Nomex", o2=30, p=0.69, flow=10)).json()
    assert n["kind"] == "not_modelled"


def test_droplet_live_equals_grid():
    g = next(r for r in j("model_droplets")["grid"] if r[0] == "n-heptane" and r[1] == 30 and r[2] == 0.69 and r[3] == 0 and r[4] == 0 and r[5] == 3)
    a = c.post("/api/predict/droplet", json=dict(fuel="n-heptane", o2=30, p=0.69, co2=0, he=0, d0=3)).json()
    assert a["br"] == pytest.approx(g[6], abs=1e-3) and a["ext"] == pytest.approx(g[8], abs=1e-3)
    assert a["burn_time_s"] > 0


def test_search_and_ask_without_key():
    s = c.get("/api/search?q=smoke detector oxygen").json()
    assert s["passages"] and all("source" in p for p in s["passages"])
    a = c.post("/api/ask", json=dict(question="Which materials burned near habitat air?")).json()
    assert a["passages"] and a["mode"] in ("retrieval", "ai")
    assert c.post("/api/ask", json=dict(question="")).status_code == 422
