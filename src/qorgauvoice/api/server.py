"""QorgauVoice HTTP API (FastAPI). Thin JSON layer over the Detector for the web frontend.

Composition root (D38): sets process env + loads the model once at startup. Single-process
inference (torch + LightGBM predict) is safe with the OpenMP guards (D66); requests are
serialized with a lock because the model isn't thread-safe and MPS is a single device.

Run: `uv run uvicorn qorgauvoice.api.server:app`  (or `python -m qorgauvoice.api.server`)
Docs: http://127.0.0.1:8000/docs
"""

from __future__ import annotations

import os

# Must be set before torch / lightgbm import (D66 — avoid the OpenMP segfault at inference).
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import base64
import io
import logging
import threading
from contextlib import asynccontextmanager

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from fastapi import FastAPI, File, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from qorgauvoice.api.schemas import DetectData, DetectResponse, HealthResponse, Reason
from qorgauvoice.config import load_config
from qorgauvoice.data.audio_io import AudioValidationError, load_validated_bytes
from qorgauvoice.explain.reasons import verdict_reason
from qorgauvoice.explain.visualize import mel_spectrogram_figure
from qorgauvoice.inference import Detector, load_detector

log = logging.getLogger("api")

_STATE: dict[str, object] = {"detector": None, "config": None}
_LOCK = threading.Lock()  # serialize inference (model not thread-safe; single MPS device)


@asynccontextmanager
async def lifespan(app: FastAPI):
    config = load_config()
    _STATE["config"] = config
    # QV_MOCK=1 → run the real contract with fake verdicts and NO model download (frontend dev).
    if os.environ.get("QV_MOCK"):
        _STATE["mock"] = True
        log.info("QorgauVoice API ready (MOCK mode — no model loaded).")
        yield
        return
    detector = load_detector(config)
    try:  # warm the backbone so the first request is fast (D55)
        warm = load_validated_bytes(_silence_wav(config), config, source_id="warmup")
        detector.predict(warm)
    except Exception as exc:  # best-effort
        log.warning("Warmup skipped: %s", exc)
    _STATE["detector"] = detector
    log.info("QorgauVoice API ready.")
    yield


def _mock_verdict(raw: bytes) -> tuple[str, float, float, float]:
    """Deterministic fake verdict from the file bytes (frontend dev — QV_MOCK)."""
    import hashlib

    prob = 0.95 if int(hashlib.sha1(raw).hexdigest(), 16) % 2 else 0.04
    label = "spoof" if prob >= 0.5 else "bona_fide"
    return label, prob, (prob if label == "spoof" else 1.0 - prob), 0.5


def _silence_wav(config) -> bytes:
    import soundfile as sf

    buf = io.BytesIO()
    sf.write(buf, np.zeros(config.runtime.sample_rate, np.float32), config.runtime.sample_rate,
             format="WAV")
    return buf.getvalue()


def _spectrogram_b64(clip, dpi: int) -> str:
    fig = mel_spectrogram_figure(clip)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight")
    plt.close(fig)  # avoid the matplotlib figure leak in a long-running server
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _run_inference(raw: bytes, filename: str, want_spectrogram: bool) -> DetectData:
    """Blocking — runs in a threadpool, serialized by _LOCK. May raise AudioValidationError."""
    config = _STATE["config"]
    clip = load_validated_bytes(raw, config, source_id=filename)  # validation gate (D49)
    with _LOCK:
        if _STATE.get("mock"):
            label, prob, confidence, threshold = _mock_verdict(raw)
        else:
            detector: Detector = _STATE["detector"]  # type: ignore[assignment]
            v = detector.predict(clip)
            label, prob, confidence, threshold = v.label, v.spoof_prob, v.confidence, v.threshold
        png = _spectrogram_b64(clip, config.api.spectrogram_dpi) if want_spectrogram else None
    return DetectData(
        label=label,
        spoof_probability=prob,
        confidence=confidence,
        threshold=threshold,
        reason=Reason(**verdict_reason(label)),
        spectrogram_png_base64=png,
    )


def create_app() -> FastAPI:
    app = FastAPI(title="QorgauVoice API", version="1.0.0", lifespan=lifespan)
    cfg = load_config()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(cfg.api.cors_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/v1/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        loaded = bool(_STATE.get("mock")) or _STATE.get("detector") is not None
        return HealthResponse(status="ok", model_loaded=loaded)

    @app.post("/api/v1/detect", response_model=DetectResponse)
    async def detect(
        audio: UploadFile = File(..., description="wav/flac/ogg/mp3, ≤15 MB, ≤60 s"),
        spectrogram: bool = Query(True, description="include a base64 mel-spectrogram PNG"),
    ):
        raw = await audio.read()
        if not raw:
            return JSONResponse(
                status_code=400,
                content=DetectResponse(success=False, error="Empty upload.").model_dump(),
            )
        try:
            data = await run_in_threadpool(
                _run_inference, raw, audio.filename or "upload", spectrogram
            )
        except AudioValidationError as exc:
            return JSONResponse(
                status_code=400,
                content=DetectResponse(success=False, error=str(exc)).model_dump(),
            )
        except Exception as exc:  # don't leak internals to the client
            log.exception("Inference failed")
            return JSONResponse(
                status_code=500,
                content=DetectResponse(success=False, error="Internal inference error.").model_dump(),
            )
        return DetectResponse(success=True, data=data)

    return app


app = create_app()


def main() -> None:
    import uvicorn

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    config = load_config()
    uvicorn.run(app, host=config.api.host, port=config.api.port)


if __name__ == "__main__":
    main()
