import type { WorkflowId } from "@convex-dev/workflow";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { deliverMessage } from "./gmail";
import { requireOwner, requireUserId } from "./lib/auth";
import { workflow } from "./lib/workflow";
import {
  approvalEvent,
  payloadSchemaFor,
  proposeAction,
  type ReplyPayload,
  ticketPayloadSchema,
  type TicketPayload,
} from "./model/approvals";
import { queueOutbound } from "./model/inbox";

const MAX_PENDING_COUNT = 99;

// --- Reading ---------------------------------------------------------------

async function withContext(ctx: QueryCtx, approval: Doc<"approvals">) {
  const thread = await ctx.db.get(approval.threadId);
  const run = await ctx.db.get(approval.runId);
  const tenant = run?.tenantId ? await ctx.db.get(run.tenantId) : null;
  return {
    ...approval,
    thread: thread && {
      _id: thread._id,
      subject: thread.subject,
      counterpartEmail: thread.counterpartEmail,
      counterpartName: thread.counterpartName,
      simulated: thread.simulated,
    },
    run: run && {
      _id: run._id,
      category: run.category,
      urgency: run.urgency,
      summary: run.summary,
      escalationReason: run.escalationReason,
    },
    tenant: tenant && { _id: tenant._id, name: tenant.name },
  };
}

/** The queue: oldest pending first. */
export const listPending = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireUserId(ctx);
    const result = await ctx.db
      .query("approvals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((a) => withContext(ctx, a))) };
  },
});

/** Recently decided, newest first. */
export const listDecided = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireUserId(ctx);
    const result = await ctx.db
      .query("approvals")
      .withIndex("by_decided", (q) => q.gt("decidedAt", 0))
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((a) => withContext(ctx, a))) };
  },
});

/** For the nav badge; reads at most 100 index entries. */
export const pendingCount = query({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    const pending = await ctx.db
      .query("approvals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(MAX_PENDING_COUNT + 1);
    return pending.length;
  },
});

export const forRun = query({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    await requireUserId(ctx);
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .collect();
    return await Promise.all(approvals.map((a) => withContext(ctx, a)));
  },
});

// --- Deciding --------------------------------------------------------------

async function decide(
  ctx: MutationCtx,
  approvalId: Id<"approvals">,
  decision:
    | { status: "approved"; editedPayload?: ReplyPayload | TicketPayload }
    | { status: "rejected"; rejectReason: string },
) {
  const userId = await requireUserId(ctx);
  const approval = await ctx.db.get(approvalId);
  if (approval === null) throw new ConvexError("Approval not found");
  if (approval.status !== "pending") {
    throw new ConvexError("This action was already decided");
  }
  // Decisions on real email (sending, creating tickets for it) are owner-only.
  const thread = await ctx.db.get(approval.threadId);
  if (!thread?.simulated) await requireOwner(ctx);
  await ctx.db.patch(approvalId, { ...decision, decidedAt: Date.now(), decidedBy: userId });

  // Wake the run's workflow, which is waiting on this event.
  const run = await ctx.db.get(approval.runId);
  if (run?.workflowId) {
    await workflow.sendEvent(ctx, {
      workflowId: run.workflowId as WorkflowId,
      name: approvalEvent(approvalId),
    });
  }
}

export const approve = mutation({
  args: { approvalId: v.id("approvals") },
  handler: async (ctx, { approvalId }) => {
    await decide(ctx, approvalId, { status: "approved" });
  },
});

/** Edit then approve: the edited version is what gets executed. */
export const approveEdited = mutation({
  args: { approvalId: v.id("approvals"), payload: v.any() },
  handler: async (ctx, { approvalId, payload }) => {
    const approval = await ctx.db.get(approvalId);
    if (approval === null) throw new ConvexError("Approval not found");
    const parsed = payloadSchemaFor(approval.action).safeParse(payload);
    if (!parsed.success) {
      throw new ConvexError(parsed.error.issues[0]?.message ?? "Invalid edit");
    }
    await decide(ctx, approvalId, { status: "approved", editedPayload: parsed.data });
  },
});

export const reject = mutation({
  args: { approvalId: v.id("approvals"), reason: v.string() },
  handler: async (ctx, { approvalId, reason }) => {
    const text = reason.trim();
    if (text.length < 3 || text.length > 500) {
      throw new ConvexError("Give a short reason (3 to 500 characters)");
    }
    await decide(ctx, approvalId, { status: "rejected", rejectReason: text });
  },
});

// --- Workflow side ---------------------------------------------------------

/** Called by the create_ticket tool: records the proposal, creates nothing. */
export const proposeFromTool = internalMutation({
  args: { runId: v.id("agentRuns"), stepIndex: v.number(), payload: v.any() },
  handler: async (ctx, { runId, stepIndex, payload }) =>
    await proposeAction(ctx, {
      runId,
      stepIndex,
      action: "create_ticket",
      payload: ticketPayloadSchema.parse(payload),
    }),
});

/**
 * After the act loop: turns the draft into a send_reply proposal, and returns
 * every pending approval of the run, tickets first. Marks the run and the
 * conversation as waiting when there is anything to decide.
 */
export const collectForRun = internalMutation({
  args: { runId: v.id("agentRuns"), stepIndex: v.number() },
  handler: async (ctx, { runId, stepIndex }) => {
    const run = (await ctx.db.get(runId))!;
    await ctx.db.patch(runId, { draftedAt: Date.now() });
    // A draft always becomes a proposal. With an escalation it is a safety
    // emergency: the person already alerted can send it in one click.
    if (run.draft) {
      await proposeAction(ctx, { runId, stepIndex, action: "send_reply", payload: run.draft });
    }
    // Eval runs end here: proposals are recorded with status "eval".
    if (run.mode === "eval") return [];
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .collect();
    const pending = approvals
      .filter((a) => a.status === "pending")
      .sort((a, b) => (a.action === b.action ? a.stepIndex - b.stepIndex : a.action === "create_ticket" ? -1 : 1));
    if (pending.length > 0) {
      await ctx.db.patch(runId, { status: "awaiting_approval" });
      // "Needs a person" outranks "awaiting approval" in the inbox.
      if (!run.escalationReason) {
        await ctx.db.patch(run.threadId, { status: "awaiting_approval" });
      }
    }
    return pending.map((a) => ({ approvalId: a._id, action: a.action }));
  },
});

/** Opens the timeline step that shows "waiting for a decision". */
export const startWaiting = internalMutation({
  args: { approvalId: v.id("approvals"), stepIndex: v.number() },
  handler: async (ctx, { approvalId, stepIndex }) => {
    const approval = (await ctx.db.get(approvalId))!;
    await ctx.db.patch(approvalId, { waitStepIndex: stepIndex });
    const existing = await ctx.db
      .query("agentSteps")
      .withIndex("by_run_index", (q) => q.eq("runId", approval.runId).eq("index", stepIndex))
      .unique();
    if (existing) return;
    await ctx.db.insert("agentSteps", {
      runId: approval.runId,
      index: stepIndex,
      type: "approval",
      name: approval.action,
      input: JSON.stringify(approval.payload, null, 1),
      status: "running",
      attempt: 1,
      startedAt: Date.now(),
    });
  },
});

export const getForExecution = internalQuery({
  args: { approvalId: v.id("approvals") },
  handler: async (ctx, { approvalId }) => (await ctx.db.get(approvalId))!,
});

/** Queues the approved reply once; a re-run returns the same message. */
export const queueApprovedReply = internalMutation({
  args: { approvalId: v.id("approvals") },
  handler: async (ctx, { approvalId }): Promise<Id<"emailMessages">> => {
    const approval = (await ctx.db.get(approvalId))!;
    if (approval.result) return approval.result as Id<"emailMessages">;
    const reply = (approval.editedPayload ?? approval.payload) as ReplyPayload;
    const thread = (await ctx.db.get(approval.threadId))!;
    const messageId = await queueOutbound(ctx, thread, reply);
    await ctx.db.patch(approvalId, { result: messageId });
    return messageId;
  },
});

/** Creates the approved ticket on the sender's unit. */
export const createApprovedTicket = internalMutation({
  args: { approvalId: v.id("approvals") },
  handler: async (ctx, { approvalId }) => {
    const approval = (await ctx.db.get(approvalId))!;
    if (approval.status !== "approved") return approval.result ?? null;
    const run = (await ctx.db.get(approval.runId))!;
    const tenant = run.tenantId ? await ctx.db.get(run.tenantId) : null;
    if (!tenant?.unitId) {
      await ctx.db.patch(approvalId, { status: "failed", error: "The sender has no unit" });
      return null;
    }
    const ticket = (approval.editedPayload ?? approval.payload) as TicketPayload;
    const ticketId = await ctx.db.insert("tickets", {
      ...ticket,
      unitId: tenant.unitId,
      tenantId: tenant._id,
      status: "open",
      agentRunId: run._id,
    });
    await ctx.db.patch(approvalId, { status: "executed", result: ticketId });
    return ticketId;
  },
});

export const finishExecution = internalMutation({
  args: {
    approvalId: v.id("approvals"),
    outcome: v.union(v.literal("executed"), v.literal("failed"), v.literal("rejected")),
    detail: v.string(),
  },
  handler: async (ctx, { approvalId, outcome, detail }) => {
    const approval = (await ctx.db.get(approvalId))!;
    if (outcome !== "rejected" && approval.status === "approved") {
      await ctx.db.patch(approvalId, {
        status: outcome,
        ...(outcome === "failed" && { error: detail }),
      });
    }
    if (outcome === "rejected" && approval.action === "send_reply") {
      // Nothing was sent: the conversation still needs an answer.
      await ctx.db.patch(approval.threadId, { status: "open" });
    }
    const step =
      approval.waitStepIndex === undefined
        ? null
        : await ctx.db
            .query("agentSteps")
            .withIndex("by_run_index", (q) =>
              q.eq("runId", approval.runId).eq("index", approval.waitStepIndex!),
            )
            .unique();
    if (step) {
      await ctx.db.patch(step._id, {
        status: outcome === "failed" ? "failed" : "succeeded",
        output: detail,
        durationMs: Date.now() - step.startedAt,
        ...(outcome === "failed" && { error: detail }),
      });
    }
  },
});

/**
 * Runs after a decision. Approved: send the reply in the Gmail thread or
 * create the ticket, using the edited version when there is one. Rejected:
 * nothing happens. Never retried: a retry could send twice.
 */
export const execute = internalAction({
  args: { approvalId: v.id("approvals") },
  handler: async (ctx, { approvalId }) => {
    const approval = await ctx.runQuery(internal.approvals.getForExecution, { approvalId });
    const edited = approval.editedPayload !== undefined;

    if (approval.status === "rejected") {
      await ctx.runMutation(internal.approvals.finishExecution, {
        approvalId,
        outcome: "rejected",
        detail: `Rejected: ${approval.rejectReason}. Nothing was ${approval.action === "send_reply" ? "sent" : "created"}.`,
      });
      return;
    }
    if (approval.status !== "approved") return;

    if (approval.action === "create_ticket") {
      const ticketId = await ctx.runMutation(internal.approvals.createApprovedTicket, { approvalId });
      await ctx.runMutation(internal.approvals.finishExecution, {
        approvalId,
        outcome: ticketId ? "executed" : "failed",
        detail: ticketId
          ? `${edited ? "Edited and approved" : "Approved"}: ticket ${ticketId} created.`
          : "The sender has no unit, so no ticket was created.",
      });
      return;
    }

    const messageId = await ctx.runMutation(internal.approvals.queueApprovedReply, { approvalId });
    const delivery = await deliverMessage(ctx, messageId);
    if (delivery === null) return; // already delivered by an earlier run of this step
    await ctx.runMutation(internal.approvals.finishExecution, {
      approvalId,
      outcome: delivery.ok ? "executed" : "failed",
      detail: delivery.ok
        ? `${edited ? "Edited and approved" : "Approved"}: reply sent (${delivery.gmailMessageId}).`
        : `Send failed: ${delivery.error}`,
    });
  },
});
