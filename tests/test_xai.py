import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from fif.xai import exact_shapley, loglinear_contributions  # noqa: E402


def test_shapley_sums_to_prediction_and_matches_linear():
    f = lambda d: 2 * d.a + 3 * d.b - d.c + d.a * d.b  # noqa: E731
    x = pd.Series(dict(a=1.0, b=2.0, c=5.0))
    ref = pd.DataFrame([dict(a=0.0, b=0.0, c=0.0)])
    base, phi = exact_shapley(f, x, ref, {"a": ["a"], "b": ["b"], "c": ["c"]})
    pred = float(f(pd.DataFrame([x]))[0])
    assert abs(base + sum(phi.values()) - pred) < 1e-9
    assert abs(phi["c"] - (-5.0)) < 1e-9            # additive term: exact
    assert abs(phi["a"] - (2 + 1.0)) < 1e-9         # interaction a*b = 2 split equally


def test_grouped_players_and_background():
    f = lambda d: d.a + d.b  # noqa: E731
    x = pd.Series(dict(a=3.0, b=4.0))
    bg = pd.DataFrame(dict(a=[0.0, 2.0], b=[1.0, 1.0]))
    base, phi = exact_shapley(f, x, bg, {"both": ["a", "b"]})
    assert abs(base - 2.0) < 1e-9 and abs(phi["both"] - 5.0) < 1e-9


def test_loglinear():
    r = loglinear_contributions({"x": np.log(2)}, {"x": 3}, {"x": 1}, {"x": ["x"]})
    assert abs(r["x"] - 4.0) < 1e-9
