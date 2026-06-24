import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone capture via MediaRecorder. Returns a Blob on stop; the analysis
 * pipeline re-encodes it to a backend-friendly WAV, so the container format the
 * browser picks here doesn't matter.
 */
export interface Recorder {
  isRecording: boolean;
  seconds: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  supported: boolean;
}

const MAX_SECONDS = 60;

export function useRecorder(): Recorder {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const stopResolve = useRef<((b: Blob | null) => void) | null>(null);

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const cleanup = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError("Recording isn't supported in this browser. Upload a file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        cleanup();
        setIsRecording(false);
        stopResolve.current?.(blob.size > 0 ? blob : null);
        stopResolve.current = null;
      };
      recRef.current = rec;
      rec.start();
      setIsRecording(true);
      setSeconds(0);
      tickRef.current = window.setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) recRef.current?.stop();
          return next;
        });
      }, 1000);
    } catch {
      setError("Microphone access was blocked. Allow it, or upload a file instead.");
      cleanup();
    }
  }, [supported, cleanup]);

  const stop = useCallback(() => {
    return new Promise<Blob | null>((resolve) => {
      if (!recRef.current || recRef.current.state === "inactive") {
        resolve(null);
        return;
      }
      stopResolve.current = resolve;
      recRef.current.stop();
    });
  }, []);

  return { isRecording, seconds, error, start, stop, supported };
}
