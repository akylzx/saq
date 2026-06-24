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
uv run uvicorn qorgauvoice.api.server:app            # real model
QV_MOCK=1 uv run uvicorn qorgauvoice.api.server:app  # instant fake verdicts, same contract
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

## Design notes

Editorial ink-on-paper system inspired by the reference designs. The page chrome is intentionally
monochrome; the **only** chromatic color is the spectrogram heatmap in the hero analyzer and the
verdict states — color carries meaning (the signal), not decoration. Typography pairs *Newsreader*
(display + editorial body), *Inter* (UI), and *JetBrains Mono* (data/annotations). Design tokens
live in `src/styles/tokens.css`; page copy lives in `src/lib/content.ts`.
