import {
  ArrowRightIcon,
  FileSearchIcon,
  FlameIcon,
  HistoryIcon,
  InboxIcon,
  LanguagesIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/app-shell/logo";
import { ScenarioStory } from "@/components/landing/scenario-story";
import { ScrambleWord } from "@/components/landing/scramble-word";
import { ScreenArc, ScreenDeck } from "@/components/landing/screens";

export const metadata: Metadata = {
  title: { absolute: "FlowPilot · Tenant email, handled before you open it" },
};

const NAV = [
  { href: "#watch", label: "Watch it work" },
  { href: "#inside", label: "Inside the app" },
  { href: "#results", label: "Results" },
];

const STACK = ["Gmail", "Gemini", "Convex", "Next.js", "Vercel"];

const FEATURES = [
  { icon: FileSearchIcon, title: "Answers from the lease", text: "Quotes the tenant's own lease PDF. Never another tenant's." },
  { icon: FlameIcon, title: "Safety first", text: "Gas, water, fire: a person is alerted at once, the tenant gets safety steps." },
  { icon: LanguagesIcon, title: "Their language", text: "German in, German out. English and more, too." },
  { icon: ShieldCheckIcon, title: "Approval, in code", text: "Tools can only propose. Sending sits behind your approval." },
  { icon: HistoryIcon, title: "Every step on record", text: "Model calls, tools, tokens, cost and retries, per run." },
  { icon: InboxIcon, title: "A real inbox", text: "Gmail sync every minute, replies in the same thread." },
];

const RESULTS = [
  { value: "97%", label: "of 32 test emails pass every check" },
  { value: "100%", label: "privacy checks passed" },
  { value: "~12s", label: "from email in to draft ready" },
  { value: "$0.002", label: "per email, Gemini paid-tier prices" },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-3 z-40 px-3">
        <div className="mx-auto flex max-w-6xl items-center gap-6 rounded-2xl border border-white/10 bg-[#0d0d11]/80 px-3 py-2 shadow-[0_20px_40px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl sm:px-4">
          <Link href="/" aria-label="FlowPilot home">
            <Logo subtitle={false} />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="text-sm text-white/70 transition-colors hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/signin"
              className="hidden h-9 items-center rounded-lg border border-white/15 px-3.5 text-sm text-white transition-colors hover:bg-white/5 sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/home"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Open the app
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-32 pb-24">
        <section className="flex flex-col items-center px-4 pt-20 text-center sm:pt-24">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" />
            Email agent for property managers
          </p>
          <h1 className="font-display max-w-4xl text-5xl leading-[1.02] text-white sm:text-7xl lg:text-8xl">
            Tenant email, <ScrambleWord words={["researched", "drafted", "translated", "triaged"]} />
            <br />
            before you open it.
          </h1>

          <div className="mt-12 w-full max-w-7xl">
            <ScreenArc />
          </div>

          <p className="mt-10 max-w-xl text-white/70 sm:text-lg">
            FlowPilot reads each tenant email, finds the tenant, the unit and the lease, and drafts the reply. Nothing
            is sent until you approve it.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/home"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Open the app <ArrowRightIcon className="size-4" />
            </Link>
            <a
              href="#watch"
              className="inline-flex h-12 items-center rounded-xl border border-white/15 bg-white/5 px-6 text-white backdrop-blur transition-colors hover:bg-white/10"
            >
              Watch it work
            </a>
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-white/40">
            <span className="text-xs tracking-widest uppercase">Built with</span>
            {STACK.map((name) => (
              <span key={name} className="font-display text-2xl text-white/60">
                {name}
              </span>
            ))}
          </div>
        </section>

        <section id="watch" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 sm:px-6">
          <SectionTitle
            eyebrow="Watch it work"
            title="One email in. The research, the draft and the decision, step by step."
          />
          <div className="mt-6">
            <ScenarioStory />
          </div>
        </section>

        <section id="inside" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 sm:px-6">
          <SectionTitle eyebrow="Inside the app" title="Built for the person who signs off." center />
          <div className="mt-12">
            <ScreenDeck />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="Guarantees" title="Careful where it matters." />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="glass glass-hover flex gap-4 rounded-2xl p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <f.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-medium text-white">{f.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section id="results" className="scroll-mt-24 border-y border-white/8 bg-[#08080b]/80 py-20 backdrop-blur">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <SectionTitle eyebrow="Results" title="Measured, not promised." center />
            <dl className="mt-12 grid gap-8 text-center sm:grid-cols-2 lg:grid-cols-4">
              {RESULTS.map((r) => (
                <div key={r.label} className="flex flex-col gap-2">
                  <dt className="order-2 text-sm text-muted-foreground">{r.label}</dt>
                  <dd className="font-display order-1 text-6xl text-white tabular-nums">{r.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-10 text-center text-xs text-muted-foreground">
              From the eval set in the repository: 32 realistic tenant emails, run through the real agent.
            </p>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 text-center">
          <h2 className="font-display text-5xl text-white sm:text-6xl">
            Try it on a <span className="text-primary italic">real</span> conversation.
          </h2>
          <p className="max-w-lg text-muted-foreground">
            Sign in, send a simulated tenant email, and watch the agent research and draft it.
          </p>
          <Link
            href="/home"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Open the app <ArrowRightIcon className="size-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <Logo subtitle={false} />
          <span>© 2026 FlowPilot</span>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title, center = false }: { eyebrow: string; title: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto flex max-w-3xl flex-col items-center gap-3 text-center" : "flex max-w-3xl flex-col gap-3"}>
      <p className="text-xs font-medium tracking-widest text-primary uppercase">{eyebrow}</p>
      <h2 className="font-display text-4xl leading-tight text-white sm:text-5xl">{title}</h2>
    </div>
  );
}
