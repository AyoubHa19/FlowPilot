import {
  ArrowRightIcon,
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  FileSearchIcon,
  FlameIcon,
  HistoryIcon,
  InboxIcon,
  LanguagesIcon,
  PencilIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/app-shell/logo";

export const metadata: Metadata = {
  title: { absolute: "FlowPilot AI · Tenant email, answered" },
};

const STEPS = [
  {
    title: "An email arrives",
    text: "From Gmail, or simulated. The agent starts a durable run for it.",
  },
  {
    title: "It does the research",
    text: "Classifies the email, finds the tenant, unit and lease, open tickets and the right lease clauses.",
  },
  {
    title: "It drafts and proposes",
    text: "A reply in the tenant's language, and a repair ticket when one is needed. Nothing is sent yet.",
  },
  {
    title: "You make the call",
    text: "Approve, edit or reject. Only then is the email sent or the ticket created.",
  },
];

const FEATURES = [
  {
    icon: FileSearchIcon,
    title: "Answers from the lease",
    text: "Searches the tenant's own lease PDF and quotes it. Never another tenant's data.",
  },
  {
    icon: FlameIcon,
    title: "Safety first",
    text: "Gas, water, fire: a person is alerted at once and the tenant gets safety steps and the hotline.",
  },
  {
    icon: LanguagesIcon,
    title: "Replies in their language",
    text: "German in, German out. English, Turkish, Arabic too.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Human approval, by design",
    text: "Tools can only propose. Sending lives behind the approval, in code, not in a prompt.",
  },
  {
    icon: HistoryIcon,
    title: "Every step on record",
    text: "A live timeline per run: model calls, tools, tokens, cost and retries.",
  },
  {
    icon: InboxIcon,
    title: "Built for a real inbox",
    text: "Gmail sync every minute, replies in the same thread, bulk import of 10,000 units.",
  },
];

const RESULTS = [
  { value: "97%", label: "of 32 test emails pass every check" },
  { value: "100%", label: "privacy: no other tenant's data, ever" },
  { value: "~12s", label: "from email in to draft ready" },
  { value: "$0.002", label: "per email, on Gemini paid-tier prices" },
];

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#results", label: "Results" },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-background/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="ml-auto hidden items-center gap-8 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-xs font-medium tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <Link
            href="/signin"
            className="ml-auto inline-flex h-9 items-center rounded-full bg-white px-4 text-xs font-semibold tracking-wide text-black uppercase transition-transform hover:-translate-y-0.5 md:ml-0"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-28 px-4 pt-20 pb-24 sm:px-6 sm:pt-28">
        <section className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col items-start gap-7">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-md border border-white/70 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-white">
                AI
              </span>
              Email agent for property managers
            </p>
            <h1 className="text-5xl leading-[1.02] font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Tenant email, answered. You approve.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              FlowPilot reads every tenant email, looks up the tenant, the unit and the lease, and
              drafts the reply. Nothing leaves your inbox until you say so.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/home"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold tracking-wide text-black uppercase transition-transform hover:-translate-y-0.5"
              >
                Open the app <ChevronRightIcon className="size-4" />
              </Link>
              <a
                href="#how"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-6 text-sm font-semibold tracking-wide text-white uppercase backdrop-blur transition-colors hover:bg-white/15"
              >
                How it works <ChevronRightIcon className="size-4" />
              </a>
            </div>
          </div>
          <ProductPreview />
        </section>

        <section id="how" className="scroll-mt-24">
          <SectionTitle eyebrow="How it works" title="From inbox to answer in four steps" />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="glass glass-hover flex flex-col gap-3 rounded-2xl p-5">
                <span className="font-mono text-xs text-primary">0{i + 1}</span>
                <h3 className="font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className="scroll-mt-24">
          <SectionTitle eyebrow="Features" title="Careful where it matters" />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="glass glass-hover flex flex-col gap-3 rounded-2xl p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="results" className="scroll-mt-24">
          <SectionTitle eyebrow="Results" title="Measured, not promised" />
          <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RESULTS.map((r) => (
              <div key={r.label} className="glass glass-hover flex flex-col gap-1 rounded-2xl p-5">
                <dt className="sr-only">{r.label}</dt>
                <dd className="text-4xl font-bold tracking-tight text-white tabular-nums">{r.value}</dd>
                <dd className="text-sm text-muted-foreground">{r.label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            From the eval set in the repository: 32 realistic tenant emails, run through the real agent.
          </p>
        </section>

        <section className="glass flex flex-col items-start gap-5 rounded-3xl p-8 sm:p-12">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            See it work on a real conversation.
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Sign in, send a simulated tenant email and watch the agent research and draft it, step by step.
          </p>
          <Link
            href="/home"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold tracking-wide text-black uppercase transition-transform hover:-translate-y-0.5"
          >
            Open the app <ArrowRightIcon className="size-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs font-medium tracking-widest text-muted-foreground uppercase sm:px-6">
          <span>© 2026 FlowPilot AI</span>
          <span>Next.js · Convex · Gemini</span>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium tracking-widest text-primary uppercase">{eyebrow}</p>
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
    </div>
  );
}

/** A still picture of the product: an email, the agent's work, the draft. */
function ProductPreview() {
  return (
    <div className="relative flex flex-col gap-3" aria-hidden="true">
      <div className="glass glass-hover rounded-2xl p-4 lg:mr-10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-[oklch(0.32_0.07_274)] text-[10px] font-semibold text-[oklch(0.88_0.06_274)]">
            AS
          </span>
          Anna Schneider · 2 min ago
        </div>
        <p className="mt-3 text-sm font-medium text-white">Wasserhahn in der Küche tropft</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Der Wasserhahn in meiner Küche tropft seit drei Tagen. Könnte bitte jemand vorbeikommen?
        </p>
      </div>

      <div className="glass glass-hover rounded-2xl p-4 lg:ml-10">
        <p className="flex items-center gap-2 text-xs font-medium text-white">
          <BotIcon className="size-4 text-primary" /> Agent run
          <span className="ml-auto rounded-full bg-info-soft px-2 py-0.5 text-[10px] text-info">Drafted</span>
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
          {["Classified: repair · medium urgency · de", "Found tenant: unit 2.04, Lindenhof", "Lease §7: small repairs up to €100", "Drafted reply · proposed ticket"].map(
            (line) => (
              <li key={line} className="flex items-center gap-2">
                <CheckIcon className="size-3.5 text-success" /> {line}
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="glass glass-hover rounded-2xl p-4 lg:mr-6">
        <p className="text-xs text-muted-foreground">Draft reply</p>
        <p className="mt-2 text-sm text-white/90">
          Guten Tag Frau Schneider, vielen Dank für Ihre Nachricht. Wir haben einen Handwerker beauftragt …
        </p>
        <div className="mt-4 flex gap-2">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-black">
            <CheckIcon className="size-3.5" /> Approve
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs text-white">
            <PencilIcon className="size-3.5" /> Edit
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs text-white">
            <XIcon className="size-3.5" /> Reject
          </span>
        </div>
      </div>
    </div>
  );
}
