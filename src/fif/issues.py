"""One issue log format for every investigation."""
from __future__ import annotations

from dataclasses import asdict, dataclass

import pandas as pd

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


@dataclass
class Issue:
    investigation_id: str
    dataset: str
    severity: str  # high = changes a result if ignored; medium = needs a decision; low = info
    check: str
    detail: str
    action: str


class IssueLog:
    def __init__(self, investigation_id: str) -> None:
        self.investigation_id = investigation_id
        self.items: list[Issue] = []

    def add(self, dataset: str, severity: str, check: str, detail: str, action: str) -> None:
        self.items.append(Issue(self.investigation_id, dataset, severity, check, detail, action))

    def frame(self) -> pd.DataFrame:
        cols = list(Issue.__dataclass_fields__)
        df = pd.DataFrame([asdict(i) for i in self.items], columns=cols)
        return df.sort_values("severity", key=lambda s: s.map(SEVERITY_ORDER), kind="stable")
