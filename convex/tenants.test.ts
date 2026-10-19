import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { tenantFor } from "./seedData";
import { modules } from "./test.setup";

let t: ReturnType<typeof convexTest>;
let asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

beforeEach(async () => {
  t = convexTest(schema, modules);
  await t.mutation(internal.seed.run, {});
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  // Convex Auth encodes the subject as "<userId>|<sessionId>".
  asUser = t.withIdentity({ subject: `${userId}|test-session` });
});

describe("auth", () => {
  test("queries reject signed-out callers", async () => {
    await expect(
      t.query(api.tenants.findByEmail, { email: "x@example.com" }),
    ).rejects.toThrow(/Not authenticated/);
    await expect(
      t.query(api.buildings.list, {
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow(/Not authenticated/);
  });
});

describe("tenants.findByEmail", () => {
  test("finds a seeded tenant, ignoring case and whitespace", async () => {
    const seeded = tenantFor(1, 4);
    const found = await asUser.query(api.tenants.findByEmail, {
      email: `  ${seeded.email.toUpperCase()} `,
    });
    expect(found?.name).toBe(seeded.name);
    expect(found?.email).toBe(seeded.email);
  });

  test("returns null for an unknown sender", async () => {
    expect(
      await asUser.query(api.tenants.findByEmail, {
        email: "stranger@example.org",
      }),
    ).toBeNull();
  });
});

describe("tenants.get", () => {
  test("returns unit, building, active lease and tickets", async () => {
    // Building 0, unit 5 has two seeded tickets (one open, one closed).
    const seeded = tenantFor(0, 5);
    const found = await asUser.query(api.tenants.findByEmail, {
      email: seeded.email,
    });
    const detail = await asUser.query(api.tenants.get, {
      tenantId: found!._id,
    });

    expect(detail?.building?.name).toBe("Lindenhof");
    expect(detail?.unit?.label).toBe("1.02");
    expect(detail?.activeLease?.startDate).toBe(seeded.startDate);
    expect(detail?.tickets.map((x) => x.status)).toEqual(["open", "closed"]);
  });

  test("returns null for a malformed id", async () => {
    expect(
      await asUser.query(api.tenants.get, { tenantId: "not-an-id" }),
    ).toBeNull();
  });
});

describe("buildings", () => {
  test("list is ordered by name and units come with tenants", async () => {
    const { page } = await asUser.query(api.buildings.list, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.map((b) => b.name)).toEqual(["Elbblick", "Isarpark", "Lindenhof"]);

    const units = await asUser.query(api.buildings.units, {
      buildingId: page[0]._id,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(units.page).toHaveLength(20);
    expect(units.page[0].label).toBe("0.01");
    expect(units.page.every((u) => u.tenant !== null)).toBe(true);
  });
});
