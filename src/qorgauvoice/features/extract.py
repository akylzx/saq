"""Embedding extraction with content-hash cache (D54). Loads each manifest clip through
the validation gate, trims to clip_seconds_max, embeds (batched), and caches .npy per key
(D52 non-pickle). Returns the feature matrix + labels aligned with the manifest order."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd

from qorgauvoice.config.app import AppConfig
from qorgauvoice.contracts import AudioClip, EmbeddingExtractor
from qorgauvoice.data.audio_io import load_validated_file
from qorgauvoice.features.embed import cache_key

Transform = Callable[[AudioClip], AudioClip]

log = logging.getLogger("extract")

LABEL_TO_INT = {"bona_fide": 0, "spoof": 1}


def _cache_path(config: AppConfig, key: str) -> Path:
    return Path(config.paths.cache_dir) / "embeddings" / f"{key}.npy"


def _load_clip(path: str, config: AppConfig) -> AudioClip:
    clip = load_validated_file(path, config)
    max_len = int(config.data.clip_seconds_max * clip.sample_rate)
    if clip.samples.shape[0] > max_len:
        return AudioClip(clip.samples[:max_len], clip.sample_rate, clip.source_id)
    return clip


def embed_manifest(
    df: pd.DataFrame,
    extractor: EmbeddingExtractor,
    config: AppConfig,
    transform: Transform | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Embed every manifest clip. An optional `transform` (e.g. degrade) is applied to the
    audio before hashing+embedding, so its cache key naturally differs from the clean clip."""
    fingerprint = extractor.fingerprint
    embeddings: list[np.ndarray | None] = [None] * len(df)
    pending_idx: list[int] = []
    pending_clips: list[AudioClip] = []
    pending_paths: list[Path] = []

    for i, path in enumerate(df["path"].tolist()):
        clip = _load_clip(path, config)
        if transform is not None:
            clip = transform(clip)
        key = cache_key(clip, fingerprint)
        cache_file = _cache_path(config, key)
        if cache_file.exists():
            embeddings[i] = np.load(cache_file)
        else:
            pending_idx.append(i)
            pending_clips.append(clip)
            pending_paths.append(cache_file)

    log.info("embeddings: %d cached, %d to compute", len(df) - len(pending_idx), len(pending_idx))
    batch_size = config.runtime.batch_size
    for start in range(0, len(pending_clips), batch_size):
        clips = pending_clips[start : start + batch_size]
        log.info("embedding batch %d-%d / %d", start, start + len(clips), len(pending_clips))
        vectors = extractor.embed_batch(clips)
        for offset, vector in enumerate(vectors):
            idx = pending_idx[start + offset]
            cache_file = pending_paths[start + offset]
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            np.save(cache_file, vector)
            embeddings[idx] = vector

    X = np.stack(embeddings).astype(np.float32)
    y = df["label"].map(LABEL_TO_INT).to_numpy()
    return X, y
