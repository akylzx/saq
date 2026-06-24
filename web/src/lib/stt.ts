/**
 * Main-thread wrapper around the Whisper worker. Owns the worker lifecycle and
 * turns Whisper's raw output into a structured transcript: detected language,
 * an estimated confidence, and timestamped segments.
 *
 * Whisper doesn't emit a calibrated confidence, so we derive an honest estimate
 * from signals we do have (speech coverage, plausible speech rate, hallucination
 * markers) and label it as an estimate in the UI.
 */

export interface Segment {
  start: number;
  end: number | null;
  text: string;
}

/** saq supports exactly three languages. */
export type Language = "kk" | "ru" | "en";

export interface STTResult {
  transcript: string;
  language: Language;
  languageLabel: string;
  confidence: number; // 0..1, estimated
  segments: Segment[];
  words: number;
}

export type STTProgress =
  | { phase: "download"; progress: number; file?: string }
  | { phase: "run"; progress: number };

type WorkerMsg =
  | { type: "progress"; id: number; phase: "download"; progress: number; file?: string }
  | { type: "progress"; id: number; phase: "run"; progress: number }
  | { type: "result"; id: number; text: string; chunks: Segment[] | { timestamp: [number, number | null]; text: string }[] }
  | { type: "error"; id: number; message: string };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (r: { text: string; chunks: Segment[] }) => void; reject: (e: Error) => void; onProgress?: (p: STTProgress) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./stt.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerMsg>) => {
      const msg = e.data;
      const entry = pending.get(msg.id);
      if (!entry) return;
      if (msg.type === "progress") {
        entry.onProgress?.(
          msg.phase === "download"
            ? { phase: "download", progress: msg.progress, file: msg.file }
            : { phase: "run", progress: msg.progress },
        );
      } else if (msg.type === "result") {
        pending.delete(msg.id);
        entry.resolve({ text: msg.text, chunks: normalizeChunks(msg.chunks) });
      } else {
        pending.delete(msg.id);
        entry.reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      const err = new Error(e.message || "Speech recognition worker crashed.");
      for (const [, entry] of pending) entry.reject(err);
      pending.clear();
    };
  }
  return worker;
}

function normalizeChunks(
  chunks: Segment[] | { timestamp: [number, number | null]; text: string }[],
): Segment[] {
  return chunks.map((c) => {
    if ("start" in c) return c;
    return { start: c.timestamp?.[0] ?? 0, end: c.timestamp?.[1] ?? null, text: c.text };
  });
}

/** Transcribe 16 kHz mono samples. `durationSec` is used for the confidence estimate. */
export function transcribe(
  samples: Float32Array,
  durationSec: number,
  opts: { language?: string | null; onProgress?: (p: STTProgress) => void } = {},
): Promise<STTResult> {
  const w = getWorker();
  const id = nextId++;
  return new Promise<{ text: string; chunks: Segment[] }>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress: opts.onProgress });
    // Transfer the audio buffer — the caller has already encoded the WAV it needs.
    w.postMessage({ type: "transcribe", id, audio: samples, language: opts.language ?? null }, [
      samples.buffer,
    ]);
  }).then(({ text, chunks }) => interpret(text, chunks, durationSec));
}

const LANG_LABELS: Record<Language, string> = {
  kk: "Kazakh",
  ru: "Russian",
  en: "English",
};

/** Map the transcript to one of saq's three supported languages by script.
 * Whisper transcribes in the spoken language, so the characters are a reliable,
 * dependency-free signal; anything non-Cyrillic falls back to English. */
function detectLanguage(text: string): Language {
  if (/[әғқңөұүһі]/i.test(text)) return "kk"; // Kazakh-specific Cyrillic letters
  if (/[а-яё]/i.test(text)) return "ru"; // other Cyrillic → Russian
  return "en";
}

/** Estimate transcription confidence from coverage, speech rate, and repetition. */
function estimateConfidence(text: string, segments: Segment[], durationSec: number): number {
  const clean = text.trim();
  if (!clean) return 0;

  let score = 0.82;

  const words = clean.split(/\s+/).filter(Boolean);
  const wps = words.length / Math.max(0.5, durationSec);
  if (wps < 0.3 || wps > 6) score -= 0.25; // implausible pace → likely garbled

  // Coverage: how much of the clip Whisper actually labeled with speech.
  if (segments.length) {
    const covered = segments.reduce((acc, s) => acc + Math.max(0, (s.end ?? s.start) - s.start), 0);
    const coverage = Math.min(1, covered / Math.max(0.5, durationSec));
    if (coverage < 0.4) score -= 0.2;
  }

  // Whisper hallucinations often repeat one token; penalize low lexical variety.
  if (words.length >= 6) {
    const variety = new Set(words.map((w) => w.toLowerCase())).size / words.length;
    if (variety < 0.35) score -= 0.3;
  }

  return Math.max(0.15, Math.min(0.98, score));
}

function interpret(text: string, chunks: Segment[], durationSec: number): STTResult {
  const transcript = text.trim();
  const language = detectLanguage(transcript);
  const words = transcript ? transcript.split(/\s+/).filter(Boolean).length : 0;
  return {
    transcript,
    language,
    languageLabel: LANG_LABELS[language],
    confidence: estimateConfidence(transcript, chunks, durationSec),
    segments: chunks,
    words,
  };
}
