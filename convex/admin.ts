import { invalidateSessions, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

/**
 * Sets a new password for an account and signs out all of its sessions.
 * CLI only (internal):
 *   npx convex run admin:resetPassword '{"email":"…","password":"…"}'
 * Used to retire a password that leaked (e.g. into git history).
 */
export const resetPassword = internalAction({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    if (password.length < 12) throw new Error("Use at least 12 characters");
    const id = email.trim().toLowerCase();
    const { user } = await retrieveAccount(ctx, { provider: "password", account: { id } });
    await modifyAccountCredentials(ctx, { provider: "password", account: { id, secret: password } });
    await invalidateSessions(ctx, { userId: user._id });
    return { email: id, sessionsInvalidated: true };
  },
});
