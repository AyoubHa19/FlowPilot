import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireOwner, requireUserId } from "./lib/auth";
import { decryptSecret, encryptSecret } from "./lib/crypto";
import {
  authorizationUrl,
  getMessage,
  getProfile,
  GmailAuthError,
  type GmailMessage,
  HistoryExpiredError,
  listInboxAdditions,
  listRecentInbox,
  refreshAccessToken,
  sendRaw,
} from "./model/gmailApi";
import { automatedReason } from "./model/agentRuns";
import { ingestMessage } from "./model/inbox";
import { buildReplyMime, bytesToBase64Url, extractBodyText, header, parseAddress } from "./model/mime";

const STATE_TTL_MS = 10 * 60 * 1000;
const SYNC_LOCK_MS = 50 * 1000;
const MAX_MESSAGES_PER_SYNC = 50;

// --- Connection ------------------------------------------------------------

/** Connection status for the dashboard. Never includes tokens. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    const account = await ctx.db.query("gmailAccounts").first();
    return (
      account && {
        email: account.email,
        status: account.status,
        lastSyncAt: account.lastSyncAt,
        lastError: account.lastError,
      }
    );
  },
});

/** Starts the OAuth flow: stores a one-time state and returns Google's URL. */
export const startConnect = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireOwner(ctx);
    const state = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    await ctx.db.insert("oauthStates", { state, userId, expiresAt: Date.now() + STATE_TTL_MS });
    return authorizationUrl(state);
  },
});

/** One use only; false for an unknown or expired state (CSRF protection). */
export const consumeState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (row === null) return false;
    await ctx.db.delete(row._id);
    return row.expiresAt > Date.now();
  },
});

/** Single inbox for the MVP: connecting an account replaces any other. */
export const saveAccount = internalMutation({
  args: {
    email: v.string(),
    refreshToken: v.string(),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const other of await ctx.db.query("gmailAccounts").collect()) {
      if (other.email !== args.email) await ctx.db.delete(other._id);
    }
    const existing = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    const fields = {
      ...args,
      status: "connected" as const,
      connectedAt: Date.now(),
      lastError: undefined,
      syncLockUntil: undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("gmailAccounts", fields);
    }
  },
});

export const saveAccessToken = internalMutation({
  args: { accountId: v.id("gmailAccounts"), accessToken: v.string(), accessTokenExpiresAt: v.number() },
  handler: async (ctx, { accountId, ...tokens }) => {
    await ctx.db.patch(accountId, tokens);
  },
});

export const markNeedsReconnect = internalMutation({
  args: { accountId: v.id("gmailAccounts"), error: v.string() },
  handler: async (ctx, { accountId, error }) => {
    await ctx.db.patch(accountId, { status: "needs_reconnect", lastError: error, syncLockUntil: undefined });
  },
});

/** A valid access token, refreshing (and storing) a new one when expired. */
async function accessTokenFor(ctx: ActionCtx, account: Doc<"gmailAccounts">) {
  if (account.accessToken && (account.accessTokenExpiresAt ?? 0) > Date.now()) {
    return await decryptSecret(account.accessToken);
  }
  const fresh = await refreshAccessToken(await decryptSecret(account.refreshToken));
  await ctx.runMutation(internal.gmail.saveAccessToken, {
    accountId: account._id,
    accessToken: await encryptSecret(fresh.accessToken),
    accessTokenExpiresAt: fresh.expiresAt,
  });
  return fresh.accessToken;
}

// --- Inbox sync (cron, every minute) ---------------------------------------

/** Takes the sync lock; null when not connected or another sync is running. */
export const claimSync = internalMutation({
  args: {},
  handler: async (ctx) => {
    const account = await ctx.db.query("gmailAccounts").first();
    const now = Date.now();
    if (account === null || account.status !== "connected" || (account.syncLockUntil ?? 0) > now) {
      return null;
    }
    await ctx.db.patch(account._id, { syncLockUntil: now + SYNC_LOCK_MS });
    return account;
  },
});

export const finishSync = internalMutation({
  args: {
    accountId: v.id("gmailAccounts"),
    historyId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { accountId, historyId, error }) => {
    await ctx.db.patch(accountId, {
      syncLockUntil: undefined,
      lastSyncAt: Date.now(),
      lastError: error,
      ...(historyId && { historyId }),
    });
  },
});

export const unknownMessageIds = internalQuery({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    const unknown: string[] = [];
    for (const id of ids) {
      const found = await ctx.db
        .query("emailMessages")
        .withIndex("by_gmail_message", (q) => q.eq("gmailMessageId", id))
        .first();
      if (found === null) unknown.push(id);
    }
    return unknown;
  },
});

export const ingest = internalMutation({
  args: {
    gmailMessageId: v.string(),
    gmailThreadId: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    from: v.string(),
    to: v.string(),
    subject: v.string(),
    bodyText: v.string(),
    rfcMessageId: v.optional(v.string()),
    references: v.optional(v.string()),
    receivedAt: v.number(),
    automatedReason: v.optional(v.string()),
  },
  handler: async (ctx, msg) => (await ingestMessage(ctx, { ...msg, simulated: false })).created,
});

function toIncoming(message: GmailMessage, accountEmail: string) {
  const headers = message.payload.headers;
  const from = header(headers, "From") ?? "";
  const fromEmail = parseAddress(from).email;
  const sentByUs = fromEmail === accountEmail || (message.labelIds ?? []).includes("SENT");
  return {
    automatedReason: automatedReason({
      fromEmail,
      labelIds: message.labelIds,
      headers: {
        "list-unsubscribe": header(headers, "List-Unsubscribe"),
        precedence: header(headers, "Precedence"),
        "auto-submitted": header(headers, "Auto-Submitted"),
      },
    }),
    gmailMessageId: message.id,
    gmailThreadId: message.threadId,
    direction: sentByUs ? ("outbound" as const) : ("inbound" as const),
    from,
    to: header(headers, "To") ?? "",
    subject: header(headers, "Subject") ?? "",
    // Capped: a 1 MB newsletter must not break the document limit.
    bodyText: extractBodyText(message.payload).slice(0, 100_000),
    rfcMessageId: header(headers, "Message-ID") ?? header(headers, "Message-Id"),
    references: header(headers, "References"),
    receivedAt: Number(message.internalDate),
  };
}

/**
 * Pulls new inbox messages. Uses Gmail's history cursor, so each run asks
 * only for what changed; dedupe by gmailMessageId makes overlaps harmless.
 */
export const sync = internalAction({
  args: {},
  handler: async (ctx): Promise<{ fetched: number } | null> => {
    const account = await ctx.runMutation(internal.gmail.claimSync, {});
    if (account === null) return null;
    try {
      const accessToken = await accessTokenFor(ctx, account);
      let ids: string[];
      let historyId: string;
      try {
        if (!account.historyId) throw new HistoryExpiredError("No cursor yet");
        ({ ids, historyId } = await listInboxAdditions(accessToken, account.historyId));
      } catch (error) {
        if (!(error instanceof HistoryExpiredError)) throw error;
        // Bootstrap: fresh cursor first, then the last two days of inbox.
        historyId = (await getProfile(accessToken)).historyId;
        ids = await listRecentInbox(accessToken);
      }

      const unknown = await ctx.runQuery(internal.gmail.unknownMessageIds, {
        ids: ids.slice(0, MAX_MESSAGES_PER_SYNC),
      });
      for (const id of unknown) {
        const message = await getMessage(accessToken, id);
        await ctx.runMutation(internal.gmail.ingest, toIncoming(message, account.email));
      }
      // If we capped the batch, keep the old cursor so the rest comes next run.
      const capped = ids.length > MAX_MESSAGES_PER_SYNC;
      await ctx.runMutation(internal.gmail.finishSync, {
        accountId: account._id,
        historyId: capped ? undefined : historyId,
      });
      return { fetched: unknown.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof GmailAuthError) {
        await ctx.runMutation(internal.gmail.markNeedsReconnect, { accountId: account._id, error: message });
      } else {
        await ctx.runMutation(internal.gmail.finishSync, { accountId: account._id, error: message });
      }
      return null;
    }
  },
});

export const syncNow = action({
  args: {},
  handler: async (ctx): Promise<{ fetched: number } | null> => {
    await requireUserId(ctx);
    return await ctx.runAction(internal.gmail.sync, {});
  },
});

// --- Sending ---------------------------------------------------------------

export const sendContext = internalQuery({
  args: { messageId: v.id("emailMessages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    const thread = message && (await ctx.db.get(message.threadId));
    if (!message || !thread) return null;
    // The newest inbound message is the one we answer.
    const inbound = await ctx.db
      .query("emailMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .order("desc")
      .filter((q) => q.eq(q.field("direction"), "inbound"))
      .first();
    const account = await ctx.db.query("gmailAccounts").first();
    return { message, thread, inbound, account };
  },
});

export const markSent = internalMutation({
  args: { messageId: v.id("emailMessages"), gmailMessageId: v.string(), from: v.string() },
  handler: async (ctx, { messageId, gmailMessageId, from }) => {
    await ctx.db.patch(messageId, {
      sendStatus: "sent",
      gmailMessageId,
      from,
      fromEmail: parseAddress(from).email,
      sendError: undefined,
    });
  },
});

export const markFailed = internalMutation({
  args: { messageId: v.id("emailMessages"), error: v.string() },
  handler: async (ctx, { messageId, error }) => {
    await ctx.db.patch(messageId, { sendStatus: "failed", sendError: error });
  },
});

export type Delivery = { ok: true; gmailMessageId: string } | { ok: false; error: string };

/**
 * Sends a queued outbound message as a reply in the same Gmail thread (or
 * marks it sent for a simulated thread). Used by manual replies and by
 * approved agent replies. Never retried automatically: a retry after Gmail
 * accepted the message would send it twice. A failure is recorded on the
 * message instead.
 */
export async function deliverMessage(
  ctx: ActionCtx,
  messageId: Id<"emailMessages">,
): Promise<Delivery | null> {
  const context = await ctx.runQuery(internal.gmail.sendContext, { messageId });
  if (context === null || context.message.sendStatus !== "sending") return null;
  const { message, thread, inbound, account } = context;

  if (thread.simulated) {
    const gmailMessageId = `sim-${messageId}`;
    await ctx.runMutation(internal.gmail.markSent, { messageId, gmailMessageId, from: message.from });
    return { ok: true, gmailMessageId };
  }
  try {
    if (account === null || account.status !== "connected") {
      throw new Error("Gmail is not connected");
    }
    const accessToken = await accessTokenFor(ctx, account);
    const to = thread.counterpartName
      ? `${thread.counterpartName} <${thread.counterpartEmail}>`
      : thread.counterpartEmail;
    const mime = buildReplyMime({
      from: account.email,
      to,
      subject: message.subject,
      body: message.bodyText,
      inReplyTo: inbound?.rfcMessageId,
      references: inbound?.references,
    });
    const sent = await sendRaw(
      accessToken,
      bytesToBase64Url(new TextEncoder().encode(mime)),
      thread.gmailThreadId,
    );
    await ctx.runMutation(internal.gmail.markSent, { messageId, gmailMessageId: sent.id, from: account.email });
    return { ok: true, gmailMessageId: sent.id };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (error instanceof GmailAuthError && account) {
      await ctx.runMutation(internal.gmail.markNeedsReconnect, { accountId: account._id, error: reason });
    }
    await ctx.runMutation(internal.gmail.markFailed, { messageId, error: reason });
    return { ok: false, error: reason };
  }
}

export const sendReply = internalAction({
  args: { messageId: v.id("emailMessages") },
  handler: async (ctx, { messageId }) => {
    await deliverMessage(ctx, messageId);
  },
});
