import { useEffect, useRef, useState } from "react";

/**
 * Reveal-on-scroll. Returns a ref to attach and a boolean that flips true once
 * the element scrolls into view (once — it does not re-hide). Respects
 * prefers-reduced-motion by revealing immediately.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            obs.disconnect();
          }
        }
      },
      { rootMargin, threshold: 0.05 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [rootMargin]);

  return { ref, shown } as const;
}
