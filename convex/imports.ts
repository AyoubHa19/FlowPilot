import { vOnCompleteArgs, Workpool } from "@convex-dev/workpool";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import Papa from "papaparse";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireUserId } from "./lib/auth";
import {
  DEFAULT_NOTICE_PERIOD_DAYS,
  IMPORT_COLUMNS,
  leaseStatusOn,
  missingColumns,
  parseImportRow,
} from "./model/importRows";
import {
  upsertBuilding,
  upsertLease,
  upsertTenant,
  upsertUnit,
} from "./model/properties";

export const BATCH_SIZE = 100;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Batches handed to the pool per mutation call while enqueueing.
const ENQUEUE_CHUNK = 20;

const importPool = new Workpool(components.importPool, { maxParallelism: 4 });

const rowValidator = v.record(v.string(), v.string());

// --- Public API ------------------------------------------------------------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Creates the job for an uploaded CSV and starts parsing it in the background. */
export const start = mutation({
  args: { storageId: v.id("_storage"), filename: v.string() },
  handler: async (ctx, { storageId, filename }) => {
    await requireUserId(ctx);
    const file = await ctx.db.system.get(storageId);
    if (file === null) {
      throw new ConvexError("Upload not found");
    }
    if (!filename.toLowerCase().endsWith(".csv")) {
      await ctx.storage.delete(storageId);
      throw new ConvexError("Only .csv files can be imported");
    }
    if (file.size > MAX_FILE_BYTES) {
      await ctx.storage.delete(storageId);
      throw new ConvexError("File is larger than 20 MB");
    }

    const jobId = await ctx.db.insert("importJobs", {
      kind: "properties",
      status: "queued",
      storageId,
      filename,
      total: 0,
      processed: 0,
      failed: 0,
      created: 0,
    });
    await ctx.scheduler.runAfter(0, internal.imports.parse, { jobId });
    return jobId;
  },
});

/** Newest first. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireUserId(ctx);
    return await ctx.db.query("importJobs").order("desc").paginate(paginationOpts);
  },
});

export const listErrors = query({
  args: { jobId: v.id("importJobs"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { jobId, paginationOpts }) => {
    await requireUserId(ctx);
    return await ctx.db
      .query("importRowErrors")
      .withIndex("by_job_row", (q) => q.eq("jobId", jobId))
      .paginate(paginationOpts);
  },
});

// --- Background pipeline ---------------------------------------------------

export const getJob = internalQuery({
  args: { jobId: v.id("importJobs") },
  handler: async (ctx, { jobId }) => await ctx.db.get(jobId),
});

/** Moves queued → parsing exactly once, so a re-run parse is a no-op. */
export const claimForParsing = internalMutation({
  args: { jobId: v.id("importJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (job === null || job.status !== "queued") {
      return null;
    }
    await ctx.db.patch(jobId, { status: "parsing" });
    return job.storageId;
  },
});

export const setTotal = internalMutation({
  args: { jobId: v.id("importJobs"), total: v.number() },
  handler: async (ctx, { jobId, total }) => {
    await ctx.db.patch(jobId, {
      total,
      status: total === 0 ? "completed" : "processing",
      ...(total === 0 && { finishedAt: Date.now() }),
    });
  },
});

export const failJob = internalMutation({
  args: { jobId: v.id("importJobs"), error: v.string() },
  handler: async (ctx, { jobId, error }) => {
    await ctx.db.patch(jobId, { status: "failed", error, finishedAt: Date.now() });
  },
});

export const enqueueBatches = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    batches: v.array(v.object({ firstRow: v.number(), rows: v.array(rowValidator) })),
  },
  handler: async (ctx, { jobId, batches }) => {
    for (const batch of batches) {
      await importPool.enqueueMutation(
        ctx,
        internal.imports.processBatch,
        { jobId, ...batch },
        {
          onComplete: internal.imports.batchFailed,
          onCompleteExcludeKinds: ["success"],
          context: { jobId, firstRow: batch.firstRow, count: batch.rows.length },
        },
      );
    }
  },
});

/** Reads the CSV, checks the header, and queues batches of BATCH_SIZE rows. */
export const parse = internalAction({
  args: { jobId: v.id("importJobs") },
  handler: async (ctx, { jobId }) => {
    const storageId = await ctx.runMutation(internal.imports.claimForParsing, { jobId });
    if (storageId === null) {
      return;
    }
    try {
      const blob = await ctx.storage.get(storageId);
      if (blob === null) {
        throw new Error("The uploaded file is gone");
      }
      const { data, meta } = Papa.parse<Record<string, string>>(await blob.text(), {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim().toLowerCase(),
      });
      const missing = missingColumns(meta.fields ?? []);
      if (missing.length > 0) {
        throw new Error(`Missing columns: ${missing.join(", ")}`);
      }

      // Keep only known columns as strings; the header is CSV line 1.
      const rows = data.map((raw) =>
        Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, String(raw[c] ?? "")])),
      );
      await ctx.runMutation(internal.imports.setTotal, { jobId, total: rows.length });

      const batches = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        batches.push({ firstRow: i + 2, rows: rows.slice(i, i + BATCH_SIZE) });
      }
      for (let i = 0; i < batches.length; i += ENQUEUE_CHUNK) {
        await ctx.runMutation(internal.imports.enqueueBatches, {
          jobId,
          batches: batches.slice(i, i + ENQUEUE_CHUNK),
        });
      }
    } catch (error) {
      await ctx.runMutation(internal.imports.failJob, {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

/**
 * Validates and upserts one batch. A bad row is recorded and skipped; it
 * never stops the rest of the batch or the job.
 */
export const processBatch = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    firstRow: v.number(),
    rows: v.array(rowValidator),
  },
  handler: async (ctx, { jobId, firstRow, rows }) => {
    const job = await ctx.db.get(jobId);
    if (job === null || job.status !== "processing") {
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    let processed = 0;
    let failed = 0;
    let created = 0;

    for (const [i, raw] of rows.entries()) {
      const rowNumber = firstRow + i;
      const parsed = parseImportRow(raw);
      if (!parsed.ok) {
        failed += 1;
        await recordRowError(ctx, jobId, rowNumber, parsed.message, raw);
        continue;
      }
      try {
        const r = parsed.row;
        const building = await upsertBuilding(ctx, {
          name: r.building_name,
          address: r.building_address,
          city: r.building_city,
        });
        const unit = await upsertUnit(ctx, {
          buildingId: building.id,
          label: r.unit_label,
          floor: r.unit_floor,
          sizeSqm: r.unit_size_sqm,
          rentCents: Math.round(r.unit_rent_eur * 100),
        });
        const tenant = await upsertTenant(ctx, {
          name: r.tenant_name,
          email: r.tenant_email,
          phone: r.tenant_phone,
          unitId: unit.id,
        });
        const lease = r.lease_start
          ? await upsertLease(ctx, {
              tenantId: tenant.id,
              unitId: unit.id,
              startDate: r.lease_start,
              endDate: r.lease_end,
              rentCents: Math.round(r.unit_rent_eur * 100),
              noticePeriodDays: r.notice_period_days ?? DEFAULT_NOTICE_PERIOD_DAYS,
              status: leaseStatusOn(today, r.lease_start, r.lease_end),
            })
          : null;
        processed += 1;
        if (building.created || unit.created || tenant.created || lease?.created) {
          created += 1;
        }
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        await recordRowError(ctx, jobId, rowNumber, message, raw);
      }
    }

    await addToCounters(ctx, jobId, { processed, failed, created });
  },
});

/** Runs only if a whole batch failed or was canceled: count its rows as failed. */
export const batchFailed = internalMutation({
  args: vOnCompleteArgs(
    v.object({ jobId: v.id("importJobs"), firstRow: v.number(), count: v.number() }),
  ),
  handler: async (ctx, { context, result }) => {
    const reason = result.kind === "failed" ? result.error : "batch was canceled";
    await recordRowError(
      ctx,
      context.jobId,
      context.firstRow,
      `Rows ${context.firstRow}–${context.firstRow + context.count - 1} not imported: ${reason}`,
      {},
    );
    await addToCounters(ctx, context.jobId, {
      processed: 0,
      failed: context.count,
      created: 0,
    });
  },
});

async function recordRowError(
  ctx: MutationCtx,
  jobId: Id<"importJobs">,
  row: number,
  message: string,
  data: Record<string, string>,
) {
  await ctx.db.insert("importRowErrors", {
    jobId,
    row,
    message,
    data: JSON.stringify(data),
  });
}

async function addToCounters(
  ctx: MutationCtx,
  jobId: Id<"importJobs">,
  delta: { processed: number; failed: number; created: number },
) {
  const job = await ctx.db.get(jobId);
  if (job === null) {
    return;
  }
  const processed = job.processed + delta.processed;
  const failed = job.failed + delta.failed;
  const done = processed + failed >= job.total;
  await ctx.db.patch(jobId, {
    processed,
    failed,
    created: job.created + delta.created,
    ...(done && { status: "completed" as const, finishedAt: Date.now() }),
  });
}
