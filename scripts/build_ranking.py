"""Rank investigations for the habitat atmosphere and build the gap map (reports/ranking/)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import pandas as pd  # noqa: E402

from fif.ranking import run  # noqa: E402

pd.set_option("display.width", 250)
pd.set_option("display.max_colwidth", 70)
res = run()
print(res["ranking"][["rank", "psi_id", "acronym", "fire_type", "data_level", "n_tests", "n_near_mission",
                      "closest_condition", "score_atmosphere", "relevance"]].to_string(index=False))
print()
print(res["gaps"].to_string(index=False))
