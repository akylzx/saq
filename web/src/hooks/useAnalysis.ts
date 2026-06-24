import { useCallback, useRef, useState } from "react";
import { detect, DetectError, type DetectData } from "../lib/api";
import { AudioInputError, decodeForAnalysis, encodeWav } from "../lib/audio";
import { combineSignals, type CombinedResult } from "../lib/analyze";
import { transcribe, type STTProgress, type STTResult } from "../lib/stt";

export type Phase = "idle" | "decoding" | "running" | "done" | "error";

export interface AnalysisState {
  phase: Phase;
  step: string; // human-readable progress line
  modelProgress: number | null; // 0..100 while the STT model downloads
  error: string | null;
  durationSec: number | null;
  stt: { ok: boolean; data: STTResult | null; error: string | null };
  detection: { ok: boolean; data: DetectData | null; error: string | null };
  combined: CombinedResult | null;
}

const INITIAL: AnalysisState = {
  phase: "idle",
  step: "",
  modelProgress: null,
  error: null,
  durationSec: null,
  stt: { ok: false, data: null, error: null },
  detection: { ok: false, data: null, error: null },
  combined: null,
};

/** Returns the ?mock value ("ai" default) or null when not in mock mode. */
const mockMode = (): string | null => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("mock")) return null;
  return params.get("mock") || "ai";
};

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>(INITIAL);
  const runId = useRef(0);

  const reset = useCallback(() => setState(INITIAL), []);

  const analyze = useCallback(async (input: Blob, _name?: string) => {
    const id = ++runId.current;
    const patch = (p: Partial<AnalysisState>) =>
      setState((s) => (runId.current === id ? { ...s, ...p } : s));

    setState({ ...INITIAL, phase: "decoding", step: "Reading audio…" });

    const mock = mockMode();
    if (mock) {
      await runMock(patch, mock);
      return;
    }

    // 1. Decode + validate once, into a normalized signal for both consumers.
    let samples: Float32Array;
    let durationSec: number;
    let wav: File;
    try {
      const decoded = await decodeForAnalysis(input);
      samples = decoded.samples;
      durationSec = decoded.durationSec;
      wav = encodeWav(samples); // build the backend WAV before the buffer is transferred
    } catch (e) {
      patch({
        phase: "error",
        step: "",
        error: e instanceof AudioInputError ? e.message : "Couldn't read that audio.",
      });
      return;
    }

    patch({ phase: "running", step: "Transcribing and analyzing…", durationSec });

    // 2. Transcript (in-browser Whisper) and voice detection (backend) in parallel.
    const sttPromise = transcribe(samples, durationSec, {
      onProgress: (p: STTProgress) =>
        patch({
          modelProgress: p.phase === "download" ? p.progress : null,
          step:
            p.phase === "download"
              ? `Loading speech model… ${p.progress}%`
              : "Transcribing and analyzing…",
        }),
    });
    const detPromise = detect(wav);

    const [sttRes, detRes] = await Promise.allSettled([sttPromise, detPromise]);
    if (runId.current !== id) return;

    const stt =
      sttRes.status === "fulfilled"
        ? { ok: true, data: sttRes.value, error: null }
        : { ok: false, data: null, error: messageFor(sttRes.reason, "Transcription failed.") };

    const detection =
      detRes.status === "fulfilled"
        ? { ok: true, data: detRes.value, error: null }
        : {
            ok: false,
            data: null,
            error: detRes.reason instanceof DetectError ? detRes.reason.message : "Voice analysis failed.",
          };

    const combined = combineSignals(detection.data, stt.data, durationSec);

    // Hard failure only if neither signal came back.
    if (!stt.ok && !detection.ok) {
      patch({ phase: "error", step: "", error: detection.error ?? stt.error, stt, detection });
      return;
    }

    patch({ phase: "done", step: "", modelProgress: null, stt, detection, combined });
  }, []);

  return { state, analyze, reset };
}

function messageFor(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

/** Canned end-to-end results for ?mock=<ai|human|inconclusive|offline> — verifies
 * every verdict branch in the UI without the model or backend. */
async function runMock(patch: (p: Partial<AnalysisState>) => void, mode: string) {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  patch({ phase: "running", step: "Loading speech model… 60%", modelProgress: 60, durationSec: 7.4 });
  await wait(450);
  patch({ step: "Transcribing and analyzing…", modelProgress: null });
  await wait(550);

  const { stt, detection, duration } = MOCKS[mode] ?? MOCKS.ai;
  patch({
    phase: "done",
    step: "",
    stt: stt ? { ok: true, data: stt, error: null } : { ok: false, data: null, error: "Transcription failed." },
    detection: detection
      ? { ok: true, data: detection, error: null }
      : { ok: false, data: null, error: "Couldn't reach the saq backend." },
    combined: combineSignals(detection, stt, duration),
  });
}

const ru = (transcript: string, confidence: number): STTResult => ({
  transcript,
  language: "ru",
  languageLabel: "Russian",
  confidence,
  words: transcript.split(/\s+/).length,
  segments: [{ start: 0, end: 7.4, text: transcript }],
});

const det = (p: number): DetectData => ({
  label: p >= 0.5 ? "spoof" : "bona_fide",
  spoof_probability: p,
  confidence: p >= 0.5 ? p : 1 - p,
  threshold: 0.5,
  reason: {
    en: p >= 0.5 ? "Acoustic patterns consistent with synthetic speech." : "Natural human voice characteristics.",
    ru: p >= 0.5 ? "Признаки синтетической речи." : "Естественные характеристики живого голоса.",
    kk: p >= 0.5 ? "Синтетикалық сөзге тән белгілер." : "Тірі дауысқа тән табиғи сипаттар.",
  },
  spectrogram_png_base64: null,
});

const MOCKS: Record<string, { stt: STTResult | null; detection: DetectData | null; duration: number }> = {
  ai: { stt: ru("Это служба безопасности банка. Подтвердите перевод средств, пожалуйста.", 0.88), detection: det(0.95), duration: 7.4 },
  human: { stt: ru("Привет, я перезвоню тебе чуть позже, сейчас занят.", 0.91), detection: det(0.06), duration: 6.2 },
  inconclusive: { stt: ru("…алло… слышно плохо…", 0.32), detection: det(0.54), duration: 5.0 },
  offline: { stt: ru("Привет, как дела? Давай встретимся завтра.", 0.86), detection: null, duration: 4.8 },
};
