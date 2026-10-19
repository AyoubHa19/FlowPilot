"use client";

import { usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { ApprovalCard } from "@/components/approvals/approval-card";
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
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold">Approvals</h1>
        <div className="flex rounded-lg border p-0.5 text-sm">
          {(["pending", "decided"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                tab === t ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "pending" ? "Pending" : "Decided"}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Everything the agent proposes waits here. Nothing is sent or created until you approve it.
      </p>

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
