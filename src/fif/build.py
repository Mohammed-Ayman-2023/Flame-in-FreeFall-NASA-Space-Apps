"""Phase 1 build: raw PSI files -> per-investigation tables -> merged, validated data layer.

Outputs (data/processed/):
  tests.csv        every test/run across investigations (conditions + outcome flags)
  evidence.csv     every value, long format, linked to tests
  issues.csv       every data-quality finding
  coverage.csv     per investigation: condition ranges actually covered (from data when loaded,
                   from the catalog otherwise, and says which)
  <PSI-ID>/        each plug-in's own cleaned tables
reports/phase1_status.md
"""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import numpy as np
import pandas as pd

from . import investigations  # noqa: F401  (registers plug-ins)
from .registry import PLUGINS, ready
from .schema import EVIDENCE_COLUMNS, TEST_COLUMNS, conform, validate_evidence, validate_tests

ROOT = Path(__file__).resolve().parents[2]
RAW, PROCESSED, REPORTS = ROOT / "data" / "raw", ROOT / "data" / "processed", ROOT / "reports"
CATALOG = ROOT / "catalog" / "investigations.csv"


def load_catalog() -> pd.DataFrame:
    return pd.read_csv(CATALOG)


def coverage(catalog: pd.DataFrame, tests: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, c in catalog[catalog["in_scope"]].iterrows():
        t = tests[tests["investigation_id"] == c["psi_id"]] if len(tests) else tests
        if len(t):
            num = lambda col: pd.to_numeric(t[col], errors="coerce")  # noqa: E731
            rows.append(dict(
                psi_id=c["psi_id"], coverage_source="data",
                fuel_classes=";".join(sorted(t["fuel_class"].dropna().unique())),
                o2_min=num("x_o2").min(), o2_max=num("x_o2").max(),
                p_min_atm=num("pressure_atm").min(), p_max_atm=num("pressure_atm").max(),
                flow_max_cm_s=num("flow_cm_s").max(), gravity_values=";".join(
                    sorted({f"{g:g}" for g in num("gravity_g").dropna()})),
                tests=len(t), experiment_tests=int((t["source_type"] == "experiment").sum()),
                simulation_tests=int((t["source_type"] == "simulation").sum())))
        else:
            rows.append(dict(
                psi_id=c["psi_id"], coverage_source="catalog", fuel_classes=c["fuel_class"],
                o2_min=c["o2_min"], o2_max=c["o2_max"], p_min_atm=c["p_min_atm"],
                p_max_atm=c["p_max_atm"], flow_max_cm_s=c["flow_max_cm_s"],
                gravity_values="0" if c["investigation_type"] == "flight" else "",
                tests=0, experiment_tests=0, simulation_tests=0))
    cov = pd.DataFrame(rows)
    return catalog[["psi_id", "acronym", "family", "pillars", "priority_tier", "data_status"]].merge(
        cov, on="psi_id", how="right")


def md_table(df: pd.DataFrame) -> str:
    def f(v):
        if isinstance(v, (float, np.floating)):
            return "" if np.isnan(v) else f"{v:.3g}"
        return "" if v is None or (isinstance(v, float) and np.isnan(v)) else str(v)
    lines = ["| " + " | ".join(df.columns) + " |", "|" + "|".join("---" for _ in df.columns) + "|"]
    lines += ["| " + " | ".join(f(v).replace("|", "/") for v in r) + " |" for r in df.itertuples(index=False)]
    return "\n".join(lines)


def run(only: list[str] | None = None, verbose: bool = True) -> dict:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    catalog = load_catalog()
    all_tests, all_ev, all_iss, status = [], [], [], []

    for psi in catalog.loc[catalog["in_scope"], "psi_id"]:
        if only and psi not in only:
            continue
        raw_dir = RAW / psi
        if psi not in PLUGINS:
            has_files = raw_dir.exists() and any(p for p in raw_dir.iterdir() if p.name not in {".keep", "README.txt"})
            status.append(dict(psi_id=psi, state="files present, loader not written yet" if has_files
                               else "no loader, no files", tests=0, evidence=0, high_issues=0, schema=""))
            continue
        ok, missing = ready(psi, raw_dir)
        if not ok:
            status.append(dict(psi_id=psi, state=f"waiting for files: {', '.join(missing)}",
                               tests=0, evidence=0, high_issues=0, schema=""))
            continue
        res = PLUGINS[psi](raw_dir)
        t = conform(res.tests, TEST_COLUMNS, "tests")
        e = conform(res.evidence, EVIDENCE_COLUMNS, "evidence")
        problems = validate_tests(t) + validate_evidence(e, t)
        out = PROCESSED / psi
        out.mkdir(exist_ok=True)
        for name, df in res.extra_tables.items():
            df.to_csv(out / f"{name}.csv", index=False)
        t.to_csv(out / "tests.csv", index=False)
        e.to_csv(out / "evidence.csv", index=False)
        all_tests.append(t)
        all_ev.append(e)
        all_iss.append(res.issues)
        status.append(dict(psi_id=psi, state="loaded", tests=len(t), evidence=len(e),
                           high_issues=int((res.issues["severity"] == "high").sum()),
                           schema="OK" if not problems else "; ".join(problems)))

    tests = pd.concat(all_tests, ignore_index=True) if all_tests else conform(pd.DataFrame(), TEST_COLUMNS, "")
    evidence = pd.concat(all_ev, ignore_index=True) if all_ev else conform(pd.DataFrame(), EVIDENCE_COLUMNS, "")
    issues = pd.concat(all_iss, ignore_index=True) if all_iss else pd.DataFrame()
    cov = coverage(catalog, tests)
    tests.to_csv(PROCESSED / "tests.csv", index=False)
    evidence.to_csv(PROCESSED / "evidence.csv", index=False)
    issues.to_csv(PROCESSED / "issues.csv", index=False)
    cov.to_csv(PROCESSED / "coverage.csv", index=False)

    st = pd.DataFrame(status).merge(catalog[["psi_id", "acronym", "priority_tier", "data_status"]],
                                    on="psi_id", how="left")
    st = st[["psi_id", "acronym", "priority_tier", "data_status", "state", "tests", "evidence",
             "high_issues", "schema"]].sort_values(["state", "priority_tier"])
    lines = [
        "# Phase 1 status: data layer",
        "",
        f"Built {dt.datetime.now():%Y-%m-%d %H:%M}. {int((st['state'] == 'loaded').sum())} of "
        f"{len(st)} in-scope investigations loaded; {len(tests)} tests and {len(evidence)} values in the "
        "merged tables.",
        "",
        md_table(st),
        "",
        "## Condition coverage (data where loaded, catalog otherwise)",
        "",
        md_table(cov[["psi_id", "acronym", "coverage_source", "fuel_classes", "o2_min", "o2_max",
                      "p_min_atm", "p_max_atm", "tests"]]),
        "",
    ]
    (REPORTS / "phase1_status.md").write_text("\n".join(lines), encoding="utf-8")
    if verbose:
        print(st.to_string(index=False))
        print(f"\nmerged: {len(tests)} tests, {len(evidence)} evidence rows, {len(issues)} issues")
    return dict(tests=tests, evidence=evidence, issues=issues, coverage=cov, status=st)
