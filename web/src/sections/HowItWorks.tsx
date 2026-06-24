import { Reveal } from "../components/Reveal";
import { SectionHead } from "../components/SectionHead";
import { STEPS } from "../lib/content";
import styles from "./HowItWorks.module.css";

export function HowItWorks() {
  return (
    <section className={styles.section} id="how">
      <div className="shell framed">
        <SectionHead
          eyebrow="How it works"
          title={
            <>
              Audio in, a verdict <em className={styles.em}>with the evidence</em> out
            </>
          }
          lead="Three steps, one request. saq reads the signal in the sound, not the words being spoken."
        />

        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step.n} className={styles.step} delay={i * 90}>
              <div className={styles.num}>
                <span className={styles.numText}>{step.n}</span>
                {i < STEPS.length - 1 ? <span className={styles.connector} aria-hidden="true" /> : null}
              </div>
              <div className={styles.text}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </div>
              <pre className={styles.code} aria-hidden="true">
                {step.code.join("\n")}
              </pre>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
