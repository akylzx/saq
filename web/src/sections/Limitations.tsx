import { Reveal } from "../components/Reveal";
import { SectionHead } from "../components/SectionHead";
import { LIMITATIONS } from "../lib/content";
import styles from "./Limitations.module.css";

export function Limitations() {
  return (
    <section className={styles.section}>
      <div className="shell framed">
        <SectionHead eyebrow={LIMITATIONS.eyebrow} title={LIMITATIONS.title} lead={LIMITATIONS.body} />
        <ul className={styles.list}>
          {LIMITATIONS.notes.map((note, i) => (
            <Reveal as="li" key={note.title} className={styles.item} delay={i * 80}>
              <h3 className={styles.itemTitle}>{note.title}</h3>
              <p className={styles.itemBody}>{note.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
