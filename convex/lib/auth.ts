import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";

/**
 * Every public query and mutation calls this first: the dashboard is
 * closed to anyone who is not logged in.
 */
export async function requireUserId(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Not authenticated");
  }
  return userId;
}
