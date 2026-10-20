"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { MailIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo, useNow } from "@/lib/time";
import { useViewer } from "@/lib/use-viewer";

/** Gmail connection status, connect / reconnect, and a manual sync. */
export function GmailConnection() {
  const status = useQuery(api.gmail.status);
  const startConnect = useMutation(api.gmail.startConnect);
  const syncNow = useAction(api.gmail.syncNow);
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);
  const now = useNow();
  const { isDemo } = useViewer();

  async function connect() {
    setBusy("connect");
    try {
      window.location.href = await startConnect();
    } catch {
      toast.error("Could not start the Gmail connection");
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      const result = await syncNow();
      toast.success(
        result === null
          ? "A sync is already running"
          : `Synced: ${result.fetched} new message${result.fetched === 1 ? "" : "s"}`,
      );
    } catch {
      toast.error("Sync failed");
    } finally {
      setBusy(null);
    }
  }

  if (status === undefined) return <Skeleton className="h-14" />;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm shadow-xs">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <MailIcon className="size-4" />
      </span>
      {status === null ? (
        <span className="text-muted-foreground">Gmail is not connected. Use “Simulate email” for demos.</span>
      ) : (
        <>
          <span className="font-medium">{status.email}</span>
          <Badge variant={status.status === "connected" ? "success" : "danger"}>
            {status.status === "connected" ? "Connected" : "Needs reconnect"}
          </Badge>
          <span className="text-muted-foreground">
            {status.lastSyncAt ? `Synced ${timeAgo(status.lastSyncAt, now)}` : "Not synced yet"}
          </span>
          {status.lastError && (
            <span className="basis-full text-xs text-destructive">Last error: {status.lastError}</span>
          )}
        </>
      )}
      <div className="ml-auto flex gap-2">
        {status?.status === "connected" && (
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void sync()}>
            <RefreshCwIcon className={busy === "sync" ? "animate-spin" : undefined} />
            Sync now
          </Button>
        )}
        {status?.status !== "connected" && !isDemo && (
          <Button size="sm" disabled={busy !== null} onClick={() => void connect()}>
            {status === null ? "Connect Gmail" : "Reconnect Gmail"}
          </Button>
        )}
      </div>
    </div>
  );
}
