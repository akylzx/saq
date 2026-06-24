# saq

Bilingual (Kazakh / Russian) **AI-voice / deepfake detector** — distinguishes genuine human
speech from AI-synthesized/cloned voice. Hackathon MVP (AI Shield).

> **Full design, decisions, status, and the Frontend Developer Guide are in [`CLAUDE.md`](./CLAUDE.md).**
> If you're building the website, read the "Frontend Developer Guide" section there first.

## Setup

Requires [`uv`](https://docs.astral.sh/uv/) (Python 3.11 is pinned automatically).

```bash
uv sync --extra dev
```

## Run

```bash
# Backend API (real model — downloads ~1.2 GB SSL backbone on first run)
uv run uvicorn saq.api.server:app          # → http://127.0.0.1:8000/docs

# Backend API in MOCK mode (instant, fake verdicts, real contract — for frontend dev)
QV_MOCK=1 uv run uvicorn saq.api.server:app

# Gradio demo (upload / mic → verdict + spectrogram)
uv run python -m saq.demo.app              # → http://127.0.0.1:7860

# Tests
uv run pytest tests/unit -q
```

## API contract (the interface for any frontend)

- `GET  /api/v1/health` → `{ "status": "ok", "model_loaded": true }`
- `POST /api/v1/detect` — multipart `audio` (wav/flac/ogg/mp3, ≤15 MB, ≤60 s), optional
  `?spectrogram=true|false` → JSON `{ success, data: { label, spoof_probability, confidence,
  threshold, reason{en,ru,kk}, spectrogram_png_base64 }, error }`.

```bash
curl -F "audio=@clip.wav" http://127.0.0.1:8000/api/v1/detect
```

## What's in the repo / what isn't

- **Included:** all code (`src/saq/`), tests, and the trained model (`artifacts/models/`)
  so the backend runs immediately.
- **Not included (regenerable, gitignored):** datasets (`data/`), cached embeddings and
  features (`artifacts/cache`, `artifacts/features.npz`). Rebuild with
  `uv run python -m saq.data.build_dataset --per-language N` →
  `uv run python -m saq.build_features` → `uv run python -m saq.train`.

## Known limitations

The recording-channel shortcut on **play-and-recorded** audio has been fixed (room augmentation +
TTS-engine diversity): a held-out engine through a simulated room now scores ~0.05 EER, and
Google-TTS played-and-recorded is correctly flagged. Remaining gaps: true **voice cloning**
(XTTS/ElevenLabs) is untested, and room validation is *simulated* (a real play-and-record sample is
the gold-standard check). See `CLAUDE.md` §0. The API contract will not change.
