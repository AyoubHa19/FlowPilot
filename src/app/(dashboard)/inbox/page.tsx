"use client";

import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { GmailConnection } from "@/components/inbox/gmail-connection";
import { SimulateEmailDialog } from "@/components/inbox/simulate-email-dialog";
import { EmptyState, TableSkeleton } from "@/components/states";
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
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold">Inbox</h1>
        <SimulateEmailDialog />
      </div>
      <GmailConnection />

      {status === "LoadingFirstPage" ? (
        <TableSkeleton rows={6} />
      ) : results.length === 0 ? (
        <EmptyState title="No emails yet">
          Send an email to the connected inbox, or use “Simulate email”.
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {results.map((thread) => (
            <li key={thread._id}>
              <Link
                href={`/inbox/${thread._id}`}
                className="flex flex-col gap-1 p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-2 sm:w-56 sm:shrink-0">
                  <span
                    className={cn("truncate", thread.status === "open" && "font-semibold")}
                    title={thread.counterpartEmail}
                  >
                    {thread.counterpartName ?? thread.counterpartEmail}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate", thread.status === "open" && "font-semibold")}>
                    {thread.subject}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{thread.snippet}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {thread.tenant ? (
                    <Badge variant="secondary">{thread.tenant.name}</Badge>
                  ) : (
                    <Badge variant="outline">Unknown sender</Badge>
                  )}
                  {thread.simulated && <Badge variant="outline">Simulated</Badge>}
                  {thread.status === "replied" && <Badge variant="outline">Replied</Badge>}
                  <span className="tabular-nums">{timeAgo(thread.lastMessageAt, now)}</span>
                </div>
              </Link>
            </li>
          ))}
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
