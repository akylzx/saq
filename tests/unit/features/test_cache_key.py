"""D63 — cache-key invariants. Fast, no heavy libs."""

import numpy as np

from qorgauvoice.contracts import AudioClip
from qorgauvoice.features.embed import cache_key

_FP = "facebook/wav2vec2-xls-r-300m@main|pool=mean_std|layers=last|sr=16000"


def _clip(samples: np.ndarray) -> AudioClip:
    return AudioClip(samples=samples.astype(np.float32), sample_rate=16000, source_id="t")


def test_same_content_same_key():
    a = _clip(np.linspace(-1, 1, 16000))
    b = _clip(np.linspace(-1, 1, 16000))
    assert cache_key(a, _FP) == cache_key(b, _FP)


def test_changed_fingerprint_changes_key():
    a = _clip(np.linspace(-1, 1, 16000))
    assert cache_key(a, _FP) != cache_key(a, _FP.replace("sr=16000", "sr=8000"))


def test_changed_content_changes_key():
    a = _clip(np.zeros(16000))
    b = _clip(np.ones(16000))
    assert cache_key(a, _FP) != cache_key(b, _FP)
