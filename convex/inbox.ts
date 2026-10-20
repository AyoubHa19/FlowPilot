import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireOwner, requireUserId } from "./lib/auth";
import { ingestMessage, queueOutbound, SIMULATED_INBOX } from "./model/inbox";
import { replySubject } from "./model/mime";
import { normalizeEmail } from "./model/properties";

const MAX_BODY_CHARS = 10_000;

/** Newest conversation first, with the tenant's name when known. */
export const listThreads = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireUserId(ctx);
    const result = await ctx.db
      .query("emailThreads")
      // eval === undefined: real and simulated mail, never the eval set.
      .withIndex("by_eval_last_message", (q) => q.eq("eval", undefined))
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (thread) => {
        const tenant = thread.tenantId ? await ctx.db.get(thread.tenantId) : null;
        return { ...thread, tenant: tenant && { _id: tenant._id, name: tenant.name } };
      }),
    );
    return { ...result, page };
  },
});

/** One conversation, oldest message first. Bodies are plain text only. */
export const getThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const id = ctx.db.normalizeId("emailThreads", args.threadId);
    const thread = id && (await ctx.db.get(id));
    if (!thread) return null;
    const messages = await ctx.db
      .query("emailMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .take(200);
    const tenant = thread.tenantId ? await ctx.db.get(thread.tenantId) : null;
    return { thread, messages, tenant: tenant && { _id: tenant._id, name: tenant.name } };
  },
});

/**
 * Demo fallback: an inbound email that never touched Gmail. It goes through
 * the same ingest path (dedupe, threading, tenant linking, agent run) as a
 * real one. `forceToolFailure` makes the lease search fail once, to show the
 * workflow retrying a step.
 */
export const simulateEmail = mutation({
  args: {
    fromEmail: v.string(),
    fromName: v.optional(v.string()),
    subject: v.string(),
    body: v.string(),
    forceToolFailure: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const email = normalizeEmail(args.fromEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError("Enter a valid sender email");
    }
    const subject = args.subject.trim();
    const body = args.body.trim();
    if (subject === "" || body === "" || body.length > MAX_BODY_CHARS) {
      throw new ConvexError(`Subject and a body of up to ${MAX_BODY_CHARS} characters are required`);
    }
    const id = crypto.randomUUID();
    const name = args.fromName?.trim();
    const { threadId } = await ingestMessage(ctx, {
      gmailMessageId: `sim-${id}`,
      gmailThreadId: `sim-thread-${id}`,
      direction: "inbound",
      from: name ? `${name} <${email}>` : email,
      to: SIMULATED_INBOX,
      subject,
      bodyText: body,
      rfcMessageId: `<sim-${id}@flowpilot.demo>`,
      receivedAt: Date.now(),
      simulated: true,
      failToolOnce: args.forceToolFailure ? "search_lease_documents" : undefined,
    });
    return threadId;
  },
});

/**
 * Queues a reply written by the manager and sends it in the background.
 * The row exists (status "sending") before Gmail is called, so the UI shows
 * it at once and a failure is recorded on it.
 */
export const queueReply = mutation({
  args: { threadId: v.id("emailThreads"), body: v.string() },
  handler: async (ctx, { threadId, body }) => {
    await requireUserId(ctx);
    const text = body.trim();
    if (text === "" || text.length > MAX_BODY_CHARS) {
      throw new ConvexError(`Write a reply of 1 to ${MAX_BODY_CHARS} characters`);
    }
    const thread = await ctx.db.get(threadId);
    if (thread === null) throw new ConvexError("Conversation not found");
    // Replying to real email is owner-only; the demo account uses simulated mail.
    if (!thread.simulated) await requireOwner(ctx);
    const messageId = await queueOutbound(ctx, thread, { subject: replySubject(thread.subject), body: text });
    await ctx.scheduler.runAfter(0, internal.gmail.sendReply, { messageId });
    return messageId;
  },
});
