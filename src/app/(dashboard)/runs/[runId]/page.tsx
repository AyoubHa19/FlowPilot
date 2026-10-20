"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  BotIcon,
  CheckIcon,
  CircleAlertIcon,
  HandIcon,
  LoaderIcon,
  WrenchIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../../../convex/_generated/api";
import { ApprovalCard } from "@/components/approvals/approval-card";
import { PageHeader } from "@/components/page-header";
import { NotFound } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { retryNotice } from "@/lib/agent-status";
import { humanize, urgencyLabel } from "@/lib/format";
import { formatDateTime, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

type Timeline = NonNullable<FunctionReturnType<typeof api.agent.runTimeline>>;
type Step = Timeline["steps"][number];

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

function seconds(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Live timeline of one agent run: every step, as it happens. */
export default function RunPage() {
  const { runId } = useParams<{ runId: string }>();
  const data = useQuery(api.agent.runTimeline, { runId });
  const approvals = useQuery(
    api.approvals.forRun,
    data ? { runId: data.run._id } : "skip",
  );
  const now = useNow(1000);

  if (data === null) return <NotFound what="Run" />;
  if (data === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { run, steps, thread, tenant, email } = data;
  const active = !run.finishedAt;
  const pending = (approvals ?? []).filter((a) => a.status === "pending");

  return (
    <>
      <PageHeader
        eyebrow={
          thread && (
            <Link href={`/inbox/${thread._id}`} className="hover:text-foreground">
              ← {thread.subject}
            </Link>
          )
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            Agent run <StatusBadge status={run.status} />
          </span>
        }
        description={
          <>
            {email && `From ${email.from} · received ${formatDateTime(email.receivedAt)}`}
            {tenant && (
              <>
                {" · tenant "}
                <Link href={`/tenants/${tenant._id}`} className="underline-offset-4 hover:underline">
                  {tenant.name}
                </Link>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2 text-sm">
        {run.category && <Badge variant="secondary">{humanize(run.category)}</Badge>}
        {run.urgency && <Badge variant="outline">{urgencyLabel(run.urgency)}</Badge>}
        {run.language && <Badge variant="outline">{run.language}</Badge>}
        <span className="text-muted-foreground">{run.summary}</span>
      </div>

      <dl className="glass grid grid-cols-2 gap-3 rounded-xl p-3 text-sm sm:grid-cols-5">
        <Stat label="Elapsed" value={seconds((run.finishedAt ?? now) - run.startedAt)} />
        <Stat label="Tool calls" value={`${run.toolCalls} / 8`} />
        <Stat label="Tokens" value={`${run.tokensIn.toLocaleString()} / ${run.tokensOut.toLocaleString()}`} />
        <Stat label="Cost (paid tier)" value={usd.format(run.costUsd)} />
        <Stat label="Model · prompt" value={`${run.model} · ${run.promptVersion}`} />
      </dl>

      {run.escalationReason && (
        <p className="rounded-md border border-amber-500/40 p-3 text-sm">
          Escalated to a person: {run.escalationReason}
        </p>
      )}
      {retryNotice(active, steps) && (
        <p className="flex items-start gap-2 rounded-md border p-3 text-sm text-muted-foreground">
          <LoaderIcon className="mt-0.5 size-4 shrink-0 animate-spin" />
          {retryNotice(active, steps)}
        </p>
      )}
      {run.error && <p className="text-sm text-destructive">Error: {run.error}</p>}

      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Waiting for your decision</h2>
          {pending.map((approval) => (
            <ApprovalCard key={approval._id} approval={approval} />
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Timeline</h2>
        <ol className="relative flex flex-col gap-2 border-l pl-6">
          {steps.map((step) => (
            <TimelineStep key={step._id} step={step} start={run.startedAt} now={now} />
          ))}
          {active && steps.at(-1)?.status !== "running" && (
            <li className="text-xs text-muted-foreground">
              <LoaderIcon className="mr-1 inline size-3 animate-spin" />
              Next step starting…
            </li>
          )}
        </ol>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums" title={value}>{value}</dd>
    </div>
  );
}

function TimelineStep({ step, start, now }: { step: Step; start: number; now: number }) {
  const running = step.status === "running";
  const TypeIcon = step.type === "llm" ? BotIcon : step.type === "approval" ? HandIcon : WrenchIcon;
  const StatusIcon = running ? LoaderIcon : step.status === "failed" ? CircleAlertIcon : CheckIcon;
  const duration = step.durationMs ?? (running ? now - step.startedAt : undefined);
  const label =
    step.type === "approval"
      ? running
        ? `Waiting for approval: ${step.name}`
        : `Approval: ${step.name}`
      : step.name;

  return (
    <li className="relative">
      <span
        className={cn(
          "absolute top-2.5 -left-[1.95rem] flex size-4 items-center justify-center rounded-full border bg-background",
          step.status === "failed" && "border-destructive",
        )}
      >
        <StatusIcon
          className={cn(
            "size-2.5",
            running && "animate-spin",
            step.status === "failed" ? "text-destructive" : "text-muted-foreground",
          )}
        />
      </span>
      <details className="glass rounded-xl px-3 py-2 text-sm" open={running && step.type === "approval"}>
        <summary className="flex cursor-pointer flex-wrap items-center gap-2">
          <TypeIcon className="size-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
          {step.attempt > 1 && <Badge variant="outline">retried ×{step.attempt - 1}</Badge>}
          {step.status === "failed" && <Badge variant="destructive">Failed</Badge>}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            +{seconds(step.startedAt - start)}
            {duration !== undefined && ` · ${seconds(duration)}`}
            {step.tokensIn ? ` · ${step.tokensIn}/${step.tokensOut} tok` : ""}
            {step.costUsd ? ` · ${usd.format(step.costUsd)}` : ""}
          </span>
        </summary>
        <div className="mt-2 flex flex-col gap-2 text-xs">
          {step.error && <p className="text-destructive">{step.status === "failed" ? "Error" : "Last error before retry"}: {step.error}</p>}
          <div>
            <p className="mb-1 font-medium text-muted-foreground">Input</p>
            <pre className="max-h-64 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{step.input}</pre>
          </div>
          {step.output && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Output</p>
              <pre className="max-h-64 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{step.output}</pre>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}
