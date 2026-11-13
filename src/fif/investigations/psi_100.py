"""PSI-100 Saffire-III: same design as Saffire-I at higher flow (PSI: 30 cm/s; paper: 25 cm/s)."""
from __future__ import annotations

from pathlib import Path

from ..registry import PluginResult, register
from ._saffire_large import build_large

PSI = "PSI-100"
TABLE = "PSI-100_Experimental_Details_from_page.tsv"


@register(PSI, required=[TABLE])
def build(raw_dir: Path) -> PluginResult:
    return build_large(PSI, raw_dir, TABLE, flight="III")
