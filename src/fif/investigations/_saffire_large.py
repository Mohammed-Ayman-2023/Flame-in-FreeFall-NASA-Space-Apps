"""Saffire-I (PSI-98) and Saffire-III (PSI-100): one 94 x 40.6 cm SIBAL sheet burned twice
(S1 concurrent, S2 opposed). The PSI table gives the set-up; results come from the team's
transcription of NTRS 20180005168 Table 1 (I-1/I-2 and III-1/III-2)."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult
from ._saffire import PAPER, PAPER_FILE, burn_extent, first_number, o2_fraction, read_paper_table, tests_and_evidence


def build_large(psi: str, raw_dir: Path, table_file: str, flight: str) -> PluginResult:
    log = IssueLog(psi)
    raw = pd.read_csv(raw_dir / table_file, sep="\t", dtype=str)
    raw.columns = [c.strip() for c in raw.columns]
    raw["source_line"] = raw.index + 2
    samples = raw[raw["Sample Number"].str.match(r"^S\d$", na=False)]
    paper = read_paper_table(raw_dir)
    if len(paper):
        paper = paper.set_index("psi_sample")
    else:
        log.add("results", "high", "missing file", f"{PAPER_FILE} not found", "no spread rates or burn lengths")
    col = {c.split(" (")[0]: c for c in raw.columns}

    burns = []
    for _, r in samples.iterrows():
        sid, flags, conf = r["Sample Number"], [], "high"
        p = paper.loc[sid] if len(paper) and sid in paper.index else None
        thick_txt = str(r[col["Sample Thickness"]]).strip()
        thick_val = first_number(thick_txt)
        # PSI tables give 0.37 / .33 "cm" for a fabric; the paper gives mm. Use mm.
        flags.append(f"thickness '{thick_txt}' in a cm column read as {thick_val:g} mm (fabric; paper gives mm)")
        log.add("experimental_table", "high", "unit error", f"{sid}: thickness '{thick_txt}' labelled cm",
                f"read as {thick_val:g} mm")
        if p is not None and first_number(p["thickness_mm"]) not in (None, thick_val):
            pt = first_number(p["thickness_mm"])
            flags.append(f"thickness: PSI {thick_val:g} mm, verified {PAPER} Table 1 {pt:g} mm (used the paper value)")
            log.add("experimental_table", "medium", "source conflict",
                    f"{sid}: thickness {thick_val:g} (PSI) vs {pt:g} mm (paper)", "used the verified results-table value")
            thick_val = pt
        L, W = first_number(r[col["Sample Length"]]), first_number(r[col["Sample Width"]])
        if L is not None and W is not None and L < W:
            flags.append(f"length/width swapped in PSI table ({L:g} x {W:g}); stored as 94 long x 40.6 wide")
            log.add("experimental_table", "medium", "swapped columns", f"{sid}: length {L:g}, width {W:g}",
                    "swapped back (paper and description: 94 cm long, 40.6 cm wide)")
            L, W = W, L
        flow = first_number(r[col["Air Flow"]])
        if p is not None and first_number(p["flow_cm_s"]) not in (None, flow):
            pf = first_number(p["flow_cm_s"])
            flags.append(f"airflow: PSI {flow:g} cm/s, verified {PAPER} Table 1 {pf:g} cm/s (used the paper value)")
            log.add("experimental_table", "medium", "source conflict", f"{sid}: airflow {flow:g} (PSI) vs {pf:g} (paper)",
                    "used the verified results-table value; PSI value kept in flags")
            flow = pf
        o2_txt = r[col["Percent O2"]] if "Percent O2" in col else (p["o2_percent_text"] if p is not None else None)
        o2, o2_note = o2_fraction(o2_txt)
        if "Percent O2" not in col:
            flags.append(f"O2 from {PAPER} Table 1 (not in PSI table)")
        flags.append(o2_note)
        def pick(psi_col, paper_col):
            if psi_col in col:
                return first_number(r[col[psi_col]]), table_file
            if p is not None and first_number(p[paper_col]) is not None:
                flags.append(f"{psi_col.lower()} from {PAPER} Table 1")
                return first_number(p[paper_col]), PAPER_FILE
            return None, None
        ip, _ = pick("Ignition Power", "ignition_power_w")
        it, _ = pick("Ignition Time", "ignition_time_s")
        bt, bt_src = pick("Burn Time", "burn_duration_s")
        if p is not None and isinstance(p.get("note"), str) and p["note"]:
            flags.append(f"paper: {p['note']}")
        direction = str(r[col["Flow Direction"] if "Flow Direction" in col else col["Direction"]]).strip().lower()
        burns.append(dict(
            sample=sid, material="Cotton-fiberglass (SIBAL)", thickness_mm=thick_val, length_cm=L, width_cm=W,
            x_o2=o2, flow_cm_s=flow, direction=direction, ignition_power_w=ip, ignition_time_s=it,
            burn_time_s=bt, burn_time_src=bt_src,
            ug_burn_cm=first_number(p["ug_burn_length_text"]) if p is not None else None, ug_burn_src=PAPER_FILE,
            ug_spread_mm_s=first_number(p["ug_spread_rate_mm_s"]) if p is not None else None, ug_spread_src=PAPER_FILE,
            ug_extent=burn_extent(p["ug_burn_length_text"], L) if p is not None else None,
            ug_note=f"Saffire-{flight} {'concurrent' if direction == 'concurrent' else 'opposed'} burn; both burns on one sheet",
            g1_extent=burn_extent(p["g1_burn_length_text"], L) if p is not None else None,
            g1_note="acceleratory spread" if p is not None and "acceler" in str(p["g1_spread_text"]).lower() else None,
            g1_src=PAPER_FILE, source_file=table_file, source_line=int(r["source_line"]), doi=PAPER,
            confidence=conf, flags=flags))
    log.add("results", "low", "transcribed values",
            f"burn lengths, spread rates{' and O2/ignition/burn time' if 'Percent O2' not in col else ''} come from "
            f"{PAPER} Table 1", "transcription verified against the PDF table (2026-11-13)")
    log.add("experimental_table", "medium", "missing condition", "cabin pressure and gas mix not published",
            "filled per flight from Olson et al. Table 1 (see _saffire.FLIGHT_P_KPA)")
    log.add("raw_data", "low", "images only", "PSI raw data for this investigation are camera images",
            "not loaded; results taken from the paper")
    tests, ev = tests_and_evidence(psi, burns)
    return PluginResult(tests=tests, evidence=ev, issues=log.frame())
