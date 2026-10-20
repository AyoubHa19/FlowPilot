"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTypewriter } from "./hooks";

/*
 * The scroll story. Left: a sticky panel with one tab per kind of email and
 * the email typing itself out. Right: one canvas per email. When a canvas
 * reaches the middle of the screen its steps appear one by one, the wires
 * draw between them, and each step types its result.
 */

// Canvas coordinates. Nodes and wires share this box, which keeps its
// aspect ratio, so wires always meet the nodes.
const W = 760;
const H = 600;
const NODE_W = 220;
const ANCHOR_Y = 22; // wires attach to the node header

type Tag = "Model" | "Lookup" | "Tool" | "Draft" | "Approval" | "Alert" | "Guard" | "Escalate" | "Audit";

type Node = { id: string; x: number; y: number; title: string; source: string; tag: Tag; text: string };

type Scenario = {
  tab: string;
  from: string;
  subject: string;
  body: string;
  nodes: Node[];
  edges: [string, string][];
};

const COLUMNS = { left: 20, middle: 270, right: 520 };

const SCENARIOS: Scenario[] = [
  {
    tab: "Repair",
    from: "Anna Schneider",
    subject: "Wasserhahn in der Küche tropft",
    body: "Hallo, der Wasserhahn in meiner Küche tropft seit drei Tagen und es wird immer schlimmer. Könnte bitte jemand vorbeikommen?",
    nodes: [
      { id: "a", x: COLUMNS.left, y: 40, title: "Classify", source: "Gemini Flash Lite", tag: "Model", text: "Repair · medium urgency · German" },
      { id: "b", x: COLUMNS.left, y: 320, title: "Find tenant", source: "Tenant records", tag: "Lookup", text: "Anna Schneider · Lindenhof, unit 2.04 · lease active" },
      { id: "c", x: COLUMNS.middle, y: 180, title: "Search her lease", source: "Vector search", tag: "Tool", text: "§7 Small repairs: the tenant pays up to €100 per repair." },
      { id: "d", x: COLUMNS.right, y: 30, title: "Repair ticket", source: "Proposal", tag: "Approval", text: "Plumber · kitchen tap · medium. Waits for your approval." },
      { id: "e", x: COLUMNS.right, y: 320, title: "Draft reply", source: "Gemini Flash", tag: "Draft", text: "Guten Tag Frau Schneider, danke für Ihre Nachricht. Wir schicken einen Handwerker vorbei …" },
    ],
    edges: [["a", "c"], ["b", "c"], ["c", "d"], ["c", "e"]],
  },
  {
    tab: "Lease question",
    from: "Lukas Wagner",
    subject: "Parking space",
    body: "Hi, is the parking space behind the building included in my rent, or do I pay for it separately?",
    nodes: [
      { id: "a", x: COLUMNS.left, y: 40, title: "Classify", source: "Gemini Flash Lite", tag: "Model", text: "Lease question · low urgency · English" },
      { id: "b", x: COLUMNS.left, y: 320, title: "Find tenant", source: "Tenant records", tag: "Lookup", text: "Lukas Wagner · Spreeblick, unit 1.03 · lease active" },
      { id: "c", x: COLUMNS.middle, y: 180, title: "Search his lease", source: "Vector search", tag: "Tool", text: "§4 Parking: the space is rented separately, €45 a month." },
      { id: "d", x: COLUMNS.right, y: 30, title: "Draft reply", source: "Gemini Flash", tag: "Draft", text: "Hi Lukas, the parking space isn't part of your rent. Under §4 of your lease it costs €45 a month …" },
      { id: "e", x: COLUMNS.right, y: 320, title: "Send reply", source: "Proposal", tag: "Approval", text: "Approve, edit or reject. Nothing is sent before you decide." },
    ],
    edges: [["a", "c"], ["b", "c"], ["c", "d"], ["d", "e"]],
  },
  {
    tab: "Emergency",
    from: "Jonas Becker",
    subject: "Gasgeruch im Treppenhaus!",
    body: "Im Treppenhaus riecht es seit einer halben Stunde stark nach Gas. Was sollen wir tun?",
    nodes: [
      { id: "a", x: COLUMNS.left, y: 40, title: "Classify", source: "Gemini Flash Lite", tag: "Model", text: "Repair · URGENT · German" },
      { id: "b", x: COLUMNS.left, y: 320, title: "Find tenant", source: "Tenant records", tag: "Lookup", text: "Jonas Becker · Lindenhof, unit 3.01" },
      { id: "c", x: COLUMNS.middle, y: 180, title: "Flag emergency", source: "Safety rule", tag: "Alert", text: "Gas. A person is alerted right now; the thread moves to Needs a person." },
      { id: "d", x: COLUMNS.right, y: 30, title: "Safety reply", source: "Gemini Flash", tag: "Draft", text: "Verlassen Sie sofort das Haus, keine Schalter betätigen, rufen Sie 112. Notdienst: +49 30 5550 9999." },
      { id: "e", x: COLUMNS.right, y: 320, title: "Manager alerted", source: "Inbox", tag: "Escalate", text: "Top of your queue, marked as an emergency." },
    ],
    edges: [["a", "c"], ["b", "c"], ["c", "d"], ["c", "e"]],
  },
  {
    tab: "Unknown sender",
    from: "m.keller@lawfirm.example",
    subject: "Lease of flat 3.01",
    body: "I represent the new tenant of flat 3.01. Please send me the full lease and the rent history.",
    nodes: [
      { id: "a", x: COLUMNS.left, y: 40, title: "Classify", source: "Gemini Flash Lite", tag: "Model", text: "Lease question · medium urgency · English" },
      { id: "b", x: COLUMNS.left, y: 320, title: "Find tenant", source: "Tenant records", tag: "Lookup", text: "No tenant with this address. Unknown sender." },
      { id: "c", x: COLUMNS.middle, y: 180, title: "Privacy guard", source: "Scoped tools", tag: "Guard", text: "Tools only see the sender's own data. Nothing about flat 3.01 is shared." },
      { id: "d", x: COLUMNS.right, y: 30, title: "Hand over", source: "Agent", tag: "Escalate", text: "Legal request from an unknown sender: escalated to a person, no draft." },
      { id: "e", x: COLUMNS.right, y: 320, title: "On the record", source: "Run timeline", tag: "Audit", text: "4 steps · 1,830 tokens · $0.0012, all in the run log." },
    ],
    edges: [["a", "c"], ["b", "c"], ["c", "d"], ["c", "e"]],
  },
];

const TAG_STYLE: Record<Tag, string> = {
  Model: "bg-[oklch(0.75_0.12_280/0.2)] text-[oklch(0.85_0.1_280)]",
  Lookup: "bg-white/10 text-white/80",
  Tool: "bg-white/10 text-white/80",
  Draft: "bg-primary text-primary-foreground",
  Approval: "bg-primary text-primary-foreground",
  Alert: "bg-[oklch(0.65_0.2_25)] text-white",
  Guard: "bg-[oklch(0.75_0.12_280/0.2)] text-[oklch(0.85_0.1_280)]",
  Escalate: "bg-[oklch(0.8_0.14_75/0.2)] text-[oklch(0.88_0.12_80)]",
  Audit: "bg-white/10 text-white/80",
};

const STEP_MS = 420; // between two nodes appearing

export function ScenarioStory() {
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const blocks = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          setActive(index);
          setRevealed((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
        }
      },
      // A canvas counts once it crosses the middle band of the screen.
      { rootMargin: "-42% 0px -42% 0px" },
    );
    for (const el of blocks.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function goTo(index: number) {
    blocks.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* Phones: pinned under the header. Desktop: pinned beside the canvases. */}
      <div className="sticky top-[72px] z-20 self-start lg:top-[calc(50vh-120px)]">
        <EmailPanel scenario={SCENARIOS[active]!} active={active} onTab={goTo} />
      </div>

      <div className="flex flex-col gap-10 lg:gap-0">
        {SCENARIOS.map((scenario, i) => (
          <div
            key={scenario.tab}
            ref={(el) => {
              blocks.current[i] = el;
            }}
            data-index={i}
            className="lg:flex lg:min-h-[85vh] lg:flex-col lg:justify-center"
          >
            <Canvas scenario={scenario} revealed={revealed.has(i)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailPanel({
  scenario,
  active,
  onTab,
}: {
  scenario: Scenario;
  active: number;
  onTab: (index: number) => void;
}) {
  const { typed, done } = useTypewriter(scenario.body, true, 16);
  const tabs = useRef<HTMLDivElement>(null);

  // On phones the tabs scroll sideways; keep the active one in view.
  useEffect(() => {
    const row = tabs.current;
    const tab = row?.children[active] as HTMLElement | undefined;
    if (row && tab && row.scrollWidth > row.clientWidth) {
      row.scrollTo({ left: tab.offsetLeft - 8, behavior: "smooth" });
    }
  }, [active]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111115]/95 shadow-2xl backdrop-blur-xl">
      <div
        ref={tabs}
        className="flex gap-1 overflow-x-auto border-b border-white/8 p-2 [scrollbar-width:none] lg:flex-wrap [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Kinds of email"
      >
        {SCENARIOS.map((s, i) => (
          <button
            key={s.tab}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => onTab(i)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              i === active ? "bg-primary text-primary-foreground" : "text-white/60 hover:text-white",
            )}
          >
            {s.tab}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 p-3 lg:gap-3 lg:p-4">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span className="flex size-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/80">
            {scenario.from.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate">{scenario.from}</span>
          <span className="truncate font-medium text-white lg:hidden">· {scenario.subject}</span>
        </div>
        <p className="hidden font-medium text-white lg:block">{scenario.subject}</p>
        <div className="flex items-end gap-3">
          <p className="line-clamp-3 min-h-[3.75rem] flex-1 text-[13px] leading-relaxed text-white/75 lg:line-clamp-none lg:min-h-[4.5rem] lg:text-sm">
            {typed}
            {!done && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-primary" />}
          </p>
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
              done ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/50",
            )}
            aria-hidden="true"
          >
            <ArrowUpRightIcon className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

function Canvas({ scenario, revealed }: { scenario: Scenario; revealed: boolean }) {
  const byId = new Map(scenario.nodes.map((n) => [n.id, n]));
  const order = new Map(scenario.nodes.map((n, i) => [n.id, i]));

  return (
    <div className="bg-dots relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c10] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)]">
      {/* Desktop: nodes on a canvas with wires. */}
      <div className="relative hidden w-full lg:block" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
          {scenario.edges.map(([from, to]) => {
            const a = byId.get(from)!;
            const b = byId.get(to)!;
            const x1 = a.x + NODE_W;
            const y1 = a.y + ANCHOR_Y;
            const x2 = b.x;
            const y2 = b.y + ANCHOR_Y;
            const delay = (order.get(to)! * STEP_MS) - 150;
            return (
              <g key={`${from}-${to}`}>
                <path
                  d={`M${x1} ${y1} C${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`}
                  pathLength={1}
                  fill="none"
                  stroke="var(--primary)"
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                  strokeDasharray="1"
                  strokeDashoffset={revealed ? 0 : 1}
                  style={{ transition: `stroke-dashoffset 600ms ease ${Math.max(delay, 0)}ms` }}
                />
                <circle cx={x1} cy={y1} r={3.5} fill="var(--primary)" opacity={revealed ? 1 : 0} style={{ transition: `opacity 200ms ${Math.max(delay, 0)}ms` }} />
                <circle cx={x2} cy={y2} r={3.5} fill="var(--primary)" opacity={revealed ? 1 : 0} style={{ transition: `opacity 200ms ${Math.max(delay + 600, 0)}ms` }} />
              </g>
            );
          })}
        </svg>
        {scenario.nodes.map((node, i) => (
          <div
            key={node.id}
            className="absolute"
            style={{ left: `${(node.x / W) * 100}%`, top: `${(node.y / H) * 100}%`, width: `${(NODE_W / W) * 100}%` }}
          >
            <NodeCard node={node} revealed={revealed} delay={i * STEP_MS} />
          </div>
        ))}
      </div>

      {/* Phones: the same steps top to bottom, joined by a rail that fills in. */}
      <ol className="relative flex flex-col gap-4 py-5 pr-4 pl-10 lg:hidden">
        <span className="absolute top-8 bottom-8 left-[19px] w-px bg-white/10" aria-hidden="true" />
        <span
          className="absolute top-8 bottom-8 left-[19px] w-px origin-top bg-primary/70 transition-transform ease-linear"
          style={{
            transform: `scaleY(${revealed ? 1 : 0})`,
            transitionDuration: `${scenario.nodes.length * STEP_MS}ms`,
          }}
          aria-hidden="true"
        />
        {scenario.nodes.map((node, i) => (
          <li key={node.id} className="relative">
            <span
              className={cn(
                "absolute top-5 -left-[25px] size-2.5 rounded-full bg-primary ring-4 ring-[#0c0c10] transition-opacity duration-300",
                revealed ? "opacity-100" : "opacity-0",
              )}
              style={{ transitionDelay: `${i * STEP_MS}ms` }}
              aria-hidden="true"
            />
            <NodeCard node={node} revealed={revealed} delay={i * STEP_MS} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function NodeCard({ node, revealed, delay }: { node: Node; revealed: boolean; delay: number }) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setStarted(true), delay + 250);
    return () => window.clearTimeout(timer);
  }, [revealed, delay]);
  const { typed, done } = useTypewriter(node.text, started, 14);

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-[#16161b] p-3 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.9)] transition-all duration-500 ease-out",
        revealed ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-white">{node.title}</span>
        <span className="truncate text-white/40">{node.source}</span>
      </div>
      <span className={cn("mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold", TAG_STYLE[node.tag])}>{node.tag}</span>
      <p className="mt-2 min-h-[3.2rem] text-xs leading-relaxed text-white/75">
        {typed}
        {started && !done && <span className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 animate-pulse bg-primary" />}
      </p>
    </div>
  );
}
