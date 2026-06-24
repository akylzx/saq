"""Classifier registry (D43) — single swap point: config.classifier.kind → instance."""

from __future__ import annotations

from saq.config.app import AppConfig


def build_classifier(config: AppConfig):
    kind = config.classifier.kind
    if kind == "lgbm":
        from saq.models.lgbm import LgbmClassifier

        return LgbmClassifier(config.classifier.lgbm_params)
    if kind == "mlp":
        from saq.models.mlp import MlpClassifier

        return MlpClassifier(config.classifier.mlp_params)
    raise ValueError(f"Unknown classifier kind: {kind!r}.")
