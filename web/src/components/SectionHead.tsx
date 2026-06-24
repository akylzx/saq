import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import styles from "./SectionHead.module.css";

interface SectionHeadProps {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
}

/** Consistent section opener: mono eyebrow, serif title, optional lead. */
export function SectionHead({ eyebrow, title, lead }: SectionHeadProps) {
  return (
    <Reveal className={styles.head}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className={styles.title}>{title}</h2>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
    </Reveal>
  );
}
