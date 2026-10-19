import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  importJobStatus,
  leaseStatus,
  ticketCategory,
  ticketPriority,
  ticketStatus,
} from "./lib/validators";

export default defineSchema({
  ...authTables,

  // --- Property data -------------------------------------------------------

  // Natural key: name.
  buildings: defineTable({
    name: v.string(),
    address: v.string(),
    city: v.string(),
  }).index("by_name", ["name"]),

  // Natural key: buildingId + label. by_building_label also serves
  // "all units of a building" (prefix match), so there is no by_building.
  units: defineTable({
    buildingId: v.id("buildings"),
    label: v.string(),
    floor: v.number(),
    sizeSqm: v.number(),
    rentCents: v.number(),
  }).index("by_building_label", ["buildingId", "label"]),

  // Natural key: email, always stored lowercase.
  tenants: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    unitId: v.optional(v.id("units")),
  })
    .index("by_email", ["email"])
    .index("by_unit", ["unitId"]),

  // Natural key: tenantId + unitId + startDate. Dates are ISO "YYYY-MM-DD".
  leases: defineTable({
    tenantId: v.id("tenants"),
    unitId: v.id("units"),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    rentCents: v.number(),
    noticePeriodDays: v.number(),
    status: leaseStatus,
  })
    .index("by_tenant", ["tenantId"])
    .index("by_unit_status", ["unitId", "status"]),

  // by_unit_status also serves "all tickets of a unit" (prefix match).
  tickets: defineTable({
    unitId: v.id("units"),
    tenantId: v.optional(v.id("tenants")),
    category: ticketCategory,
    priority: ticketPriority,
    description: v.string(),
    status: ticketStatus,
  })
    .index("by_status", ["status"])
    .index("by_unit_status", ["unitId", "status"]),

  // --- Background jobs -----------------------------------------------------

  // Running counters, so the progress bar reads one row, not thousands.
  // total is known once the CSV is parsed; the job is done when
  // processed + failed === total.
  importJobs: defineTable({
    kind: v.literal("properties"),
    status: importJobStatus,
    storageId: v.id("_storage"),
    filename: v.string(),
    total: v.number(),
    processed: v.number(),
    failed: v.number(),
    // Rows that created at least one new record; 0 on a re-import.
    created: v.number(),
    // Job-level failure (unreadable file, missing columns).
    error: v.optional(v.string()),
    finishedAt: v.optional(v.number()),
  }).index("by_status", ["status"]),

  // One row per rejected CSV line. Kept out of importJobs so a file with
  // thousands of bad rows cannot hit the 1 MB document limit.
  importRowErrors: defineTable({
    jobId: v.id("importJobs"),
    row: v.number(), // line number in the CSV, header is line 1
    message: v.string(),
    data: v.string(), // the raw row as JSON, for the error report
  }).index("by_job_row", ["jobId", "row"]),
});
