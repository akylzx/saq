# saq — landing page

The marketing and live-demo site for **saq**, the bilingual (Kazakh / Russian) AI-voice
detector. Built as a standalone Vite + React + TypeScript app so it stays decoupled from the
Python backend in `../src/` (per the project's frontend/backend boundary).

## Develop

```bash
cd web
npm install
npm run dev          # → http://localhost:5173
```

The live "Try saq" section calls the backend at `POST /api/v1/detect`. The dev server proxies
`/api` → `http://127.0.0.1:8000`, so run the backend alongside it:

```bash
# from the repo root
uv run uvicorn saq.api.server:app            # real model
QV_MOCK=1 uv run uvicorn saq.api.server:app  # instant fake verdicts, same contract
```

If the backend isn't running, the demo degrades gracefully and shows how to start it — the rest
of the page is fully static.

## Checks

```bash
npm run typecheck    # tsc, no emit
npm run lint         # eslint
npm run build        # type-check + production bundle → dist/
npm run preview      # serve the built bundle
```

## Speech-analysis pipeline (the "Analyze" section)

The `#try` section runs a full pipeline entirely client-side:

1. **Capture** — file upload or mic recording (`useRecorder`). Everything is decoded once,
   resampled to 16 kHz mono, and re-encoded to WAV (`lib/audio.ts`) so the same signal feeds
   both the transcriber and the backend detector.
2. **Speech-to-text** — Whisper (`Xenova/whisper-base`) runs in a **Web Worker** via
   `@huggingface/transformers` (`lib/stt.worker.ts` / `lib/stt.ts`). Returns transcript,
   detected language (script heuristic), an estimated confidence, and segment timestamps. The
   model downloads once (~tens of MB, quantized) and then runs on-device — nothing is uploaded.
3. **AI voice detection** — the original audio (as WAV) is sent to the existing
   `POST /api/v1/detect`. No backend changes.
4. **Combined analysis** — `lib/analyze.ts` fuses the detector (primary signal) with transcript
   quality, language, and speech presence (supporting signals) into a final assessment:
   **Likely human / Likely AI-generated / Inconclusive**, with a plain explanation and the key
   factors. It deliberately does not rely on the detector alone.

STT and detection run in parallel and degrade independently: if the backend is offline you still
get the transcript (verdict becomes *Inconclusive*); if STT fails you still get the voice verdict.

### Preview the result states without the model/backend

Append `?mock=<mode>` and upload any file to see canned results:
`?mock=ai`, `?mock=human`, `?mock=inconclusive`, `?mock=offline`.

## Design notes

Editorial ink-on-paper system inspired by the reference designs. The page chrome is intentionally
monochrome; the **only** chromatic color is the spectrogram heatmap in the hero analyzer and the
verdict states — color carries meaning (the signal), not decoration. Typography pairs *Newsreader*
(display + editorial body), *Inter* (UI), and *JetBrains Mono* (data/annotations). Design tokens
live in `src/styles/tokens.css`; page copy lives in `src/lib/content.ts`.
