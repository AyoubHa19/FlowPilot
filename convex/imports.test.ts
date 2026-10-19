import workpool from "@convex-dev/workpool/test";
import { convexTest } from "convex-test";
import Papa from "papaparse";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { IMPORT_COLUMNS } from "./model/importRows";
import schema from "./schema";
import { modules } from "./test.setup";

type Row = Record<(typeof IMPORT_COLUMNS)[number], string>;

function makeRow(i: number, overrides: Partial<Row> = {}): Row {
  return {
    building_name: `Testhaus ${Math.floor(i / 10)}`,
    building_address: `Teststraße ${Math.floor(i / 10)}, 10115 Berlin`,
    building_city: "Berlin",
    unit_label: `U${i % 10}`,
    unit_floor: String(i % 10),
    unit_size_sqm: "60",
    unit_rent_eur: "900",
    tenant_name: `Tenant ${i}`,
    tenant_email: `tenant${i}@example.net`,
    tenant_phone: "",
    lease_start: "2022-01-01",
    lease_end: "",
    notice_period_days: "",
    ...overrides,
  };
}

function toCsv(rows: Row[]) {
  return Papa.unparse(rows, { columns: [...IMPORT_COLUMNS] });
}

function setup() {
  const t = convexTest(schema, modules);
  workpool.register(t, "importPool");
  return t;
}

async function createProcessingJob(t: ReturnType<typeof setup>, total: number) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["unused"]));
    return await ctx.db.insert("importJobs", {
      kind: "properties",
      status: "processing",
      storageId,
      filename: "test.csv",
      total,
      processed: 0,
      failed: 0,
      created: 0,
    });
  });
}

async function counts(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => ({
    buildings: (await ctx.db.query("buildings").collect()).length,
    units: (await ctx.db.query("units").collect()).length,
    tenants: (await ctx.db.query("tenants").collect()).length,
    leases: (await ctx.db.query("leases").collect()).length,
  }));
}

async function getJob(t: ReturnType<typeof setup>, jobId: Id<"importJobs">) {
  return await t.run(async (ctx) => (await ctx.db.get(jobId))!);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("imports.processBatch", () => {
  test("imports good rows and records bad ones without stopping", async () => {
    const t = setup();
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow(i, i === 7 ? { tenant_email: "broken-email" } : {}),
    );
    const jobId = await createProcessingJob(t, rows.length);

    await t.mutation(internal.imports.processBatch, { jobId, firstRow: 2, rows });

    const job = await getJob(t, jobId);
    expect(job).toMatchObject({ processed: 19, failed: 1, created: 19, status: "completed" });
    expect(await counts(t)).toEqual({ buildings: 2, units: 19, tenants: 19, leases: 19 });

    const errors = await t.run((ctx) =>
      ctx.db
        .query("importRowErrors")
        .withIndex("by_job_row", (q) => q.eq("jobId", jobId))
        .collect(),
    );
    // Row index 7 is CSV line 9 (header is line 1, first data row is line 2).
    expect(errors.map((e) => [e.row, e.message])).toEqual([
      [9, "tenant_email is not a valid email"],
    ]);
    expect(JSON.parse(errors[0].data).tenant_email).toBe("broken-email");
  });

  test("re-importing the same rows adds nothing", async () => {
    const t = setup();
    const rows = Array.from({ length: 30 }, (_, i) => makeRow(i));

    const first = await createProcessingJob(t, rows.length);
    await t.mutation(internal.imports.processBatch, { jobId: first, firstRow: 2, rows });
    const before = await counts(t);

    const second = await createProcessingJob(t, rows.length);
    await t.mutation(internal.imports.processBatch, { jobId: second, firstRow: 2, rows });

    expect(await counts(t)).toEqual(before);
    expect(await getJob(t, second)).toMatchObject({ processed: 30, failed: 0, created: 0 });
  });

  test("updates an existing tenant instead of duplicating it", async () => {
    const t = setup();
    const jobA = await createProcessingJob(t, 1);
    await t.mutation(internal.imports.processBatch, {
      jobId: jobA,
      firstRow: 2,
      rows: [makeRow(1)],
    });
    const jobB = await createProcessingJob(t, 1);
    await t.mutation(internal.imports.processBatch, {
      jobId: jobB,
      firstRow: 2,
      rows: [makeRow(1, { tenant_name: "Renamed Tenant", tenant_email: "TENANT1@example.net" })],
    });

    const tenants = await t.run((ctx) => ctx.db.query("tenants").collect());
    expect(tenants.map((x) => x.name)).toEqual(["Renamed Tenant"]);
  });
});

describe("full pipeline", () => {
  test("upload → parse → Workpool batches → completed job", async () => {
    vi.useFakeTimers();
    const t = setup();
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    const asUser = t.withIdentity({ subject: `${userId}|test-session` });

    // 250 rows = 3 batches; one broken email.
    const rows = Array.from({ length: 250 }, (_, i) =>
      makeRow(i, i === 120 ? { tenant_email: "nope" } : {}),
    );
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([toCsv(rows)], { type: "text/csv" })),
    );

    const jobId = await asUser.mutation(api.imports.start, {
      storageId,
      filename: "tenants.csv",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await getJob(t, jobId)).toMatchObject({
      status: "completed",
      total: 250,
      processed: 249,
      failed: 1,
    });
    expect((await counts(t)).tenants).toBe(249);
  });

  test("a CSV without the required columns fails the job", async () => {
    vi.useFakeTimers();
    const t = setup();
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));
    const asUser = t.withIdentity({ subject: `${userId}|test-session` });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["name,email\nA,a@example.com"])),
    );

    const jobId = await asUser.mutation(api.imports.start, {
      storageId,
      filename: "wrong.csv",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const job = await getJob(t, jobId);
    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/^Missing columns: building_name/);
  });

  test("rejects signed-out callers", async () => {
    const t = setup();
    await expect(t.mutation(api.imports.generateUploadUrl, {})).rejects.toThrow(
      /Not authenticated/,
    );
  });
});
