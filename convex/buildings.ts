import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireUserId(ctx);
    return await ctx.db
      .query("buildings")
      .withIndex("by_name")
      .paginate(paginationOpts);
  },
});

/** Returns null for a malformed or unknown id, so the page can show "not found". */
export const get = query({
  args: { buildingId: v.string() },
  handler: async (ctx, { buildingId }) => {
    await requireUserId(ctx);
    const id = ctx.db.normalizeId("buildings", buildingId);
    return id === null ? null : await ctx.db.get(id);
  },
});

/** Units of a building ordered by label, each with its current tenant. */
export const units = query({
  args: { buildingId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { buildingId, paginationOpts }) => {
    await requireUserId(ctx);
    const id = ctx.db.normalizeId("buildings", buildingId);
    if (id === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("units")
      .withIndex("by_building_label", (q) => q.eq("buildingId", id))
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (unit) => {
        const tenant = await ctx.db
          .query("tenants")
          .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
          .first();
        return {
          ...unit,
          tenant: tenant && { _id: tenant._id, name: tenant.name },
        };
      }),
    );
    return { ...result, page };
  },
});
