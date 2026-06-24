"""FakeEmbeddingExtractor (D62) — deterministic embeddings from clip content, no torch.
Lets models/eval/explain be built and tested before the real backbone cache exists."""

from __future__ import annotations

import hashlib
from typing import Sequence

import numpy as np

from qorgauvoice.contracts import AudioClip, FloatArray


class FakeEmbeddingExtractor:
    """Implements the EmbeddingExtractor protocol with cheap, deterministic vectors."""

    def __init__(self, dim: int = 32) -> None:
        self._dim = dim

    @property
    def dim(self) -> int:
        return self._dim

    @property
    def fingerprint(self) -> str:
        return f"fake|dim={self._dim}"

    def _seed(self, clip: AudioClip) -> int:
        digest = hashlib.sha256(np.ascontiguousarray(clip.samples, dtype=np.float32).tobytes())
        return int.from_bytes(digest.digest()[:8], "big")

    def embed(self, audio: AudioClip) -> FloatArray:
        return self.embed_batch([audio])[0]

    def embed_batch(self, clips: Sequence[AudioClip]) -> FloatArray:
        vecs = [
            np.random.default_rng(self._seed(c)).standard_normal(self._dim).astype(np.float32)
            for c in clips
        ]
        return np.stack(vecs)
