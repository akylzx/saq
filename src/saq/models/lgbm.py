"""LightGBM classifier (D7, D41). Primary model: trains in seconds, native SHAP.
`fit` returns a NEW fitted instance (D34). Persisted as native text — no pickle (D52)."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from saq.contracts import FloatArray, IntArray


class LgbmClassifier:
    def __init__(self, params: dict | None = None) -> None:
        self._params = dict(params or {})
        self._booster = None

    def fit(self, X: FloatArray, y: IntArray) -> "LgbmClassifier":
        import lightgbm as lgb

        clf = lgb.LGBMClassifier(**self._params)
        clf.fit(np.asarray(X), np.asarray(y))
        fitted = LgbmClassifier(self._params)
        fitted._booster = clf.booster_  # binary objective → predict() gives P(class 1)
        return fitted

    def predict_proba(self, X: FloatArray) -> FloatArray:
        if self._booster is None:
            raise RuntimeError("LgbmClassifier is not fitted.")
        return np.asarray(self._booster.predict(np.asarray(X)), dtype=float)

    def save(self, path: str | Path) -> None:
        if self._booster is None:
            raise RuntimeError("Cannot save an unfitted LgbmClassifier.")
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._booster.save_model(str(path))  # text format (D52)

    @classmethod
    def load(cls, path: str | Path) -> "LgbmClassifier":
        import lightgbm as lgb

        obj = cls()
        obj._booster = lgb.Booster(model_file=str(path))
        return obj
