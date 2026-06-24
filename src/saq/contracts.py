"""Core contracts (D40-D42). Structural Protocols so concretes need no inheritance
and tests can pass plain fakes. Only light imports (numpy) — no torch/transformers here."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, Sequence, runtime_checkable

import numpy as np

FloatArray = np.ndarray
IntArray = np.ndarray


@dataclass(frozen=True)
class AudioClip:
    """Validated, decoded audio. Immutable (D34). Produced only by the audio-io gate (D49).

    samples: float32, mono, shape (n_samples,)
    """

    samples: np.ndarray
    sample_rate: int
    source_id: str


@runtime_checkable
class EmbeddingExtractor(Protocol):
    """D40 — decouples classifiers from the SSL backbone. Never reads files."""

    @property
    def dim(self) -> int: ...

    @property
    def fingerprint(self) -> str:
        """Backbone id + pooling + revision + sr → cache-key salt (D54)."""
        ...

    def embed(self, audio: AudioClip) -> FloatArray:
        """(dim,) for one clip."""
        ...

    def embed_batch(self, clips: Sequence[AudioClip]) -> FloatArray:
        """(n, dim) for a batch."""
        ...


@runtime_checkable
class Classifier(Protocol):
    """D41 — LightGBM / MLP / AASIST-pooled all satisfy this. `fit` returns a NEW
    fitted instance (D34), never mutates self."""

    def fit(self, X: FloatArray, y: IntArray) -> "Classifier": ...

    def predict_proba(self, X: FloatArray) -> FloatArray:
        """(n,) calibrated-input probability of spoof (class 1)."""
        ...

    def save(self, path: Path) -> None: ...

    @classmethod
    def load(cls, path: Path) -> "Classifier": ...
