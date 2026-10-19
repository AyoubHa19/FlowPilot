import { getAuthUserId } from "@convex-dev/auth/server";
import type { Auth } from "convex/server";
import { ConvexError } from "convex/values";

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
