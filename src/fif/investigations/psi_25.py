"""PSI-25 BASS-II: ~130 burns of PMMA films/slabs/rods, SIBAL fabric and Nomex in the MSG
wind tunnel on the ISS, at 13.6-22.2 % O2 (N2 vitiation), flows up to ~40 cm/s.

Primary source: BASS-II_Test_Matrix_by_PI_Final.xlsx (one tab per PI). Fallback: the same table
copied from the PSI page (two text parts). Column meanings from BASS-II_data_FAQ.docx:
  * 'Air display' = flow speed in the duct, cm/s (slow response, ~1 min)
  * 'Fan display' = fan voltage x10, sometimes control-box pot settings (not used)
  * calibrated O2 = sensor corrected with a constant offset to the ISS MCA reading
  * CO 'OR' = over range (> 1000 ppm)
The table is an operations log: the flow is stepped during a run and the end state is free text
("5, 3, 2, ext", "5 down to ext", "blowoff"). Every listed flow before an end keyword counts as
'flame present at that flow'.
Flow direction is not a column; it follows each PI's configuration (FLOW_DIRECTION below).
x_o2 = calibrated INITIAL O2; the final O2 is kept as an extra column.
"""
from __future__ import annotations

import io
import re
from pathlib import Path

import pandas as pd

from ..issues import IssueLog
from ..registry import PluginResult, register
from ._bass2_fancal import CAL_FILE, estimate_speed, read_calibration
from ._saffire import first_number

PSI = "PSI-25"
P1 = "PSI-25_Experimental_table_page1_of_2.txt"
P2 = "PSI-25_Experimental_table_page2_of_2.txt"
O2_INIT, O2_FINAL = "Calibrated initial O2 % by vol", "Calibrated final O2 % by vol"
XLSX = "BASS-II_Test_Matrix_by_PI_Final.xlsx"
INCH = 25.4
MAX_TUNNEL_CM_S = 40.0  # PSI page: the tunnel imposes airflow up to 40 cm/s
# direction by PI: (direction, source, confidence)
FLOW_DIRECTION = {
    "Olson": ("concurrent", "FAQ: rods ignited at the upstream end (stagnation / concurrent geometry)", "high"),
    "Fernandez-Pello": ("opposed", "FAQ: rods ignited at the downstream end (opposed-flow spread)", "high"),
    "Bhattacharjee": ("opposed", "PI publications on opposed-flow spread over thin PMMA (FAQ list)", "medium"),
    "Miller": ("opposed", "PI publications on opposed-flow spread over thick PMMA (FAQ list)", "medium"),
    "T'ien": ("concurrent", "Zhao et al. PCI 36: concurrent spread over SIBAL in BASS-II (FAQ list)", "medium"),
    "Ferkul": (None, "not stated", "low"),
}
FRAC = {"1/4": 0.25, "3/8": 0.375, "1/2": 0.5, "0.5": 0.5}


def _norm(c) -> str:
    return re.sub(r"\s+", " ", str(c)).strip()


def read_xlsx(raw_dir: Path) -> pd.DataFrame:
    rename = {"Test no.": "Test #", "Sample no.": "Sample #", "Material": "Fuel Sample Material",
              "calibrated initial O2 % by vol": O2_INIT, "calibrated final O2 % by vol": O2_FINAL,
              "total frames shot": "Total Frames Shot"}
    frames = []
    for sheet, df in pd.read_excel(raw_dir / XLSX, sheet_name=None, dtype=object).items():
        df.columns = [_norm(c) for c in df.columns]
        df = df.rename(columns=rename)
        df["source_line"] = [f"{sheet}!{i + 2}" for i in range(len(df))]
        df = df[df["Test #"].notna()]
        df["PI"] = sheet
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    for c in df.columns:
        df[c] = df[c].map(lambda v: None if v is None or (isinstance(v, float) and pd.isna(v)) else
                          (v.strftime("%Y-%m-%d") if hasattr(v, "strftime") else str(v)))
    df["source_file"], df["truncated"] = XLSX, False
    return df


def read_table(raw_dir: Path) -> pd.DataFrame:
    if (raw_dir / XLSX).exists():
        return read_xlsx(raw_dir)
    lines = (raw_dir / P1).read_text(encoding="utf-8").splitlines()
    end = next(i for i, l in enumerate(lines) if l.startswith("Items per page"))
    header, rows1 = lines[0], lines[1:end]
    rows2 = [l for l in (raw_dir / P2).read_text(encoding="utf-8").splitlines() if l.strip()] \
        if (raw_dir / P2).exists() else []
    src = [(P1, i + 2, l) for i, l in enumerate(rows1)] + [(P2, i + 1, l) for i, l in enumerate(rows2)]
    ncol = header.count("\t") + 1
    recs = []
    for f, line_no, l in src:
        cells = l.split("\t")
        truncated = len(cells) < ncol
        cells = (cells + [""] * ncol)[:ncol]
        recs.append(cells + [f, line_no, truncated])
    cols = header.split("\t") + ["source_file", "source_line", "truncated"]
    df = pd.DataFrame(recs, columns=cols).replace({"": None})
    return df


def parse_material(text: str) -> dict:
    t = (text if isinstance(text, str) else "").replace('""', '"').strip().strip('"')
    tl = t.lower()
    out = dict(material=None, geometry=None, thickness_mm=None, diameter_mm=None, width_cm=None, flags=[])
    w = re.search(r"(\d+(?:\.\d+)?)\s*cm(?:\s*wide|\s*2ide|\s+thick)?", tl)
    if "rod" in tl:
        m = re.search(r"(1/4|3/8|1/2|0\.5)", tl)
        out.update(geometry="rod", diameter_mm=round(FRAC[m.group(1)] * INCH, 2) if m else None)
        colour = "black" if "bla" in tl else "clear"
        out["material"] = f"PMMA ({colour})"
        if "pmma" not in tl:
            out["flags"].append("rod material PMMA per FAQ/SRD")
        if "blac " in tl + " " and "black" not in tl:
            out["flags"].append("typo 'blac' read as black")
    elif "sibal" in tl:
        out.update(material="Cotton-fiberglass (SIBAL)", geometry="fabric sheet", width_cm=first_number(w.group(1)) if w else None)
        if "igniter" in tl or "ign" in tl:
            out["flags"].append(f"note in material cell: '{t}'")
    elif "spherical" in tl:
        out.update(material="PMMA", geometry="spherical section (stagnation-region ignition)",
                   diameter_mm=first_number(t) * 10 if first_number(t) else None)
    elif "nomex" in tl:
        out.update(material="Nomex", geometry="fabric sheet")
    elif "candle" in tl or "wax" in tl:
        out.update(material="Japan wax (candle)", geometry="candle")
    else:  # PMMA films and slabs
        out["material"] = "PMMA"
        if "pmma" not in tl:
            out["flags"].append("film material PMMA per FAQ/SRD")
        mic = re.search(r"(\d+)\s*micron", tl)
        mm = re.search(r"(\d+(?:\.\d+)?)\s*mm", tl)
        thick = int(mic.group(1)) / 1000 if mic else (float(mm.group(1)) if mm else None)
        out["thickness_mm"] = thick
        out["geometry"] = "thin film" if thick is not None and thick <= 0.5 else "slab"
        if "1 sided" in tl:
            out["geometry"] += " (1-sided burning)"
        elif "2 sided" in tl:
            out["geometry"] += " (2-sided burning)"
        widths = re.findall(r"(\d+(?:\.\d+)?)\s*cm", tl)
        out["width_cm"] = float(widths[0]) if widths else None
        if "2 cm thick" in tl:
            out["flags"].append("'2 cm thick' read as 2 cm wide (typo)")
        if "2ide" in tl:
            out["flags"].append("typo '2ide' read as wide")
    return out


END_WORDS = [("no ign", "no_ignition"), ("would not stay lit", "would_not_stay_lit"), ("blowoff", "blowoff"),
             ("ext", "extinguished_low_flow"), ("out", "extinguished_low_flow")]


def parse_flow(text: str | None, fan_text: str | None = None) -> dict:
    """'5 3 2 ext' -> flows [5, 3, 2], end 'extinguished_low_flow'.
    Air speeds are read from the 'Air display' text only; the end keyword is searched in both
    'Air display' and 'Fan display' (operators often wrote 'ext'/'blowoff' in the fan column)."""
    raw = text if isinstance(text, str) else ""
    fan_text = fan_text if isinstance(fan_text, str) else ""
    paren = " ".join(re.findall(r"\(([^)]*)\)", raw.lower()))
    t = re.sub(r"\([^)]*\)", " ", raw.lower())  # parenthesised values (usually fan readings)
    both = t + " " + (fan_text or "").lower()
    end = next((tag for word, tag in END_WORDS if word in both), None)
    pot = re.search(r"\bpots?\b", t)
    t_num = t[:pot.start()] if pot else t  # numbers after 'pot' are fan-pot settings, not air speed
    nums = [float(x) for x in re.findall(r"(?<![\w.])(\d+(?:\.\d+)?)", t_num.replace("<", " "))]
    swapped = False
    num_re = r"(?<![\w.])(\d+(?:\.\d+)?)"
    if nums and all(v > MAX_TUNNEL_CM_S for v in nums) and paren:
        alt = [float(x) for x in re.findall(num_re, paren)]
        if alt and all(v <= MAX_TUNNEL_CM_S for v in alt):  # speeds were written in brackets
            nums, swapped = alt, True
    too_high = [v for v in nums if v > MAX_TUNNEL_CM_S]
    nums = [v for v in nums if v <= MAX_TUNNEL_CM_S]
    clean = set(re.sub(r"[\d.<>~,;]|ext|extinguished|blowoff|max|down to|decr|incr to|low|very|no ign at any flow|"
                       r"would not stay lit|ibid|cm/s|ign|lower|see fan|approaching|to|etc|\s", "", t))
    return dict(flows=nums, end=end, less_than="<" in raw, odd=bool(clean) or "?" in raw or pot is not None,
                pot=pot is not None, too_high=too_high, swapped=swapped)


def last_fan_reading(fan_text, air_text) -> float | None:
    """Last non-zero fan reading of the run (pot setting <= 10 or fan display >= 38).
    Taken from 'Fan display'; if that is empty, from pot values written in 'Air display'."""
    def nums(t):
        t = re.sub(r"\(\s*\d+\s*cm/s\s*\)", " ", t.lower())  # '(5cm/s)' annotations
        return [float(x) for x in re.findall(r"(?<![\w])(\d*\.?\d+)", t)]
    fan = fan_text if isinstance(fan_text, str) else ("" if fan_text is None else str(fan_text))
    vals = [v for v in nums(fan) if v > 0]
    if not vals and isinstance(air_text, str):
        a = air_text.lower()
        m = re.search(r"\bpots?\b", a)
        inside = " ".join(re.findall(r"\(([^)]*)\)", a))
        vals = [v for v in nums((a[m.end():] if m else "") + " " + inside) if 0 < v <= 10]
    vals = [v for v in vals if v <= 10 or v >= 38]
    return vals[-1] if vals else None


@register(PSI, required=["*.xlsx"])
def build(raw_dir: Path) -> PluginResult:
    log = IssueLog(PSI)
    df = read_table(raw_dir)
    log.add("test_matrix", "low", "units", "'Air display' = duct flow speed in cm/s (FAQ); slow sensor (~1 min)",
            "used as flow_cm_s; short steps may not have settled")
    log.add("test_matrix", "medium", "derived condition", "flow direction is not a column",
            "set per PI from the FAQ (Olson concurrent, Fernandez-Pello opposed: high confidence) and PI "
            "publications (Bhattacharjee, Miller opposed; T'ien concurrent: medium); Ferkul blank")
    log.add("test_matrix", "medium", "missing condition", "pressure not stated in the matrix, FAQ or SRD (MSG on ISS)",
            "pressure_atm blank: fill from a paper at step 5")
    n_trunc = int(df["truncated"].sum())
    if n_trunc:
        log.add("experimental_table", "medium", "truncated row",
                f"{n_trunc} row(s) cut off in the copy: {df.loc[df['truncated'], 'Test #'].tolist()}",
                "kept with blank cells; re-copy or download the CSV")
    ids = set(df["Test #"])
    if "T8" not in ids:
        log.add("test_matrix", "low", "missing row", "T8 absent in the test matrix (T7 then T9)",
                "none: numbering follows the planned matrix")
    dups = df["Test #"][df["Test #"].duplicated()].tolist()
    if dups:
        log.add("experimental_table", "medium", "duplicate id", f"repeated test numbers: {dups}", "suffixed")

    cal = read_calibration(raw_dir) if (raw_dir / CAL_FILE).exists() else None
    if cal is None:
        log.add("fan_calibration", "medium", "missing file", f"{CAL_FILE} not found",
                "extinction speeds stay as coarse air-display bounds")
    tests, ev = [], []
    for _, r in df.iterrows():
        tid = f"{PSI}:{r['Test #']}"
        mat = parse_material(r["Fuel Sample Material"])
        flow = parse_flow(r["Air display"], r["Fan display"])
        flags = list(mat["flags"])
        o2i, o2f = first_number(r[O2_INIT]), first_number(r[O2_FINAL])
        if o2f is not None and (o2f > 25 or o2f < 5):
            flags.append(f"final O2 {o2f:g}% impossible (sensor/entry error); ignored")
            log.add("experimental_table", "medium", "bad value", f"{r['Test #']}: final O2 {o2f}%", "ignored")
            o2f = None
        if str(r[O2_FINAL]).strip().lower() == "none":
            o2f = None
        for c in ("Initial CO (ppm)", "Final CO (ppm)"):
            if str(r[c]).strip().upper() in {"OR", "OVER"} or str(r[c]).startswith(">"):
                flags.append(f"{c} '{r[c]}' = over range (> 1000 ppm per FAQ)")
        if flow["odd"]:
            flags.append(f"flow text '{r['Air display']}' only partly parsed")
        if 0.0 in flow["flows"]:
            flags.append("flow sequence includes 0 cm/s (air off); not counted as a burning point")
        if flow["too_high"]:
            flags.append(f"values {flow['too_high']} above the 40 cm/s tunnel maximum dropped (likely fan readings)")
        if flow["swapped"]:
            flags.append("air speeds read from the bracketed values (outside values are fan readings)")
        if flow["pot"]:
            flags.append("air-display text mixes fan-pot settings; only speeds before 'pot' used")
        if flow["less_than"]:
            flags.append("'<1' read as 1 cm/s (upper bound)")
        if not flow["flows"] and flow["end"] is None:
            flags.append("no air speed given")
        direction, dir_src, dir_conf = FLOW_DIRECTION.get(r["PI"], (None, "unknown PI", "low"))
        flags.append(f"flow direction {direction or 'unknown'}: {dir_src}")
        conf = "medium" if (flow["odd"] or mat["material"] is None or r["truncated"] or dir_conf != "high") else "high"
        if direction is None:
            conf = "low"
        ignited = False if flow["end"] == "no_ignition" else (True if flow["flows"] else None)
        extinguished = True if flow["end"] in ("extinguished_low_flow", "blowoff", "would_not_stay_lit") else None
        size = mat["thickness_mm"] if mat["thickness_mm"] is not None else mat["diameter_mm"]
        lim = dict(limit_speed_cm_s=None, limit_speed_bound=None, limit_speed_method=None)
        if cal is not None and flow["end"] in ("extinguished_low_flow", "blowoff", "would_not_stay_lit"):
            reading = last_fan_reading(r["Fan display"], r["Air display"])
            year = str(r.get("Actual Date (for Video Display Date, add 1 for Leap Year)") or "")[:4]
            gmt = next((r[c] for c in r.index if str(c).startswith("GMT") and r[c] is not None
                        and not (isinstance(r[c], float) and pd.isna(r[c]))), None)
            day = int(first_number(gmt)) if first_number(gmt) is not None else None
            restr = int(first_number(r["Flow restrictor"])) if first_number(r["Flow restrictor"]) is not None else None
            if reading is None or restr is None:
                lim["limit_speed_method"] = "no fan reading / restrictor to convert"
            elif year == "2016":
                lim["limit_speed_method"] = "2016 run: no 2016 fan calibration in the file"
            else:
                est = estimate_speed(cal, day, restr, reading)
                lim = dict(limit_speed_cm_s=est["value"], limit_speed_bound=est.get("bound"),
                           limit_speed_method=f"fan {est['kind']} {reading:g}, {restr} restrictor(s): {est['method']}")
                if est["value"] is not None:
                    q = "blowoff_speed_from_fan_cal" if flow["end"] == "blowoff" else "extinction_speed_from_fan_cal"
                    ev.append(dict(investigation_id=PSI, test_id=tid, dataset_id="bass2_runs",
                                   source_type="experiment", quantity=q, unit="cm/s", value=est["value"],
                                   status=("upper bound: " if est.get("bound") == "upper" else
                                           "lower bound: " if est.get("bound") == "lower" else "") + lim["limit_speed_method"],
                                   source_file=f"{r['source_file']} + {CAL_FILE}", source_line=r["source_line"]))
        tests.append(dict(
            investigation_id=PSI, test_id=tid, source_type="experiment", platform="ISS-MSG",
            fuel=mat["material"], fuel_class="solid", geometry=mat["geometry"], size_mm=size,
            thickness_mm=mat["thickness_mm"], diameter_mm=mat["diameter_mm"], sample_width_cm=mat["width_cm"],
            pressure_atm=None, x_o2=round(o2i / 100, 4) if o2i is not None else None,
            x_o2_final=round(o2f / 100, 4) if o2f is not None else None, diluent="N2 (vitiation)",
            flow_cm_s=flow["flows"][0] if flow["flows"] else None,
            flow_min_cm_s=min([v for v in flow["flows"] if v > 0], default=None),
            flow_max_cm_s=max(flow["flows"]) if flow["flows"] else None,
            flow_sequence=r["Air display"], flow_direction=direction, gravity_g=0.0, setup="BASS-II MSG wind tunnel",
            end_state=flow["end"] or ("burning_at_end_or_unreported" if flow["flows"] else None),
            ignited=ignited, extinguished=extinguished, pi=r["PI"], sample_no=r["Sample #"],
            outcome_note=f"flow steps {flow['flows']} -> {flow['end'] or 'no end keyword'}",
            confidence=conf, flags="; ".join(flags), doi="10.60555/4qc4-de67", **lim,
            source_file=r["source_file"]))
        for v in flow["flows"]:
            if v == 0:  # air switched off: a transient, not a steady 'burning at 0 cm/s' point
                continue
            ev.append(dict(investigation_id=PSI, test_id=tid, dataset_id="bass2_runs", source_type="experiment",
                           quantity="flame_present_at_flow", unit="1=yes", value=1.0, x_name="flow_cm_s",
                           x_value=v, x_unit="cm/s", status="ok (A1: units assumed)",
                           source_file=r["source_file"], source_line=r["source_line"]))
        if flow["end"] == "extinguished_low_flow" and flow["flows"]:
            ev.append(dict(investigation_id=PSI, test_id=tid, dataset_id="bass2_runs", source_type="experiment",
                           quantity="low_flow_extinction_bound", unit="cm/s",
                           value=min([v for v in flow["flows"] if v > 0], default=min(flow["flows"])),
                           status="flame went out at or below this flow (A1)",
                           source_file=r["source_file"], source_line=r["source_line"]))
        if flow["end"] == "blowoff" and flow["flows"]:
            ev.append(dict(investigation_id=PSI, test_id=tid, dataset_id="bass2_runs", source_type="experiment",
                           quantity="blowoff_flow_bound", unit="cm/s", value=max(flow["flows"]),
                           status="blow-off at or above this flow (A1)",
                           source_file=r["source_file"], source_line=r["source_line"]))
    tests = pd.DataFrame(tests)
    if tests["test_id"].duplicated().any():  # e.g. repeated ids across copies
        tests["test_id"] = tests["test_id"] + tests.groupby("test_id").cumcount().map(lambda k: "" if k == 0 else f"_{k}")
    return PluginResult(tests=tests, evidence=pd.DataFrame(ev), issues=log.frame(),
                        notes=f"{len(tests)} runs from the PSI experimental table (copied, 2 parts)")
