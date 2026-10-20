import { getAuthUserId } from "@convex-dev/auth/server";
import type { Auth } from "convex/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";

/**
 * Every public query, mutation and action calls this first: the dashboard
 * is closed to anyone who is not logged in.
 */
export async function requireUserId(ctx: { auth: Auth }) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Not authenticated");
  }
  return userId;
}

/** A comma-separated email list from the environment, or null when unset. */
export function emailList(name: string): string[] | null {
  const raw = process.env[name];
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type Role = "owner" | "demo";

/**
 * Owners (OWNER_EMAILS) can do everything. Any other account is a demo
 * account: it sees everything and can try the agent on simulated email, but
 * cannot send real email, connect Gmail or upload files. Without
 * OWNER_EMAILS (local development) every account is an owner.
 */
export async function roleOf(ctx: QueryCtx, userId: Awaited<ReturnType<typeof requireUserId>>): Promise<Role> {
  const owners = emailList("OWNER_EMAILS");
  if (owners === null) return "owner";
  const user = await ctx.db.get(userId);
  return user?.email && owners.includes(user.email.toLowerCase()) ? "owner" : "demo";
}

export async function requireOwner(ctx: QueryCtx) {
  const userId = await requireUserId(ctx);
  if ((await roleOf(ctx, userId)) !== "owner") {
    throw new ConvexError("The demo account can't do this. It can only act on simulated emails.");
  }
  return userId;
}
