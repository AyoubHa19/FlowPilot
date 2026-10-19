import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// Upserts by natural key, shared by the seed and (Stage 2) the CSV import,
// so running either one twice never creates duplicates.

type PropertyTable = "buildings" | "units" | "tenants" | "leases" | "tickets";
type Fields<T extends PropertyTable> = Omit<Doc<T>, "_id" | "_creationTime">;

export type Upserted<T extends PropertyTable> = {
  id: Id<T>;
  created: boolean;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** One index read on by_email. Also used by the agent's find_tenant_by_email. */
export async function findTenantByEmail(ctx: QueryCtx, email: string) {
  return await ctx.db
    .query("tenants")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
    .unique();
}

export async function upsertBuilding(
  ctx: MutationCtx,
  fields: Fields<"buildings">,
): Promise<Upserted<"buildings">> {
  const existing = await ctx.db
    .query("buildings")
    .withIndex("by_name", (q) => q.eq("name", fields.name))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return { id: existing._id, created: false };
  }
  return { id: await ctx.db.insert("buildings", fields), created: true };
}

export async function upsertUnit(
  ctx: MutationCtx,
  fields: Fields<"units">,
): Promise<Upserted<"units">> {
  const existing = await ctx.db
    .query("units")
    .withIndex("by_building_label", (q) =>
      q.eq("buildingId", fields.buildingId).eq("label", fields.label),
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return { id: existing._id, created: false };
  }
  return { id: await ctx.db.insert("units", fields), created: true };
}

export async function upsertTenant(
  ctx: MutationCtx,
  fields: Fields<"tenants">,
): Promise<Upserted<"tenants">> {
  const email = normalizeEmail(fields.email);
  const existing = await findTenantByEmail(ctx, email);
  if (existing) {
    await ctx.db.patch(existing._id, { ...fields, email });
    return { id: existing._id, created: false };
  }
  return {
    id: await ctx.db.insert("tenants", { ...fields, email }),
    created: true,
  };
}

export async function upsertLease(
  ctx: MutationCtx,
  fields: Fields<"leases">,
): Promise<Upserted<"leases">> {
  // A tenant has only a handful of leases, so reading them by index is cheap.
  const leases = await ctx.db
    .query("leases")
    .withIndex("by_tenant", (q) => q.eq("tenantId", fields.tenantId))
    .collect();
  const existing = leases.find(
    (l) => l.unitId === fields.unitId && l.startDate === fields.startDate,
  );
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return { id: existing._id, created: false };
  }
  return { id: await ctx.db.insert("leases", fields), created: true };
}

export async function upsertTicket(
  ctx: MutationCtx,
  fields: Fields<"tickets">,
): Promise<Upserted<"tickets">> {
  // A unit has only a handful of tickets, so reading them by index is cheap.
  const tickets = await ctx.db
    .query("tickets")
    .withIndex("by_unit_status", (q) => q.eq("unitId", fields.unitId))
    .collect();
  const existing = tickets.find((t) => t.description === fields.description);
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return { id: existing._id, created: false };
  }
  return { id: await ctx.db.insert("tickets", fields), created: true };
}
