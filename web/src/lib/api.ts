/**
 * Thin client for the saq detection API. The contract is stable and documented
 * in ../../CLAUDE.md: POST /api/v1/detect (multipart, field `audio`).
 *
 * The dev server proxies /api → http://127.0.0.1:8000 (see vite.config.ts), so
 * the demo works against a locally running backend with no CORS setup.
 */

export type Verdict = "spoof" | "bona_fide";

export interface DetectData {
  label: Verdict;
  spoof_probability: number;
  confidence: number;
  threshold: number;
  reason: { en: string; ru: string; kk: string };
  spectrogram_png_base64: string | null;
}

interface DetectEnvelope {
  success: boolean;
  error: string | null;
  data: DetectData | null;
}

export class DetectError extends Error {}

const MAX_BYTES = 15 * 1024 * 1024; // mirror the backend's 15 MB gate

/** Send one audio file to the detector. Throws DetectError with a friendly message. */
export async function detect(file: File, signal?: AbortSignal): Promise<DetectData> {
  if (file.size > MAX_BYTES) {
    throw new DetectError("That file is over 15 MB. Trim the clip and try again.");
  }

  const form = new FormData();
  form.append("audio", file);

  let res: Response;
  try {
    res = await fetch("/api/v1/detect?spectrogram=true", {
      method: "POST",
      body: form,
      signal,
    });
  } catch {
    throw new DetectError(
      "Couldn't reach the saq backend. Start it with `uv run uvicorn qorgauvoice.api.server:app` and try again.",
    );
  }

  let envelope: DetectEnvelope;
  try {
    envelope = (await res.json()) as DetectEnvelope;
  } catch {
    throw new DetectError("The backend returned an unexpected response.");
  }

  if (!res.ok || !envelope.success || !envelope.data) {
    throw new DetectError(envelope.error ?? `Detection failed (${res.status}).`);
  }
  return envelope.data;
}
