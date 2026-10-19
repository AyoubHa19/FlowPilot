import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { workflow } from "../lib/workflow";
import { PROMPT_VERSION } from "../prompts/agent";
import { AGENT_MODEL } from "./llm";

/**
 * Starts the agent for a new inbound message: one run per message (the
 * by_message index makes a second call a no-op). Automated mail
 * (newsletters, notifications) is recorded as skipped without any LLM call.
 */
export async function startAgentRun(
  ctx: MutationCtx,
  args: {
    messageId: Id<"emailMessages">;
    threadId: Id<"emailThreads">;
    tenantId?: Id<"tenants">;
    skipReason?: string;
    failToolOnce?: string;
  },
) {
  const existing = await ctx.db
    .query("agentRuns")
    .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
    .first();
  if (existing) return existing._id;

  const now = Date.now();
  const runId = await ctx.db.insert("agentRuns", {
    messageId: args.messageId,
    threadId: args.threadId,
    tenantId: args.tenantId,
    status: args.skipReason ? "skipped" : "queued",
    skipReason: args.skipReason,
    toolCalls: 0,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    model: AGENT_MODEL,
    promptVersion: PROMPT_VERSION,
    failToolOnce: args.failToolOnce,
    startedAt: now,
    ...(args.skipReason && { finishedAt: now }),
  });
  if (!args.skipReason) {
    const workflowId = await workflow.start(
      ctx,
      internal.agent.runAgent,
      { runId },
      { onComplete: internal.agent.workflowDone, context: { runId } },
    );
    await ctx.db.patch(runId, { workflowId });
  }
  return runId;
}

const AUTOMATED_SENDER = /(^|[._+-])(no-?reply|do-?not-?reply|notifications?|mailer-daemon|newsletter)([._+-]|@)/i;
const AUTOMATED_LABELS = ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS"];

/** Why a message looks machine-sent, or undefined for a person's email. */
export function automatedReason(input: {
  fromEmail: string;
  labelIds?: string[];
  headers?: Record<string, string | undefined>;
}) {
  if (AUTOMATED_SENDER.test(input.fromEmail)) return "Automated sender address";
  const label = input.labelIds?.find((l) => AUTOMATED_LABELS.includes(l));
  if (label) return `Gmail category ${label.replace("CATEGORY_", "").toLowerCase()}`;
  const h = input.headers ?? {};
  if (h["list-unsubscribe"]) return "Mailing list (List-Unsubscribe)";
  if (/^(bulk|list|junk)$/i.test(h["precedence"] ?? "")) return "Bulk mail (Precedence)";
  if (h["auto-submitted"] && h["auto-submitted"].toLowerCase() !== "no") return "Auto-submitted";
  return undefined;
}
