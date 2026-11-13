"""TEMPLATE for a new investigation plug-in. Copy to psi_<number>.py and fill in.

Rules (the same ones PSI-117 follows):
1. Read only files in raw_dir (data/raw/PSI-xx/). Never modify them.
2. Never overwrite a raw value. Put cleaned values in new columns and say why in `status`.
3. Every test row: conditions in the units of fif.schema (atm, mole fraction, cm/s, mm).
4. Every evidence row: source_type, source_file and source_line, so any number can be traced.
5. Every rule that changes or excludes data -> log.add(...).
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register

PSI = "PSI-XX"


# @register(PSI, required=["*.csv"])   # <- uncomment once written
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)

    tests = pd.DataFrame([
        # dict(investigation_id=PSI, test_id=f"{PSI}:run1", source_type="experiment",
        #      platform="ISS-MSG", fuel="...", fuel_class="solid", geometry="...", size_mm=...,
        #      pressure_atm=..., x_o2=..., diluent="N2", flow_cm_s=..., flow_direction="opposed",
        #      gravity_g=0.0, t_ambient_k=..., ignited=True, extinguished=..., doi="...",
        #      source_file="..."),
    ])
    evidence = pd.DataFrame([
        # dict(investigation_id=PSI, test_id=f"{PSI}:run1", dataset_id="...",
        #      source_type="experiment", quantity="flame_spread_rate", unit="mm/s", value=...,
        #      x_name=None, x_value=None, x_unit=None, status="ok",
        #      source_file="...", source_line=...),
    ])
    return PluginResult(tests=tests, evidence=evidence, issues=log.frame())
