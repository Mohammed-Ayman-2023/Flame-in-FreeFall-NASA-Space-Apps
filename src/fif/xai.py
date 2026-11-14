"""Local explanations: why the model gave THIS prediction.

Exact Shapley values (the quantity SHAP estimates), computed by enumerating every coalition of a handful of
inputs, so no sampling and no extra package. For a prediction f(x) and a reference r (a single reference row or
a background sample), the value of a coalition S is the average prediction when the inputs in S take the query's
values and the rest take the reference's values ("interventional" Shapley). The contributions add up exactly to
f(x) minus the reference prediction (the efficiency property, checked in tests/test_xai.py).
"""
from __future__ import annotations

from itertools import combinations
from math import factorial

import numpy as np
import pandas as pd


def exact_shapley(f, x: pd.Series, reference: pd.DataFrame, players: dict[str, list[str]]) -> tuple[float, dict]:
    """Return (reference value, {player: contribution}). f maps a DataFrame of raw inputs to an array.

    All 2^n coalitions are stacked into one frame and scored in a single call to f, so the cost is one model call
    on 2^n x len(reference) rows.
    """
    names = list(players)
    n = len(names)
    ref = reference.reset_index(drop=True)
    subsets = [frozenset(c) for k in range(n + 1) for c in combinations(names, k)]
    frames = []
    for S in subsets:
        frame = ref.copy()
        for p_ in S:
            for col in players[p_]:
                frame[col] = x[col]
        frames.append(frame)
    pred = np.asarray(f(pd.concat(frames, ignore_index=True)), dtype=float).reshape(len(subsets), len(ref))
    value = {S: float(v) for S, v in zip(subsets, pred.mean(axis=1))}
    phi = {}
    for name in names:
        others = [nm for nm in names if nm != name]
        tot = 0.0
        for k in range(n):
            w = factorial(k) * factorial(n - k - 1) / factorial(n)
            for S in combinations(others, k):
                S = frozenset(S)
                tot += w * (value[S | {name}] - value[S])
        phi[name] = tot
    return value[frozenset()], phi


def loglinear_contributions(coef: dict[str, float], x: dict, ref: dict, groups: dict[str, list[str]]) -> dict:
    """For a model linear in log-time (Weibull AFT), each input's exact multiplicative effect vs the reference."""
    return {g: float(np.exp(sum(coef[c] * (x[c] - ref[c]) for c in cols))) for g, cols in groups.items()}
