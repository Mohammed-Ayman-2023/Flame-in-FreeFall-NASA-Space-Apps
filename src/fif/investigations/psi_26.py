"""PSI-26 BASS: ~116 burns on the ISS (MSG, SPICE/BASS wind tunnel): SIBAL fabric, PMMA spheres and
slabs, Nomex, Ultem, wax candles and wax slabs, 16-23 % O2 (N2 vitiation), measured cabin pressure
0.97-1.01 atm, flow up to ~44 cm/s. Some runs used N2 jets as an extinguishing agent (GN2).

Source: 'As Run_Test Matrix.xlsx', sheet 'as run matrix'. Unlike the PSI experimental table, it has
O2, PRESSURE, CO2, fan and air speeds, GN2 settings and the crew/PI observation notes.

The outcome of each run is only written as free text (notes). It is classified here with explicit
keyword rules (OUTCOME_RULES, first match wins); the matched phrase is stored in outcome_evidence so
every label can be checked. Classes:
  not_tested     igniter broke / no test performed            -> excluded from labels
  no_ignition    never ignited                                -> flame_sustained 0
  not_sustained  ignited but went out without spreading       -> flame_sustained 0
  sustained      burned / spread / burned out / did not blow out -> flame_sustained 1
  unclear        none of the rules match                      -> excluded from labels
Air display = duct air speed in cm/s (same hardware as BASS-II).
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register

PSI = "PSI-26"
XLSX = "PSI-26_Science Documents_As Run_Test Matrix.xlsx"
SHEET = "as run matrix"
MAX_AIR = 45.0

OUTCOME_RULES = [
    ("not_tested", r"igniter (is )?broken!|igniter broke before ignition|no ignition on this test"),
    ("not_sustained", r"brief ignition and extinguished|died when igniter turned off|went out when igniter was retracted|"
                      r"no luck keeping the flame sustained|did not sustain|self-extinguished|didn't propagate at all|"
                      r"flamed out|brief flame\b"),
    ("sustained", r"ign(ition)? took \d|ignition in \d|ignited (within|in|quickly|very quickly|at|after|on)|steady spread|"
                  r"burned out|burn(ed)? to completion|did not blow out|blow out with gn2|blew out with gn2|did blow out|spread"),
    ("no_ignition", r"did not ignite|no ignition|just smoked|no joy|no flame\.|not even any smoke"),
    ("sustained", r"nice burn|sooty|envelope|wrapped|grew|good burn|good ignition|burn\b|flame kept going|"
                  r"blue flame|all blue|extinguished|out at|nice images"),
]


def classify(note: str) -> tuple[str, str]:
    t = (note or "").lower()
    for label, pat in OUTCOME_RULES:
        m = re.search(pat, t)
        if m:
            return label, m.group(0)
    return "unclear", ""


def parse_material(text: str) -> dict:
    t = str(text or "").lower()
    width = re.search(r"(\d)\s*cm", t)
    w = float(width.group(1)) if width else None
    if "sibal" in t:
        return dict(fuel="Cotton-fiberglass (SIBAL)", geometry="fabric sheet", size_mm=None, width_cm=w)
    if "nomex" in t:
        return dict(fuel="Nomex" + (" blend" if "blend" in t else " III"), geometry="fabric sheet", size_mm=None, width_cm=w)
    if "ultem" in t:
        return dict(fuel="Ultem", geometry="thin sheet", size_mm=None, width_cm=None)
    if "candle" in t:
        return dict(fuel="Japan wax (candle)" if "japan" in t else "paraffin wax (candle)", geometry="candle",
                    size_mm=None, width_cm=None)
    if "wax" in t:
        return dict(fuel="paraffin wax", geometry="thick slab", size_mm=None, width_cm=None)
    if "slab" in t:
        return dict(fuel="PMMA", geometry="thick slab", size_mm=None, width_cm=None)
    if "pmma" in t or "sphere" in t:  # 'PMMA 2 cm' rows use sphere sample numbers (21-26)
        return dict(fuel="PMMA", geometry="sphere", size_mm=w * 10 if w else None, width_cm=None)
    return dict(fuel=None, geometry=None, size_mm=None, width_cm=None)


def parse_air(text) -> tuple[list[float], list[str]]:
    flags = []
    if text is None or (isinstance(text, float) and pd.isna(text)):
        return [], flags
    t = str(text).lower()
    if any(w in t for w in ("?", "etc", "left vm")):
        flags.append(f"air text '{text}' partly readable")
    t = re.sub(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)", lambda m: str((float(m.group(1)) + float(m.group(2))) / 2), t)
    vals = [float(x) for x in re.findall(r"(?<![\w.])(\d+(?:\.\d+)?)", t.replace("<", " "))]
    if "<" in t:
        flags.append("'<1' read as 1 cm/s")
    vals = [v for v in vals if v <= MAX_AIR]
    return vals, flags


def direction(material_text: str, note: str, geometry: str | None) -> tuple[str | None, str]:
    t = f"{material_text} {note}".lower()
    if "opposed" in t:
        return "opposed", "stated in material/notes"
    if geometry in ("sphere", "candle"):
        return ("wake ignition" if "wake" in t else "stagnation"), "sphere/candle: ignition point from notes"
    if geometry == "fabric sheet":
        return "concurrent", "fabric default (BASS fabric burns concurrent unless 'opposed' noted)"
    if "concurrent" in t:
        return "concurrent", "stated in notes"
    return None, "not stated"


PAPER_FILE = "Ferkul2013_TableI_transcribed.csv"


def read_fabric_table(raw_dir: Path) -> dict:
    """SIBAL tests from Ferkul et al. 2013 Table I: test number -> (direction, flows, comment)."""
    f = raw_dir / PAPER_FILE
    if not f.exists():
        return {}
    t = pd.read_csv(f, comment="#", dtype=str)
    return {r["test_no"].strip(): (r["direction"].strip().lower(),
                                   [float(x) for x in str(r["flow_speeds_cm_s"]).split(";")],
                                   str(r["comments"]) if isinstance(r["comments"], str) else "")
            for _, r in t.iterrows()}


@register(PSI, required=[XLSX])
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    import openpyxl
    ws = openpyxl.load_workbook(raw_dir / XLSX, data_only=True)[SHEET]
    fabric = read_fabric_table(raw_dir)
    tests, ev = [], []
    counts: dict[str, int] = {}
    seen = set()
    for i, r in enumerate(ws.iter_rows(min_row=4, values_only=True), start=4):
        run, test_no, sample, mat = r[2], r[3], r[4], r[5]
        if not isinstance(run, (int, float)) or mat is None:
            continue
        note = str(r[29] or "")
        m = parse_material(mat)
        air, aflags = parse_air(r[10])
        outcome, evidence = classify(note)
        counts[outcome] = counts.get(outcome, 0) + 1
        o2, p = r[26], r[27]
        o2 = float(o2) if isinstance(o2, (int, float)) else None
        p = float(p) if isinstance(p, (int, float)) else None
        d, dsrc = direction(mat, note, m["geometry"])
        key = str(test_no).strip()
        paper_row = fabric.get(key) if m["geometry"] == "fabric sheet" and "sibal" in str(mat).lower() else None
        if paper_row:
            d, dsrc = paper_row[0], "Ferkul et al. 2013 Table I"
            if paper_row[1] != air:
                aflags.append(f"air speeds {air} replaced by paper Table I {paper_row[1]}")
                air = paper_row[1]
            if outcome == "unclear":
                outcome, evidence = "sustained", "paper Table I: spread measured in this test"
            if "quenching extinction observed" in paper_row[2].lower():
                outcome, evidence = "sustained", "paper: quenching extinction observed below the last flow"
        gn2 = str(r[13] or "")
        n2_jet = bool(re.search(r"n2 on|gn2 on|blow(ing)? out with gn2|n2 and air|gn2 to|n2 at", note.lower())) or \
            "max" in gn2.lower()
        tid = f"{PSI}:{int(run)}_{test_no}"
        if tid in seen:
            tid += f"_{i}"
        seen.add(tid)
        flags = aflags + [f"outcome '{outcome}' from note phrase '{evidence}'" if evidence else "outcome not stated in note",
                          f"flow direction {d or 'unknown'}: {dsrc}"]
        conf = "high" if outcome in ("sustained", "no_ignition", "not_sustained") and not aflags else "medium"
        if outcome in ("unclear", "not_tested") or d is None:
            conf = "low"
        tests.append(dict(
            investigation_id=PSI, test_id=tid, source_type="experiment", platform="ISS-MSG",
            fuel=m["fuel"], fuel_class="solid", geometry=m["geometry"], size_mm=m["size_mm"],
            sample_width_cm=m["width_cm"], pressure_atm=round(p, 4) if p else None,
            x_o2=round(o2, 4) if o2 else None, diluent="N2 (vitiation)", flow_cm_s=air[0] if air else None,
            flow_min_cm_s=min([a for a in air if a > 0], default=None), flow_max_cm_s=max(air) if air else None,
            flow_sequence=None if r[10] is None else str(r[10]), flow_direction=d, gravity_g=0.0,
            setup="BASS (SPICE/BASS MSG wind tunnel)", run_outcome=outcome,
            end_state="extinguished_low_flow" if paper_row and "quenching" in paper_row[2].lower() else None, outcome_evidence=evidence,
            ignited=outcome in ("sustained", "not_sustained") if outcome != "unclear" else None,
            extinguished=None, n2_jet_used=n2_jet, sample_no=sample, material_text=mat,
            outcome_note=note[:300], confidence=conf, flags="; ".join(flags), doi="10.60555/58h4-dy80",
            source_file=XLSX))
        for v in air:
            if v == 0 or outcome != "sustained":
                continue
            ev.append(dict(investigation_id=PSI, test_id=tid, dataset_id="bass_runs", source_type="experiment",
                           quantity="flame_present_at_flow", unit="1=yes", value=1.0, x_name="flow_cm_s",
                           x_value=v, x_unit="cm/s", status="ok (outcome from note keywords)",
                           source_file=XLSX, source_line=f"{SHEET}!{i}"))
        if outcome in ("no_ignition", "not_sustained") and air:
            ev.append(dict(investigation_id=PSI, test_id=tid, dataset_id="bass_runs", source_type="experiment",
                           quantity="flame_not_sustained_at_flow", unit="1=yes", value=1.0, x_name="flow_cm_s",
                           x_value=air[0], x_unit="cm/s", status=f"{outcome} (note: '{evidence}')",
                           source_file=XLSX, source_line=f"{SHEET}!{i}"))
    log.add("as_run_matrix", "medium", "outcome from text",
            f"run outcomes classified from free-text notes with keyword rules: {counts}",
            "rules and matched phrase stored per test (outcome_evidence); spot-check before the presentation")
    log.add("as_run_matrix", "low", "pressure", "cabin pressure is measured per run (0.97-1.01 atm)",
            "used as pressure_atm; also supports the ~1 atm assumption for BASS-II (same MSG)")
    log.add("as_run_matrix", "low", "geometry", "'PMMA 1/2 cm' rows use sphere sample numbers", "read as PMMA spheres")
    # Olson et al. Table 1 (verified): steady spread rate and flame size for two BASS SIBAL burns
    olson_file = raw_dir / "Olson_SIBAL-cotton_Table1_transcribed.csv"
    if olson_file.exists():
        o = pd.read_csv(olson_file, comment="#", dtype={"our_test_id": str})
        known = {t_["test_id"] for t_ in tests}
        for _, r in o[o["flight"] == "BASS"].iterrows():
            if r["our_test_id"] not in known:
                continue
            for q, unit, v in (("flame_spread_rate", "mm/s", r["vf_cm_s"] * 10), ("flame_length", "cm", r["lf_cm"]),
                               ("flame_height", "cm", r["hf_cm"])):
                if pd.notna(v):
                    ev.append(dict(investigation_id=PSI, test_id=r["our_test_id"], dataset_id="olson_sibal_cotton",
                                   source_type="experiment", quantity=q, unit=unit, value=float(v),
                                   status="Olson et al. Table 1 (verified vs PDF)", source_file=olson_file.name))
        log.add("results", "low", "matched by sample", "Olson Table 1 BASS samples 11 and 4 matched to runs 65 and 12",
                "matched on sample number, flow (19 vs 20, 22 vs 22 cm/s) and O2 (21.5 vs 21.5, 21.6 vs 21.6 %)")
    return PluginResult(tests=pd.DataFrame(tests), evidence=pd.DataFrame(ev), issues=log.frame(),
                        notes=f"{len(tests)} runs; outcomes {counts}")
