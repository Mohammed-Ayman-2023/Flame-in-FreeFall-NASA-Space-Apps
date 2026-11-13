"""Loaders: one function per PSI-117 file.

Each loader returns the data *as it is in the file*, reshaped into tidy tables,
with no values changed. Every row carries `source_line` (1-based line number in
the raw CSV) so any number can be traced back to the file. Cleaning happens in
`clean.py`, not here.
"""
from __future__ import annotations

import csv
from pathlib import Path

import numpy as np
import pandas as pd

from . import config


# ---------------------------------------------------------------- helpers
def _rows(path: Path) -> list[list[str]]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return [row for row in csv.reader(fh)]


def _num(cell: str) -> float:
    cell = (cell or "").strip()
    if cell == "":
        return np.nan
    return float(cell)


def _pair_block(rows, x_col, y_col, first_data_row=1):
    """Read an (x, y) column pair, keeping only rows where both cells are filled."""
    out = []
    for i, row in enumerate(rows[first_data_row:], start=first_data_row):
        if len(row) <= max(x_col, y_col):
            continue
        x, y = row[x_col].strip(), row[y_col].strip()
        if x == "" or y == "":
            continue
        out.append({"x": float(x), "y": float(y), "source_line": i + 1})
    return pd.DataFrame(out)


def raw_path(key: str) -> Path:
    return config.RAW / config.FILES[key]


# ---------------------------------------------------------------- ReadMe workbook
def load_readme() -> pd.DataFrame:
    """The ReadMe sheet, exactly as written (it repeats its header per block)."""
    import openpyxl

    ws = openpyxl.load_workbook(raw_path("readme"), data_only=True).active
    # Columns B..K by position. Later blocks repeat only the first header cells,
    # so names are assigned by position rather than read from each block.
    names = ["Fuel", "do (mm)", "P (atm)", "XO2", "XN2", "sixth_column_value",
             "_blank", "Data File", "Reference", "Figure"]
    records, sixth_label = [], None
    for r, row in enumerate(ws.iter_rows(values_only=True), start=1):
        cells = (list(row[1:]) + [None] * 10)[:10]  # column A is empty
        if cells[0] == "Fuel":
            sixth_label = cells[5]  # 'XO3', 'XHe' or empty, depending on the block
            continue
        if all(c is None for c in cells):
            continue
        rec = dict(zip(names, cells))
        rec["sixth_column_label"] = sixth_label
        rec["sheet_row"] = r
        records.append(rec)
    df = pd.DataFrame(records).drop(columns="_blank")
    return df[["Fuel", "do (mm)", "P (atm)", "XO2", "XN2", "sixth_column_label",
               "sixth_column_value", "Data File", "Reference", "Figure", "sheet_row"]]


# ---------------------------------------------------------------- n-heptane cool flame simulations
HEPTANE_COLUMNS = {
    "Time(sec)": "time_s",
    "Diameter(mm)": "d_mm",
    "K(mm^2/sec)": "k_mm2_s",
    "T_max(K)": "tmax_k",
    "D_Tmax/D_drop": "d_tmax_over_d",
    "D_OHm/D_drop": "d_ohmax_over_d",
    "(D/Do)2": "d2_over_d02_given",
}


def load_heptane(case: str) -> pd.DataFrame:
    """case = 'stable' or 'oscillatory'. Simulation time series (Alam et al. 2019, Fig. 1)."""
    key = f"heptane_{case}"
    df = pd.read_csv(raw_path(key), encoding="utf-8-sig")
    df = df.rename(columns=HEPTANE_COLUMNS)
    df["source_line"] = np.arange(2, len(df) + 2)
    df.insert(0, "case", case)
    df.insert(0, "dataset_id", key)
    df["source_type"] = "simulation"
    return df


# ---------------------------------------------------------------- n-dodecane three-stage (expt + sim)
# (x column, y column, quantity as labelled in the file, unit)
THREE_STAGE_EXPT_BLOCKS = [
    (1, 2, "d2_over_d02", "-"),
    (5, 6, "Dflame/Dodrop (as labelled)", "as labelled"),
    (8, 9, "Dflame mm (as labelled)", "as labelled"),
    (12, 13, "flame_radiance_I", "W"),
    (16, 17, "flame_radiance_II", "W"),
    (20, 21, "cool_flame_diameter_fwhm", "mm"),
    (23, 24, "cool_flame_diameter_peak_to_peak", "mm"),
]


def load_three_stage() -> dict[str, pd.DataFrame]:
    """Experiment blocks (long format) plus the three simulation blocks."""
    rows = _rows(raw_path("c12_three_stage"))
    blocks = []
    for xc, yc, qty, unit in THREE_STAGE_EXPT_BLOCKS:
        b = _pair_block(rows, xc, yc)
        b = b.rename(columns={"x": "t_over_d02_s_mm2", "y": "value"})
        b["quantity_as_labelled"] = qty
        b["unit_as_labelled"] = unit
        b["point_order"] = np.arange(len(b))
        blocks.append(b)
    expt = pd.concat(blocks, ignore_index=True)
    expt.insert(0, "source_type", "experiment")
    expt.insert(0, "dataset_id", "c12_three_stage")

    # simulation block 1: t, D, K, Tmax, D_Tmax/D_drop, D_OHm/D_drop (cols 28-33)
    sim = []
    for i, row in enumerate(rows[1:], start=1):
        if len(row) > 33 and row[28].strip() != "":
            sim.append(dict(
                time_s=_num(row[28]), d_mm=_num(row[29]), k_mm2_s=_num(row[30]),
                tmax_k=_num(row[31]), d_tmax_over_d=_num(row[32]),
                d_ohmax_over_d=_num(row[33]), source_line=i + 1))
    sim = pd.DataFrame(sim)
    sim.insert(0, "source_type", "simulation")
    sim.insert(0, "dataset_id", "c12_three_stage")

    # simulation block 2: t/do^2, (d/do)^2, Dflame(mm) (cols 35-37)
    flame = []
    for i, row in enumerate(rows[1:], start=1):
        if len(row) > 37 and row[35].strip() != "":
            flame.append(dict(t_over_d02_s_mm2=_num(row[35]), d2_over_d02=_num(row[36]),
                              dflame_mm=_num(row[37]), source_line=i + 1))
    flame = pd.DataFrame(flame)
    flame.insert(0, "source_type", "simulation")

    # simulation block 3: t/do^2, radiance (cols 39-40)
    rad = _pair_block(rows, 39, 40).rename(columns={"x": "t_over_d02_s_mm2", "y": "radiance_w"})
    rad.insert(0, "source_type", "simulation")
    return {"expt": expt, "sim": sim, "sim_flame": flame, "sim_radiance": rad}


# ---------------------------------------------------------------- extinction diameters at 1 atm
def load_alkane_dext_1atm() -> pd.DataFrame:
    rows = _rows(raw_path("alkane_dext_1atm"))
    header = rows[0]
    out = []
    for g in range(0, len(header), 5):
        fuel_code = header[g].strip()
        if not fuel_code:
            continue
        source = rows[1][g].strip()  # 'Expt' or 'Sim' sits in the first data row
        for i, row in enumerate(rows[1:], start=1):
            if len(row) <= g + 3 or row[g + 1].strip() == "":
                continue
            out.append(dict(
                fuel_code=fuel_code,
                source_type={"Expt": "experiment", "Sim": "simulation"}[source],
                d0_mm=_num(row[g + 1]),
                dext_hot_mm=_num(row[g + 2]),
                dext_cool_mm=_num(row[g + 3]),
                source_line=i + 1,
            ))
    df = pd.DataFrame(out)
    df["fuel"] = df["fuel_code"].map({"C7": "n-heptane", "C10": "n-decane", "C12": "n-dodecane"})
    df.insert(0, "dataset_id", "alkane_dext_1atm")
    return df


# ---------------------------------------------------------------- n-dodecane extinction vs pressure
def load_c12_dext_vs_p() -> pd.DataFrame:
    rows = _rows(raw_path("c12_dext_vs_p"))
    pairs = [
        (0, 1, "dext_hot", "experiment"),
        (3, 4, "dext_hot", "simulation"),
        (6, 7, "dext_cool", "experiment"),
        (9, 10, "dext_cool", "simulation"),
        (12, 13, "dext_cool_bound_upper", "experiment"),
        (15, 16, "dext_cool_bound_lower", "experiment"),
    ]
    out = []
    for xc, yc, qty, src in pairs:
        b = _pair_block(rows, xc, yc).rename(columns={"x": "pressure_atm", "y": "value_mm"})
        b["quantity"] = qty
        b["source_type"] = src
        b["column_as_labelled"] = rows[0][yc]
        out.append(b)
    df = pd.concat(out, ignore_index=True)
    df.insert(0, "dataset_id", "c12_dext_vs_p")
    return df


# ---------------------------------------------------------------- n-dodecane cool-flame burning rate vs pressure
def load_c12_kavg() -> pd.DataFrame:
    rows = _rows(raw_path("c12_kavg"))
    expt = _pair_block(rows, 1, 2).rename(columns={"x": "pressure_atm", "y": "k_mm2_s"})
    expt["source_type"] = "experiment"
    expt["quantity"] = "kavg_cool_flame"
    model = _pair_block(rows, 5, 6).rename(columns={"x": "pressure_atm", "y": "k_mm2_s"})
    model["source_type"] = "simulation"
    model["quantity"] = "kb_model"
    df = pd.concat([expt, model], ignore_index=True)
    df.insert(0, "dataset_id", "c12_kavg")
    return df
