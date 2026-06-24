import { useRef, useState } from "react";
import { Reveal } from "../components/Reveal";
import { SectionHead } from "../components/SectionHead";
import { useAnalysis } from "../hooks/useAnalysis";
import { useRecorder } from "../hooks/useRecorder";
import type { Assessment, Factor } from "../lib/analyze";
import styles from "./Analyze.module.css";

const ASSESSMENT_LABEL: Record<Assessment, string> = {
  human: "Likely human",
  ai: "Likely AI-generated",
  inconclusive: "Inconclusive",
};

export function Analyze() {
  const { state, analyze, reset } = useAnalysis();
  const recorder = useRecorder();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = state.phase === "decoding" || state.phase === "running";

  const onFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file && !busy) void analyze(file, file.name);
  };

  const onMic = async () => {
    if (recorder.isRecording) {
      const blob = await recorder.stop();
      if (blob) void analyze(blob, "recording.webm");
    } else {
      reset();
      await recorder.start();
    }
  };

  return (
    <section className={styles.section} id="try">
      <div className="shell framed">
        <SectionHead
          eyebrow="Analyze"
          title="Hear what's real — and read what's said."
          lead="Record or upload a clip. saq transcribes it in the browser, checks the voice for synthetic markers, and combines both into one explained verdict. No upload to a third party, no account."
        />

        <Reveal className={styles.panel}>
          {/* ---- capture ---- */}
          <div className={styles.capture}>
            <div
              className={`${styles.drop} ${dragging ? styles.dragging : ""} ${busy ? styles.disabled : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onFile(e.dataTransfer.files);
              }}
              onClick={() => !busy && inputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !busy) {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Upload an audio file to analyze"
            >
              <input
                ref={inputRef}
                type="file"
                accept=".wav,.flac,.ogg,.mp3,audio/*"
                className={styles.fileInput}
                onChange={(e) => onFile(e.target.files)}
                disabled={busy}
              />
              <WaveGlyph />
              <p className={styles.dropTitle}>Drop a clip or click to upload</p>
              <p className={styles.dropHint}>wav · mp3 · ogg · flac — up to 60 s</p>
            </div>

            <div className={styles.or} aria-hidden="true">
              <span>or</span>
            </div>

            <button
              className={`${styles.mic} ${recorder.isRecording ? styles.recording : ""}`}
              onClick={onMic}
              disabled={busy && !recorder.isRecording}
            >
              <span className={styles.micDot} aria-hidden="true" />
              {recorder.isRecording ? `Stop · ${recorder.seconds}s` : "Record from mic"}
            </button>
            {recorder.error && <p className={styles.inlineErr}>{recorder.error}</p>}
          </div>

          {/* ---- results / states ---- */}
          <div className={styles.results} aria-live="polite">
            {state.phase === "idle" && <Idle />}
            {busy && <Processing step={state.step} progress={state.modelProgress} />}
            {state.phase === "error" && <ErrorState message={state.error} onRetry={reset} />}
            {state.phase === "done" && state.combined && <Results state={state} />}
          </div>
        </Reveal>

        <p className={styles.caveat}>
          Whisper transcription and the confidence scores are estimates — saq flags risk, it doesn't
          deliver proof. Treat a verdict as a prompt to verify through another channel, not a final
          ruling.
        </p>
      </div>
    </section>
  );
}

function Idle() {
  return (
    <div className={styles.placeholder}>
      <p className={styles.phText}>Your transcript, voice analysis, and a combined verdict appear here.</p>
      <ul className={styles.phList}>
        <li>Transcript with detected language</li>
        <li>AI-voice probability from the detector</li>
        <li>One explained final assessment</li>
      </ul>
    </div>
  );
}

function Processing({ step, progress }: { step: string; progress: number | null }) {
  return (
    <div className={styles.placeholder}>
      <div className={styles.scanner} aria-hidden="true" />
      <p className={styles.phText}>{step || "Working…"}</p>
      {progress !== null && (
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}
      <p className={styles.phNote}>The speech model downloads once, then runs entirely on your device.</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className={styles.placeholder}>
      <p className={styles.errTitle}>Couldn't analyze that</p>
      <p className={styles.errBody}>{message}</p>
      <button className={styles.retry} onClick={onRetry}>
        Try another clip
      </button>
    </div>
  );
}

function Results({ state }: { state: ReturnType<typeof useAnalysis>["state"] }) {
  const { combined, stt, detection } = state;
  if (!combined) return null;
  const a = combined.assessment;
  const confPct = combined.confidence !== null ? Math.round(combined.confidence * 100) : null;

  return (
    <div className={styles.report}>
      {/* Final assessment — the headline */}
      <div className={`${styles.assessment} ${styles[a]}`}>
        <div className={styles.assessHead}>
          <span className={styles.assessDot} aria-hidden="true" />
          <span className={styles.assessLabel}>{ASSESSMENT_LABEL[a]}</span>
          <span className={styles.assessConf}>{confPct !== null ? `${confPct}% confidence` : "low certainty"}</span>
        </div>
        <p className={styles.assessSummary}>{combined.summary}</p>
        <ul className={styles.factors}>
          {combined.factors.map((f) => (
            <FactorRow key={f.label} factor={f} />
          ))}
        </ul>
      </div>

      {/* Transcript */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Transcript</h3>
          {stt.data && (
            <span className={styles.cardMeta}>
              {stt.data.languageLabel} · {Math.round(stt.data.confidence * 100)}% est.
            </span>
          )}
        </div>
        {stt.data ? (
          stt.data.transcript ? (
            <p className={styles.transcript}>{stt.data.transcript}</p>
          ) : (
            <p className={styles.muted}>No intelligible speech was transcribed.</p>
          )
        ) : (
          <p className={styles.muted}>Transcription unavailable — {stt.error}</p>
        )}
      </div>

      {/* Voice analysis */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Voice analysis</h3>
          {detection.data && (
            <span className={styles.cardMeta}>threshold {detection.data.threshold.toFixed(2)}</span>
          )}
        </div>
        {detection.data ? (
          <>
            <div className={styles.meterRow}>
              <span className={styles.meterLabel}>AI probability</span>
              <span className={styles.meterValue}>{Math.round(detection.data.spoof_probability * 100)}%</span>
            </div>
            <div className={styles.meter}>
              <div
                className={`${styles.meterFill} ${detection.data.label === "spoof" ? styles.fillAi : styles.fillHuman}`}
                style={{ width: `${Math.round(detection.data.spoof_probability * 100)}%` }}
              />
            </div>
            {detection.data.spectrogram_png_base64 && (
              <img
                className={styles.spectro}
                src={`data:image/png;base64,${detection.data.spectrogram_png_base64}`}
                alt="Mel spectrogram of the analyzed clip"
              />
            )}
          </>
        ) : (
          <p className={styles.muted}>Voice detector unavailable — {detection.error}</p>
        )}
      </div>
    </div>
  );
}

function FactorRow({ factor }: { factor: Factor }) {
  return (
    <li className={`${styles.factor} ${styles[`lean_${factor.lean}`]} ${factor.weight === "primary" ? styles.primaryFactor : ""}`}>
      <span className={styles.factorDot} aria-hidden="true" />
      <span className={styles.factorLabel}>{factor.label}</span>
      <span className={styles.factorDetail}>{factor.detail}</span>
    </li>
  );
}

function WaveGlyph() {
  return (
    <svg className={styles.dropIcon} viewBox="0 0 24 24" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none">
        <line x1="4" y1="12" x2="4" y2="14" />
        <line x1="8" y1="9" x2="8" y2="17" />
        <line x1="12" y1="5" x2="12" y2="21" />
        <line x1="16" y1="8" x2="16" y2="18" />
        <line x1="20" y1="11" x2="20" y2="15" />
      </g>
    </svg>
  );
}
