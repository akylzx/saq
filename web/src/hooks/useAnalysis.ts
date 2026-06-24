import { useCallback, useRef, useState } from "react";
import { detect, DetectError, type DetectData } from "../lib/api";
import { AudioInputError, decodeForAnalysis, encodeWav } from "../lib/audio";
import { assessFraud, type FraudResult } from "../lib/fraud";
import { extractSignals } from "../lib/transcriptSignals";
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
  fraud: FraudResult | null;
}

const INITIAL: AnalysisState = {
  phase: "idle",
  step: "",
  modelProgress: null,
  error: null,
  durationSec: null,
  stt: { ok: false, data: null, error: null },
  detection: { ok: false, data: null, error: null },
  fraud: null,
};

/** Returns the ?mock value ("ai" default) or null when not in mock mode. */
const mockMode = (): string | null => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("mock")) return null;
  return params.get("mock") || "ai";
};

/** Build the fraud assessment from whatever signals came back. */
function buildFraud(
  detection: DetectData | null,
  stt: STTResult | null,
  durationSec: number,
): FraudResult {
  const signals = extractSignals(stt?.transcript ?? "");
  return assessFraud(detection, stt, signals, durationSec);
}

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

    // Hard failure only if neither signal came back — nothing to assess.
    if (!stt.ok && !detection.ok) {
      patch({ phase: "error", step: "", error: detection.error ?? stt.error, stt, detection });
      return;
    }

    const fraud = buildFraud(detection.data, stt.data, durationSec);
    patch({ phase: "done", step: "", modelProgress: null, stt, detection, fraud });
  }, []);

  return { state, analyze, reset };
}

function messageFor(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

/* ----------------------- mock scenarios (?mock=<mode>) ---------------------- */

const stt = (transcript: string, confidence = 0.88, language: "ru" | "kk" | "en" = "ru"): STTResult => ({
  transcript,
  language,
  languageLabel: language === "ru" ? "Russian" : language === "kk" ? "Kazakh" : "English",
  confidence,
  words: transcript.split(/\s+/).filter(Boolean).length,
  segments: [{ start: 0, end: 7, text: transcript }],
});

const det = (p: number): DetectData => ({
  label: p >= 0.5 ? "spoof" : "bona_fide",
  spoof_probability: p,
  confidence: p >= 0.5 ? p : 1 - p,
  threshold: 0.5,
  reason: { en: "", ru: "", kk: "" },
  spectrogram_png_base64: null,
});

const SCAM = "Это служба безопасности банка. Срочно продиктуйте код из смс, иначе мы заблокируем счёт и переведём деньги.";
const HARMLESS = "Привет, как дела? Давай встретимся завтра возле кафе в три часа.";

const MOCKS: Record<string, { stt: STTResult | null; detection: DetectData | null; duration: number }> = {
  // AI voice + bank-impersonation scam → High
  ai: { stt: stt(SCAM), detection: det(0.95), duration: 7.2 },
  // human voice running the same scam → still High (fraud ≠ AI)
  humanscam: { stt: stt(SCAM), detection: det(0.07), duration: 7.2 },
  // AI voice reading harmless content → Low (harmless AI is not fraud)
  safeai: { stt: stt(HARMLESS), detection: det(0.93), duration: 5.4 },
  // human, normal conversation → Low
  human: { stt: stt(HARMLESS), detection: det(0.06), duration: 5.4 },
  // synthetic voice, vague content → Medium
  inconclusive: { stt: stt("Здравствуйте, у нас для вас важное сообщение, перезвоните нам.", 0.6), detection: det(0.9), duration: 4.6 },
  // detector offline, scam transcript → scored from transcript alone
  offline: { stt: stt(SCAM), detection: null, duration: 7.2 },
};

async function runMock(patch: (p: Partial<AnalysisState>) => void, mode: string) {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  patch({ phase: "running", step: "Loading speech model… 60%", modelProgress: 60, durationSec: 7 });
  await wait(450);
  patch({ step: "Transcribing and analyzing…", modelProgress: null });
  await wait(550);

  const { stt: sttData, detection, duration } = MOCKS[mode] ?? MOCKS.ai;
  patch({
    phase: "done",
    step: "",
    stt: sttData ? { ok: true, data: sttData, error: null } : { ok: false, data: null, error: "Transcription failed." },
    detection: detection
      ? { ok: true, data: detection, error: null }
      : { ok: false, data: null, error: "Couldn't reach the saq backend." },
    fraud: buildFraud(detection, sttData, duration),
  });
}
