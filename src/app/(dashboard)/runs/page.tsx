"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/page-header";
import { EmptyState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { humanize } from "@/lib/format";
import { timeAgo, useNow } from "@/lib/time";

const PAGE_SIZE = 25;

const usd = (value: number, digits = 4) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`);
const percent = (part: number, total: number) => (total === 0 ? "—" : `${Math.round((part / total) * 100)}%`);

export default function RunsPage() {
  const stats = useQuery(api.agent.runStats);
  const { results, status, loadMore } = usePaginatedQuery(api.agent.listRuns, {}, { initialNumItems: PAGE_SIZE });
  const now = useNow(30_000);

  return (
    <>
      <PageHeader
        title="Agent runs"
        description="One run per inbound email. Costs use Gemini's paid-tier list prices; on the free tier they cost nothing."
      />

      {stats === undefined ? (
        <Skeleton className="h-24" />
      ) : (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Runs" value={String(stats.runs)} hint={`last ${stats.window}`} />
          <Stat label="Cost per run" value={usd(stats.avgCostUsd)} hint={`${usd(stats.totalCostUsd, 2)} total`} />
          <Stat label="Time to draft" value={seconds(stats.avgDraftMs)} hint="average" />
          <Stat
            label="Escalated"
            value={percent(stats.byStatus.escalated ?? 0, stats.runs)}
            hint={`${stats.byStatus.escalated ?? 0} runs`}
          />
          <Stat
            label="Approved as drafted"
            value={percent(stats.approvals.approved, stats.approvals.decided)}
            hint={`${stats.approvals.decided} decisions`}
          />
          <Stat
            label="Edited / rejected"
            value={`${percent(stats.approvals.edited, stats.approvals.decided)} / ${percent(stats.approvals.rejected, stats.approvals.decided)}`}
            hint="of decisions"
          />
        </dl>
      )}

      {status === "LoadingFirstPage" ? (
        <TableSkeleton rows={8} />
      ) : results.length === 0 ? (
        <EmptyState title="No runs yet">Each new tenant email starts one.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((run) => (
              <TableRow key={run._id}>
                <TableCell className="max-w-64">
                  <Link href={`/runs/${run._id}`} className="block truncate font-medium underline-offset-4 hover:underline">
                    {run.subject ?? "(email)"}
                  </Link>
                  <span className="block truncate text-xs text-muted-foreground">{run.tenantName ?? run.from}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">{run.category ? humanize(run.category) : "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={run.status} />
                    {run.escalationReason && run.status !== "escalated" && <StatusBadge status="needs_human" />}
                    {run.status === "failed" && <RetryButton runId={run._id} />}
                  </div>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {(run.tokensIn + run.tokensOut).toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">{usd(run.costUsd)}</TableCell>
                <TableCell className="hidden text-right text-xs text-muted-foreground sm:table-cell">
                  {timeAgo(run.startedAt, now)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" className="self-center" onClick={() => loadMore(PAGE_SIZE)}>
          Load more
        </Button>
      )}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

function RetryButton({ runId }: { runId: Id<"agentRuns"> }) {
  const retry = useMutation(api.agent.retryRun);
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label="Retry run"
      title="Retry run"
      onClick={() =>
        void retry({ runId }).then(
          () => toast.success("Run restarted"),
          (error: unknown) => toast.error(error instanceof ConvexError ? String(error.data) : "Could not retry"),
        )
      }
    >
      <RotateCcwIcon />
    </Button>
  );
}
