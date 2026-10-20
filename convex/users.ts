import { query } from "./_generated/server";
import { requireUserId, roleOf } from "./lib/auth";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (user === null) return null;
    return { _id: user._id, email: user.email ?? null, role: await roleOf(ctx, userId) };
  },
});
