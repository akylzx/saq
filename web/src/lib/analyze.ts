/**
 * Combine the AI-voice detector with transcript metadata into a final, explained
 * assessment. The detector is the primary signal, but — per the brief — it is not
 * the only one: poor transcription quality, no intelligible speech, or an
 * out-of-scope language all reduce how much we trust a confident voice verdict
 * and can pull the result to "inconclusive".
 *
 * Pure and deterministic, so the logic is easy to reason about and test.
 */
import type { DetectData } from "./api";
import type { STTResult } from "./stt";

export type Assessment = "human" | "ai" | "inconclusive";

export interface Factor {
  label: string;
  detail: string;
  lean: "ai" | "human" | "neutral";
  weight: "primary" | "supporting";
}

export interface CombinedResult {
  assessment: Assessment;
  /** 0..1 confidence in the stated assessment; null when inconclusive. */
  confidence: number | null;
  summary: string;
  factors: Factor[];
}

const IN_SCOPE = new Set(["kk", "ru", "en"]);
const DECISIVE = 0.5; // minimum combined certainty to commit to human/ai

export function combineSignals(
  detection: DetectData | null,
  stt: STTResult | null,
  durationSec: number,
): CombinedResult {
  const factors: Factor[] = [];

  // Without the detector we can't judge the voice; report transcript only.
  if (!detection) {
    if (stt) {
      factors.push({
        label: "Transcript",
        detail: `${stt.words} words · ${stt.languageLabel}`,
        lean: "neutral",
        weight: "supporting",
      });
    }
    factors.push({
      label: "Voice analysis",
      detail: "Unavailable — couldn't reach the detector.",
      lean: "neutral",
      weight: "primary",
    });
    return {
      assessment: "inconclusive",
      confidence: null,
      summary:
        "The voice detector is offline, so this can't be confirmed from acoustics. The transcript below is still available.",
      factors,
    };
  }

  const p = detection.spoof_probability; // probability the voice is synthetic
  const lean: Exclude<Assessment, "inconclusive"> = p >= 0.5 ? "ai" : "human";
  let certainty = Math.abs(p - 0.5) * 2; // detector decisiveness, 0..1

  factors.push({
    label: "Voice acoustics",
    detail: `${Math.round(p * 100)}% AI-like (detector ${Math.round(detection.confidence * 100)}% sure)`,
    lean,
    weight: "primary",
  });

  // --- supporting signals: erode certainty when the audio is hard to trust ---
  if (stt) {
    const noSpeech = stt.words === 0 && durationSec > 1.2;
    if (noSpeech) {
      certainty -= 0.5;
      factors.push({
        label: "Speech content",
        detail: "No intelligible speech detected.",
        lean: "neutral",
        weight: "supporting",
      });
    } else {
      factors.push({
        label: "Transcription quality",
        detail: `${Math.round(stt.confidence * 100)}% est. · ${stt.words} words`,
        lean: "neutral",
        weight: "supporting",
      });
      if (stt.confidence < 0.4) certainty -= 0.3; // garbled audio → less to go on
    }

    factors.push({
      label: "Detected language",
      detail: IN_SCOPE.has(stt.language)
        ? stt.languageLabel
        : `${stt.languageLabel} (outside saq's tuned range)`,
      lean: "neutral",
      weight: "supporting",
    });
    if (!IN_SCOPE.has(stt.language)) certainty -= 0.2; // model tuned for kk/ru
  }

  certainty = Math.max(0, certainty);

  if (certainty < DECISIVE) {
    return {
      assessment: "inconclusive",
      confidence: null,
      summary: buildSummary("inconclusive", p, stt),
      factors,
    };
  }

  return {
    assessment: lean,
    confidence: Math.min(0.99, 0.55 + certainty * 0.44),
    summary: buildSummary(lean, p, stt),
    factors,
  };
}

function buildSummary(assessment: Assessment, p: number, stt: STTResult | null): string {
  const pct = Math.round((assessment === "human" ? 1 - p : p) * 100);
  if (assessment === "ai") {
    return `The voice carries acoustic patterns consistent with synthetic speech (${pct}%). Treat this call with caution.`;
  }
  if (assessment === "human") {
    return `The voice shows the natural variation of genuine human speech (${pct}%). No synthetic markers stood out.`;
  }
  const reason =
    stt && stt.words === 0
      ? "there's no clear speech to corroborate it"
      : stt && stt.confidence < 0.4
        ? "the audio is too degraded to be sure"
        : "the signals don't agree strongly enough";
  return `The evidence is mixed — ${reason}. Verify through another channel before trusting this voice.`;
}
