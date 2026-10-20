"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/* Real screenshots of the app (demo data only), in public/landing/. */
export const SCREENS = {
  conversation: { src: "/landing/conversation.jpg", label: "Conversation" },
  draft: { src: "/landing/draft.jpg", label: "Agent draft" },
  run: { src: "/landing/run-timeline.jpg", label: "Run timeline" },
  buildings: { src: "/landing/buildings.jpg", label: "Buildings" },
  documents: { src: "/landing/documents.jpg", label: "Lease search" },
} as const;

type ScreenKey = keyof typeof SCREENS;

const ARC: ScreenKey[] = ["documents", "buildings", "run", "draft", "conversation", "run", "documents"];

/** A row of screens bent around the viewer, like the inside of a cylinder. */
export function ScreenArc() {
  const center = (ARC.length - 1) / 2;
  return (
    <div className="relative -mx-4 overflow-hidden py-6 sm:mx-0" aria-hidden="true">
      <div className="flex items-center justify-center [perspective:1100px]">
        {ARC.map((key, i) => {
          const offset = i - center;
          const distance = Math.abs(offset);
          return (
            <div
              key={`${key}-${i}`}
              className={cn(
                "relative -mx-3 shrink-0 overflow-hidden rounded-xl border border-white/12 bg-black shadow-[0_30px_60px_-25px_rgb(0_0_0/0.95)] sm:-mx-2",
                distance > 1 && "hidden sm:block",
                distance > 2 && "hidden lg:block",
              )}
              style={{
                width: `clamp(150px, ${15 + distance * 2.5}vw, 300px)`,
                transform: `rotateY(${offset * -16}deg) translateZ(${distance * 34}px)`,
                zIndex: 10 - Math.round(distance),
                animation: `arc-float 7s ease-in-out ${i * 0.6}s infinite`,
              }}
            >
              <Image src={SCREENS[key].src} alt="" width={800} height={421} className="block h-auto w-full" priority={distance < 1} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DECK: { key: ScreenKey; title: string; text: string; side: [ScreenKey, string][] }[] = [
  {
    key: "conversation",
    title: "Inbox",
    text: "Every tenant email lands here, linked to the tenant and their unit. Simulated email works the same way, so you can try it without Gmail.",
    side: [["draft", "Draft ready"], ["run", "Run started"]],
  },
  {
    key: "draft",
    title: "Drafts",
    text: "The agent's reply sits next to the email, in the tenant's language, with the lease clause it relied on. Use it, edit it, or write your own.",
    side: [["conversation", "Tenant linked"], ["documents", "Lease clause"]],
  },
  {
    key: "run",
    title: "Run timeline",
    text: "Each step of each run: what the model was asked, which tool it called, what came back, how long it took and what it cost.",
    side: [["draft", "Reply drafted"], ["conversation", "Email in"]],
  },
  {
    key: "documents",
    title: "Lease search",
    text: "Lease PDFs are split, embedded and searched per tenant. A tenant's question is only ever answered from their own lease.",
    side: [["buildings", "10,000 units"], ["run", "Search step"]],
  },
];

/** A stacked deck of screens with floating labels; tabs pick the top card. */
export function ScreenDeck() {
  const [active, setActive] = useState(0);
  const item = DECK[active]!;
  const [left, right] = item.side;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative w-full max-w-3xl pt-10">
        {/* The cards behind the top one. */}
        <div className="absolute inset-x-[10%] top-0 h-24 rounded-2xl border border-white/8 bg-white/[0.03]" />
        <div className="absolute inset-x-[5%] top-5 h-24 rounded-2xl border border-white/10 bg-white/[0.05]" />

        <div className="glass relative overflow-hidden rounded-2xl p-2">
          <Image
            key={item.key}
            src={SCREENS[item.key].src}
            alt={`${item.title} screen of FlowPilot`}
            width={800}
            height={421}
            className="block h-auto w-full animate-[deck-in_500ms_ease-out] rounded-xl"
          />
        </div>

        <FloatingTile screen={left![0]} label={left![1]} className="-left-6 top-1/3 hidden -rotate-6 md:block lg:-left-24" />
        <FloatingTile screen={right![0]} label={right![1]} className="-right-6 top-2/3 hidden rotate-6 md:block lg:-right-24" />
      </div>

      <div className="flex max-w-xl flex-col items-center gap-2 text-center">
        <h3 className="font-display text-4xl text-white">{item.title}</h3>
        <p className="text-sm text-muted-foreground">{item.text}</p>
      </div>

      <div className="glass flex flex-wrap justify-center gap-1 rounded-xl p-1" role="tablist" aria-label="App screens">
        {DECK.map((d, i) => (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm transition-colors",
              i === active ? "bg-primary font-medium text-primary-foreground" : "text-white/70 hover:text-white",
            )}
          >
            {d.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function FloatingTile({ screen, label, className }: { screen: ScreenKey; label: string; className?: string }) {
  return (
    <div
      className={cn(
        "absolute w-44 rounded-xl border border-white/12 bg-[#111115] p-1.5 shadow-[0_24px_50px_-20px_rgb(0_0_0/0.95)] lg:w-52",
        className,
      )}
      aria-hidden="true"
    >
      <div className="relative overflow-hidden rounded-lg">
        <Image src={SCREENS[screen].src} alt="" width={800} height={421} className="block h-28 w-full object-cover object-left-top" />
      </div>
      <span className="absolute -top-3 right-3 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
        {label}
      </span>
    </div>
  );
}
