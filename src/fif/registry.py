"""Plug-in registry. Each investigation module calls @register("PSI-xx") on a function

    build(raw_dir: Path) -> PluginResult

that reads ONLY its own folder data/raw/PSI-xx/ and returns the contract tables.
A plug-in whose raw folder is empty is skipped and reported as 'waiting for data'.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import pandas as pd


@dataclass
class PluginResult:
    tests: pd.DataFrame
    evidence: pd.DataFrame
    issues: pd.DataFrame
    extra_tables: dict[str, pd.DataFrame] = field(default_factory=dict)  # written as-is
    notes: str = ""


PLUGINS: dict[str, Callable[[Path], PluginResult]] = {}
REQUIRED_FILES: dict[str, list[str]] = {}


def register(psi_id: str, required: list[str] | None = None):
    """required: glob patterns that must match in the raw folder before the plug-in runs."""
    def deco(fn):
        PLUGINS[psi_id] = fn
        REQUIRED_FILES[psi_id] = required or ["*"]
        return fn
    return deco


def ready(psi_id: str, raw_dir: Path) -> tuple[bool, list[str]]:
    missing = [pat for pat in REQUIRED_FILES[psi_id] if not any(raw_dir.glob(pat))]
    return (not missing, missing)
