"use client";

import { usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { ApprovalCard } from "@/components/approvals/approval-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function ApprovalsPage() {
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const pending = usePaginatedQuery(
    api.approvals.listPending,
    tab === "pending" ? {} : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const decided = usePaginatedQuery(
    api.approvals.listDecided,
    tab === "decided" ? {} : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const list = tab === "pending" ? pending : decided;

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Everything the agent proposes waits here. Nothing is sent or created until you approve it."
        actions={
          <div className="flex rounded-lg border bg-card p-0.5 text-sm shadow-xs" role="tablist">
            {(["pending", "decided"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  tab === t ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "pending" ? "Pending" : "Decided"}
              </button>
            ))}
          </div>
        }
      />

      {list.status === "LoadingFirstPage" ? (
        <TableSkeleton rows={4} />
      ) : list.results.length === 0 ? (
        <EmptyState title={tab === "pending" ? "Nothing waiting for you" : "No decisions yet"}>
          {tab === "pending" && "New emails show up here once the agent has drafted a reply."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {list.results.map((approval) => (
            <ApprovalCard key={approval._id} approval={approval} showContext />
          ))}
        </div>
      )}
      {list.status === "CanLoadMore" && (
        <Button variant="outline" className="self-center" onClick={() => list.loadMore(PAGE_SIZE)}>
          Load more
        </Button>
      )}
    </>
  );
}
