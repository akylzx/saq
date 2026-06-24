import { Wordmark } from "./Wordmark";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`shell ${styles.inner}`}>
        <div className={styles.brand}>
          <Wordmark />
          <p className={styles.tag}>Hear what's real.</p>
        </div>

        <div className={styles.cols}>
          <nav className={styles.col} aria-label="Product">
            <p className={styles.colHead}>Product</p>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#try">Try saq</a>
          </nav>
          <div className={styles.col}>
            <p className={styles.colHead}>Scope</p>
            <span>Kazakh · Russian</span>
            <span>Open models</span>
            <span>Self-hosted API</span>
          </div>
        </div>
      </div>

      <div className={`shell ${styles.base}`}>
        <span>© {new Date().getFullYear()} saq</span>
        <span className="mono">anti-spoofing for voice · built for AI Shield</span>
      </div>
    </footer>
  );
}
