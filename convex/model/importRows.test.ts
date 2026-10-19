import { describe, expect, test } from "vitest";
import { leaseStatusOn, missingColumns, parseImportRow } from "./importRows";

const valid = {
  building_name: "Lindenhof",
  building_address: "Lindenstraße 42, 10969 Berlin",
  building_city: "Berlin",
  unit_label: "1.02",
  unit_floor: "1",
  unit_size_sqm: "50",
  unit_rent_eur: "725.50",
  tenant_name: "Felix Braun",
  tenant_email: " Felix.Braun@Example.com ",
  tenant_phone: "",
  lease_start: "2023-02-01",
  lease_end: "",
  notice_period_days: "",
};

describe("parseImportRow", () => {
  test("accepts a valid row and normalises it", () => {
    const parsed = parseImportRow(valid);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.row).toMatchObject({
      unit_floor: 1,
      unit_size_sqm: 50,
      unit_rent_eur: 725.5,
      tenant_email: "felix.braun@example.com",
      tenant_phone: undefined,
      lease_end: undefined,
      notice_period_days: undefined,
    });
  });

  test("rejects a broken email with a readable message", () => {
    const parsed = parseImportRow({ ...valid, tenant_email: "felix.braun@" });
    expect(parsed).toEqual({ ok: false, message: "tenant_email is not a valid email" });
  });

  test("blank required numbers fail instead of becoming 0", () => {
    const parsed = parseImportRow({ ...valid, unit_rent_eur: "" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toMatch(/^unit_rent_eur must be a number/);
  });

  test("reports every problem in one message", () => {
    const parsed = parseImportRow({ ...valid, building_name: " ", unit_floor: "1.5" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain("building_name is required");
    expect(parsed.message).toContain("unit_floor must be a whole number");
  });

  test("rejects impossible dates and an end before the start", () => {
    expect(parseImportRow({ ...valid, lease_start: "2024-02-30" }).ok).toBe(false);
    const parsed = parseImportRow({ ...valid, lease_end: "2022-01-01" });
    expect(parsed).toEqual({ ok: false, message: "lease_end is before lease_start" });
  });
});

describe("leaseStatusOn", () => {
  test("upcoming, active and ended", () => {
    expect(leaseStatusOn("2025-06-01", "2025-07-01", undefined)).toBe("upcoming");
    expect(leaseStatusOn("2025-06-01", "2020-01-01", undefined)).toBe("active");
    expect(leaseStatusOn("2025-06-01", "2020-01-01", "2025-06-01")).toBe("active");
    expect(leaseStatusOn("2025-06-01", "2020-01-01", "2024-12-31")).toBe("ended");
  });
});

describe("missingColumns", () => {
  test("lists required columns that are absent", () => {
    expect(missingColumns(Object.keys(valid))).toEqual([]);
    expect(missingColumns(["building_name", "tenant_email"])).toContain("unit_label");
  });
});
