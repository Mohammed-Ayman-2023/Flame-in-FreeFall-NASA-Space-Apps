"""Guards for the shared data layer. Run: pytest -q"""
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from fif import build  # noqa: E402
from fif.schema import EVIDENCE_COLUMNS, TEST_COLUMNS  # noqa: E402


@pytest.fixture(scope="module")
def built():
    return build.run(verbose=False)


def test_catalog_is_well_formed():
    c = build.load_catalog()
    assert c["psi_id"].is_unique
    psi = c[~c["psi_id"].str.startswith("EXT-")]
    assert psi["in_scope"].sum() == 24  # 23 combustion investigations + the unseen 26th result
    assert set(c.loc[c["psi_id"].str.startswith("EXT-"), "psi_id"]) <= {"EXT-SAFFIRE-456"}  # external literature, flagged
    o2 = pd.to_numeric(c["o2_max"], errors="coerce").dropna()
    assert o2.between(0, 1).all()


def test_contract_columns_present(built):
    assert list(TEST_COLUMNS) == list(built["tests"].columns[: len(TEST_COLUMNS)])
    assert list(EVIDENCE_COLUMNS) == list(built["evidence"].columns[: len(EVIDENCE_COLUMNS)])


def test_every_loaded_investigation_passes_schema(built):
    loaded = built["status"][built["status"]["state"] == "loaded"]
    assert len(loaded) >= 1
    assert (loaded["schema"] == "OK").all(), loaded[["psi_id", "schema"]]


def test_every_value_links_to_a_test(built):
    ev, t = built["evidence"], built["tests"]
    assert ev["test_id"].notna().all()
    assert set(ev["test_id"]) <= set(t["test_id"])


def test_measured_and_modelled_never_mixed(built):
    t = built["tests"].set_index("test_id")["source_type"]
    ev = built["evidence"]
    assert (ev["source_type"].to_numpy() == t.loc[ev["test_id"]].to_numpy()).all()


def test_coverage_says_where_it_came_from(built):
    cov = built["coverage"]
    assert set(cov["coverage_source"]) <= {"data", "catalog"}
    assert cov.loc[cov["psi_id"] == "PSI-117", "coverage_source"].item() == "data"
