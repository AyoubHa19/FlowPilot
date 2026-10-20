"use client";

import { useEffect, useState } from "react";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Types `text` out once `start` is true. Reduced motion shows it at once. */
export function useTypewriter(text: string, start: boolean, msPerChar = 18) {
  const reduced = usePrefersReducedMotion();
  // Progress is stored with its text, so a new text starts from zero
  // without resetting state inside the effect.
  const [progress, setProgress] = useState({ text: "", count: 0 });

  useEffect(() => {
    if (!start || reduced) return;
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setProgress({ text, count: i });
      if (i >= text.length) window.clearInterval(timer);
    }, msPerChar);
    return () => window.clearInterval(timer);
  }, [text, start, reduced, msPerChar]);

  const count = progress.text === text ? progress.count : 0;
  if (reduced) return { typed: start ? text : "", done: start };
  return { typed: text.slice(0, count), done: count >= text.length };
}
