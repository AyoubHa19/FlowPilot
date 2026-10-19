import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
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
});
