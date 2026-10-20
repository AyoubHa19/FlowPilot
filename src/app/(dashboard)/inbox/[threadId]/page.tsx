"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { LockIcon, SendIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { AgentRunCard } from "@/components/inbox/agent-run-card";
import { InitialsAvatar } from "@/components/initials-avatar";
import { PageHeader } from "@/components/page-header";
import { NotFound } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/time";
import { DEMO_HINT, useViewer } from "@/lib/use-viewer";

export default function ThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const detail = useQuery(api.inbox.getThread, { threadId });
  // "Use draft" remounts the reply form with the agent's text.
  const [draft, setDraft] = useState<{ body: string; version: number } | null>(null);

  if (detail === null) return <NotFound what="Conversation" />;
  if (detail === undefined) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const { thread, messages, tenant } = detail;
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/inbox" className="hover:text-foreground">
            ← Inbox
          </Link>
        }
        title={thread.subject}
        description={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <InitialsAvatar name={thread.counterpartName ?? thread.counterpartEmail} className="size-6 text-[0.6rem]" />
            <span>
              {thread.counterpartName ? `${thread.counterpartName} · ` : ""}
              {thread.counterpartEmail}
            </span>
            {tenant ? (
              <Link href={`/tenants/${tenant._id}`}>
                <Badge variant="info">Tenant: {tenant.name}</Badge>
              </Link>
            ) : (
              <Badge variant="warning">Unknown sender</Badge>
            )}
            {thread.simulated && <Badge variant="neutral">Simulated</Badge>}
            <StatusBadge status={thread.status} />
          </span>
        }
      />

      <ol className="flex flex-col gap-3">
        {messages.map((message) => (
          <MessageBubble key={message._id} message={message} />
        ))}
      </ol>

      <AgentRunCard
        threadId={thread._id}
        onUseDraft={(body) => setDraft((d) => ({ body, version: (d?.version ?? 0) + 1 }))}
      />

      <ReplyForm
        key={draft?.version ?? 0}
        threadId={thread._id}
        simulated={thread.simulated}
        initialBody={draft?.body ?? ""}
      />
    </>
  );
}

function MessageBubble({ message }: { message: Doc<"emailMessages"> }) {
  const outbound = message.direction === "outbound";
  return (
    <li
      className={cn(
        "flex max-w-[85%] flex-col gap-2 glass rounded-xl p-4 text-sm",
        outbound ? "self-end border-primary/20 bg-primary/5" : "self-start",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{outbound ? "You" : message.from}</span>
        <span className="tabular-nums">{formatDateTime(message.receivedAt)}</span>
        {message.sendStatus && (
          <Badge variant={message.sendStatus === "failed" ? "destructive" : "outline"}>
            {message.sendStatus === "sending" ? "Sending…" : message.sendStatus === "sent" ? "Sent" : "Failed"}
          </Badge>
        )}
      </div>
      {/* Plain text only: email HTML is converted on ingest and never rendered. */}
      <p className="break-words whitespace-pre-wrap">{message.bodyText}</p>
      {message.sendError && <p className="text-xs text-destructive">{message.sendError}</p>}
    </li>
  );
}

function ReplyForm({
  threadId,
  simulated,
  initialBody,
}: {
  threadId: Id<"emailThreads">;
  simulated: boolean;
  initialBody: string;
}) {
  const queueReply = useMutation(api.inbox.queueReply);
  const { isDemo } = useViewer();
  const locked = isDemo && !simulated;
  const [body, setBody] = useState(initialBody);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim() === "") return;
    setPending(true);
    try {
      await queueReply({ threadId, body });
      setBody("");
    } catch (error) {
      toast.error(error instanceof ConvexError ? String(error.data) : "Could not send the reply");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 glass glass-hover rounded-xl p-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        aria-label="Reply"
        rows={4}
        disabled={pending || locked}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {locked ? (
            <span className="inline-flex items-center gap-1.5">
              <LockIcon className="size-3.5" /> {DEMO_HINT}
            </span>
          ) : simulated
            ? "Simulated conversation: the reply is saved, not emailed."
            : "Sent from the connected Gmail inbox, in the same thread."}
        </p>
        <Button type="submit" size="sm" disabled={pending || locked || body.trim() === ""}>
          <SendIcon />
          {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
