import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { findTenantByEmail } from "./model/properties";

const TICKET_STATUS_ORDER = { open: 0, in_progress: 1, closed: 2 } as const;

/** Tenant detail: contact, unit, building, active lease and the unit's tickets. */
export const get = query({
  args: { tenantId: v.string() },
  handler: async (ctx, { tenantId }) => {
    await requireUserId(ctx);
    const id = ctx.db.normalizeId("tenants", tenantId);
    const tenant = id === null ? null : await ctx.db.get(id);
    if (tenant === null) {
      return null;
    }

    const unit = tenant.unitId ? await ctx.db.get(tenant.unitId) : null;
    const building = unit ? await ctx.db.get(unit.buildingId) : null;

    const leases = await ctx.db
      .query("leases")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .collect();
    const activeLease = leases.find((l) => l.status === "active") ?? null;

    const tickets = unit
      ? await ctx.db
          .query("tickets")
          .withIndex("by_unit_status", (q) => q.eq("unitId", unit._id))
          .collect()
      : [];
    tickets.sort(
      (a, b) =>
        TICKET_STATUS_ORDER[a.status] - TICKET_STATUS_ORDER[b.status] ||
        b._creationTime - a._creationTime,
    );

    return { tenant, unit, building, activeLease, tickets };
  },
});

export const findByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await requireUserId(ctx);
    const tenant = await findTenantByEmail(ctx, email);
    return tenant && { _id: tenant._id, name: tenant.name, email: tenant.email };
  },
});
