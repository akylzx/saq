/**
 * Fraud-risk assessment. Fuses multiple weighted signals into a single fraud
 * score and verdict. The question this answers is "is this likely fraudulent?",
 * NOT "is this AI-generated?" — synthetic voice is just one capped contributor,
 * so harmless AI content stays Low and a human-voiced scam still reads High.
 *
 * Pure and deterministic. Signal generation lives elsewhere (transcriptSignals,
 * stt, api); this module only assesses risk.
 */
import type { DetectData } from "./api";
import type { STTResult } from "./stt";
import type { DetectedSignal, Severity } from "./transcriptSignals";

export type RiskLevel = "low" | "medium" | "high";

export interface RiskFactor {
  label: string;
  detail: string;
  severity: Severity | "info";
  /** Points this factor added to the score (0 for informational/context). */
  contribution: number;
}

export interface FraudResult {
  level: RiskLevel;
  score: number; // 0..100
  summary: string;
  factors: RiskFactor[];
}

// AI voice is a supporting signal: capped below the "medium" band so it can
// never, on its own, flag harmless synthetic audio as fraud.
const AI_MAX_POINTS = 18;
const AI_PRESENT = 0.6; // spoof prob above which we treat the voice as "synthetic"
const COMBO_BONUS = 12; // synthetic voice *delivering* a scam script
const MED = 25;
const HIGH = 60;

export function assessFraud(
  detection: DetectData | null,
  stt: STTResult | null,
  signals: DetectedSignal[],
  durationSec: number,
): FraudResult {
  const factors: RiskFactor[] = [];
  let score = 0;

  // --- transcript scam indicators (the primary fraud driver) ---
  for (const sig of signals) {
    score += sig.weight;
    factors.push({
      label: sig.label,
      detail: quoteMatches(sig.matches),
      severity: sig.severity,
      contribution: sig.weight,
    });
  }

  // --- audio: AI-voice probability, capped and supporting ---
  const spoofP = detection?.spoof_probability ?? null;
  if (spoofP !== null) {
    const pts = Math.round(AI_MAX_POINTS * spoofP);
    score += pts;
    factors.push({
      label: "Synthetic-voice likelihood",
      detail: `${Math.round(spoofP * 100)}% AI-like voice`,
      severity: spoofP >= AI_PRESENT ? "medium" : "info",
      contribution: pts,
    });
  } else {
    factors.push({
      label: "Voice analysis",
      detail: "Unavailable — scored from transcript only.",
      severity: "info",
      contribution: 0,
    });
  }

  // --- behavioural: synthetic voice + scam script is worse than either alone ---
  if (spoofP !== null && spoofP >= AI_PRESENT && signals.length > 0) {
    score += COMBO_BONUS;
    factors.push({
      label: "Synthetic voice + scam script",
      detail: "A machine voice is delivering scam content.",
      severity: "high",
      contribution: COMBO_BONUS,
    });
  }

  // --- contextual: transcription quality (informational) ---
  if (stt) {
    if (stt.words > 0 && stt.confidence < 0.4) {
      factors.push({
        label: "Low transcription confidence",
        detail: `${Math.round(stt.confidence * 100)}% est. — content read may be partial.`,
        severity: "info",
        contribution: 0,
      });
    }
    if (stt.words === 0 && durationSec > 1.2) {
      factors.push({
        label: "No intelligible speech",
        detail: "Couldn't read the content of this clip.",
        severity: "info",
        contribution: 0,
      });
    }
  }

  score = Math.min(100, Math.round(score));
  const level: RiskLevel = score >= HIGH ? "high" : score >= MED ? "medium" : "low";

  return { level, score, summary: summarize(level, signals, spoofP, stt), factors };
}

function quoteMatches(matches: string[]): string {
  const shown = matches.slice(0, 2).map((m) => `"${m}"`).join(", ");
  const extra = matches.length > 2 ? ` +${matches.length - 2} more` : "";
  return `Detected ${shown}${extra}`;
}

function summarize(
  level: RiskLevel,
  signals: DetectedSignal[],
  spoofP: number | null,
  stt: STTResult | null,
): string {
  const top = signals.slice(0, 2).map((s) => s.label.toLowerCase());
  const synthetic = spoofP !== null && spoofP >= AI_PRESENT;

  if (level === "high") {
    const lead = top.length ? `It ${top.join(" and ")}` : "The voice shows strong synthetic markers";
    return `${lead}${synthetic && top.length ? ", in a synthetic-sounding voice" : ""}. Treat this as a likely scam — do not share codes, card details, or money.`;
  }
  if (level === "medium") {
    if (top.length) {
      return `Some scam-like cues are present (${top.join(", ")}). Be cautious and verify the caller through an official channel.`;
    }
    return `The voice sounds synthetic but the content shows no clear scam intent. Stay alert and verify if anything is requested.`;
  }
  // low
  if (!stt || stt.words === 0) {
    return "No scam indicators were found in the available signals. Risk appears low.";
  }
  return "No scam language and no strong synthetic markers were detected. This looks low-risk, but stay alert if money or codes come up.";
}
