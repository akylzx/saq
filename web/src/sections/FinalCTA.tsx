import { Button } from "../components/Button";
import { Reveal } from "../components/Reveal";
import styles from "./FinalCTA.module.css";

export function FinalCTA() {
  return (
    <section className={styles.section}>
      <div className="shell">
        <Reveal className={styles.card}>
          <p className={styles.eyebrow}>Catch the call before it costs</p>
          <h2 className={styles.title}>
            Put a verdict <em className={styles.em}>on every voice.</em>
          </h2>
          <p className={styles.lead}>
            saq is open, self-hosted, and explainable. Run the detector locally, wire the endpoint
            into your stack, and start telling real voices from synthetic ones today.
          </p>
          <div className={styles.actions}>
            <Button href="#try" className={styles.primary}>
              Try the detector
            </Button>
            <Button href="#how" variant="ghost" className={styles.secondary}>
              See how it works
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
