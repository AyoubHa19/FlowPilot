"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { CheckIcon, PencilIcon, TicketIcon, MailIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { humanize } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { DEMO_HINT, useViewer } from "@/lib/use-viewer";
import { cn } from "@/lib/utils";

export type ApprovalWithContext = FunctionReturnType<typeof api.approvals.forRun>[number];

type Reply = { subject: string; body: string };
type Ticket = { category: string; priority: string; description: string };

const CATEGORIES = ["plumbing", "electrical", "heating", "appliance", "structural", "pest", "other"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

function errorText(error: unknown) {
  return error instanceof ConvexError ? String(error.data) : "Something went wrong, try again";
}

function statusBadge(approval: ApprovalWithContext) {
  const edited = approval.editedPayload !== undefined;
  switch (approval.status) {
    case "pending":
      return <Badge variant="warning">Waiting for you</Badge>;
    case "approved":
      return <Badge variant="info">Approved · running…</Badge>;
    case "executed":
      return <Badge variant="success">{edited ? "Edited & approved" : "Approved"} · done</Badge>;
    case "rejected":
      return <Badge variant="neutral">Rejected</Badge>;
    case "failed":
      return <Badge variant="danger">Failed</Badge>;
    case "eval":
      return <Badge variant="neutral">Eval only · never executed</Badge>;
  }
}

/** One proposed action with Approve / Edit then approve / Reject. */
export function ApprovalCard({
  approval,
  showContext = false,
}: {
  approval: ApprovalWithContext;
  showContext?: boolean;
}) {
  const approve = useMutation(api.approvals.approve);
  const approveEdited = useMutation(api.approvals.approveEdited);
  const reject = useMutation(api.approvals.reject);
  const [mode, setMode] = useState<"view" | "edit" | "reject">("view");
  const [pending, setPending] = useState(false);
  const { isDemo } = useViewer();
  // The server enforces this too; here it only explains the disabled buttons.
  const locked = isDemo && approval.thread?.simulated === false;
  const emergency = approval.run?.escalationReason?.startsWith("Safety emergency");

  const isReply = approval.action === "send_reply";
  const shown = (approval.editedPayload ?? approval.payload) as Reply & Ticket;

  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true);
    try {
      await action();
      toast.success(success);
      setMode("view");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setPending(false);
    }
  }

  function onEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = isReply
      ? { subject: String(form.get("subject") ?? ""), body: String(form.get("body") ?? "") }
      : {
          category: String(form.get("category") ?? ""),
          priority: String(form.get("priority") ?? ""),
          description: String(form.get("description") ?? ""),
        };
    void run(
      () => approveEdited({ approvalId: approval._id, payload }),
      isReply ? "Edited reply approved and sending" : "Edited ticket approved",
    );
  }

  function onRejectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    void run(() => reject({ approvalId: approval._id, reason }), "Rejected. Nothing was sent.");
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 glass rounded-xl p-4 text-sm",
        emergency && approval.status === "pending" && "border-destructive/50 ring-2 ring-destructive/15",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          {isReply ? <MailIcon className="size-3.5" /> : <TicketIcon className="size-3.5" />}
        </span>
        <span className="font-medium">{isReply ? "Send reply" : "Create ticket"}</span>
        {statusBadge(approval)}
        {emergency && <Badge variant="danger">Emergency · a person was alerted</Badge>}
        {showContext && approval.thread && (
          <Link
            href={`/inbox/${approval.thread._id}`}
            className="min-w-0 truncate text-muted-foreground underline-offset-4 hover:underline"
          >
            {approval.thread.subject} · {approval.tenant?.name ?? approval.thread.counterpartEmail}
          </Link>
        )}
        {showContext && approval.run && (
          <Link href={`/runs/${approval.run._id}`} className="ml-auto text-xs text-muted-foreground hover:underline">
            Run timeline →
          </Link>
        )}
      </div>

      {mode === "edit" ? (
        <form onSubmit={onEditSubmit} className="flex flex-col gap-3">
          {isReply ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`subject-${approval._id}`}>Subject</Label>
                <Input id={`subject-${approval._id}`} name="subject" defaultValue={shown.subject} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`body-${approval._id}`}>Reply</Label>
                <Textarea id={`body-${approval._id}`} name="body" rows={10} defaultValue={shown.body} />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`category-${approval._id}`}>Category</Label>
                  <select
                    id={`category-${approval._id}`}
                    name="category"
                    defaultValue={shown.category}
                    className="h-8 rounded-lg border bg-background px-2"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{humanize(c)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`priority-${approval._id}`}>Priority</Label>
                  <select
                    id={`priority-${approval._id}`}
                    name="priority"
                    defaultValue={shown.priority}
                    className="h-8 rounded-lg border bg-background px-2"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{humanize(p)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`description-${approval._id}`}>Description</Label>
                <Textarea id={`description-${approval._id}`} name="description" rows={3} defaultValue={shown.description} />
              </div>
            </>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              <CheckIcon />
              Approve edited
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode("view")} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-md bg-muted/50 p-3">
          {isReply ? (
            <>
              <p className="mb-2 font-medium">{shown.subject}</p>
              <p className="whitespace-pre-wrap">{shown.body}</p>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Badge variant="secondary">{humanize(shown.category)}</Badge>
                <Badge variant={shown.priority === "urgent" || shown.priority === "high" ? "destructive" : "outline"}>
                  {humanize(shown.priority)}
                </Badge>
              </div>
              <p>{shown.description}</p>
            </div>
          )}
        </div>
      )}

      {mode === "reject" && (
        <form onSubmit={onRejectSubmit} className="flex flex-col gap-2 sm:flex-row">
          <Input name="reason" placeholder="Why? (required)" aria-label="Reject reason" autoFocus />
          <Button type="submit" size="sm" variant="destructive" disabled={pending}>
            Reject
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode("view")} disabled={pending}>
            Cancel
          </Button>
        </form>
      )}

      {approval.status === "pending" && mode === "view" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={pending || locked}
            onClick={() =>
              void run(
                () => approve({ approvalId: approval._id }),
                isReply ? "Approved, sending the reply" : "Approved, creating the ticket",
              )
            }
          >
            <CheckIcon />
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={pending || locked} onClick={() => setMode("edit")}>
            <PencilIcon />
            Edit
          </Button>
          <Button size="sm" variant="ghost" disabled={pending || locked} onClick={() => setMode("reject")}>
            <XIcon />
            Reject
          </Button>
          {locked && <span className="text-xs text-muted-foreground">{DEMO_HINT}</span>}
        </div>
      )}

      {approval.status !== "pending" && (
        <p className="text-xs text-muted-foreground">
          {approval.decidedAt && `Decided ${formatDateTime(approval.decidedAt)}`}
          {approval.rejectReason && ` · Reason: ${approval.rejectReason}`}
          {approval.error && <span className="text-destructive"> · {approval.error}</span>}
        </p>
      )}
    </div>
  );
}
