import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeEmail } from "./properties";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
/** Extracted text kept on the document for display; chunks hold all of it. */
export const MAX_STORED_TEXT_CHARS = 500_000;

export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 150;

/** "lease-felix.braun@example.com.pdf" → "felix.braun@example.com". */
export function emailFromFilename(filename: string): string | null {
  const match = /^lease[-_ ](.+@.+\..+)\.pdf$/i.exec(filename.trim());
  return match ? normalizeEmail(match[1]) : null;
}

/** Collapses runs of spaces but keeps line breaks. */
export function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A short line without closing punctuation, like "6. Termination and notice period". */
function isHeading(line: string) {
  return line.length <= 60 && !/[.,;:!?]$/.test(line);
}

/**
 * Paragraphs from PDF text, where every visual line ends in a newline:
 * wrapped lines are joined back with spaces, and a heading starts a new
 * paragraph (kept on its own line above its text).
 */
function paragraphs(text: string): string[] {
  const out: string[] = [];
  for (const block of text.split(/\n\n/)) {
    let current = "";
    let afterHeading = false;
    for (const line of block.split("\n")) {
      const heading = isHeading(line);
      if (heading && current !== "" && !afterHeading) {
        out.push(current);
        current = "";
      }
      current = current === "" ? line : `${current}${afterHeading ? "\n" : " "}${line}`;
      afterHeading = heading;
    }
    if (current !== "") out.push(current);
  }
  return out;
}

/**
 * Splits at a sentence end: . ! or ? followed by whitespace and a capital
 * letter, digit or quote. "EUR 2,175.00", "1.02" and email addresses stay
 * whole. A bare section number ("6.") is glued to what follows.
 */
function sentences(paragraph: string): string[] {
  const out: string[] = [];
  for (const part of paragraph.split(/(?<=[.!?])\s+(?=["'(\p{Lu}\d])/u)) {
    const previous = out.at(-1);
    if (previous !== undefined && /^\d+\.$/.test(previous)) {
      out[out.length - 1] = `${previous} ${part}`;
    } else {
      out.push(part);
    }
  }
  return out;
}

/** Cuts text longer than `max` at word boundaries. */
function hardWrap(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const space = rest.lastIndexOf(" ", max);
    const cut = space > max / 2 ? space : max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest !== "") out.push(rest);
  return out;
}

type Unit = { text: string; paragraph: number };

/** Sentences of one paragraph join with a space, paragraphs with a blank line. */
function join(units: Unit[]) {
  return units
    .map((u, i) => {
      if (i === 0) return u.text;
      return (u.paragraph === units[i - 1].paragraph ? " " : "\n\n") + u.text;
    })
    .join("");
}

/**
 * Packs whole sentences into chunks of at most `size` characters, keeping
 * sections together where they fit. Each chunk after the first repeats the
 * last whole sentences of the previous one (up to `overlap` characters), so
 * a fact near a boundary is still found with its context.
 */
export function chunkText(raw: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const text = normalizeText(raw);
  if (text === "") return [];
  const units: Unit[] = paragraphs(text).flatMap((p, paragraph) =>
    sentences(p).flatMap((s) => hardWrap(s, size).map((t) => ({ text: t, paragraph }))),
  );

  const chunks: string[] = [];
  let current: Unit[] = [];
  for (const unit of units) {
    if (current.length === 0 || join([...current, unit]).length <= size) {
      current.push(unit);
      continue;
    }
    chunks.push(join(current));
    const carry: Unit[] = [];
    for (let i = current.length - 1; i >= 0; i--) {
      if (join([current[i], ...carry]).length > overlap) break;
      carry.unshift(current[i]);
    }
    current = join([...carry, unit]).length <= size ? [...carry, unit] : [unit];
  }
  if (current.length > 0) chunks.push(join(current));
  return chunks;
}

/**
 * Links a document to a tenant (and their active lease), and copies the
 * tenantId onto every chunk so vector search can filter by tenant.
 */
export async function linkDocumentToTenant(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  tenantId: Id<"tenants"> | undefined,
) {
  const leases = tenantId
    ? await ctx.db
        .query("leases")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect()
    : [];
  const lease = leases.find((l) => l.status === "active") ?? null;

  await ctx.db.patch(documentId, {
    tenantId,
    leaseId: lease?._id,
    kind: lease ? "lease" : "other",
  });
  if (lease && lease.documentId !== documentId) {
    await ctx.db.patch(lease._id, { documentId });
  }

  const chunks = await ctx.db
    .query("docChunks")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();
  for (const chunk of chunks) {
    if (chunk.tenantId !== tenantId) {
      await ctx.db.patch(chunk._id, { tenantId });
    }
  }
}
