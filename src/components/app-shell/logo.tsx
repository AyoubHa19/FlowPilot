import { cn } from "@/lib/utils";

/** The FlowPilot mark: a flight path ending in an arrow, on the brand color. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.58_0.2_300)] text-primary-foreground shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17c3.5 0 4.5-10 9-10 2.2 0 3.4 1.4 4.2 3" />
        <path d="M14.5 10.5 17.5 10l.5-3" />
        <circle cx="4" cy="17" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight">FlowPilot AI</span>
        <span className="block text-[11px] text-muted-foreground">Tenant email agent</span>
      </span>
    </span>
  );
}
