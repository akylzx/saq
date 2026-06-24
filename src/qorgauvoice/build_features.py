"""Feature-build step (torch process). Embeds the manifest with the SSL backbone and
saves a numeric feature matrix to artifacts/features.npz (D52 non-pickle).

Kept SEPARATE from training: PyTorch and LightGBM each bundle their own OpenMP runtime,
and co-importing them in one process segfaults on macOS. This process imports torch but
never LightGBM; `train.py` imports LightGBM but never torch.

Run: `uv run python -m qorgauvoice.build_features`
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from qorgauvoice.config import load_config
from qorgauvoice.config.seeding import seed_everything
from qorgauvoice.data.augment.pipeline import degrade, rng_for
from qorgauvoice.data.manifest import Manifest
from qorgauvoice.features.backbone import Wav2Vec2Extractor
from qorgauvoice.features.extract import embed_manifest

log = logging.getLogger("build_features")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    config = load_config()
    seed_everything(config.runtime.seed)

    artifacts = Path(config.paths.artifacts_dir)
    manifest = Manifest.from_parquet(artifacts / "manifest.parquet")
    df = manifest.df

    extractor = Wav2Vec2Extractor(config)
    arrays: dict[str, np.ndarray] = {
        "y": None,  # type: ignore[dict-item]
        "split": df["split"].to_numpy().astype(str),
        "language": df["language"].to_numpy().astype(str),
    }

    log.info("Embedding %d clips (clean) ...", len(df))
    X, y = embed_manifest(df, extractor, config)
    arrays["X"] = X.astype(np.float32)
    arrays["y"] = y.astype(np.int64)

    if config.augment.enabled:
        seed = config.runtime.seed

        def deg(clip):
            return degrade(clip, rng_for(clip.source_id, seed), config)

        log.info("Embedding %d clips (degraded: telephone+noise) ...", len(df))
        X_deg, _ = embed_manifest(df, extractor, config, transform=deg)
        arrays["X_deg"] = X_deg.astype(np.float32)

    out = artifacts / "features.npz"
    np.savez(out, **arrays)
    log.info("Saved features X=%s (deg=%s) → %s", X.shape, config.augment.enabled, out)


if __name__ == "__main__":
    main()
