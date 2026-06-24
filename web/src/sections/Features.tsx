import { Reveal } from "../components/Reveal";
import { SectionHead } from "../components/SectionHead";
import { FEATURES } from "../lib/content";
import styles from "./Features.module.css";

export function Features() {
  return (
    <section className={styles.section} id="features">
      <div className="shell framed">
        <SectionHead
          eyebrow="What's inside"
          title="A detector built for the real failure case"
          lead="Voice fraud doesn't happen in a studio in English. saq is shaped around the call it actually has to catch."
        />

        <ul className={styles.grid}>
          {FEATURES.map((f, i) => (
            <Reveal as="li" key={f.title} className={styles.card} delay={(i % 3) * 80}>
              <span className={styles.tag}>{f.tag}</span>
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardBody}>{f.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
