"""Train the v1 models (models/v1/) from ml/v1/. Run build_ml.py first."""
import json
import sys
import warnings
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
warnings.filterwarnings("ignore")

from fif.models import run  # noqa: E402

print(json.dumps(run(), indent=2, default=str))
