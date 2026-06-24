"""Mel-spectrogram visualization (D28) — the one guaranteed demo visual."""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")  # headless, no GUI backend

import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np

from saq.contracts import AudioClip


def mel_spectrogram_figure(clip: AudioClip, n_mels: int = 80):
    """Return a matplotlib Figure of the clip's mel spectrogram (Gradio `gr.Plot` accepts it)."""
    mel = librosa.feature.melspectrogram(
        y=clip.samples, sr=clip.sample_rate, n_mels=n_mels
    )
    mel_db = librosa.power_to_db(mel, ref=np.max)
    fig, ax = plt.subplots(figsize=(6, 3))
    image = librosa.display.specshow(
        mel_db, sr=clip.sample_rate, x_axis="time", y_axis="mel", ax=ax
    )
    fig.colorbar(image, ax=ax, format="%+2.0f dB")
    ax.set_title("Mel spectrogram")
    fig.tight_layout()
    return fig
