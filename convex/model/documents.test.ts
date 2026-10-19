import { describe, expect, test } from "vitest";
import { chunkText, emailFromFilename } from "./documents";

// Text as unpdf returns it: one line per visual line of the PDF.
const LEASE = [
  "Residential Lease Agreement",
  "1. Parties",
  "Tenant: Felix Braun, email felix.braun@example.com, phone +49 30 5550105.",
  "5. Security deposit",
  "The tenant pays a security deposit of three monthly base rents, EUR 2,175.00. It may be paid in three equal",
  "monthly instalments, the first due at the start of the lease.",
  "6. Termination and notice period",
  "Either party may terminate this lease in writing. The notice period is 90 days (3 months). Notice must reach",
  "the other party no later than the third working day of a month.",
].join("\n");

describe("chunkText", () => {
  test("keeps numbers, emails and unit labels whole", () => {
    const text = chunkText(LEASE).join("\n");
    expect(text).toContain("EUR 2,175.00.");
    expect(text).toContain("felix.braun@example.com");
    expect(text).not.toMatch(/2,175\.\s/);
  });

  test("unwraps PDF lines and keeps a heading with its section", () => {
    const [chunk] = chunkText(LEASE, 2000);
    expect(chunk).toContain(
      "6. Termination and notice period\nEither party may terminate this lease in writing. The notice period is 90 days (3 months). Notice must reach the other party",
    );
  });

  test("respects the size limit and overlaps with whole sentences", () => {
    const chunks = chunkText(LEASE, 250, 80);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(250);
    }
    // Every chunk after the first starts at a sentence or section start.
    for (const chunk of chunks.slice(1)) {
      expect(chunk).toMatch(/^(\d+\. )?[A-Z]/);
    }
  });

  test("the notice period sentence lands whole in one chunk", () => {
    const chunks = chunkText(LEASE, 250, 80);
    expect(chunks.some((c) => c.includes("The notice period is 90 days (3 months)."))).toBe(true);
  });

  test("hard-wraps a sentence longer than a chunk at word boundaries", () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(long, 100, 20);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(" ").split(" ")).toContain("word59");
  });

  test("empty or whitespace-only text has no chunks", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText(" \n\n \t ")).toEqual([]);
  });
});

describe("emailFromFilename", () => {
  test("reads the tenant email from lease-<email>.pdf", () => {
    expect(emailFromFilename("lease-Felix.Braun@example.com.pdf")).toBe("felix.braun@example.com");
    expect(emailFromFilename("LEASE_anna@example.org.PDF")).toBe("anna@example.org");
  });

  test("returns null for other names", () => {
    expect(emailFromFilename("scan-0042.pdf")).toBeNull();
    expect(emailFromFilename("lease-felix.pdf")).toBeNull();
    expect(emailFromFilename("invoice-felix@example.com.pdf")).toBeNull();
  });
});
