"""D64 — LightGBM fit/predict + save/load roundtrip on synthetic embeddings (no backbone)."""

import numpy as np

from qorgauvoice.eval.metrics import evaluate
from qorgauvoice.models.lgbm import LgbmClassifier
from qorgauvoice.testing import FakeEmbeddingExtractor
from qorgauvoice.contracts import AudioClip


def _separable_dataset(n=120, dim=32, seed=0):
    rng = np.random.default_rng(seed)
    x0 = rng.standard_normal((n, dim)) - 1.5
    x1 = rng.standard_normal((n, dim)) + 1.5
    X = np.vstack([x0, x1]).astype(np.float32)
    y = np.array([0] * n + [1] * n)
    return X, y


def test_fit_returns_new_instance_and_predicts():
    X, y = _separable_dataset()
    clf = LgbmClassifier({"n_estimators": 50, "verbose": -1})
    fitted = clf.fit(X, y)
    assert fitted is not clf  # immutability (D34)
    proba = fitted.predict_proba(X)
    assert proba.shape == (len(y),)
    assert evaluate(proba, y).auc > 0.95


def test_save_load_roundtrip(tmp_path):
    X, y = _separable_dataset()
    fitted = LgbmClassifier({"n_estimators": 50, "verbose": -1}).fit(X, y)
    path = tmp_path / "lgbm.txt"
    fitted.save(path)
    loaded = LgbmClassifier.load(path)
    np.testing.assert_allclose(fitted.predict_proba(X), loaded.predict_proba(X), rtol=1e-6)


def test_fake_extractor_is_deterministic():
    ex = FakeEmbeddingExtractor(dim=16)
    clip = AudioClip(samples=np.ones(8000, dtype=np.float32), sample_rate=16000, source_id="x")
    np.testing.assert_array_equal(ex.embed(clip), ex.embed(clip))
    assert ex.embed(clip).shape == (16,)
