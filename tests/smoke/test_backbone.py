"""D64 — backbone smoke test. Downloads weights on first run; embeds one clip."""

import numpy as np

from qorgauvoice.config import load_config
from qorgauvoice.contracts import AudioClip
from qorgauvoice.features.backbone import Wav2Vec2Extractor


def test_embed_one_clip_returns_dim_vector():
    cfg = load_config()
    ex = Wav2Vec2Extractor(cfg)
    sr = cfg.runtime.sample_rate
    clip = AudioClip(
        samples=np.random.randn(sr).astype(np.float32), sample_rate=sr, source_id="smoke"
    )
    vec = ex.embed(clip)
    assert vec.ndim == 1
    assert vec.shape == (ex.dim,)
