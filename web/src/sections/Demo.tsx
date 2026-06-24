import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal } from "../components/Reveal";
import { SectionHead } from "../components/SectionHead";
import { detect, DetectError, health, type DetectData } from "../lib/api";
import styles from "./Demo.module.css";

type Lang = "en" | "ru" | "kk";
const LANGS: { code: Lang; label: string }[] = [
  { code: "kk", label: "Қазақша" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

type Status = "idle" | "checking" | "online" | "offline" | "loading" | "done" | "error";

export function Demo() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<DetectData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("kk");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Probe the backend once so the UI can guide the user before they upload.
  useEffect(() => {
    let alive = true;
    setStatus("checking");
    health().then((ok) => {
      if (alive) setStatus(ok ? "online" : "offline");
    });
    return () => {
      alive = false;
    };
  }, []);

  const run = useCallback(async (file: File) => {
    setFileName(file.name);
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const data = await detect(file);
      setResult(data);
      setStatus("done");
    } catch (e) {
      setError(e instanceof DetectError ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }, []);

  const onPick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void run(file);
  };

  const isSpoof = result?.label === "spoof";
  const pct = result ? Math.round(result.confidence * 100) : 0;

  return (
    <section className={styles.section} id="try">
      <div className="shell framed">
        <SectionHead
          eyebrow="Try saq"
          title="Hand it a clip. See the verdict."
          lead="Upload a voice recording and saq returns the call, a confidence score, the spectrogram it read, and a reason in three languages."
        />

        <Reveal className={styles.panel}>
          <div className={styles.left}>
            <div
              className={`${styles.drop} ${dragging ? styles.dragging : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onPick(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
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
                className={styles.input}
                onChange={(e) => onPick(e.target.files)}
              />
              <svg className={styles.dropIcon} viewBox="0 0 24 24" aria-hidden="true">
                <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none">
                  <line x1="4" y1="12" x2="4" y2="14" />
                  <line x1="8" y1="9" x2="8" y2="17" />
                  <line x1="12" y1="5" x2="12" y2="21" />
                  <line x1="16" y1="8" x2="16" y2="18" />
                  <line x1="20" y1="11" x2="20" y2="15" />
                </g>
              </svg>
              <p className={styles.dropTitle}>
                {fileName ? fileName : "Drop a clip or click to choose"}
              </p>
              <p className={styles.dropHint}>wav · flac · ogg · mp3 — up to 15 MB, 60 s</p>
            </div>

            <p className={`${styles.health} ${styles[`health_${status}`] ?? ""}`}>
              <span className={styles.healthDot} aria-hidden="true" />
              {status === "checking" && "Checking the backend…"}
              {status === "online" && "Backend online — ready to analyze."}
              {status === "loading" && "Analyzing…"}
              {(status === "offline" || status === "error" || status === "done" || status === "idle") &&
                "Needs the saq backend running locally."}
            </p>
          </div>

          <div className={styles.right}>
            {status === "loading" && (
              <div className={styles.placeholder}>
                <div className={styles.scanner} aria-hidden="true" />
                <p className={styles.phText}>Reading the signal…</p>
              </div>
            )}

            {status === "error" && (
              <div className={styles.placeholder}>
                <p className={styles.errTitle}>Couldn't analyze that</p>
                <p className={styles.errBody}>{error}</p>
              </div>
            )}

            {(status === "offline" || status === "idle" || status === "checking") && !result && (
              <div className={styles.placeholder}>
                <p className={styles.phText}>The verdict appears here.</p>
                <pre className={styles.startCode}>
                  {`# start the detector, then upload
uv run uvicorn qorgauvoice.api.server:app
# or instant mock verdicts:
QV_MOCK=1 uv run uvicorn \\
  qorgauvoice.api.server:app`}
                </pre>
              </div>
            )}

            {status === "online" && !result && (
              <div className={styles.placeholder}>
                <p className={styles.phText}>Ready. Upload a clip to see the verdict.</p>
              </div>
            )}

            {result && (
              <div className={`${styles.verdict} ${isSpoof ? styles.spoof : styles.bona}`}>
                <div className={styles.verdictHead}>
                  <span className={styles.verdictDot} aria-hidden="true" />
                  <span className={styles.verdictLabel}>
                    {isSpoof ? "Likely synthetic" : "Likely genuine"}
                  </span>
                  <span className={styles.verdictMono}>
                    {result.label} · p={result.spoof_probability.toFixed(2)}
                  </span>
                </div>

                <div className={styles.meter} role="img" aria-label={`Confidence ${pct} percent`}>
                  <div className={styles.meterFill} style={{ width: `${pct}%` }} />
                </div>
                <p className={styles.meterLabel}>
                  {pct}% confidence · threshold {result.threshold.toFixed(2)}
                </p>

                {result.spectrogram_png_base64 && (
                  <img
                    className={styles.spectro}
                    src={`data:image/png;base64,${result.spectrogram_png_base64}`}
                    alt="Mel spectrogram of the analyzed clip"
                  />
                )}

                <div className={styles.langRow} role="tablist" aria-label="Reason language">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      role="tab"
                      aria-selected={lang === l.code}
                      className={`${styles.langBtn} ${lang === l.code ? styles.langOn : ""}`}
                      onClick={() => setLang(l.code)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <p className={styles.reason}>{result.reason[lang]}</p>
              </div>
            )}
          </div>
        </Reveal>

        <p className={styles.caveat}>
          Confidence is a hint, not a guarantee — calibration is a work in progress, and
          play-and-record audio can still slip past. Treat a verdict as a signal to verify, not a
          final ruling.
        </p>
      </div>
    </section>
  );
}
