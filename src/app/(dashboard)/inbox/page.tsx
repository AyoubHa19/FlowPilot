"use client";

import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { GmailConnection } from "@/components/inbox/gmail-connection";
import { SimulateEmailDialog } from "@/components/inbox/simulate-email-dialog";
import { InitialsAvatar } from "@/components/initials-avatar";
import { PageHeader } from "@/components/page-header";
import { EmptyState, TableSkeleton } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo, useNow } from "@/lib/time";

const PAGE_SIZE = 25;

// Shown once after Google redirects back from the OAuth screen.
const OAUTH_RESULTS: Record<string, [string, boolean]> = {
  connected: ["Gmail connected. New mail syncs every minute.", true],
  denied: ["Gmail access was not granted.", false],
  invalid_state: ["That connection link expired. Try again.", false],
  error: ["Gmail connection failed. Check the Convex logs.", false],
};

export default function InboxPage() {
  const params = useSearchParams();
  const now = useNow();
  const { results, status, loadMore } = usePaginatedQuery(
    api.inbox.listThreads,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  const oauthResult = params.get("gmail");
  useEffect(() => {
    const result = oauthResult && OAUTH_RESULTS[oauthResult];
    if (!result) return;
    (result[1] ? toast.success : toast.error)(result[0]);
    window.history.replaceState(null, "", "/inbox");
  }, [oauthResult]);

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Tenant email from the connected Gmail inbox. Each new email starts an agent run."
        actions={<SimulateEmailDialog />}
      />
      <GmailConnection />

      {status === "LoadingFirstPage" ? (
        <TableSkeleton rows={6} />
      ) : results.length === 0 ? (
        <EmptyState title="No emails yet">
          Send an email to the connected inbox, or use “Simulate email”.
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden glass rounded-xl">
          {results.map((thread) => {
            const unread = thread.status === "open" || thread.status === "needs_human";
            const who = thread.counterpartName ?? thread.counterpartEmail;
            return (
              <li key={thread._id}>
                <Link
                  href={`/inbox/${thread._id}`}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                    thread.status === "needs_human" && "bg-danger-soft/40",
                  )}
                >
                  <InitialsAvatar name={who} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")} title={thread.counterpartEmail}>
                        {who}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                        {timeAgo(thread.lastMessageAt, now)}
                      </span>
                    </div>
                    <p className={cn("truncate text-sm", unread ? "font-medium text-foreground" : "text-foreground/80")}>
                      {thread.subject}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{thread.snippet}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {thread.status !== "open" && <StatusBadge status={thread.status} />}
                      {thread.tenant ? (
                        <Badge variant="secondary">{thread.tenant.name}</Badge>
                      ) : (
                        <Badge variant="neutral">Unknown sender</Badge>
                      )}
                      {thread.simulated && <Badge variant="outline">Simulated</Badge>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" className="self-center" onClick={() => loadMore(PAGE_SIZE)}>
          Load more
        </Button>
      )}
    </>
  );
}
