"""Embedding cache key (D54). Content-hash of normalized audio ⊕ extractor fingerprint
→ automatic invalidation on any backbone/pooling/sr change."""

from __future__ import annotations

import hashlib

import numpy as np

from qorgauvoice.contracts import AudioClip


def _normalized_bytes(clip: AudioClip) -> bytes:
    return np.ascontiguousarray(clip.samples, dtype=np.float32).tobytes()


def cache_key(clip: AudioClip, extractor_fingerprint: str) -> str:
    """sha256(normalized_audio_bytes) ⊕ fingerprint (D54)."""
    h = hashlib.sha256()
    h.update(_normalized_bytes(clip))
    h.update(b"|")
    h.update(extractor_fingerprint.encode("utf-8"))
    return h.hexdigest()
