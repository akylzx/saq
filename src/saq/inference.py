"""Inference service (D25). A `Detector` turns a validated AudioClip into a verdict.
Decoupled from concretes (testable with FakeEmbeddingExtractor); `load_detector` is the
factory that wires the real backbone + trained classifier + calibrated threshold."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from saq.config.app import AppConfig
from saq.contracts import AudioClip, Classifier, EmbeddingExtractor


@dataclass(frozen=True)
class Verdict:
    label: str  # "bona_fide" | "spoof"
    spoof_prob: float
    confidence: float  # probability of the chosen label, in [0, 1]
    threshold: float


class Detector:
    def __init__(self, extractor: EmbeddingExtractor, classifier: Classifier, threshold: float):
        self._extractor = extractor
        self._classifier = classifier
        self._threshold = threshold

    def predict(self, clip: AudioClip) -> Verdict:
        embedding = self._extractor.embed(clip)
        prob = float(self._classifier.predict_proba(embedding.reshape(1, -1))[0])
        label = "spoof" if prob >= self._threshold else "bona_fide"
        confidence = prob if label == "spoof" else 1.0 - prob
        return Verdict(label=label, spoof_prob=prob, confidence=confidence, threshold=self._threshold)


def load_detector(config: AppConfig) -> Detector:
    """Wire the real backbone + LightGBM model + calibrated threshold (composition root helper)."""
    from saq.features.backbone import Wav2Vec2Extractor
    from saq.models.lgbm import LgbmClassifier

    artifacts = Path(config.paths.artifacts_dir)
    extractor = Wav2Vec2Extractor(config)
    classifier = LgbmClassifier.load(artifacts / "models" / "lgbm.txt")

    calibrator = json.loads((artifacts / "models" / "calibrator.json").read_text())
    threshold = float(calibrator.get("threshold", 0.5))
    # Guard against the degenerate threshold from perfectly-separable data (§0 caveat): on
    # this data the FPR-tuned threshold collapses to ~0 (or ~1), which mislabels everything.
    # Scores are cleanly bimodal (~0 vs ~1), so fall back to 0.5 when it's clearly degenerate.
    if not 0.01 < threshold < 0.99:
        threshold = 0.5
    return Detector(extractor, classifier, threshold)
