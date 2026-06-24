"""SSL backbone extractor (D6, D40). Lazy singleton: weights load on first `embed`
call, not at import (D55), so the deterministic test suite never pulls 1.2 GB."""

from __future__ import annotations

from typing import Sequence

import numpy as np

from saq.config.app import AppConfig
from saq.contracts import AudioClip, FloatArray


def device_for(prefer: str, allow_cpu_fallback: bool) -> str:
    """Pick the torch device (D5/D55)."""
    import torch

    if prefer == "mps" and torch.backends.mps.is_available():
        return "mps"
    if prefer == "cuda" and torch.cuda.is_available():
        return "cuda"
    if allow_cpu_fallback:
        return "cpu"
    raise RuntimeError(f"Device '{prefer}' unavailable and CPU fallback disabled.")


def pool(hidden: np.ndarray, pooling: str) -> FloatArray:
    """Pool frame embeddings (T, H) → (H,) or (2H,). Pure function (testable)."""
    mean = hidden.mean(axis=0)
    if pooling == "mean":
        return mean.astype(np.float32)
    if pooling == "mean_std":
        std = hidden.std(axis=0)
        return np.concatenate([mean, std]).astype(np.float32)
    raise ValueError(f"Unknown pooling '{pooling}'.")


class Wav2Vec2Extractor:
    """Implements the EmbeddingExtractor protocol (D40)."""

    def __init__(self, config: AppConfig) -> None:
        self._cfg = config
        self._bk = config.backbone
        self._device: str | None = None
        self._model = None
        self._fe = None

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return
        from transformers import AutoFeatureExtractor, Wav2Vec2Model

        self._device = device_for(self._cfg.device.prefer, self._cfg.device.allow_cpu_fallback)
        self._fe = AutoFeatureExtractor.from_pretrained(
            self._bk.model_id, revision=self._bk.revision
        )
        self._model = (
            Wav2Vec2Model.from_pretrained(self._bk.model_id, revision=self._bk.revision)
            .to(self._device)
            .eval()
        )

    @property
    def dim(self) -> int:
        self._ensure_loaded()
        hidden = self._model.config.hidden_size
        return hidden * (2 if self._bk.pooling == "mean_std" else 1)

    @property
    def fingerprint(self) -> str:
        bk = self._bk
        return (
            f"{bk.model_id}@{bk.revision}|pool={bk.pooling}"
            f"|layers={bk.layers}|sr={self._cfg.runtime.sample_rate}"
        )

    def embed(self, audio: AudioClip) -> FloatArray:
        return self.embed_batch([audio])[0]

    def embed_batch(self, clips: Sequence[AudioClip]) -> FloatArray:
        if not clips:
            raise ValueError("embed_batch received an empty clip sequence.")
        self._ensure_loaded()
        import torch

        sr = self._cfg.runtime.sample_rate
        inputs = self._fe(
            [np.asarray(c.samples, dtype=np.float32) for c in clips],
            sampling_rate=sr,
            return_tensors="pt",
            padding=True,
        )
        with torch.inference_mode():
            hidden = self._model(inputs.input_values.to(self._device)).last_hidden_state
        arr = hidden.float().cpu().numpy()  # (B, T, H)
        return np.stack([pool(arr[i], self._bk.pooling) for i in range(arr.shape[0])])
