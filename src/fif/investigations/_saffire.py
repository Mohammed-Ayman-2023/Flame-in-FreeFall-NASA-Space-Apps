"""Shared helpers for the three Saffire investigations (PSI-98, PSI-99, PSI-100).

All three publish a small "experimental table" (one row per sample burn) with units written
inside the cells, plus camera images as raw data. Results that are not in the PSI tables
(spread rates for Saffire-I and III, O2 and burn times for Saffire-III) come from the team's
transcription of NASA NTRS 20180005168, Table 1, stored next to the raw files.

Each burn becomes:
  * one microgravity test row (gravity_g = 0, platform Cygnus), and
  * one 1-g comparison test row when the source reports a 1-g result (gravity_g = 1).
Solid-specific columns are added as extras on the tests table:
  thickness_mm, sample_length_cm, sample_width_cm, ignition_power_w, ignition_time_s,
  burn_extent (none | partial | complete), setup, confidence (high | medium | low), flags.
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

PAPER = "NTRS 20180005168"
PAPER_FILE = "NTRS-20180005168_Table1_transcribed.csv"

_NUM = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)")


def first_number(text) -> float | None:
    """'~ 21.5' -> 21.5, '.33 cm' -> 0.33, '29 cm' -> 29. None when there is no number."""
    if text is None or (isinstance(text, float) and pd.isna(text)):
        return None
    m = _NUM.search(str(text))
    return float(m.group()) if m else None


def o2_fraction(text) -> tuple[float | None, str]:
    """'21.5 - 21.7' / '22.1 to 22.0' -> midpoint; '~ 22.1' -> 0.221. Returns (fraction, note)."""
    if text is None or (isinstance(text, float) and pd.isna(text)) or str(text).strip() == "":
        return None, ""
    nums = [float(x) for x in _NUM.findall(str(text))]
    if not nums:
        return None, f"O2 '{text}' has no number"
    if len(nums) >= 2:
        return round(sum(nums[:2]) / 200, 4), f"O2 '{text}' stored as midpoint"
    note = f"O2 '{text}' is approximate" if "~" in str(text) else ""
    return round(nums[0] / 100, 4), note


def burn_extent(text, sample_length_cm: float | None) -> str | None:
    """'~ 0' -> none, 'Complete' -> complete, a length -> partial or complete."""
    if text is None or (isinstance(text, float) and pd.isna(text)):
        return None
    s = str(text).strip().lower()
    if not s or s.startswith("n/a"):
        return None
    if s.lstrip("~ ").startswith("complete"):
        return "complete"
    v = first_number(s)
    if v is None:
        return None
    if v == 0:
        return "none"
    if sample_length_cm and v >= 0.95 * sample_length_cm:
        return "complete"
    return "partial"


def read_paper_table(raw_dir: Path) -> pd.DataFrame:
    p = raw_dir / PAPER_FILE
    if not p.exists():
        return pd.DataFrame()
    return pd.read_csv(p, comment="#", dtype=str)


# Cygnus cabin pressure per flight, from Olson et al. (UCL eprint 10164340) Table 1, measured during the
# concurrent SIBAL burn of each flight; applied to every microgravity burn of that flight.
FLIGHT_P_KPA = {"PSI-98": 102.0, "PSI-99": 103.0, "PSI-100": 99.0}
FLIGHT_P_SRC = "Olson et al. (UCL eprint 10164340) Table 1"


def tests_and_evidence(psi: str, burns: list[dict]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """burns: one dict per burn with the cleaned values (see the plug-ins). Builds both tables."""
    tests, ev = [], []
    for b in burns:
        if b.get("pressure_atm") is None and psi in FLIGHT_P_KPA:
            b = dict(b, pressure_atm=round(FLIGHT_P_KPA[psi] / 101.325, 4),
                     flags=list(b.get("flags", [])) + [f"pressure {FLIGHT_P_KPA[psi]:g} kPa = flight cabin pressure from "
                                                       f"{FLIGHT_P_SRC} (measured in the SIBAL burn; same flight)"])
        base = dict(investigation_id=psi, source_type="experiment", fuel=b["material"],
                    fuel_class="solid", geometry="flat sheet", size_mm=b.get("thickness_mm"),
                    thickness_mm=b.get("thickness_mm"), sample_length_cm=b.get("length_cm"),
                    sample_width_cm=b.get("width_cm"), doi=b.get("doi"), source_file=b["source_file"])
        # microgravity burn
        tid = f"{psi}:{b['sample']}"
        tests.append(dict(base, test_id=tid, platform="Cygnus (post-ISS)", setup="Saffire flow duct",
                          pressure_atm=b.get("pressure_atm"), x_o2=b.get("x_o2"), diluent=b.get("diluent"),
                          flow_cm_s=b.get("flow_cm_s"), flow_direction=b.get("direction"), gravity_g=0.0,
                          ignition_power_w=b.get("ignition_power_w"), ignition_time_s=b.get("ignition_time_s"),
                          burn_extent=b.get("ug_extent"), ignited=b.get("ug_extent") not in (None, "none") or None,
                          outcome_note=b.get("ug_note"), confidence=b.get("confidence", "high"),
                          flags="; ".join(f for f in b.get("flags", []) if f)))
        for qty, unit, key, src_key in (("flame_spread_rate", "mm/s", "ug_spread_mm_s", "ug_spread_src"),
                                        ("burn_length", "cm", "ug_burn_cm", "ug_burn_src"),
                                        ("burn_time", "s", "burn_time_s", "burn_time_src")):
            if b.get(key) is not None:
                src = b.get(src_key, b["source_file"])
                ev.append(dict(investigation_id=psi, test_id=tid, dataset_id="saffire_burns",
                               source_type="experiment", quantity=qty, unit=unit, value=b[key],
                               status="ok" if src == b["source_file"] else f"from {PAPER} Table 1",
                               source_file=src, source_line=b.get("source_line")))
        # 1-g comparison burn (NASA ground test of the same material), when reported
        if b.get("g1_extent") is not None or b.get("g1_spread_mm_s") is not None:
            tid1 = f"{psi}:{b['sample']}_1g"
            tests.append(dict(base, test_id=tid1, platform="ground (1-g comparison test)",
                              setup="1-g comparison test (conditions not given)", pressure_atm=None,
                              x_o2=None, flow_cm_s=None, flow_direction=b.get("direction"), gravity_g=1.0,
                              burn_extent=b.get("g1_extent"),
                              ignited=b.get("g1_extent") not in (None, "none") or None,
                              outcome_note=b.get("g1_note"), confidence="low",
                              flags="1-g comparison: O2, pressure and flow not reported; flow direction "
                                    "copied from the flight burn (orientation not stated)"))
            if b.get("g1_spread_mm_s") is not None:
                ev.append(dict(investigation_id=psi, test_id=tid1, dataset_id="saffire_burns",
                               source_type="experiment", quantity="flame_spread_rate", unit="mm/s",
                               value=b["g1_spread_mm_s"], status="ok", source_file=b.get("g1_src", b["source_file"]),
                               source_line=b.get("source_line")))
    return pd.DataFrame(tests), pd.DataFrame(ev)
