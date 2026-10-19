import { z } from "zod";
import type { LeaseStatus } from "../lib/validators";

/**
 * Property import CSV: one row per unit, with its tenant and lease.
 * Buildings repeat across rows and are upserted by name.
 */
export const IMPORT_COLUMNS = [
  "building_name",
  "building_address",
  "building_city",
  "unit_label",
  "unit_floor",
  "unit_size_sqm",
  "unit_rent_eur",
  "tenant_name",
  "tenant_email",
  "tenant_phone",
  "lease_start",
  "lease_end",
  "notice_period_days",
] as const;

export const REQUIRED_COLUMNS = IMPORT_COLUMNS.filter(
  (c) => !["tenant_phone", "lease_start", "lease_end", "notice_period_days"].includes(c),
);

export const DEFAULT_NOTICE_PERIOD_DAYS = 90;

/** Empty cells become undefined, so optional columns can be left blank. */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const required = { error: "is required" };
const text = z.string(required).trim().min(1, "is required");

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date like 2024-01-31")
  .refine((s) => {
    // Round-trip rejects dates that roll over, like 2024-02-30.
    const date = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(s);
  }, "is not a real date");

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());

// Blank cells must fail, not coerce to 0.
const number = z.coerce.number({ error: "must be a number" });
const requiredNumber = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema);

export const importRowSchema = z
  .object({
    building_name: text,
    building_address: text,
    building_city: text,
    unit_label: text,
    unit_floor: requiredNumber(number.int("must be a whole number").min(-5).max(200)),
    unit_size_sqm: requiredNumber(number.positive("must be greater than 0").max(10_000)),
    unit_rent_eur: requiredNumber(number.min(0, "cannot be negative").max(1_000_000)),
    tenant_name: text,
    tenant_email: z.string(required).trim().toLowerCase().pipe(z.email("is not a valid email")),
    tenant_phone: optional(z.string().trim()),
    lease_start: optional(isoDate),
    lease_end: optional(isoDate),
    notice_period_days: optional(number.int("must be a whole number").min(0).max(3650)),
  })
  .refine((row) => !row.lease_end || row.lease_start, {
    message: "is set without lease_start",
    path: ["lease_end"],
  })
  .refine((row) => !row.lease_start || !row.lease_end || row.lease_end >= row.lease_start, {
    message: "is before lease_start",
    path: ["lease_end"],
  });

export type ImportRow = z.infer<typeof importRowSchema>;

export type ParsedRow =
  | { ok: true; row: ImportRow }
  | { ok: false; message: string };

export function parseImportRow(raw: Record<string, string>): ParsedRow {
  const result = importRowSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, row: result.data };
  }
  const message = result.error.issues
    .map((issue) => `${issue.path.join(".") || "row"} ${issue.message}`)
    .join("; ");
  return { ok: false, message };
}

/** Status of a lease on `today` (ISO date). ISO dates compare as strings. */
export function leaseStatusOn(
  today: string,
  startDate: string,
  endDate: string | undefined,
): LeaseStatus {
  if (startDate > today) return "upcoming";
  if (endDate !== undefined && endDate < today) return "ended";
  return "active";
}

/** Returns the required columns missing from a CSV header. */
export function missingColumns(header: string[]) {
  const present = new Set(header);
  return REQUIRED_COLUMNS.filter((c) => !present.has(c));
}
