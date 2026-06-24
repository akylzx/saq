"""Anti-spoofing metrics (D21). EER is the headline. Labels: 1 = spoof (positive),
0 = bona fide. Scores: model probability of spoof."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.metrics import roc_auc_score, roc_curve


@dataclass(frozen=True)
class EvalResult:
    eer: float
    eer_threshold: float
    auc: float
    accuracy: float
    n: int


def compute_eer(scores, labels) -> tuple[float, float]:
    """Equal Error Rate + the threshold where FAR == FRR."""
    scores = np.asarray(scores, dtype=float)
    labels = np.asarray(labels, dtype=int)
    if len(np.unique(labels)) < 2:
        raise ValueError("EER needs both classes present.")
    fpr, tpr, thresholds = roc_curve(labels, scores)
    fnr = 1.0 - tpr
    idx = int(np.nanargmin(np.abs(fnr - fpr)))
    return float((fpr[idx] + fnr[idx]) / 2.0), float(thresholds[idx])


def threshold_at_fpr(scores, labels, target_fpr: float) -> float:
    """Pick the operating threshold for a target false-positive rate (D24, low-FPR)."""
    scores = np.asarray(scores, dtype=float)
    labels = np.asarray(labels, dtype=int)
    fpr, _tpr, thresholds = roc_curve(labels, scores)
    allowed = np.where(fpr <= target_fpr)[0]
    return float(thresholds[allowed[-1]]) if allowed.size else float(thresholds[0])


def evaluate(scores, labels, threshold: float | None = None) -> EvalResult:
    scores = np.asarray(scores, dtype=float)
    labels = np.asarray(labels, dtype=int)
    eer, eer_threshold = compute_eer(scores, labels)
    try:
        auc = float(roc_auc_score(labels, scores))
    except ValueError:
        auc = float("nan")
    t = eer_threshold if threshold is None else threshold
    preds = (scores >= t).astype(int)
    accuracy = float((preds == labels).mean())
    return EvalResult(eer, eer_threshold, auc, accuracy, int(len(labels)))
