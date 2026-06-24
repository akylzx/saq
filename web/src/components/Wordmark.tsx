import styles from "./Wordmark.module.css";

/** The saq wordmark: a small waveform glyph + the name, always lowercase. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <a href="#top" className={`${styles.mark} ${className ?? ""}`} aria-label="saq — home">
      <svg className={styles.glyph} viewBox="0 0 32 32" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="3" y1="13" x2="3" y2="19" />
          <line x1="9" y1="9" x2="9" y2="23" />
          <line x1="15" y1="5" x2="15" y2="27" />
          <line x1="21" y1="10" x2="21" y2="22" />
          <line x1="27" y1="14" x2="27" y2="18" />
        </g>
      </svg>
      <span className={styles.name}>saq</span>
    </a>
  );
}
