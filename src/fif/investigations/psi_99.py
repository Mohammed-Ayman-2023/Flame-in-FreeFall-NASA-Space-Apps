"""PSI-99 Saffire-II: nine 5 x 29 cm samples burned in the Cygnus flow duct (20 cm/s).

Source: PSI-99_Experimental table_SAFFIRE-2.csv (units inside the cells, footnote rows at the end).
Corrections are made here, never in the raw file, and each one is logged:
  * '037 mm' -> 0.37 mm (missing decimal; NTRS 20180005168 Table 1 lists 0.37 mm)
  * blank Material for 2-6 and 2-9 -> taken from NTRS 20180005168 Table 1
  * sample 2-7 (PMMA 5 cm then Nomex 24 cm on one card) is split into 2-7a and 2-7b
  * '?-g' headers are micro-g (the symbol was lost in the export)
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register
from ._saffire import PAPER, PAPER_FILE, burn_extent, first_number, o2_fraction, read_paper_table, tests_and_evidence

PSI = "PSI-99"
RAW_FILE = "PSI-99_Experimental table_SAFFIRE-2.csv"


@register(PSI, required=[RAW_FILE])
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    raw = pd.read_csv(raw_dir / RAW_FILE, dtype=str, encoding="utf-8-sig")
    raw.columns = [c.strip() for c in raw.columns]
    raw["source_line"] = raw.index + 2  # header is line 1
    log.add("experimental_table", "low", "encoding", "column headers '?-g ...' have lost the micro sign",
            "read as micro-g")
    samples = raw[raw["Sample Number"].str.match(r"^2-\d$", na=False)].copy()
    dropped = raw.loc[~raw.index.isin(samples.index), "Sample Number"].tolist()
    log.add("experimental_table", "low", "non-data rows",
            f"{len(dropped)} rows are flow-visualisation runs or footnotes: {dropped[:2]} ...",
            "excluded from tests; footnotes applied below")
    paper = read_paper_table(raw_dir)
    paper = paper.set_index("psi_sample") if len(paper) else paper
    rm_path = raw_dir / "PSI-99_Readme_Table1_samples_transcribed.csv"
    readme = ({r["sample"]: r for _, r in pd.read_csv(rm_path, comment="#", dtype=str).iterrows()}
              if rm_path.exists() else {})

    burns = []
    for _, r in samples.iterrows():
        sid, flags, conf = r["Sample Number"], [], "high"
        material = (r["Material"] or "").strip() if isinstance(r["Material"], str) else ""
        if not material:
            pm = paper.loc[sid, "material"] if sid in getattr(paper, "index", []) else None
            material = pm or "unknown"
            flags.append(f"material blank in PSI table; '{material}' from {PAPER} Table 1")
            log.add("experimental_table", "medium", "missing value", f"{sid}: Material blank",
                    f"filled from {PAPER} Table 1 ({material})")
        material = {"Cotton-Fiberglass (SIBAL)": "Cotton-fiberglass (SIBAL)",
                    "Cotton-Fiberglass": "Cotton-fiberglass (SIBAL)"}.get(material, material)
        thick_txt = str(r["Samle Thickness"]).strip()
        o2, o2_note = o2_fraction(r["Percent O2 (Note 1)"])
        flags += [o2_note, "O2 derived from CO2 production (table Note 1)"]
        flow = first_number(r["Air Flow (cm/s)"])
        if sid in getattr(paper, "index", []) and isinstance(paper.loc[sid, "flow_cm_s"], str) and \
                first_number(paper.loc[sid, "flow_cm_s"]) not in (None, flow):
            pf = first_number(paper.loc[sid, "flow_cm_s"])
            flags.append(f"airflow: PSI table {flow:g} cm/s, verified {PAPER} Table 1 {pf:g} cm/s (used the paper value)")
            log.add("experimental_table", "medium", "source conflict", f"{sid}: airflow {flow:g} (PSI) vs {pf:g} (paper)",
                    "used the verified results-table value; PSI value kept in flags")
            flow = pf
        rm_row = readme.get(sid.replace("2-", "S"))
        if rm_row is not None and first_number(rm_row["flow_cm_s"]) not in (None, flow):
            rf = first_number(rm_row["flow_cm_s"])
            flags.append(f"airflow: PSI readme Table 1 says {rf:g} cm/s (kept {flow:g} cm/s from the results table)")
            log.add("readme", "medium", "source conflict",
                    f"{sid}: airflow {rf:g} cm/s in the SAFFIRE-II Readme Table 1 vs {flow:g} cm/s used",
                    f"kept the verified {PAPER} Table 1 value; the PSI experimental table, the NTRS paper and the readme do not all agree")
        common = dict(length_cm=first_number(r["Sample Length"]), width_cm=first_number(r["Sample Width (cm)"]),
                      x_o2=o2, flow_cm_s=flow, direction=str(r["Flow Direction"]).strip().lower(),
                      ignition_power_w=first_number(r["Ignition Power (W)"]),
                      ignition_time_s=first_number(r["Ignition Time (s)"]),
                      burn_time_s=first_number(r["Burn Time (s)"]), source_file=RAW_FILE,
                      source_line=int(r["source_line"]), doi=f"{PAPER}")
        if str(r["Burn Time (s)"]).strip().lower() == "insignificant":
            flags.append("burn time 'Insignificant' left blank")
        ug_len_txt, g1_len_txt = r["?-g Burn Length"], r["1-g Burn Length"]
        g1_spread_txt = str(r["1-g Spread Rate"])
        g1_spread = first_number(g1_spread_txt) if "mm/s" in g1_spread_txt else None
        g1_note = "acceleratory spread" if "acceler" in g1_spread_txt.lower() else None

        if sid == "2-7":  # two materials on one card: split
            log.add("experimental_table", "medium", "two materials in one row",
                    "2-7 is PMMA (0.85 mm, 5 cm) followed by Nomex (0.37 mm, 24 cm)",
                    "split into tests 2-7a (PMMA) and 2-7b (Nomex), table Note 2")
            burns.append(dict(common, sample="2-7a", material="PMMA", thickness_mm=0.85, length_cm=5,
                              ug_burn_cm=5.0, ug_extent="complete", g1_extent=None, confidence="medium",
                              ug_note="PMMA portion completely consumed (Note 2)",
                              flags=flags + ["split from sample 2-7 (PMMA part); 1-g result not given for PMMA part"]))
            burns.append(dict(common, sample="2-7b", material="Nomex", thickness_mm=0.37, length_cm=24,
                              ug_burn_cm=0.0, ug_extent="none", burn_time_s=None, g1_extent="none",
                              confidence="medium", ug_note="Nomex not ignited (Note 2)",
                              flags=flags + ["split from sample 2-7 (Nomex part); burn time belongs to the PMMA part"]))
            continue

        if thick_txt.startswith("037"):
            thick = 0.37
            flags.append(f"thickness '{thick_txt}' read as 0.37 mm (missing decimal; {PAPER} lists 0.37 mm)")
            log.add("experimental_table", "medium", "typo", f"{sid}: thickness '{thick_txt}'", "read as 0.37 mm")
        elif "fig" in thick_txt.lower():
            thick = None
            flags.append("thickness 'See Fig. 5' (shaped sample): not in the table")
            log.add("experimental_table", "medium", "missing value", f"{sid}: thickness refers to a figure", "left blank")
            conf = "medium"
        elif thick_txt.endswith("cm"):
            thick = first_number(thick_txt) * 10
            flags.append(f"thickness '{thick_txt}' converted to mm")
        else:
            thick = first_number(thick_txt)
        ug_cm = first_number(ug_len_txt)
        if str(ug_len_txt).strip().startswith("~"):
            flags.append(f"micro-g burn length '{ug_len_txt}' is approximate")
        note = None
        if sid in ("2-8", "2-9"):
            note = "flame anchored at sample base; regression 0.01-0.04 mm/s (Note 4); length = visible damage (Note 3)"
            conf = "medium"
        burns.append(dict(common, sample=sid, material=material, thickness_mm=thick, ug_burn_cm=ug_cm,
                          ug_spread_mm_s=first_number(r["?-g Spread Length"]) if "mm/s" in str(r["?-g Spread Length"]) else None,
                          ug_extent=burn_extent(ug_len_txt, common["length_cm"]), ug_note=note,
                          g1_extent=burn_extent(g1_len_txt, common["length_cm"]), g1_spread_mm_s=g1_spread,
                          g1_note=g1_note, confidence=conf, flags=flags))
    log.add("experimental_table", "medium", "missing condition", "cabin pressure and gas mix not in the table",
            "filled per flight from Olson et al. Table 1 (see _saffire.FLIGHT_P_KPA)")
    log.add("experimental_table", "low", "header label", "'?-g Spread Length' holds rates in mm/s",
            "stored as flame_spread_rate")
    tests, ev = tests_and_evidence(PSI, burns)
    return PluginResult(tests=tests, evidence=ev, issues=log.frame(),
                        notes=f"9 samples (2-7 split in two) + 1-g comparisons; paper file: {PAPER_FILE}")
