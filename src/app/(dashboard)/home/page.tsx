"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import {
  ArrowRightIcon,
  BotIcon,
  CircleDollarSignIcon,
  InboxIcon,
  ShieldCheckIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4 }).format(value);

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The first screen: what needs a decision, and how the agent is doing. */
export default function HomePage() {
  const viewer = useQuery(api.users.viewer);
  const stats = useQuery(api.agent.runStats);
  const pendingCount = useQuery(api.approvals.pendingCount);
  const pending = usePaginatedQuery(api.approvals.listPending, {}, { initialNumItems: 5 });
  const threads = usePaginatedQuery(api.inbox.listThreads, {}, { initialNumItems: 6 });
  const now = useNow(30_000);
  const name = viewer?.email?.split("@")[0];

  return (
    <>
      <PageHeader
        title={`${greeting(new Date(now).getHours())}${name ? `, ${name}` : ""}`}
        description="The agent reads tenant email, looks up the tenant and the lease, and drafts. Nothing is sent until you approve it."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={ShieldCheckIcon}
          label="Waiting for you"
          value={pendingCount === undefined ? undefined : String(pendingCount)}
          hint="proposals to approve"
          href="/approvals"
          highlight={!!pendingCount}
        />
        <Kpi
          icon={TimerIcon}
          label="Time to draft"
          value={stats === undefined ? undefined : stats.avgDraftMs === null ? "—" : `${(stats.avgDraftMs / 1000).toFixed(0)}s`}
          hint="email in → draft ready"
        />
        <Kpi
          icon={CircleDollarSignIcon}
          label="Cost per email"
          value={stats === undefined ? undefined : usd(stats.avgCostUsd)}
          hint="Gemini, paid-tier prices"
        />
        <Kpi
          icon={BotIcon}
          label="Approved as drafted"
          value={
            stats === undefined
              ? undefined
              : stats.approvals.decided === 0
                ? "—"
                : `${Math.round((stats.approvals.approved / stats.approvals.decided) * 100)}%`
          }
          hint={stats ? `of ${stats.approvals.decided} decisions` : ""}
          href="/runs"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Section
          className="lg:col-span-3"
          title="Needs your decision"
          href="/approvals"
          empty={pending.status !== "LoadingFirstPage" && pending.results.length === 0}
          emptyText="All caught up. New proposals appear here as soon as the agent has drafted."
          loading={pending.status === "LoadingFirstPage"}
        >
          {pending.results.map((approval) => (
            <Link
              key={approval._id}
              href={approval.run ? `/runs/${approval.run._id}` : "/approvals"}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  approval.run?.escalationReason ? "bg-danger-soft text-destructive" : "bg-secondary text-secondary-foreground",
                )}
              >
                {approval.action === "send_reply" ? "Re" : "Tk"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {approval.action === "send_reply" ? "Send reply" : "Create ticket"} · {approval.thread?.subject}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {approval.tenant?.name ?? approval.thread?.counterpartEmail}
                  {approval.run?.escalationReason && " · " + approval.run.escalationReason}
                </span>
              </span>
              {approval.run?.escalationReason ? <StatusBadge status="urgent" label="Emergency" /> : <StatusBadge status="pending" />}
            </Link>
          ))}
        </Section>

        <Section
          className="lg:col-span-2"
          title="Latest email"
          href="/inbox"
          empty={threads.status !== "LoadingFirstPage" && threads.results.length === 0}
          emptyText="No email yet. Send one to the connected inbox or use Simulate email."
          loading={threads.status === "LoadingFirstPage"}
        >
          {threads.results.map((thread) => (
            <Link
              key={thread._id}
              href={`/inbox/${thread._id}`}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60"
            >
              <InboxIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{thread.subject}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {thread.tenant?.name ?? thread.counterpartName ?? thread.counterpartEmail} · {timeAgo(thread.lastMessageAt, now)}
                </span>
              </span>
              {thread.status !== "open" && <StatusBadge status={thread.status} />}
            </Link>
          ))}
        </Section>
      </div>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  href,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  value: string | undefined;
  hint: string;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "glass glass-hover flex h-full flex-col gap-2 rounded-xl p-4",
        href && "hover:border-primary/40",
        highlight && "border-primary/40",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("size-4", highlight && "text-primary")} />
        {label}
      </div>
      {value === undefined ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      )}
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Section({
  title,
  href,
  children,
  empty,
  emptyText,
  loading,
  className,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
  empty: boolean;
  emptyText: string;
  loading: boolean;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col glass rounded-xl", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link href={href} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          View all <ArrowRightIcon className="size-3" />
        </Link>
      </div>
      <div className="flex flex-col p-1.5">
        {loading ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : empty ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
