import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { startAgentRun } from "./agentRuns";
import { parseAddress, snippetOf } from "./mime";
import { findTenantByEmail } from "./properties";

export type IncomingMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  rfcMessageId?: string;
  references?: string;
  receivedAt: number;
  simulated: boolean;
  /** Set for newsletters and notifications: the agent skips them. */
  automatedReason?: string;
  /** Dev-only fault injection, passed to the agent run. */
  failToolOnce?: string;
};

/**
 * Stores one email exactly once (deduped by gmailMessageId), groups it into
 * its thread by gmailThreadId, and links the thread to a tenant when the
 * other party's email belongs to one.
 */
export async function ingestMessage(
  ctx: MutationCtx,
  msg: IncomingMessage,
): Promise<{ messageId: Id<"emailMessages">; threadId: Id<"emailThreads">; created: boolean }> {
  const existing = await ctx.db
    .query("emailMessages")
    .withIndex("by_gmail_message", (q) => q.eq("gmailMessageId", msg.gmailMessageId))
    .unique();
  if (existing) {
    return { messageId: existing._id, threadId: existing.threadId, created: false };
  }

  const from = parseAddress(msg.from);
  const counterpart = msg.direction === "inbound" ? from : parseAddress(msg.to);
  const tenant = await findTenantByEmail(ctx, counterpart.email);
  const snippet = snippetOf(msg.bodyText);

  let thread = await ctx.db
    .query("emailThreads")
    .withIndex("by_gmail_thread", (q) => q.eq("gmailThreadId", msg.gmailThreadId))
    .unique();
  if (thread === null) {
    const threadId = await ctx.db.insert("emailThreads", {
      subject: msg.subject || "(no subject)",
      gmailThreadId: msg.gmailThreadId,
      status: msg.direction === "inbound" ? "open" : "replied",
      lastMessageAt: msg.receivedAt,
      tenantId: tenant?._id,
      counterpartEmail: counterpart.email,
      counterpartName: counterpart.name,
      snippet,
      simulated: msg.simulated,
    });
    thread = (await ctx.db.get(threadId))!;
  } else if (msg.receivedAt >= thread.lastMessageAt) {
    await ctx.db.patch(thread._id, {
      lastMessageAt: msg.receivedAt,
      snippet,
      status: msg.direction === "inbound" ? "open" : "replied",
      ...(thread.tenantId === undefined && tenant && { tenantId: tenant._id }),
    });
  }

  const messageId = await ctx.db.insert("emailMessages", {
    threadId: thread._id,
    direction: msg.direction,
    from: msg.from,
    fromEmail: from.email,
    to: msg.to,
    subject: msg.subject,
    bodyText: msg.bodyText,
    gmailMessageId: msg.gmailMessageId,
    rfcMessageId: msg.rfcMessageId,
    references: msg.references,
    receivedAt: msg.receivedAt,
  });

  // PRD: a new inbound message starts a durable agent run.
  if (msg.direction === "inbound") {
    await startAgentRun(ctx, {
      messageId,
      threadId: thread._id,
      tenantId: tenant?._id,
      skipReason: msg.automatedReason,
      failToolOnce: msg.failToolOnce,
    });
  }
  return { messageId, threadId: thread._id, created: true };
}
