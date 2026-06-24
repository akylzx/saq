"""D64 — Detector verdict logic with fakes (no torch, no LightGBM)."""

import numpy as np

from saq.contracts import AudioClip
from saq.inference import Detector, Verdict
from saq.testing import FakeEmbeddingExtractor


class _StubClassifier:
    """Returns a fixed spoof probability regardless of input."""

    def __init__(self, prob: float):
        self._prob = prob

    def predict_proba(self, X):
        return np.full(len(X), self._prob, dtype=float)


def _clip():
    return AudioClip(samples=np.ones(16000, dtype=np.float32), sample_rate=16000, source_id="t")


def test_high_prob_yields_spoof():
    det = Detector(FakeEmbeddingExtractor(dim=8), _StubClassifier(0.9), threshold=0.5)
    v = det.predict(_clip())
    assert isinstance(v, Verdict)
    assert v.label == "spoof"
    assert v.confidence == 0.9


def test_low_prob_yields_bona_fide_with_inverted_confidence():
    det = Detector(FakeEmbeddingExtractor(dim=8), _StubClassifier(0.1), threshold=0.5)
    v = det.predict(_clip())
    assert v.label == "bona_fide"
    assert v.confidence == 0.9  # 1 - 0.1


def test_threshold_boundary_is_spoof():
    det = Detector(FakeEmbeddingExtractor(dim=8), _StubClassifier(0.5), threshold=0.5)
    assert det.predict(_clip()).label == "spoof"
