#!/usr/bin/env python3
"""
Offline ML pipeline for OmniTuner's chord-finder ergonomics model.

Trains a *linear* model on the pinned voicings a user exported from the app
(`training_data.json`, produced by the "export ML data" button) plus a batch
of synthesized "awkward / impossible" negatives, then writes the trained
coefficients as a JSON weight payload that the Angular app consumes
(`src/assets/ml_weights.json`).

Why a linear model?
    scoreErgonomics() in ergonomics.ts is a linear combination of
    ErgonomicsFeatures with a fixed weight set. A linear model's `coef_`
    vector maps 1:1 onto those weights, so we can export it directly as a
    drop-in override — no architectural change needed in the app.

Fallback:
    If the training data is missing, has fewer than MIN_PINS pins, or training
    fails for any reason, the script writes the shipped defaults
    (BASE_ERGONOMICS_WEIGHTS) so the app never loads a broken payload.

Usage:
    python scripts/train_model.py [path/to/training_data.json]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

# ─────────────────────────────────────────────────────────────────────────────
# Shipped defaults — mirror of BASE_ERGONOMICS_WEIGHTS in
# src/app/utils/ergonomics.ts. Written as the fallback payload and used as the
# starting point for any weight the model does not produce.
# ─────────────────────────────────────────────────────────────────────────────
BASE_ERGONOMICS_WEIGHTS: dict[str, float] = {
    "positionPerFret": 0.4,
    "spanPerFret": 0.6,
    "indexSpanPerFret": 0.8,
    "stretchPerFret": 1.0,
    "barrePerBarre": 2.0,
    "barreWidthPerString": 0.5,
    "barreHighFret": 3.0,
    "openPerString": -1.0,
    "doublingPerTone": -0.5,
    "rootDoubleBonus": -0.75,
    "bassNotRoot": 1.5,
    "bassStringPerString": 0.25,
    "stringSkip": 2.5,
    "thumbFretting": 4.0,
    "stretchExponent": 2.0,
    "fretWidthRate": 0.05,
}

# How many pinned voicings are needed before we trust a trained model.
MIN_PINS = 20
# Number of synthesized negative samples ("impossible / awkward" shapes).
NEGATIVE_SAMPLES = 5000

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = PROJECT_ROOT / "src" / "assets" / "ml_weights.json"
DEFAULT_DATA_PATH = PROJECT_ROOT / "training_data.json"

# Feature columns the model is trained on. Every coefficient maps to a key in
# ErgonomicsWeights (see WEIGHT_KEY_MAP below). Booleans are 0/1 floats.
FEATURE_COLUMNS: list[str] = [
    "position",
    "span",
    "indexSpan",
    "stretchSpan",
    "barreCount",
    "maxBarreWidth",
    "barreAtHighFret",
    "openCount",
    "bassString",
    "bassIsRoot",
    "rootDoubled",
    "thirdDoubled",
    "fifthDoubled",
    "noteCount",
    "fingeredCount",
    "maxSpan",
    "hasStringSkip",
    "hasThumbFret",
]

# Maps a feature column to the ErgonomicsWeights key its coefficient feeds.
# Not every weight is produced by a feature (e.g. stretchExponent,
# fretWidthRate are structural and keep their defaults).
WEIGHT_KEY_MAP: dict[str, str] = {
    "position": "positionPerFret",
    "span": "spanPerFret",
    "indexSpan": "indexSpanPerFret",
    "stretchSpan": "stretchPerFret",
    "barreCount": "barrePerBarre",
    "maxBarreWidth": "barreWidthPerString",
    "barreAtHighFret": "barreHighFret",
    "openCount": "openPerString",
    "bassString": "bassStringPerString",
    "bassIsRoot": "bassNotRoot",
    "rootDoubled": "rootDoubleBonus",
    "hasStringSkip": "stringSkip",
    "hasThumbFret": "thumbFretting",
}


def load_positive_samples(path: Path) -> list[dict[str, float]]:
    """Read the exported pins and return their ErgonomicsFeatures dicts."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    pins = raw.get("pins", []) if isinstance(raw, dict) else raw
    samples: list[dict[str, float]] = []
    for pin in pins:
        features = pin.get("features") if isinstance(pin, dict) else None
        if isinstance(features, dict):
            samples.append({k: float(v) for k, v in features.items()})
    return samples


def synthesize_negatives(
    positives: list[dict[str, float]], rng: np.random.Generator, count: int
) -> list[dict[str, float]]:
    """
    Generate negative samples (y = 0) that represent "awkward or impossible"
    voicings by PERTURBING the real pinned positives.

    Why perturb instead of uniform-random? A uniform random draw over the full
    feature space rarely overlaps the region real players pin, so the model
    learns "big numbers = bad" and collapses once real data is added. By
    starting from a real pinned shape and pushing the hand-stress axes upward,
    every negative is *close* to a positive — the model must learn exactly
    which axes make a voicing awkward:

      - span / stretchSpan / maxSpan  -> +1..3 frets (wider stretch)
      - fingeredCount                 -> 4-5 (more independent fingers)
      - barreCount / maxBarreWidth    -> more / wider barres
      - barreAtHighFret               -> pushed true ~60% of the time
      - hasStringSkip / hasThumbFret  -> forced true ~50% of the time
      - every other feature           -> jittered slightly around the pin
    """
    if not positives:
        return []
    samples: list[dict[str, float]] = []
    for _ in range(count):
        base = positives[rng.integers(0, len(positives))]
        sample = dict(base)
        sample["span"] = float(min(12.0, base["span"] + rng.integers(1, 4)))
        sample["stretchSpan"] = float(min(9.0, base["stretchSpan"] + rng.integers(1, 4)))
        sample["maxSpan"] = float(min(12.0, base["maxSpan"] + rng.integers(1, 4)))
        sample["fingeredCount"] = float(rng.integers(4, 6))
        sample["barreCount"] = float(min(3.0, base["barreCount"] + rng.integers(0, 2)))
        sample["maxBarreWidth"] = float(min(7.0, base["maxBarreWidth"] + rng.integers(0, 3)))
        sample["barreAtHighFret"] = float(rng.random() < 0.6)
        sample["hasStringSkip"] = float(rng.random() < 0.5)
        sample["hasThumbFret"] = float(rng.random() < 0.5)
        # Jitter the remaining numeric features slightly so the negatives
        # aren't exact duplicates of a positive.
        for key in ("position", "indexSpan", "openCount", "bassString", "noteCount"):
            sample[key] = float(
                max(0, int(base[key]) + int(rng.integers(-1, 2)))
            )
        for key in ("bassIsRoot", "rootDoubled", "thirdDoubled", "fifthDoubled"):
            sample[key] = float(rng.random() < 0.5)
        samples.append(sample)
    return samples


def build_frame(positives: list[dict[str, float]], negatives: list[dict[str, float]]) -> pd.DataFrame:
    """Combine positives + negatives into a single DataFrame, y included."""
    rows = [dict(sample) for sample in positives]
    for negative in negatives:
        row = dict(negative)
        rows.append(row)
    df = pd.DataFrame(rows, columns=FEATURE_COLUMNS)
    df = df.fillna(0.0)  # A real pin may lack a key the schema expects.
    y = np.concatenate([np.ones(len(positives)), np.zeros(len(negatives))])
    return df, y


def train_and_map_weights(df: pd.DataFrame, y: np.ndarray) -> dict[str, float]:
    """
    Train a logistic regression and map its coefficients back onto the
    ErgonomicsWeights shape. Features are standardized first so the
    coefficients are directly comparable to the app's linear weights.
    """
    scaler = StandardScaler()
    X = scaler.fit_transform(df[FEATURE_COLUMNS].to_numpy(dtype=float))

    model = LogisticRegression(max_iter=2000, C=1.0)
    model.fit(X, y)

    weights = dict(BASE_ERGONOMICS_WEIGHTS)  # Start from defaults.
    for column, coef in zip(FEATURE_COLUMNS, model.coef_[0]):
        weight_key = WEIGHT_KEY_MAP.get(column)
        if weight_key is None:
            continue
        # The app's weight acts on the *raw* feature, so un-scale: a feature
        # with large variance needs a smaller coefficient to matter equally.
        scale = scaler.scale_[FEATURE_COLUMNS.index(column)]
        weights[weight_key] = float(coef) / scale if scale else float(coef)
    return enforce_heuristic_signs(weights)


# Physical direction each weight must keep. A positive coefficient means the
# feature ADDS cost (penalty); a negative one means it REDUCES cost (bonus).
# The model may tune the magnitude, but it must never learn that a wider
# stretch is *easier* — that would be a physical impossibility.
PENALTY_WEIGHTS = {
    "positionPerFret",
    "spanPerFret",
    "indexSpanPerFret",
    "stretchPerFret",
    "barrePerBarre",
    "barreWidthPerString",
    "barreHighFret",
    "bassNotRoot",
    "bassStringPerString",
    "stringSkip",
    "thumbFretting",
}
BONUS_WEIGHTS = {
    "openPerString",
    "doublingPerTone",
    "rootDoubleBonus",
}

# How much the trained coefficient is trusted vs. the shipped heuristic.
# 1.0 = use the trained value fully; 0.0 = keep the heuristic default.
SHRINKAGE = 0.7


def enforce_heuristic_signs(weights: dict[str, float]) -> dict[str, float]:
    """
    Clamp trained coefficients to the physical direction the heuristic knows:
    penalties stay >= 0, bonuses stay <= 0. Magnitudes are free (that is what
    the data teaches); the sign is a hard physical constraint.

    A coefficient the data cannot support (sign flipped, or shrunk toward 0)
    is blended back toward the shipped default so a weak signal degrades
    gracefully instead of zeroing a penalty the heuristic knows matters.
    """
    for key in PENALTY_WEIGHTS:
        trained = weights[key]
        if trained < 0:
            trained = 0.0
        weights[key] = SHRINKAGE * trained + (1 - SHRINKAGE) * BASE_ERGONOMICS_WEIGHTS[key]
    for key in BONUS_WEIGHTS:
        trained = weights[key]
        if trained > 0:
            trained = 0.0
        weights[key] = SHRINKAGE * trained + (1 - SHRINKAGE) * BASE_ERGONOMICS_WEIGHTS[key]
    return weights


def write_payload(weights: dict[str, float], source: str) -> None:
    payload = {
        "version": 1,
        "source": source,
        "weights": weights,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"[train_model] wrote {source} weights -> {OUTPUT_PATH}")


def main() -> int:
    data_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATA_PATH

    if not data_path.exists():
        print(f"[train_model] {data_path} not found — writing fallback weights.", file=sys.stderr)
        write_payload(BASE_ERGONOMICS_WEIGHTS, "fallback")
        return 0

    try:
        positives = load_positive_samples(data_path)
        if len(positives) < MIN_PINS:
            print(
                f"[train_model] only {len(positives)} pins (< {MIN_PINS}) — writing fallback weights.",
                file=sys.stderr,
            )
            write_payload(BASE_ERGONOMICS_WEIGHTS, "fallback")
            return 0

        rng = np.random.default_rng(42)
        negatives = synthesize_negatives(positives, rng, NEGATIVE_SAMPLES)
        df, y = build_frame(positives, negatives)
        weights = train_and_map_weights(df, y)
        write_payload(weights, "ml")
        return 0
    except Exception as exc:  # noqa: BLE001 — fallback must never crash the pipeline
        print(f"[train_model] training failed ({exc}) — writing fallback weights.", file=sys.stderr)
        write_payload(BASE_ERGONOMICS_WEIGHTS, "fallback")
        return 0


if __name__ == "__main__":
    sys.exit(main())
