import { Reveal } from "../components/Reveal";
import { BENEFITS } from "../lib/content";
import styles from "./Benefits.module.css";

export function Benefits() {
  return (
    <section className={styles.section}>
      <div className="shell framed">
        <div className={styles.inner}>
          <Reveal className={styles.intro}>
            <p className="eyebrow">Why it matters</p>
            <h2 className={styles.title}>
              The fraud is local. <em className={styles.em}>The defense should be too.</em>
            </h2>
            <p className={styles.lead}>
              Generic deepfake tools are trained on English and tuned for clean audio. The calls
              that drain accounts here are in Kazakh and Russian, over a phone line. saq is built
              for that call.
            </p>
          </Reveal>

          <dl className={styles.stats}>
            {BENEFITS.map((b, i) => (
              <Reveal as="div" key={b.label} className={styles.stat} delay={i * 90}>
                <dt className={styles.statNum}>{b.stat}</dt>
                <dd className={styles.statLabel}>{b.label}</dd>
                <p className={styles.statBody}>{b.body}</p>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
