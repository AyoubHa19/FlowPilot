import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Event the run's workflow awaits for one approval. */
export function approvalEvent(approvalId: Id<"approvals">) {
  return `approval:${approvalId}`;
}

export const replyPayloadSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: z.string().trim().min(1, "The reply is empty").max(10_000),
});
export type ReplyPayload = z.infer<typeof replyPayloadSchema>;

export const ticketPayloadSchema = z.object({
  category: z.enum(["plumbing", "electrical", "heating", "appliance", "structural", "pest", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  description: z.string().trim().min(5, "Describe the problem").max(1_000),
});
export type TicketPayload = z.infer<typeof ticketPayloadSchema>;

export function payloadSchemaFor(action: "send_reply" | "create_ticket") {
  return action === "send_reply" ? replyPayloadSchema : ticketPayloadSchema;
}

/**
 * Records a proposed side effect. Keyed by (run, step), so a retried tool
 * step does not propose twice.
 */
export async function proposeAction(
  ctx: MutationCtx,
  args: {
    runId: Id<"agentRuns">;
    stepIndex: number;
    action: "send_reply" | "create_ticket";
    payload: ReplyPayload | TicketPayload;
  },
) {
  const existing = await ctx.db
    .query("approvals")
    .withIndex("by_run", (q) => q.eq("runId", args.runId))
    .collect();
  const same = existing.find((a) => a.stepIndex === args.stepIndex && a.action === args.action);
  if (same) return same._id;
  const run = (await ctx.db.get(args.runId))!;
  return await ctx.db.insert("approvals", {
    ...args,
    threadId: run.threadId,
    // Eval runs record what the agent would propose, but nothing can act on it.
    status: run.mode === "eval" ? "eval" : "pending",
  });
}
