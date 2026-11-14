"""Checks on the crew briefing, investigation summaries, Ask the archive and the mission briefing."""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from fif import knowledge as Kn  # noqa: E402
from fif import ranking as R  # noqa: E402

pytestmark = pytest.mark.skipif(not (ROOT / "models/v1/D_gas_flames.joblib").exists(),
                                reason="run scripts/train_models.py first")


@pytest.fixture(scope="module")
def K():
    return Kn.load()


def test_presets_match_the_atmospheres_named_by_nasa():
    m = Kn.MISSIONS
    assert m["iss"]["x_o2"] == 0.21 and m["iss"]["pressure_atm"] == 1.0
    assert m["exploration"]["x_o2"] == 0.265 and abs(m["exploration"]["pressure_atm"] * 14.696 - 10.2) < 0.02
    assert m["lunar"]["x_o2"] == 0.34 and abs(m["lunar"]["pressure_atm"] * 14.696 - 8.2) < 0.02


def test_six_takeaways_each_labelled_and_sourced(K):
    for m in Kn.MISSIONS.values():
        tks = Kn.takeaways(K, m["x_o2"], m["pressure_atm"])
        assert len(tks) == 6
        assert all(t["badge"] in ("measured", "model", "literature", "gap") and t["source"] for t in tks)


def test_ventilation_takeaway_grows_with_oxygen(K):
    med = [Kn._d_predict(K, o2, 0.69)[0] for o2 in (0.21, 0.265, 0.30, 0.34)]
    assert med == sorted(med)


def test_habitat_point_is_flagged_as_interpolated(K):
    vent = Kn.takeaways(K, 0.30, 0.69)[0]
    assert "24 % and 33 %" in vent["caveat"]


def test_smoke_tests_counted_without_remeasurements(K):
    det = [t for t in Kn.takeaways(K, 0.30, 0.69) if t["key"] == "detect"][0]
    assert det["number"] == "0 of 555"


def test_every_investigation_has_a_summary_and_link(K):
    it = Kn.investigation_table(K)
    assert len(it) >= 20 and it.psi_id.is_unique
    assert it.what.str.len().gt(30).all() and it.link.str.startswith("https://").all()


def test_ask_answers_with_sources_and_abstains_when_off_topic(K):
    A = Kn.Archive(K)
    hits = A.ask("Do smoke detectors work in a lunar habitat?", x_o2=0.34, p=0.558, label="lunar")
    assert hits and hits[0]["source"] and "smoke" in hits[0]["title"].lower()
    assert A.ask("best pizza in town") == []


def test_briefing_contains_every_section(K):
    target = dict(x_o2=0.34, pressure_atm=0.558)
    h = Kn.briefing_html(K, "Lunar", 0.34, 0.558, R.rank(target), R.mission_gaps(target), R.RECOMMENDATIONS)
    for part in ("What the crew and designers should know", "Most relevant NASA investigations",
                 "Recommended next experiments", "Moon and Mars", "NASA Physical Sciences Informatics"):
        assert part in h


def test_hardware_groups_match_challenge_brief():
    assert set(Kn.HARDWARE["acme"]["members"]) == {"PSI-20", "PSI-159", "PSI-21", "PSI-10", "PSI-23", "PSI-22"}
    assert set(Kn.HARDWARE["mdca"]["members"]) == {"PSI-69", "PSI-68", "PSI-39"}
    assert set(Kn.HARDWARE["msg_duct"]["members"]) == {"PSI-26", "PSI-25", "PSI-107", "PSI-106"}


def test_variables_split_varied_and_constant(K):
    v = Kn.variables(K, "PSI-159")
    assert any(x.startswith("O₂") for x in v["varied"])
    assert any(x.startswith("air speed: 0 cm/s") for x in v["same"])
    v = Kn.variables(K, "PSI-102")
    assert any(x.startswith("O₂: 21%") for x in v["same"])


def test_gravity_bounds_silicone_disagrees(K):
    gb = Kn.gravity_bounds(K).set_index("material")
    assert gb.at["Silicone", "partial_gravity"].startswith("bounds disagree")
    assert gb.at["PMMA", "partial_gravity"].startswith("bounds agree")


def test_every_investigation_has_hardware_and_samples(K):
    it = Kn.investigation_table(K)
    assert (it.hardware.str.len() > 0).all() and (it.samples.str.len() > 0).all()
    assert "85 %" in Kn.CONTEXT["PSI-159"]
