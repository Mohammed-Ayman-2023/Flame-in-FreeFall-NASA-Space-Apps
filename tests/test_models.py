"""Sanity checks on the trained models (models/v1): physics directions and honest labels."""
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from fif import models as M  # noqa: E402

MOD = ROOT / "models" / "v1"
pytestmark = pytest.mark.skipif(not (MOD / "A_solids.joblib").exists(), reason="run scripts/train_models.py first")


def _solid_curve(factor, grid, **fixed):
    pack = joblib.load(MOD / "A_solids.joblib")
    base = dict(material_family="PMMA", geometry_class="thick slab", flow_direction="opposed", flow_cm_s=10.0,
                x_o2=0.21, pressure_atm=1.0) | fixed
    q = pd.DataFrame([base] * len(grid))
    q[factor] = grid
    return pack["model"].predict_proba(M._a_features(q))[:, 1]


def test_solids_more_oxygen_never_lowers_risk():
    p = _solid_curve("x_o2", np.linspace(0.15, 0.40, 26))
    assert np.all(np.diff(p) >= -1e-9)


def test_solids_more_pressure_never_lowers_risk():
    p = _solid_curve("pressure_atm", np.linspace(0.4, 1.2, 17))
    assert np.all(np.diff(p) >= -1e-9)


def test_gas_flames_burn_longer_with_more_oxygen():
    tr = json.loads((MOD / "explain.json").read_text())["D_gas_flames"]["time_ratios"][0]
    assert tr["effect"] == "+1 % oxygen" and tr["ci95"][0] > 1.0


def test_rare_materials_are_not_modelled():
    a = pd.read_csv(MOD / "A_habitat_predictions.csv")
    rare = a[a.material_family.isin(["cotton", "Nomex", "silicone"])]
    assert rare.p_sustained.isna().all()


def test_suppressant_at_habitat_oxygen_is_flagged_outside():
    pk = joblib.load(MOD / "C_droplets.joblib")["burning_rate_mm2_s"]
    q = pd.DataFrame([dict(fuel="methanol", d0_mm=3.0, x_co2=0.15, x_he=0.0, x_o2=0.30, pressure_atm=0.69)])
    lab = M.applicability(q, pk["train"], "fuel", dict(x_o2=0.04, pressure_atm=0.2, x_co2=0.05, x_he=0.05)).iloc[0].label
    assert lab.startswith("outside")
