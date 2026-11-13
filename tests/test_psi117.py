"""Checks that guard the cleaning rules and the headline numbers. Run: pytest -q"""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from psi117 import analysis as A  # noqa: E402
from psi117 import clean, io  # noqa: E402


@pytest.fixture(scope="module")
def cleaned():
    return clean.clean_all()


def test_loaders_read_every_file():
    assert len(io.load_heptane("stable")) == 243
    assert len(io.load_heptane("oscillatory")) == 640
    ts = io.load_three_stage()
    assert len(ts["sim"]) == 570 and len(ts["sim_radiance"]) == 72
    assert len(io.load_alkane_dext_1atm()) == 33
    assert len(io.load_c12_dext_vs_p()) == 31
    assert len(io.load_c12_kavg()) == 25


def test_every_row_has_provenance(cleaned):
    tables, _ = cleaned
    for name, df in tables.items():
        if name == "catalog":
            continue
        assert "source_type" in df.columns, name
        assert set(df["source_type"]) <= {"experiment", "simulation"}, name


def test_compositions_sum_to_one(cleaned):
    cat = cleaned[0]["catalog"]
    avail = cat[cat["available"]]
    assert np.allclose(avail[["x_o2", "x_n2", "x_he", "x_o3"]].sum(axis=1), 1.0)


def test_sentinel_zeros_never_reach_statistics(cleaned):
    dx = cleaned[0]["alkane_dext_1atm"]
    assert (dx["dext_cool_mm_clean"].dropna() > 0).all()
    assert (dx["dext_hot_mm_clean"].dropna() > 0).all()
    dvp = cleaned[0]["c12_dext_vs_p"]
    assert (dvp["value_clean_mm"].dropna() > 0).all()


def test_raw_values_are_not_overwritten(cleaned):
    expt = cleaned[0]["c12_three_stage_expt"]
    raw = io.load_three_stage()["expt"]
    assert np.allclose(expt["value"].to_numpy(), raw["value"].to_numpy())


def test_model_stage_temperatures_match_paper(cleaned):
    st = A.three_stage_model_stages(cleaned[0]["c12_three_stage_sim"]).set_index("stage")
    # Farouk et al. 2019: warm ~970 K, cool ~765 K
    assert abs(st.loc["warm", "mean_tmax_k"] - 970) < 20
    assert abs(st.loc["cool", "mean_tmax_k"] - 765) < 20


def test_oscillation_grows_only_at_low_oxygen(cleaned):
    hep = cleaned[0]["heptane"]
    _, osc = A.heptane_oscillations(hep, "oscillatory")
    _, stable = A.heptane_oscillations(hep, "stable")
    assert osc["cycles"] >= 8 and osc["prominence_growth_k_per_cycle"] > 0
    assert stable["cycles"] == 0


def test_cool_flame_burning_rate_rises_with_pressure(cleaned):
    fits = A.pressure_trends(cleaned[0]["c12_dext_vs_p"], cleaned[0]["c12_kavg"])["k_fits"]
    assert (fits["n"] > 0).all()
