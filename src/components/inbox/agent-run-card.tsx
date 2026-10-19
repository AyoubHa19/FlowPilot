"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { BotIcon, CheckIcon, CircleAlertIcon, LoaderIcon, WrenchIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

type RunData = NonNullable<FunctionReturnType<typeof api.agent.runForThread>>;
type Step = RunData["steps"][number];

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

function statusVariant(status: RunData["run"]["status"]) {
  if (status === "failed") return "destructive" as const;
  if (status === "drafted") return "secondary" as const;
  return "outline" as const;
}

/** Live view of the agent's latest run on this conversation. */
export function AgentRunCard({
  threadId,
  onUseDraft,
}: {
  threadId: Id<"emailThreads">;
  onUseDraft: (body: string) => void;
}) {
  const data = useQuery(api.agent.runForThread, { threadId });
  if (data === undefined) return <Skeleton className="h-40" />;
  if (data === null) return null;

  const { run, steps } = data;
  const running = run.status === "queued" || run.status === "running";
  const seconds = run.finishedAt ? ((run.finishedAt - run.startedAt) / 1000).toFixed(1) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2">
        <BotIcon className="size-4" />
        <CardTitle className="mr-auto">Agent run</CardTitle>
        <Badge variant={statusVariant(run.status)}>
          {running && <LoaderIcon className="animate-spin" />}
          {humanize(run.status)}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {run.status === "skipped" ? (
          <p className="text-muted-foreground">Skipped without an LLM call: {run.skipReason}.</p>
        ) : (
          <>
            {run.category && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{humanize(run.category)}</Badge>
                <Badge variant={run.urgency === "urgent" || run.urgency === "high" ? "destructive" : "outline"}>
                  {humanize(run.urgency ?? "")} urgency
                </Badge>
                <Badge variant="outline">{run.language}</Badge>
                <span className="text-muted-foreground">{run.summary}</span>
              </div>
            )}

            {run.escalationReason && (
              <p className="flex items-start gap-2 rounded-md border border-amber-500/40 p-2">
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                Escalated to a person: {run.escalationReason}
              </p>
            )}
            {run.error && <p className="text-destructive">Error: {run.error}</p>}

            {run.draft && (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Draft reply</span>
                  <span className="text-muted-foreground">{run.draft.subject}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => onUseDraft(run.draft!.body)}
                  >
                    Use draft
                  </Button>
                </div>
                <p className="whitespace-pre-wrap">{run.draft.body}</p>
                <p className="text-xs text-muted-foreground">
                  Nothing is sent until you send it yourself. Approvals arrive in Stage 6.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <span>{run.tokensIn.toLocaleString()} in / {run.tokensOut.toLocaleString()} out tokens</span>
              <span title="At paid-tier list prices; the free tier costs nothing">
                {usd.format(run.costUsd)}
              </span>
              <span>{run.toolCalls}/8 tool calls</span>
              {seconds && <span>{seconds}s</span>}
              <span>
                {run.model} · {run.promptVersion}
              </span>
            </div>
          </>
        )}

        {steps.length > 0 && (
          <details open={running}>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              {steps.length} steps
            </summary>
            <ol className="mt-2 flex flex-col gap-1">
              {steps.map((step) => (
                <StepRow key={step._id} step={step} />
              ))}
            </ol>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function StepRow({ step }: { step: Step }) {
  const Icon = step.status === "running" ? LoaderIcon : step.status === "failed" ? CircleAlertIcon : CheckIcon;
  return (
    <li className="rounded-md border px-2 py-1.5 text-xs">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-2">
          <Icon
            className={cn(
              "size-3.5",
              step.status === "running" && "animate-spin",
              step.status === "failed" ? "text-destructive" : "text-muted-foreground",
            )}
          />
          {step.type === "tool" ? <WrenchIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
          <span className="font-medium">{step.name}</span>
          {step.attempt > 1 && <Badge variant="outline">retried ×{step.attempt - 1}</Badge>}
          <span className="ml-auto text-muted-foreground tabular-nums">
            {step.tokensIn ? `${step.tokensIn}/${step.tokensOut} tok · ` : ""}
            {step.durationMs !== undefined ? `${step.durationMs} ms` : "…"}
          </span>
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {step.error && <p className="text-destructive">Last error: {step.error}</p>}
          <pre className="max-h-48 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{step.input}</pre>
          {step.output && (
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{step.output}</pre>
          )}
        </div>
      </details>
    </li>
  );
}
