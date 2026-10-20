import { cn } from "@/lib/utils";

/**
 * The FlowPilot mark: an envelope whose flap turns into a flight path that
 * leaves it. Mail that finds its own way, with a person at the controls.
 */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="10" width="20" height="15" rx="3.2" stroke="currentColor" strokeWidth="2" />
      <path d="M4.4 12.2 13 18.6l3.4-2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16.4 16.1c3.6-2.7 6.5-6.2 10.6-10.3" stroke="var(--primary)" strokeWidth="2.4" />
      <path d="M21.6 5.4h5.8v5.8" stroke="var(--primary)" strokeWidth="2.4" />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-white/12 bg-gradient-to-b from-white/10 to-white/[0.02] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]",
        className,
      )}
      aria-hidden="true"
    >
      <LogoGlyph className="size-5" />
    </span>
  );
}

/** "Flow" in the sans, "Pilot" in the italic display serif. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[15px] leading-none font-semibold tracking-tight text-white", className)}>
      Flow<span className="font-display text-[1.12em] font-normal tracking-normal italic">Pilot</span>
    </span>
  );
}

export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-tight">
        <Wordmark className="block" />
        {subtitle && <span className="mt-0.5 block text-[11px] text-muted-foreground">Tenant email agent</span>}
      </span>
    </span>
  );
}
