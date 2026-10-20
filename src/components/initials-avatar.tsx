import { cn } from "@/lib/utils";

// A few soft brand-friendly colors; the same name always gets the same one.
const PALETTE = [
  "bg-[oklch(0.93_0.05_274)] text-[oklch(0.4_0.15_274)] dark:bg-[oklch(0.32_0.07_274)] dark:text-[oklch(0.88_0.06_274)]",
  "bg-[oklch(0.93_0.05_200)] text-[oklch(0.4_0.1_200)] dark:bg-[oklch(0.32_0.06_200)] dark:text-[oklch(0.88_0.05_200)]",
  "bg-[oklch(0.93_0.06_155)] text-[oklch(0.4_0.1_155)] dark:bg-[oklch(0.32_0.06_155)] dark:text-[oklch(0.88_0.06_155)]",
  "bg-[oklch(0.94_0.06_85)] text-[oklch(0.45_0.1_70)] dark:bg-[oklch(0.33_0.06_75)] dark:text-[oklch(0.9_0.07_85)]",
  "bg-[oklch(0.93_0.05_330)] text-[oklch(0.42_0.13_330)] dark:bg-[oklch(0.32_0.07_330)] dark:text-[oklch(0.88_0.06_330)]",
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function initialsOf(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        PALETTE[hash(name) % PALETTE.length],
        className,
      )}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
