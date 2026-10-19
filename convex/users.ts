import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    return user === null ? null : { _id: user._id, email: user.email ?? null };
  },
});
