"""The common output contract. Every investigation plug-in returns these three tables.

tests     one row per test / run / condition set: WHAT was burned, UNDER WHICH conditions.
          This is what the relevance ranking and the gap matrix read.
evidence  one row per measured or modelled value (long format): the numbers themselves,
          each tied to a test_id and traceable to a raw file and line.
issues    one row per data-quality finding (see fif.issues).

Columns marked required must be present (they may be empty where the source has no value).
"""
from __future__ import annotations

import pandas as pd

FUEL_CLASSES = {"solid", "liquid", "gas", "emulated_solid", "smoke_source", "mixed"}
SOURCE_TYPES = {"experiment", "simulation"}
PILLARS = {"prevention", "detection", "suppression", "fundamental"}

TEST_COLUMNS = {
    # identity
    "investigation_id": "PSI ID, e.g. PSI-25",
    "test_id": "unique within the investigation, e.g. PSI-25:B1_147",
    "source_type": "experiment | simulation",
    "platform": "ISS-MSG, ISS-CIR, Cygnus, ground, model",
    # what burned
    "fuel": "material or fuel name as given by the source",
    "fuel_class": "solid | liquid | gas | emulated_solid | smoke_source | mixed",
    "geometry": "flat sheet, rod, sphere, droplet, jet, porous burner, ...",
    "size_mm": "characteristic size (droplet diameter, sample thickness, burner diameter)",
    # conditions
    "pressure_atm": "ambient pressure",
    "x_o2": "oxygen mole fraction (0-1)",
    "diluent": "main diluent(s): N2, He, CO2, Xe, ...",
    "x_diluent_other": "mole fraction of the non-N2 diluent, if any",
    "flow_cm_s": "imposed flow velocity (0 = quiescent)",
    "flow_direction": "concurrent | opposed | none",
    "gravity_g": "0 for microgravity; 1 for ground tests",
    "t_ambient_k": "ambient temperature",
    # outcome flags (fill what the source supports)
    "ignited": "True/False/None",
    "extinguished": "True/False/None",
    "outcome_note": "free text: spread, extinction mode, cool flame, ...",
    # provenance
    "doi": "paper the data come from",
    "source_file": "raw file name",
}

EVIDENCE_COLUMNS = {
    "investigation_id": "PSI ID",
    "test_id": "links to tests.test_id (may be empty for summary curves)",
    "dataset_id": "plug-in level dataset name",
    "source_type": "experiment | simulation",
    "quantity": "what the value measures (flame_spread_rate, burning_rate, ...)",
    "unit": "unit of value",
    "value": "the number",
    "x_name": "independent variable name (time_s, pressure_atm, ...); empty for scalars",
    "x_value": "independent variable value",
    "x_unit": "unit of x_value",
    "status": "ok, or why the value is set aside",
    "source_file": "raw file name",
    "source_line": "1-based line in the raw file (or sheet row)",
}


def conform(df: pd.DataFrame, columns: dict, name: str) -> pd.DataFrame:
    """Add missing contract columns (empty) and order them first; keep any extras after."""
    df = df.copy()
    for col in columns:
        if col not in df.columns:
            df[col] = pd.NA
    extras = [c for c in df.columns if c not in columns]
    return df[list(columns) + extras]


def validate_tests(df: pd.DataFrame) -> list[str]:
    problems = []
    if df["test_id"].duplicated().any():
        problems.append(f"duplicate test_id: {df.loc[df['test_id'].duplicated(), 'test_id'].tolist()[:5]}")
    bad = set(df["source_type"].dropna()) - SOURCE_TYPES
    if bad:
        problems.append(f"unknown source_type {bad}")
    bad = set(df["fuel_class"].dropna()) - FUEL_CLASSES
    if bad:
        problems.append(f"unknown fuel_class {bad}")
    o2 = pd.to_numeric(df["x_o2"], errors="coerce")
    if ((o2 < 0) | (o2 > 1)).any():
        problems.append("x_o2 outside 0-1 (percent instead of fraction?)")
    p = pd.to_numeric(df["pressure_atm"], errors="coerce")
    if ((p <= 0) | (p > 50)).any():
        problems.append("pressure_atm outside (0, 50] (kPa or psi instead of atm?)")
    return problems


def validate_evidence(df: pd.DataFrame, tests: pd.DataFrame) -> list[str]:
    problems = []
    bad = set(df["source_type"].dropna()) - SOURCE_TYPES
    if bad:
        problems.append(f"unknown source_type {bad}")
    if pd.to_numeric(df["value"], errors="coerce").isna().any():
        problems.append("non-numeric or empty value rows")
    linked = df["test_id"].dropna()
    orphans = set(linked) - set(tests["test_id"])
    if orphans:
        problems.append(f"{len(orphans)} evidence test_id values not in tests, e.g. {sorted(orphans)[:3]}")
    return problems
