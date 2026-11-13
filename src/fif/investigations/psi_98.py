"""PSI-98 Saffire-I: one 94 x 40.6 cm SIBAL sheet, concurrent (S1) and opposed (S2) burns at 20 cm/s."""
from __future__ import annotations

from pathlib import Path

from ..registry import PluginResult, register
from ._saffire_large import build_large

PSI = "PSI-98"
TABLE = "PSI-98_Experimental_table_from_page.tsv"


@register(PSI, required=[TABLE])
def build(raw_dir: Path) -> PluginResult:
    return build_large(PSI, raw_dir, TABLE, flight="I")
