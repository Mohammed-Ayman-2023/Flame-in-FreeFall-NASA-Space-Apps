"""Build the ML-ready tables (ml/v0/) from data/processed/. Run build_data.py first."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from fif.ml_tables import run  # noqa: E402

out = run()
for k in ("A", "A1g", "B", "C", "Csim", "D"):
    df = out[k]
    ready = int(df["ready_for_model"].sum()) if "ready_for_model" in df else len(df)
    print(f"{k:5s} rows={len(df):4d} ready={ready}")
print(out["stats"])
