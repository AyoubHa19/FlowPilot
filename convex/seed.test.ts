import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { TICKETS } from "./seedData";
import { modules } from "./test.setup";

async function countRows(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ({
    buildings: (await ctx.db.query("buildings").collect()).length,
    units: (await ctx.db.query("units").collect()).length,
    tenants: (await ctx.db.query("tenants").collect()).length,
    leases: (await ctx.db.query("leases").collect()).length,
    tickets: (await ctx.db.query("tickets").collect()).length,
  }));
}

describe("seed:run", () => {
  test("creates 3 buildings, 60 units, tenants and leases", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.run, {});

    expect(await countRows(t)).toEqual({
      buildings: 3,
      units: 60,
      tenants: 60,
      leases: 60,
      tickets: TICKETS.length,
    });
  });

  test("running twice creates no duplicates", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.seed.run, {});
    const before = await countRows(t);
    const second = await t.mutation(internal.seed.run, {});

    expect(await countRows(t)).toEqual(before);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(first.created);
  });

  test("every tenant has a unique lowercase email and an active lease", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.run, {});

    await t.run(async (ctx) => {
      const tenants = await ctx.db.query("tenants").collect();
      const emails = tenants.map((x) => x.email);
      expect(new Set(emails).size).toBe(tenants.length);
      for (const tenant of tenants) {
        expect(tenant.email).toBe(tenant.email.toLowerCase());
        const leases = await ctx.db
          .query("leases")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
          .collect();
        expect(leases.map((l) => l.status)).toEqual(["active"]);
        expect(leases[0].unitId).toBe(tenant.unitId);
      }
    });
  });
});
