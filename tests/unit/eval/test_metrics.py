"""D63 — EER known cases."""

import numpy as np
import pytest

from saq.eval.metrics import compute_eer, evaluate, threshold_at_fpr


def test_perfect_separation_eer_zero():
    scores = np.array([0.1, 0.2, 0.8, 0.9])
    labels = np.array([0, 0, 1, 1])
    eer, _ = compute_eer(scores, labels)
    assert eer == pytest.approx(0.0, abs=1e-9)


def test_random_constant_scores_eer_half():
    scores = np.full(100, 0.5)
    labels = np.array([0, 1] * 50)
    eer, _ = compute_eer(scores, labels)
    assert eer == pytest.approx(0.5, abs=0.05)


def test_single_class_raises():
    with pytest.raises(ValueError):
        compute_eer(np.array([0.1, 0.2]), np.array([1, 1]))


def test_evaluate_reports_high_auc_for_separable():
    scores = np.array([0.05, 0.1, 0.2, 0.85, 0.9, 0.95])
    labels = np.array([0, 0, 0, 1, 1, 1])
    res = evaluate(scores, labels)
    assert res.auc == pytest.approx(1.0, abs=1e-9)
    assert res.accuracy == pytest.approx(1.0, abs=1e-9)
    assert res.n == 6


def test_threshold_at_low_fpr_is_high():
    scores = np.array([0.1, 0.2, 0.3, 0.7, 0.8, 0.9])
    labels = np.array([0, 0, 0, 1, 1, 1])
    t = threshold_at_fpr(scores, labels, target_fpr=0.0)
    assert t > 0.3
