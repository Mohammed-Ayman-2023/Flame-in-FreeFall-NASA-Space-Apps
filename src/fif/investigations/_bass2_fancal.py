"""BASS-II fan calibration (PSI-25 Reference Data): air speed vs fan pot / fan display per test day
and per number of flow restrictors (0, 1, 2).

Sheet layout: one 4-column block per calibration day (Pot | Fan Display | Air Display | blank),
starting with 'DATE' in row 3 and the GMT label in row 4. Inside a block the rows run from the
'Pot' header down; each later section of numbers follows a 'decr' marker in the Air column and
uses one more restrictor. The first block (columns A-E) is the SPICE example calibration.
Test-section speed U = 1.0066 x Air display (sheet footnote). The 3.8 V (display 38) zero point is
not used: the fan stops at a finite voltage (sheet note).
"""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import openpyxl
import pandas as pd

CAL_FILE = "PSI-25_Reference Data_Fan calibration data.xlsx"
U_FACTOR = 1.0066


def _num(v):
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    return None


def read_calibration(raw_dir: Path) -> pd.DataFrame:
    ws = openpyxl.load_workbook(raw_dir / CAL_FILE, data_only=True).active
    rows = []
    for c in range(1, ws.max_column + 1):
        if ws.cell(3, c).value != "DATE":
            continue
        date, label = ws.cell(3, c + 1).value, str(ws.cell(4, c + 1).value or "")
        day = re.search(r"2014-0*(\d+)", label)
        day = int(day.group(1)) if day else None
        example = c == 1
        restr, started = 0, False
        for r in range(5, ws.max_row + 1):
            a = ws.cell(r, c + 2).value
            if isinstance(a, str) and a.strip().lower().startswith("decr"):
                if started:
                    restr += 1
                started = True
                continue
            pot, fan, air = _num(ws.cell(r, c).value), _num(ws.cell(r, c + 1).value), _num(a)
            if pot is None or fan is None or air is None:
                continue
            rows.append(dict(cal_day=day, cal_label=label, cal_date=str(date)[:10], example=example,
                             restrictors=restr, pot=pot, fan_display=fan, air_cm_s=air,
                             u_cm_s=round(U_FACTOR * air, 3), cell=f"col{c}!r{r}"))
    return pd.DataFrame(rows)


def estimate_speed(cal: pd.DataFrame, day: int | None, restrictors: int, reading: float) -> dict:
    """Air speed for one fan reading. reading <= 10 is a pot setting, >= 38 a fan display value.
    Uses the same-day curve for the restrictor count, else the nearest day with that restrictor.
    Readings below the lowest non-zero calibration point give an upper bound, not a value."""
    kind = "pot" if reading <= 10 else "fan_display"
    c = cal[(~cal["example"]) & (cal["restrictors"] == restrictors) & (cal["fan_display"] > 38)]
    if c.empty:
        return dict(value=None, kind=kind, method="no calibration for this restrictor count")
    counts = c.groupby("cal_day").size()
    days = counts[counts >= 3].index.to_numpy()  # a usable curve needs at least 3 points
    if day is not None and day in days:
        use, how = c[c["cal_day"] == day], "same-day calibration"
    elif day is not None and len(days):
        near = min(days, key=lambda d: abs(d - day))
        use, how = c[c["cal_day"] == near], f"nearest calibration day (GMT {near:g})"
    else:
        use, how = c, "all calibration days pooled (test day unknown)"
    curve = use.groupby(kind)["u_cm_s"].mean().sort_index()
    x, y = curve.index.to_numpy(float), curve.to_numpy(float)
    if reading < x.min():
        return dict(value=float(y[0]), kind=kind, bound="upper",
                    method=f"{how}; reading {reading:g} below lowest calibrated {kind} {x.min():g}: "
                           f"speed is below {y[0]:.1f} cm/s (upper bound)")
    if reading > x.max():
        return dict(value=float(y[-1]), kind=kind, bound="lower", method=f"{how}; above calibrated range")
    return dict(value=round(float(np.interp(reading, x, y)), 2), kind=kind, bound=None,
                method=f"{how}; linear interpolation on {kind}")
