# CLAUDE.md — QorgauVoice (Anti-Spoofing Core)

> **Purpose of this document.** This is the authoritative decision record and working
> brief for an AI coding agent (and the architect agent that will plan from it). It
> captures **every binding decision** for the hackathon MVP, with rationale, so that
> implementation does not re-litigate settled choices. Decisions are tagged `D#` so the
> architect can reference them. Anything marked **STRETCH** is explicitly optional and
> must never block the core demo.

---

## Frontend Developer Guide — READ THIS FIRST if you're building the website

**You are building the web frontend. The Python backend in `src/qorgauvoice/` is DONE and
working — do NOT modify it, its tests, or `pyproject.toml`.** Build the site as a *separate app*
in your own stack, in a new top-level `web/` directory (or a separate repo). The API contract
below is the only interface you need, and it will **not change** when the backend model improves.
This keeps the two of us conflict-free: you touch `web/`, the backend owner touches `src/`.

### 1. Run the backend locally
```bash
uv sync                                              # one-time, installs Python deps
# Real model (downloads ~1.2 GB SSL backbone on first request):
uv run uvicorn qorgauvoice.api.server:app
# OR — frontend dev mode: instant, NO model download, fake verdicts, identical contract:
QV_MOCK=1 uv run uvicorn qorgauvoice.api.server:app
```
Serves at `http://127.0.0.1:8000`. **Interactive contract + try-it-out: http://127.0.0.1:8000/docs.**
Use `QV_MOCK=1` while building UI; switch to the real model when you want true detections.

### 2. API contract (stable)
- `GET /api/v1/health` → `{ "status": "ok", "model_loaded": true }`
- `POST /api/v1/detect` — `multipart/form-data`, field **`audio`** (wav/flac/ogg/mp3, ≤15 MB,
  ≤60 s); optional query `?spectrogram=true|false` (default true).

Success `200`:
```json
{ "success": true, "error": null, "data": {
    "label": "spoof",                     // "spoof" = AI/synthetic, "bona_fide" = real human
    "spoof_probability": 0.97,            // 0..1
    "confidence": 0.97,                   // 0..1, probability of the shown label
    "threshold": 0.5,
    "reason": { "en": "…", "ru": "…", "kk": "…" },
    "spectrogram_png_base64": "iVBORw0…"  // null if ?spectrogram=false
} }
```
Render the spectrogram directly: `<img src="data:image/png;base64,${spectrogram_png_base64}">`.
Error `400`/`500`: `{ "success": false, "data": null, "error": "Audio too long: …" }`.
```bash
curl -F "audio=@clip.wav" http://127.0.0.1:8000/api/v1/detect
```

### 3. Ground rules
- All frontend code under `web/` (or a separate repo). Do **not** edit `src/`, `tests/`, `pyproject.toml`.
- CORS: dev allows all origins. For a deployed site, ask the backend owner to set
  `ApiConfig.cors_origins` in `src/qorgauvoice/config/app.py`.
- `label` is machine-readable; show `reason[lang]` (kk/ru/en) to users. **`confidence` can read
  ~100% even when wrong** (calibration is WIP, and the model is fooled by play-and-recorded audio) —
  present it as a hint, not a guarantee.

---

## 0. Build Status — updated 2026-06-24

**Status:** P0–P5 + backend API done; the channel-shortcut + engine-diversity robustness fix has
landed. Full unit suite green (38 tests).

### Done
- **P0 Scaffold** — `uv` / Python 3.11, frozen `AppConfig`, `contracts.py`, seeding, lazy XLS-R
  extractor (MPS), content-hash embedding cache. Backbone smoke-tested.
- **P1 Data** — audio validation gate (`data/audio_io.py`); FLEURS loader via **direct Parquet
  download** (D68); MMS-TTS (kk+ru) + Silero (ru, the unseen engine) synth engines; leakage-free
  manifest + splits. Build: **200 clips/lang → 820-clip dataset**.
- **P2 Embeddings** — cached extraction → `artifacts/features.npz`.
- **P3 Train/EER** — LightGBM + EER; **torch and LightGBM split into two processes** (D66) to fix a
  macOS OpenMP segfault (the "Python quit unexpectedly" crash).
- **P4 Augmentation + honest metric** — telephone/noise/reverb transforms (`data/augment/`);
  degraded feature matrix (D67); train on `clean ∪ degraded`; 2×2 EER table; unseen-TTS (Silero)
  split populated and evaluated (held-out real clips reused as its negatives).
- **P5 Demo** — Gradio app (`demo/app.py`): upload/mic → bilingual (kk/ru/en) real-vs-synthetic
  verdict + confidence + mel spectrogram; 3 canned offline examples; localhost-only (D53).
  **Single-process inference** (torch backbone + LightGBM `predict`) is safe — only `fit`
  triggers the OpenMP segfault — with the duplicate-OpenMP guards pinned in `app.py` (D66).
  Verified serving (HTTP 200) on `127.0.0.1:7860`. Run: `uv run python -m qorgauvoice.demo.app`.
  Note: **Gradio 6** (D31 said 4.x; forced up by `huggingface_hub` removing `HfFolder`).
  Demo uses a **0.5 threshold** (the FPR-calibrated one is degenerate on perfectly-separable data).
- **Backend API** — FastAPI (`api/server.py`, `api/schemas.py`) over the same `Detector`:
  `POST /api/v1/detect` (multipart audio → JSON verdict + bilingual reason + base64 mel
  spectrogram) and `GET /api/v1/health`. Standard envelope (success/data/error); validation
  gate → HTTP 400; CORS (config-driven); **lock-serialized** inference (model not thread-safe,
  single MPS device); model loaded once at startup. Verified end-to-end (TestClient). This is the
  distribution boundary for a **separate web frontend** (teammate's repo) — the OpenAPI contract
  at `/docs` is the interface. Bilingual labels/reasons moved to shared `explain/reasons.py`.
  Run: `uv run uvicorn qorgauvoice.api.server:app` → http://127.0.0.1:8000/docs
- **Channel + engine robustness fix (D70, D71)** — root cause of the real-world failure was a
  *channel shortcut* ("clean digital = synthetic, room/mic-recorded = human"), confirmed
  empirically. Fix = (D70) **room "played-back / re-recorded" augmentation** (`data/augment/room.py`:
  speaker/mic band-pass + randomized RIR + ambient noise) applied to BOTH classes so channel can't
  predict the label; **(D71) engine diversity** — training spoof now spans **MMS + Apple-say +
  edge-tts + gTTS** (kk+ru), with **Silero held out entirely** as the unseen-engine probe. Train on
  `clean ∪ telephone ∪ room`; 2×3 eval; LightGBM `class_weight=balanced`.

### Current snapshot — multi-engine + channel-robust (1096 clips)
Train spoof engines: MMS · Apple · edge · gTTS (kk+ru). **Silero held out** (unseen). Channels:
clean / telephone / room. **2×3 EER:** `test_same` {clean 0.000, telephone 0.027, room 0.037};
**`test_unseen` (held-out Silero) {clean 0.000, telephone 0.000, room 0.048 / AUC 0.998}**.
Diagnostic on real clips: held-out Silero + room → spoof 1.000; Silero + an *unseen* reverb →
spoof 0.999; **gTTS (Google) + room → spoof 1.000** (the original reported failure, fixed); real
human + room → bona_fide. The channel shortcut is gone; generalization holds to unseen engines
AND unseen channels.
**Remaining gaps (honest):** (1) all engines are *text-to-speech* — true **voice cloning**
(XTTS/ElevenLabs), the real vishing threat, is untested and the top next add; (2) validation uses
*simulated* room channels — a **real play-and-record** sample is the gold-standard check; (3)
modest test data (132 `test_same`, 45 `test_unseen`); (4) threshold still degenerate → demo/API use
a 0.5 fallback. **The trained model artifact changed — re-commit `artifacts/models/` to share it.**

### Run commands
- Build data: `uv run python -m qorgauvoice.data.build_dataset --per-language N`
- Extract features (torch): `uv run python -m qorgauvoice.build_features`
- Train + EER (no torch): `OMP_NUM_THREADS=1 uv run python -m qorgauvoice.train`
- Tests: `uv run pytest tests/unit -q`
- Env: set `HF_HUB_DISABLE_XET=1` (faster/stable HF downloads) and `PYTORCH_ENABLE_MPS_FALLBACK=1`.

### What's left
1. **Voice cloning (top priority for real quality).** Add XTTS/OpenVoice-class *cloning* spoofs
   (impersonating a specific speaker) — the actual vishing threat; current engines are all TTS.
   Hold one out to measure generalization to cloning.
2. **Real play-and-record validation.** Collect a few clips of TTS played through speakers and
   recorded via mic (real RIR/mic, not simulated) as a held-out eval — the gold-standard check.
3. **Threshold calibration** — still degenerate on near-separable data; revisit once cloning makes
   scores overlap.
4. Scale data; add a **Kazakh** held-out engine (Silero is RU-only, so `test_unseen` is RU).
2. **P6 — Explainability** (§8/D25–D30): temporal heatmap, acoustic indicators, bilingual
   (kk/ru/en) reasons, SHAP — wire into the existing demo (the spectrogram panel is already there).
3. **P7 — STRETCH** (D8/D9): MLP head; SSL-AASIST as a separate `EndToEndClassifier`.
4. **P8 — Polish** (§15): README metrics table + honest limitations; demo rehearsal.

### Known tech debt
- Backbone `revision="main"` not pinned to a commit sha (D51 TODO).
- MUSAN/RIR not downloaded — synthetic noise used instead (deliberate, saves ~13 GB).
- `batch_size=4` to avoid MPS OOM on 17 GB shared RAM (D5/D56).

---

## 1. Mission & Context

**Hackathon brief** ("AI Shield"): build a real-time, AI-driven solution for data
protection and cyber-threat detection, judged on **practical applicability, detection
speed, and explainability**.

**Our wedge:** detect **AI-synthesized / cloned voice** ("audio deepfakes") in
**Kazakh and Russian**, the language gap no deployed consumer tool fills. This directly
attacks the country's #1 measured fraud-loss vector (vishing + voice impersonation).

**This MVP is the *detection model* + a thin explainable demo wrapper.** Live telephony
capture, messenger integration, on-device deployment, and the scam-intent LLM are
**explicitly out of scope** and positioned as the post-hackathon roadmap (see §13).

---

## 2. Scope

### In scope (the deliverable)
- A binary classifier: **bona fide (real human speech)** vs **spoof (TTS / voice-cloned)**.
- Trained/evaluated on **open** Kazakh/Russian speech + **self-generated** synthetic speech.
- An **honest evaluation** with a generalization-focused test split (unseen speakers + unseen TTS engine).
- An **explainability layer**: confidence, temporal heatmap, interpretable acoustic indicators, bilingual plain-language reasons.
- A **Gradio demo**: upload or record audio → verdict + confidence + visualizations + explanation.

### Out of scope (do NOT build for the demo)
- Live call / telephony audio capture; Android app; on-device inference.
- Messenger (WhatsApp/Telegram) integration.
- Scam-intent / conversation classification; ASR; any LLM.
- Anti-Fraud Center / 1414 reporting integration.
- Speaker identification or biometric verification.
- Any reuse of the `avtobys` project (code, data, pipelines, models) — see **D0**.

---

## 3. Hard Constraints

| ID | Constraint | Implication |
|----|-----------|-------------|
| **D0** | **Clean-room.** No code, data, manifests, or model artifacts from `avtobys`. | Fresh repo, fresh data download, fresh synth. Shared public datasets (e.g. Golos) are *not* used here to avoid any entanglement; we deliberately pick different open sources (§6). |
| **D1** | **12 hours to first demo.** | Milestone-gated plan (§10). Working end-to-end pipeline (even if weak) by **hour ~4**. Every component has a fallback. |
| **D2** | **Anti-spoofing only.** | No ASR/LLM/intent. One model, one job. |
| **D3** | **Open data + self-generated synthetic only.** | Every dataset CC0/CC-BY/open-research; every TTS model open. License notes in §6. |
| **D4** | **Bilingual: Kazakh + Russian.** | Multilingual backbone (D5); balanced data; bilingual explanations. |
| **D5** | **Dev hardware = Apple Silicon (macOS, MPS).** | PyTorch MPS backend with CPU fallback. Embeddings **cached to disk** so the heavy backbone runs once. GPU (Colab) only for STRETCH AASIST fine-tune. |

---

## 4. Product Naming
- **Product / pitch name:** `QorgauVoice` ("qorgau" = protection/defense).
- **Repo dir:** `shaq` (existing). Do not rename.
- Verdict labels in code: `bona_fide` / `spoof`. UI labels localized (kk/ru/en).

---

## 5. Core Technical Decisions

### 5.1 Model architecture

| ID | Decision | Rationale |
|----|----------|-----------|
| **D6** | **Frontend = frozen self-supervised backbone `facebook/wav2vec2-xls-r-300m`** for utterance embeddings. | Multilingual (covers kk + ru), strong anti-spoofing prior, no training needed → fits 12h. Frozen = fast, deterministic, cacheable. |
| **D7** | **Primary classifier = gradient-boosted trees (LightGBM)** on pooled (mean+std) embeddings. | Trains in **seconds**, robust on small data, **native SHAP** explainability, trivial to iterate. This de-risks D1 — guarantees a real number fast. |
| **D8** | **Upgrade path (in budget) = small MLP head** (2–3 layers, dropout, BCE) on the same cached embeddings. | If LightGBM EER is weak, MLP often improves with minutes of training. Keep LightGBM as fallback. |
| **D9** | **STRETCH = SSL-AASIST fine-tune** (wav2vec2/XLS-R + AASIST graph-attention head). | The "credible SOTA" option for the pitch. Only if hours 10–11 are free and a GPU is available. Must not block the demo. |

**Pooling (D7/D8):** mean + std over the time axis of the last hidden state (and optionally
a weighted sum of layers). Keep the embedding-extraction interface stable so all three
classifiers consume the same cached features.

**Backbone swap escape hatch:** if `xls-r-300m` is too slow on the available hardware,
config-swap to a lighter multilingual encoder (e.g. `whisper-small` encoder or
`wav2vec2-large-xlsr-53`). Backbone is a **config value, never hardcoded**.

### 5.2 Why not train AASIST from scratch / use ASVspoof directly
ASVspoof is English and lab-clean; the literature documents catastrophic out-of-domain
collapse ("domain amnesia"). Our value is a **local, telephone-robust, Kazakh/Russian**
detector. We therefore train on local-language data with telephone/noise augmentation and
**evaluate on unseen TTS** to measure the only number that matters: generalization.

---

## 6. Data Pipeline

### 6.1 Bona fide (real human speech) — open

| ID | Source | Why |
|----|--------|-----|
| **D10** | **Google FLEURS** (`google/fleurs`, configs `kk_kz`, `ru_ru`) via HF `datasets`. | Small, clean, fast to download (vs full Common Voice), CC-BY, has **transcripts** (needed for matched-content synth, D13). |
| **D11** | **Supplement: Common Voice** (kk, ru) sample, only if FLEURS volume insufficient. CC0. | Speaker diversity. Sample, don't download all. |

### 6.2 Spoof (synthetic) — self-generated from open TTS

| ID | Decision | Notes |
|----|----------|-------|
| **D12** | **Generate spoofs ourselves** using multiple open TTS engines for diversity. | Diversity of synthesis methods is the single biggest driver of generalization. |
| **D13** | **Matched content:** synthesize from the **FLEURS transcripts** of the bona fide clips. | Forces the model to learn *synthesis artifacts*, not topic/wording shortcuts. |
| **D14** | **TTS engines:** (a) **MMS-TTS** `facebook/mms-tts-kaz` + `facebook/mms-tts-rus` (single tool, both languages); (b) **Silero TTS** (Russian, high quality); (c) **STRETCH: XTTS-v2 / OpenVoice voice-clone** for the "cloned voice" demo flourish. | Covers kk+ru with ≥2 engines. License: MMS = CC-BY-NC, Silero = open non-commercial, XTTS = CPML (non-commercial). **All fine for hackathon/research; flag for productionization.** |

### 6.3 Augmentation (fight domain amnesia) — `audiomentations` / `torch-audiomentations`

| ID | Decision |
|----|----------|
| **D15** | Apply to a **fraction** of training samples (both classes): **telephone-codec sim** (resample→8 kHz, μ-law/G.711, optional Opus/AMR), **additive noise** (MUSAN, open), **light reverb** (RIR). Keep cheap; deterministic given seed. |
| **D16** | Augmentation is **config-toggled**; ship a no-aug baseline number AND an aug number to show the robustness delta in the pitch. |

### 6.4 Manifest, splits, balance

| ID | Decision |
|----|----------|
| **D17** | Build an immutable **manifest** (parquet/jsonl): `path, label, language, source, tts_engine, speaker_id, duration, split`. |
| **D18** | **Clip length** normalized to ~3–6 s (pad/trim). Target initial size ~1.5k bona fide + ~1.5k spoof, language-balanced. Scale down on slow hardware. |
| **D19** | **Generalization test split:** hold out (i) **unseen speakers** for bona fide and (ii) at least **one unseen TTS engine** for spoof (e.g. train on MMS+Silero, test on XTTS). Report EER on this split as the headline, honest number. Also report a same-domain split for contrast. |
| **D20** | Splits are **deterministic** (seeded); never leak a speaker or a synthesized-from-same-source pair across train/test. |

---

## 7. Evaluation Protocol

| ID | Decision |
|----|----------|
| **D21** | **Primary metric = EER (Equal Error Rate).** Also report accuracy, AUC, and a confusion matrix at the chosen operating threshold. |
| **D22** | Report **two settings**: (a) clean, (b) telephone-augmented. And **two splits**: same-domain vs unseen-TTS (D19). The unseen-TTS + telephone number is the one we stand behind. |
| **D23** | **Targets (honest, not promises):** working pipeline > a paper number. < ~10% EER on the telephone-augmented unseen-TTS split is a strong result; report whatever it is, with caveats. Never overclaim. |
| **D24** | **Score calibration** (Platt/isotonic) so the demo's "confidence %" is meaningful; pick the threshold for **low false-positive rate** (avoid alert fatigue) and state it. |

---

## 8. Explainability Layer (judging criterion — first-class, not an afterthought)

| ID | Decision |
|----|----------|
| **D25** | **Verdict + calibrated confidence**, with the operating threshold shown. |
| **D26** | **Temporal heatmap:** slide a window over the clip, score each window, plot which segments drove "spoof" — shows *where* the artifact is. |
| **D27** | **Interpretable acoustic-indicator panel** (clearly labeled *supporting heuristics, not the decision*): F0 / prosody variance, spectral flatness, high-frequency energy/rolloff, breath/silence patterns. Computed with librosa; each mapped to a bilingual template sentence. |
| **D28** | **Spectrogram / mel visualization** of the clip. |
| **D29** | **SHAP** on the LightGBM classifier (global + per-clip) for the technical audience. Do **not** claim per-embedding-dim SHAP is human-meaningful — pair it with D27 for the human-facing story. |
| **D30** | **Bilingual reasons (kk/ru, + en for judges):** dict-based i18n, template strings. Honest phrasing ("acoustic patterns consistent with synthetic speech"), never fabricated certainty. |

---

## 9. Demo Wrapper

| ID | Decision |
|----|----------|
| **D31** | **Gradio app.** Input: file upload **and** in-browser mic record. Output: verdict, confidence gauge, temporal heatmap, spectrogram, acoustic-indicator panel, bilingual explanation. |
| **D32** | Ship **3 canned examples** for a reliable live demo: real Kazakh clip, real Russian clip, a cloned/synthetic clip. Pre-load so the demo never depends on a flaky download. |
| **D33** | Include an honest **"limitations" note** in the UI/readme (small data, unseen-TTS caveat, not yet live-call). Honesty about failure modes scores well and pre-empts judge probing. |

---

## 10. 12-Hour Execution Plan (milestone-gated)

> Each block has a **fallback**. The rule: **always keep a runnable demo.** Never start a
> risky upgrade without the previous milestone committed.

| Hours | Goal | Milestone / Fallback |
|------|------|----------------------|
| **0–1** | Scaffold: repo structure, deps, config, seed; smoke-test backbone loads + embeds one clip on MPS. | ✅ Env works. Fallback: CPU + smaller backbone. |
| **1–3** | Data: pull FLEURS kk+ru; generate spoof via MMS-TTS (+Silero); build manifest + seeded splits (D19). | ✅ Labeled manifest exists. Fallback: fewer clips, one TTS engine. |
| **3–4** | Extract & **cache** XLS-R embeddings; train **LightGBM**; first EER. | ✅ **END-TO-END PIPELINE WORKS WITH A REAL NUMBER.** This is the critical gate. |
| **4–6** | Add augmentation (telephone+noise); retrain; calibrate; record clean-vs-aug + same-vs-unseen-TTS numbers. | ✅ Robustness delta measured. Fallback: skip aug, keep baseline. |
| **6–8** | Explainability: temporal heatmap, acoustic indicators, SHAP, bilingual reasons. | ✅ Explanations render. Fallback: confidence + spectrogram only. |
| **8–10** | Gradio demo: upload + mic, all panels, canned examples. | ✅ **DEMO-READY.** |
| **10–11** | **STRETCH:** MLP head, then SSL-AASIST fine-tune if GPU free and baseline weak. | Optional. Revert if it doesn't beat baseline. |
| **11–12** | Rehearse demo, finalize README + metrics table, limitations slide. | ✅ Ship. |

**If behind schedule, cut in this order:** AASIST (D9) → XTTS clone demo (D14c) → SHAP
(D29) → augmentation variety (keep telephone only). Never cut: working classifier,
honest eval, one visualization, bilingual verdict.

---

## 11. Repository Structure (many small files; high cohesion, low coupling)

```
shaq/
  CLAUDE.md                 # this file
  README.md                 # quickstart + metrics table + limitations
  pyproject.toml            # deps, tool config
  src/qorgauvoice/
    config/                 # immutable config dataclasses + defaults (no hardcoded values)
    data/
      sources/              # fleurs.py, common_voice.py  (bona fide loaders)
      synth/                # mms_tts.py, silero_tts.py, xtts.py  (spoof generation)
      augment/             # telephone.py, noise.py, reverb.py  (pure, seeded transforms)
      manifest.py           # build/validate manifest, splits (D17-D20)
    features/
      backbone.py           # load SSL backbone (config-driven, D6)
      embed.py              # extract + cache pooled embeddings
    models/
      lgbm.py               # primary classifier (D7)
      mlp.py                # upgrade head (D8)  [optional]
      aasist.py             # STRETCH (D9)
      calibrate.py          # score calibration + threshold (D24)
    eval/
      metrics.py            # EER, AUC, confusion (D21)
      report.py             # metrics tables across splits/settings (D22)
    explain/
      temporal.py           # windowed scoring heatmap (D26)
      acoustic.py           # interpretable indicators (D27)
      shap_explain.py       # SHAP (D29)
      reasons.py + i18n/    # bilingual templates (D30)
    demo/
      app.py                # Gradio (D31-D33)
  tests/                    # see §12
  data/                     # raw + processed (gitignored)
  artifacts/                # cached embeddings, checkpoints, calibrators (gitignored)
```

---

## 12. Coding Standards & Testing

Follow the user's global rules (immutability, small focused files <800 lines / functions
<50 lines, comprehensive error handling, input validation at boundaries, no hardcoded
values).

| ID | Decision |
|----|----------|
| **D34** | **Immutability:** data transforms return new objects; configs are frozen dataclasses; no in-place mutation of manifests/arrays where avoidable. |
| **D35** | **Input validation at boundaries:** validate audio (sample rate, channels, duration, dtype) before inference; fail fast with clear messages. Never trust dataset/file content. |
| **D36** | **Error handling:** explicit, user-friendly messages in the demo; detailed logs server-side; never silently swallow. |
| **D37** | **Testing (pragmatic under D1):** TDD-style unit tests for *deterministic core utilities* — augmentation transforms (seeded), EER computation (known cases), manifest split integrity (no speaker/TTS leakage, D20), embedding shape, i18n key coverage. ML training validated by **smoke tests**, not coverage targets. The global 80% target applies to `data/`, `eval/`, `explain/` utility modules; the demo and training loops are smoke-tested only. State this relaxation explicitly in the README. |

---

## 13. Post-Hackathon Roadmap (pitch as "what's next", do NOT build now)
- SSL-AASIST / AASIST3 hardening; expand to real in-the-wild telephone data (with consent, via operator/bank).
- Streaming / on-device (Android) real-time inference; latency budget < 1 s.
- Add the scam-intent LLM layer (the bilingual conversation classifier) as the second detector → late-fusion decision engine.
- Anti-Fraud Center / 1414 reporting integration; telecom/bank white-label SDK.
- Messenger-channel coverage; continuous OTA model updates as new TTS emerge.
- Cross-Turkic transfer (Uzbek, Kyrgyz).

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Backbone too slow on Mac/CPU | Cache embeddings (D5); config-swap to smaller encoder; reduce clip count. |
| Data download slow / fails | FLEURS (small) over Common Voice (D10); pre-fetch early (hours 1–3); canned demo examples (D32). |
| Overfit on tiny data → fake-good EER | Unseen-speaker + unseen-TTS test split (D19); honest reporting (D23); telephone aug. |
| AASIST eats the clock | Hard STRETCH (D9); cut first (§10). |
| TTS license confusion | Open models only; non-commercial caveat documented (D14); productionization flagged in roadmap. |
| Explainability looks like hand-waving | Pair SHAP with interpretable acoustic indicators + temporal heatmap (D26–D29); label heuristics honestly. |
| False-positive alert fatigue narrative | Calibrate for low FPR; show the threshold (D24). |

---

## 15. Definition of Done (for the 12-hour demo)
1. `demo/app.py` runs locally; upload **and** mic input both produce a verdict.
2. Verdict shows: label, calibrated confidence, temporal heatmap, spectrogram, acoustic
   indicators, and a **bilingual** plain-language reason.
3. A **metrics table** exists (README) covering clean vs telephone-aug × same-domain vs
   unseen-TTS, with EER/AUC/accuracy and stated caveats.
4. 3 canned examples (real kk, real ru, synthetic) work offline.
5. Limitations are stated honestly in README + UI.
6. Core utility tests pass (D37).

---

# 16. Software Architecture — Layered Module Boundaries & Data Flow

> Refines and binds the §11 skeleton. Builds on D5 (cache), D6–D9 (swappable classifiers),
> D17–D20 (manifest), D34–D37 (style/test). Introduces D38–D65.

## 16.1 Layering & dependency direction (one-way, downstream-only)

Six layers; dependencies point **down only**. A higher layer may import a lower one, never
the reverse. Keeps the deterministic core (data/features/eval/explain) testable without the
demo and lets us swap the slow backbone behind a contract.

```
config        (leaf — depends on nothing; everyone imports it)
   ▲
data          (sources, synth, augment, manifest)      ── depends on: config
   ▲
features      (backbone, embed, cache)                 ── depends on: config, data(manifest contract)
   ▲
models        (lgbm, mlp, aasist, calibrate)           ── depends on: config, features(EmbeddingMatrix)
   ▲
eval          (metrics, report)                        ── depends on: config, models(Classifier)
   ▲
explain       (temporal, acoustic, shap, reasons/i18n) ── depends on: config, features, models
   ▲
demo          (Gradio app)                             ── depends on: ALL (composition root only)
```

- **D38** — `demo/app.py` is the **only composition root**: the single place allowed to
  instantiate concrete classes, wire dependencies, and read environment. No lower layer
  imports `demo` or reads env / constructs another layer's concretes directly — they receive
  contracts via constructor/factory args. This is what makes everything below the demo
  unit-testable with fakes.
- **D39** — `config` is a **leaf** with zero internal imports and **no heavy libs** (no torch,
  datasets, lightgbm, gradio at module top-level), so importing config in a test costs ~nothing.
  Heavy libs are imported lazily inside the function that needs them (see D49/D55).

## 16.2 Core contracts (`typing.Protocol`, not base classes)

Structural typing so concrete classes need no inheritance and tests pass plain fakes. Live in
one shared `src/qorgauvoice/contracts.py` (~120 lines) for a 12h build.

- **D40 — `EmbeddingExtractor` contract.** Decouples the three classifiers from the backbone;
  cache and demo depend only on this:
  ```python
  class EmbeddingExtractor(Protocol):
      @property
      def dim(self) -> int: ...
      @property
      def fingerprint(self) -> str: ...                 # backbone id + pooling + revision → cache salt
      def embed(self, audio: AudioClip) -> FloatArray: ...           # (dim,)
      def embed_batch(self, clips: Sequence[AudioClip]) -> FloatArray: ...  # (n, dim)
  ```
  `AudioClip` is a frozen value object `(samples: float32 mono, sample_rate: int, source_id: str)`.
  The extractor **never reads files** — it receives validated, decoded audio (validation at the
  boundary, D49).

- **D41 — `Classifier` contract.** LightGBM (D7), MLP (D8), AASIST-pooled (D9) all satisfy it;
  swapping is a config value, never an `if` ladder:
  ```python
  class Classifier(Protocol):
      def fit(self, X: FloatArray, y: IntArray) -> "Classifier": ...  # returns NEW fitted instance (D34)
      def predict_proba(self, X: FloatArray) -> FloatArray: ...        # (n,) prob of spoof=1
      def save(self, path: Path) -> None: ...
      @classmethod
      def load(cls, path: Path) -> "Classifier": ...
  ```
  `fit` returns a new instance rather than mutating `self` (D34). In-budget AASIST consumes the
  **same cached pooled embeddings**; only the STRETCH end-to-end fine-tune operates on raw audio
  via a **separate** `EndToEndClassifier` variant, physically walled off (see §23.1).

- **D42 — `Manifest` contract (refines D17).** Immutable wrapper over a DataFrame with validated
  columns: `path, label(bona_fide|spoof), language(kk|ru), source, tts_engine|null, speaker_id,
  duration, split(train|test_same|test_unseen)`. Operations (`filter`, `split`, `with_column`)
  return **new** `Manifest` objects. `validate()` enforces the D20 no-leakage invariant (the
  seam tested in §22).

- **D43 — factory selection.** `models/registry.py` maps `config.classifier.kind ∈
  {"lgbm","mlp","aasist"}` → constructor; same for `features/registry.py` (backbone) and
  `data/synth/registry.py` (TTS engines). Strategy/repository pattern **only at these three swap
  points** — single-implementation things (manifest store, metrics) are NOT abstracted (ceremony
  violates D1).

## 16.3 End-to-end data flow

```
FLEURS/CV (D10,D11) ─┐
                     ├─► data/manifest ─► features/embed ──cache──► models/{lgbm|mlp} ─► calibrate ─┐
synth TTS (D12-D14) ─┘        │ (D17-20)    (D40, content-hash)        (D41,D43)         (D24)        │
                             augment (D15-16, seeded)                                                ▼
                                                                          eval/metrics+report (D21-23)
                                                                                                     │
upload/mic ─► validate (§19) ─► AudioClip ─► embed (cache miss=compute) ─► classifier ─► explain ────┴─► Gradio (D31)
```

Training and inference share the **same** `embed → classifier → calibrate` spine; training reads
the manifest, inference reads one validated clip. The demo path is exercised by the eval path.

---

# 17. Framework & Library Choices

Philosophy pinned, not exact versions.

| Concern | Choice | Rationale |
|---|---|---|
| **Package/dep mgr** | **`uv`** + `pyproject.toml` | 10–100× faster installs (saves minutes in 12h); `uv.lock` = reproducible, supply-chain-pinned deps (D50). |
| **Config** | **`pydantic-settings`** roots + **frozen pydantic models** | Validation-at-construction, `frozen=True` → D34 immutability free, env binding without hardcoding, typed. |
| **Audio decode (untrusted)** | **`soundfile`** (libsndfile) primary; `librosa` for resample/features | Hardened C decoder; gated behind our own size/duration check (D49). |
| **Resampling** | **`torchaudio`** / `soxr` (via librosa) | Fast deterministic resample to 16 kHz + 8 kHz telephone sim (D15). |
| **Augmentation** | **`audiomentations`** (numpy) primary | Pure, seedable transforms (D15/D34); simpler to wire than torch variant. |
| **Datasets** | **HF `datasets`** (`streaming=True` where possible) | D10/D11; avoids downloading all of Common Voice. |
| **Backbone** | **`transformers`** `Wav2Vec2Model` + `AutoFeatureExtractor` | D6; `from_pretrained` pinned revision (D51). |
| **Primary classifier** | **`lightgbm`** | D7; trains in seconds, native SHAP. |
| **MLP head** | **PyTorch** tiny `nn.Sequential` | D8; reuses torch already present — no new dep. |
| **Calibration** | **scikit-learn** (`CalibratedClassifierCV`/isotonic) | D24; deterministic. |
| **Metrics** | sklearn + hand-written **EER** (~15 lines) | EER not in sklearn; unit-tested with known cases (D37). |
| **Explainability** | **`shap`** (TreeExplainer), **`librosa`**, **matplotlib** | TreeExplainer exact+fast on trees; librosa for F0/flatness/rolloff/mel. |
| **Demo** | **Gradio 4.x** (`gr.Blocks`) | D31; mature queueing + safer file defaults. Pin major to 4 (avoid 3→5 churn). |
| **Testing** | **`pytest`** + `pytest-cov` (+ `hypothesis` optional) | D37. |
| **Lint/format** | **`ruff`** (lint + format) | One near-instant tool; no config bikeshedding. |
| **Type check** | **`mypy`/`ty`** on `config/`, `contracts.py`, `eval/` only | Type-check the contracts + deterministic core, not everything. |
| **Logging** | stdlib **`logging`** + one `logging_config.py` | D36; detailed server-side, friendly UI. |

- **D44** — No new top-level dependency unless it removes ≥30 min of hand-rolling or is already
  transitively required. Every dep pinned in `uv.lock`.

---

# 18. Config & Secrets Strategy

- **D45 — config tree.** One frozen nested pydantic `AppConfig`, instantiated once at the
  composition root (D38), threaded down as a value:
  `PathsConfig` · `DataConfig` · `SynthConfig` · `AugmentConfig` (D16 toggle) · `BackboneConfig`
  (model_id, revision, pooling, layers) · `ClassifierConfig` (kind + params) · `EvalConfig` ·
  `DeviceConfig` (prefer="mps", cpu_fallback) · `RuntimeConfig` (seed=1337, max_audio_seconds,
  max_upload_bytes, sample_rate=16000).
- **D46 — precedence & no-hardcoding.** Defaults in frozen models → `config.toml` → env (`QV_`
  prefix) → explicit args. **No magic literals** in `data/`/`features/`/`models/` logic; every
  threshold/limit/dim/prob is a config field. (test/log strings exempt.)
- **D47 — secrets.** No app secrets (all data/models public). Only optional `HF_TOKEN` for
  gated/rate-limited downloads: read from env, `SecretStr`, never logged, never written to disk,
  absent-by-default. Fail fast if a chosen source needs it and it's missing (D36).
- **D48 — seeding.** Single `seeding.py` sets `random`/`numpy`/`torch`/`PYTHONHASHSEED` from
  `RuntimeConfig.seed`. Augmentation, splits (D20), MLP init consume the seed **explicitly as a
  parameter** (no hidden global RNG). Resolved config hash + seed recorded in every artifact
  sidecar (§21). Backbone swap (D6) is purely `BackboneConfig.model_id` + `features/registry.py`.

---

# 19. Security Posture — Untrusted Audio + Remote Artifacts

Defense-in-depth at two trust boundaries: (1) audio in, (2) artifacts in.

- **D49 — audio validation gate (refines D35).** One sanctioned decode path
  `data/audio_io.py::load_validated(path|bytes, config) -> AudioClip`, cheap checks first:
  1. **Size cap before decode** (bytes > `max_upload_bytes`, e.g. 15 MB → reject).
  2. **Format allowlist by content sniff** (`{wav,flac,ogg,mp3}` via `soundfile.info`, not extension).
  3. **Header inspection before full decode** (`soundfile.info()` frames/samplerate; reject if
     duration > `max_audio_seconds`, e.g. 30 s) — **decompression-bomb / long-file defense**.
  4. **Decode with a hard frame cap** (`soundfile.read(frames=max_audio_seconds*sr)`).
  5. **Normalize** → mono, 16 kHz, float32, clip/pad to clip length (D18); reject NaN/Inf.
  6. Return frozen `AudioClip`. Malformed-file errors → user-friendly message (D36); raw
     exception logged server-side only (no path/stack leak).
- **D50 — supply-chain hygiene.** `uv.lock` pins exact hashes; resolve once. No unpinned
  `pip install` mid-build; no `--break-system-packages`; no `curl | sh` fetchers.
- **D51 — safe model/dataset loading.** Pin HF `revision=<commit-sha>` (not `main`);
  `use_safetensors=True` where offered (XLS-R, MMS); unavoidable pickle checkpoints loaded with
  `torch.load(..., weights_only=True)`. Trust allowlist: official `facebook/*`, `google/*`,
  `mozilla-foundation/*` orgs only.
- **D52 — non-pickle cache/artifacts.** Embedding cache = `.npy`/`.npz` + JSON sidecar. **No
  `pickle`/`joblib.dump`** of arbitrary objects. LGBM = native text model; MLP = `state_dict`
  (weights_only load); calibrator = JSON. Closes unsafe-deserialization on our own artifacts.
- **D53 — Gradio exposure (refines D31).** `launch(share=False, server_name="127.0.0.1")` —
  **never** `share=True`. Enforce D49 size/type gate inside the handler (treat every Gradio input
  as untrusted). `gr.File` temp paths go straight to `load_validated` — never join user strings
  into our data dir (no path traversal). Request queue with a concurrency cap (flood defense).

---

# 20. Performance & Latency Design

- **D54 — content-hash cache key (the key perf lever, supports D5).**
  `key = sha256(normalized_audio_bytes) ⊕ extractor.fingerprint`, where
  `fingerprint = f"{model_id}@{revision}|pool={pooling}|layers={layers}|sr={sample_rate}"`.
  Keying on **content** (not path) dedups; the fingerprint salt **auto-invalidates** on any
  backbone/pooling/layer/sr change (no manual cache-busting). Stored as
  `artifacts/cache/embeddings/<key>.npy` + one `manifest_embeddings.parquet` index (no 3000 tiny
  reads at train time).
- **D55 — device select + lazy backbone.** `device_for(config)` → `mps` if available & preferred,
  else `cpu` (D5). Backbone is a **lazy singleton** inside `Wav2Vec2Extractor` — `from_pretrained`
  runs on **first `embed` call**, not at import — so the deterministic test suite never loads 1.2 GB.
  Demo warms it once at startup.
- **D56 — batching.** `embed_batch` pads to one batch tensor, single forward under
  `inference_mode()` + `eval()`; batch size config (default 16 MPS / 4 CPU). Training extraction
  fully batched + cached once (the D1 hour 3–4 gate).
- **D57 — single-clip latency budget (warm, ~4 s clip, MPS):** decode+validate+resample <50 ms;
  backbone forward <300 ms MPS / <1.5 s CPU; pooling+LGBM+calibrate <10 ms; temporal heatmap
  bounded to ≤N windows (config, e.g. 8) reusing **one batched forward**. **Total verdict target
  < 1.5 s warm on MPS** (beats the "detection speed" criterion).
- **D58 — progressive explainability.** SHAP (D29) + matplotlib render **after** the verdict
  returns to the UI, so explainability cost never inflates headline latency.

---

# 21. Caching & Artifact Layout

- **D59 — directory contract (gitignored except where noted; refines §11).**
  ```
  data/                                   # inputs, gitignored
    raw/fleurs/{kk_kz,ru_ru}/             # bona fide
    raw/common_voice/                     # optional sample (D11)
    synth/{mms,silero,xtts}/              # generated spoofs (D12-14)
    examples/                             # canned demo clips (D32) — bona fide committed; synth gitignored (§23.2)
  artifacts/                              # derived, gitignored, regenerable
    manifest.parquet                      # immutable manifest (D17, D42)
    cache/embeddings/<key>.npy            # content-hashed (D54)
    cache/manifest_embeddings.parquet     # cache index
    models/lgbm.txt | mlp.pt | calibrator.json   # non-pickle native formats (D52)
    reports/metrics_<config_hash>.json    # eval tables (D22)
    config_resolved/<run>.json            # frozen config + seed provenance (D48)
  ```
- **D60 — invalidation.** Embeddings invalidated by content hash ⊕ fingerprint (D54).
  Models/calibrator/reports carry a **config hash** in the filename; changing params/splits writes
  a new immutable artifact (D34), old kept for comparison. Demo loads the artifact whose config
  hash matches; on mismatch logs a clear warning and loads the committed canonical one.
- **D61 — atomic writes.** Manifest + cache index are append-only within a run, rewritten via
  temp → `os.replace` so a crash can't corrupt the index.

---

# 22. Testability — The Seams

Realizes D37; the §16.1 dependency direction is designed so the deterministic core needs zero
heavy libs.

- **D62 — fakes at the contracts.** `FakeEmbeddingExtractor` (deterministic `(dim,)` from a seed)
  implements D40, letting `models/`/`eval/`/`explain/` be tested **without loading XLS-R** —
  suite runs in seconds (D1 + D37).
- **D63 — tested seams (80% zone):**
  - `data/augment/*` — pure `(clip, rng) -> clip`; determinism (same seed → identical bytes),
    shape/dtype invariants, symmetric treatment of both classes (D15).
  - `data/manifest.py::validate` — **no-leakage invariant** (D20): no speaker / synth-source pair
    crosses train↔test_unseen; unseen TTS engine absent from train (D19). Highest-value test
    (makes the headline EER honest).
  - `eval/metrics.py::eer` — known closed-form cases.
  - `features/embed.py::cache_key` — same content → same key; changed fingerprint → changed key (D54).
  - `explain/reasons` + `i18n` — **key-coverage** test: every key exists in kk/ru/en (D30).
  - `data/audio_io.py::load_validated` — oversized / lying-header / wrong-format / NaN / 0-length
    each rejected with the right error class (D49 security regression tests).
- **D64 — smoke-only zone** (not held to 80%): `features/backbone.py`, `models/*::fit`,
  `demo/app.py` — one smoke test each (embed returns `(dim,)`; LGBM fits+predicts on synthetic
  vectors; Gradio handler returns a populated verdict dict).
- **D65 — test layout** mirrors src: `tests/unit/{data,features,models,eval,explain}/`,
  `tests/smoke/`, `tests/fixtures/audio/` (≤1 s tiny clips).

---

# 23. Flagged Conflicts & Resolutions

1. **§23.1 — D9 (STRETCH AASIST) vs. the pooled `Classifier` contract (D41).** Credible-SOTA
   AASIST wants frame-level SSL features, not the mean+std pooled vector the cache stores.
   **Resolution:** keep D41 for LGBM/MLP; define a **separate** `EndToEndClassifier` taking
   `AudioClip`/frame-features, gated entirely behind `config.classifier.kind=="aasist"`. Do not
   retrofit the pooled cache. Honors D9's "must not block the demo" by physical isolation.
2. **§23.2 — D14 TTS licenses (CC-BY-NC / CPML) vs. committing demo artifacts (D32/D59).**
   Committed synthetic clips would be non-commercial-licensed derivatives in a possibly-public
   repo. **Resolution:** commit only **bona fide** examples (FLEURS = CC-BY, attributed); generate
   synthetic examples at demo startup into gitignored `data/examples/`, or commit under a marked
   `examples/NONCOMMERCIAL_LICENSE.md`.
3. **§23.3 — D5 "cache to disk" vs. D52 "no pickle".** The fast way (joblib/pickle) is an
   unsafe-deserialization foothold in our own artifacts. **Resolution:** `.npy` + JSON only (D52);
   costs nothing in build time, removes the attack surface.
4. **§23.4 — D31 mic record vs. D49 validation.** Browser audio arrives as webm/opus; decoding it
   tempts shelling out to ffmpeg on untrusted input. **Resolution:** use `gr.Audio(type="numpy")`
   so Gradio hands us **already-decoded samples + sample_rate**; validate the array via the same
   `load_validated` core (bytes-vs-array branch). Sidesteps untrusted-container parsing entirely.
5. **§23.5 — D37 relaxed coverage vs. global 80% rule.** Already reconciled; D62–D65 make the
   relaxation structural (80% on core utils, smoke-only on training/demo), not an excuse.

No internal contradictions among D0–D37; the only real tension (D9 raw-feature need vs. pooled
cache) is resolved in §23.1.

---

# 24. Decision Index

- **D0–D5** Constraints — clean-room · 12h · anti-spoofing only · open+synthetic data · Kazakh+Russian · Apple-Silicon/MPS.
- **D6–D9** Model — frozen XLS-R-300m · LightGBM primary · MLP upgrade · SSL-AASIST STRETCH.
- **D10–D20** Data — FLEURS bona fide · Common Voice supplement · self-gen spoof · matched content · MMS/Silero/XTTS · augmentation (telephone/noise/reverb) · aug toggle · manifest · clip length/size · unseen-TTS+unseen-speaker split · deterministic no-leak splits.
- **D21–D24** Eval — EER primary · 2 settings × 2 splits · honest targets · calibration/threshold.
- **D25–D30** Explainability — verdict+confidence · temporal heatmap · acoustic indicators · spectrogram · SHAP · bilingual reasons.
- **D31–D33** Demo — Gradio upload+mic · canned examples · honest limitations.
- **D34–D37** Standards — immutability · validation · error handling · pragmatic TDD.
- **D38–D43** Architecture — single composition root · config leaf · `EmbeddingExtractor` · `Classifier`(+EndToEnd) · `Manifest` · three registries.
- **D44–D48** Frameworks/Config — dep-add discipline · frozen `AppConfig` · precedence/no-hardcoding · `HF_TOKEN`-only secrets · explicit seeding.
- **D49–D53** Security — audio validation gate · supply-chain pinning · safe model loading · non-pickle artifacts · Gradio localhost-only.
- **D54–D58** Performance — content-hash cache key · lazy backbone+device select · batching · <1.5 s latency budget · progressive explainability.
- **D59–D61** Artifacts — directory contract · config-hash invalidation · atomic writes.
- **D62–D65** Testability — contract fakes · tested seams · smoke-only zone · test layout.
- **D66–D69** Discovered during implementation — **D66** torch/LightGBM **two-process split**
  (`build_features.py` torch-only → `features.npz`; `train.py` LightGBM-only) to avoid the macOS
  OpenMP segfault · **D67** augmentation as **parallel feature matrices** (`X` clean, `X_deg`
  degraded), train on `clean ∪ degraded`, 2×2 eval · **D68** FLEURS via **direct Parquet shard
  download** (`refs/convert/parquet`, default `validation` split) because the dataset *builder*
  hangs in this env · **D69** Silero synth at 24 kHz then resample to 16 kHz, and Silero is
  RU-only (Kazakh unseen-TTS is an open gap).
- **D70–D71** Robustness fix — **D70** room "played-back/re-recorded" augmentation (band-pass +
  randomized RIR + ambient noise), applied to both classes, to kill the channel shortcut ·
  **D71** engine diversity (MMS + Apple-say + edge-tts + gTTS seen; Silero held out) so the model
  learns engine-invariant synthetic cues that survive the room channel.

---

## 25. Glossary
- **Bona fide:** genuine human speech.
- **Spoof:** AI-generated speech (TTS or voice-cloned/converted).
- **EER:** Equal Error Rate — threshold where false-accept = false-reject; lower is better.
- **Domain amnesia:** anti-spoofing models that score well in-lab collapsing on real/out-of-domain audio.
- **SSL backbone:** self-supervised pretrained audio encoder (wav2vec2/XLS-R).
- **Unseen-TTS split:** test set whose synthetic samples come from a TTS engine absent from training — the honest generalization measure.
