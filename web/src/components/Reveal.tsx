import type { CSSProperties, ElementType, ReactNode } from "react";
import { useReveal } from "../hooks/useReveal";
import styles from "./Reveal.module.css";

interface RevealProps {
  children: ReactNode;
  /** Stagger delay in ms for sequenced reveals. */
  delay?: number;
  as?: ElementType;
  className?: string;
}

/** Fades + lifts its children into view once on scroll. */
export function Reveal({ children, delay = 0, as: Tag = "div", className }: RevealProps) {
  const { ref, shown } = useReveal<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={`${styles.reveal} ${shown ? styles.shown : ""} ${className ?? ""}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
