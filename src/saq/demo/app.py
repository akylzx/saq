"""saq demo (D31-D33). Upload or record audio → real/synthetic verdict + confidence
+ mel spectrogram, with a bilingual (kk/ru/en) plain-language line.

Composition root (D38): the only place that wires concretes and sets process env. Runs as a
SINGLE process (torch backbone + LightGBM predict) — safe because only `fit` triggers the
OpenMP segfault, and we pin the duplicate-OpenMP guards below.

Run: `uv run python -m saq.demo.app`
"""

from __future__ import annotations

import os

# Must be set before torch / lightgbm import (D66 — avoid the OpenMP clash at inference).
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import logging
from pathlib import Path

import gradio as gr
import numpy as np

from saq.config import load_config
from saq.data.audio_io import AudioValidationError, load_validated_array
from saq.explain.visualize import mel_spectrogram_figure
from saq.inference import Verdict, load_detector

log = logging.getLogger("demo")

_VERDICT_LABEL = {
    "spoof": {
        "en": "Synthetic (AI-generated) voice",
        "ru": "Синтетический (сгенерированный ИИ) голос",
        "kk": "Жасанды (ЖИ жасаған) дауыс",
    },
    "bona_fide": {
        "en": "Genuine human voice",
        "ru": "Настоящий человеческий голос",
        "kk": "Нақты адам дауысы",
    },
}

_LIMITATIONS = """
**Limitations (honest):** Trained on FLEURS (clean read speech) vs. MMS/Silero TTS, ~820 clips.
It reliably separates these, including an unseen TTS engine — but this is an *easy* setting and
likely detects "TTS-generated" broadly, **not** sophisticated voice-cloning. Not yet validated on
real telephone audio or high-quality cloned voices. On-device/live-call capture is future work.
"""


def _verdict_markdown(verdict: Verdict) -> str:
    icon = "🛑" if verdict.label == "spoof" else "✅"
    names = _VERDICT_LABEL[verdict.label]
    pct = f"{verdict.confidence * 100:.1f}%"
    return (
        f"## {icon} {names['en']}\n"
        f"**RU:** {names['ru']}  \n**KK:** {names['kk']}\n\n"
        f"**Confidence:** {pct}  •  spoof-probability: {verdict.spoof_prob:.3f}  "
        f"•  threshold: {verdict.threshold:.2f}"
    )


def build_app(config=None) -> gr.Blocks:
    config = config or load_config()
    detector = load_detector(config)

    # Warm the backbone once at startup so the first real click is fast (D55).
    try:
        warm = load_validated_array(np.zeros(config.runtime.sample_rate, np.float32),
                                    config.runtime.sample_rate, config, source_id="warmup")
        detector.predict(warm)
        log.info("Backbone warmed.")
    except Exception as exc:  # warmup is best-effort
        log.warning("Warmup skipped: %s", exc)

    def analyze(audio):
        if audio is None:
            return "⚠️ Please upload or record an audio clip first.", None
        sample_rate, samples = audio
        try:
            clip = load_validated_array(np.asarray(samples), int(sample_rate), config)
        except AudioValidationError as exc:
            return f"⚠️ {exc}", None
        verdict = detector.predict(clip)
        return _verdict_markdown(verdict), mel_spectrogram_figure(clip)

    examples_dir = Path(config.paths.examples_dir)
    example_files = sorted(str(p) for p in examples_dir.glob("*.wav"))

    with gr.Blocks(title="saq") as demo:
        gr.Markdown(
            "# 🛡️ saq\n"
            "Bilingual (Kazakh/Russian) **AI-voice / deepfake detector**. "
            "Upload or record a clip to check whether the voice is genuine or synthetic."
        )
        with gr.Row():
            audio_in = gr.Audio(
                sources=["upload", "microphone"], type="numpy", label="Audio clip"
            )
        analyze_btn = gr.Button("Analyze", variant="primary")
        verdict_out = gr.Markdown()
        plot_out = gr.Plot(label="Mel spectrogram")
        analyze_btn.click(analyze, inputs=audio_in, outputs=[verdict_out, plot_out])
        if example_files:
            gr.Examples(
                examples=[[f] for f in example_files], inputs=audio_in, cache_examples=False
            )
        gr.Markdown(_LIMITATIONS)
    return demo


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    demo = build_app()
    demo.launch(share=False, server_name="127.0.0.1")  # D53 — never share=True


if __name__ == "__main__":
    main()
