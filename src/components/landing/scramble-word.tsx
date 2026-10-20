"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./hooks";

const NOISE = "@#%&*+=<>/?§€ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

/**
 * Cycles through words. Each change scrambles the letters into glyphs and
 * resolves them left to right, the same glyphs as the page background.
 */
export function ScrambleWord({ words, interval = 2800 }: { words: string[]; interval?: number }) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [display, setDisplay] = useState(words[0] ?? "");

  useEffect(() => {
    if (reduced || words.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => window.clearInterval(timer);
  }, [reduced, words.length, interval]);

  useEffect(() => {
    const target = words[index] ?? "";
    if (reduced) return;
    const frames = 16;
    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      const resolved = Math.floor((frame / frames) * target.length);
      setDisplay(
        target
          .split("")
          .map((ch, i) => (i < resolved || ch === " " ? ch : NOISE[Math.floor(Math.random() * NOISE.length)]))
          .join(""),
      );
      if (frame >= frames) window.clearInterval(timer);
    }, 38);
    return () => window.clearInterval(timer);
  }, [index, words, reduced]);

  return (
    <span className="text-primary" aria-live="polite">
      <span className="sr-only">{words[index]}</span>
      <span aria-hidden="true">{reduced ? words[index] : display}</span>
    </span>
  );
}
