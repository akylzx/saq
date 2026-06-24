import { Analyzer } from "../components/Analyzer";
import { Button } from "../components/Button";
import { HERO } from "../lib/content";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero} id="top">
      <div className={`shell framed ${styles.shell}`}>
        <p className={`eyebrow ${styles.eyebrow}`}>{HERO.eyebrow}</p>

        <h1 className={styles.headline}>
          <span className={styles.line}>{HERO.headlineTop}</span>
          <em className={styles.accent}>{HERO.headlineAccent}</em>
        </h1>

        <div className={styles.body}>
          <p className={styles.lead}>{HERO.lead}</p>
          <div className={styles.actions}>
            <Button href={HERO.primaryCta.href}>{HERO.primaryCta.label}</Button>
            <Button href={HERO.secondaryCta.href} variant="ghost">
              {HERO.secondaryCta.label}
            </Button>
          </div>
          <p className={styles.trust}>{HERO.trust}</p>
        </div>

        <div className={styles.stage}>
          <pre className={`${styles.note} ${styles.noteLeft}`} aria-hidden="true">
            {`// stream in
$ analyzing 4.2s clip
formants: drifting
hi-freq energy: low
breath markers: 2
// reading the signal…`}
          </pre>

          <Analyzer />

          <pre className={`${styles.note} ${styles.noteRight}`} aria-hidden="true">
            {`label: "spoof"
spoof_probability: 0.97
threshold: 0.50
reason → kk · ru · en
// verdict in 1.3s`}
          </pre>
        </div>
      </div>
    </section>
  );
}
