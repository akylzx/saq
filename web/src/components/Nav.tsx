import { useEffect, useState } from "react";
import { NAV_LINKS } from "../lib/content";
import { Button } from "./Button";
import { Wordmark } from "./Wordmark";
import styles from "./Nav.module.css";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
      <div className={`shell ${styles.inner}`}>
        <Wordmark />
        <nav className={styles.links} aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </a>
          ))}
        </nav>
        <Button href="#try" className={styles.cta}>
          Try saq
        </Button>
      </div>
    </header>
  );
}
