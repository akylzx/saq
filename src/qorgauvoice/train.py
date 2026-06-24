"""P3 — train + EER (D7/D21-D24). Reads the cached feature matrix (features.npz from
build_features.py), fits the classifier on `train`, picks a low-FPR threshold, reports
EER/AUC/accuracy per split, and saves the model + calibrator (non-pickle, D52).

IMPORTANT: this process must NOT import torch (OpenMP clash with LightGBM → segfault on
macOS). Run feature extraction separately via `build_features.py` first.

Run: `uv run python -m qorgauvoice.build_features && uv run python -m qorgauvoice.train`
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np

from qorgauvoice.config import load_config
from qorgauvoice.eval.metrics import evaluate, threshold_at_fpr
from qorgauvoice.models.registry import build_classifier

log = logging.getLogger("train")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    config = load_config()
    artifacts = Path(config.paths.artifacts_dir)

    features_path = artifacts / "features.npz"
    if not features_path.exists():
        raise FileNotFoundError(
            f"{features_path} not found — run `python -m qorgauvoice.build_features` first."
        )
    data = np.load(features_path, allow_pickle=False)
    X, y, split = data["X"], data["y"], data["split"]
    X_deg = data["X_deg"] if "X_deg" in data.files else None

    train_mask = split == "train"
    # D15: train on clean ∪ degraded so the model is codec/noise-robust (off the channel shortcut)
    if X_deg is not None:
        X_train = np.vstack([X[train_mask], X_deg[train_mask]])
        y_train = np.concatenate([y[train_mask], y[train_mask]])
    else:
        X_train, y_train = X[train_mask], y[train_mask]

    classifier = build_classifier(config).fit(X_train, y_train)
    threshold = threshold_at_fpr(
        classifier.predict_proba(X[train_mask]), y[train_mask], config.eval.target_fpr
    )

    models_dir = artifacts / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    classifier.save(models_dir / "lgbm.txt")
    (models_dir / "calibrator.json").write_text(
        json.dumps({"threshold": float(threshold), "target_fpr": config.eval.target_fpr}, indent=2)
    )

    conditions: dict[str, np.ndarray] = {"clean": X}
    if X_deg is not None:
        conditions["degraded"] = X_deg

    # The held-out real clips live in `test_same`; reuse them as the bona fide negatives
    # for the unseen-TTS evaluation (whose rows are unseen-engine spoofs only).
    def eval_mask(split_name: str) -> np.ndarray:
        if split_name == "test_unseen":
            return (split == "test_unseen") | ((split == "test_same") & (y == 0))
        return split == split_name

    print("\n=== RESULTS (threshold=%.3f @ FPR<=%.2f) ===" % (threshold, config.eval.target_fpr))
    print(f"{'split':12s}{'condition':11s}{'n':>5s}  {'EER':>6s}  {'AUC':>6s}  {'acc':>6s}")
    for split_name in ("train", "test_same", "test_unseen"):
        mask = eval_mask(split_name)
        if mask.sum() == 0 or len(np.unique(y[mask])) < 2:
            print(f"{split_name:12s}{'-':11s}(skipped - insufficient data)")
            continue
        for cond_name, feats in conditions.items():
            res = evaluate(classifier.predict_proba(feats[mask]), y[mask], threshold=threshold)
            print(
                f"{split_name:12s}{cond_name:11s}{res.n:5d}  "
                f"{res.eer:6.3f}  {res.auc:6.3f}  {res.accuracy:6.3f}"
            )


if __name__ == "__main__":
    main()
