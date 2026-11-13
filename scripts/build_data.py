"""Build the Phase 1 data layer.

    python scripts/build_data.py              # every investigation whose files are present
    python scripts/build_data.py PSI-25       # just one (or several)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from fif.build import run  # noqa: E402

if __name__ == "__main__":
    run(only=sys.argv[1:] or None)
