import workpool from "@convex-dev/workpool/test";
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { EMBEDDING_DIMENSIONS } from "./model/embeddings";
import schema from "./schema";
import { tenantFor } from "./seedData";
import { modules } from "./test.setup";

let t: ReturnType<typeof convexTest>;
let asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

/** A unit vector along one axis: two chunks with the same axis match exactly. */
function axis(i: number) {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  vector[i] = 1;
  return vector;
}

async function tenantIdFor(b: number, u: number) {
  const tenant = await asUser.query(api.tenants.findByEmail, { email: tenantFor(b, u).email });
  return tenant!._id;
}

async function upload(filename: string) {
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["%PDF-1.4 test"])));
  return await asUser.mutation(api.documents.create, { storageId, filename });
}

async function addChunk(documentId: Id<"documents">, chunkIndex: number, text: string, vector: number[]) {
  await t.mutation(internal.documents.addChunks, {
    documentId,
    chunks: [{ chunkIndex, text, embedding: vector }],
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  workpool.register(t, "documentPool");
  await t.mutation(internal.seed.run, {});
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  asUser = t.withIdentity({ subject: `${userId}|test-session` });
});

describe("documents.create", () => {
  test("links lease-<email>.pdf to the tenant and their active lease", async () => {
    const felix = tenantFor(0, 5);
    const documentId = await upload(`lease-${felix.email}.pdf`);

    const { doc, lease } = await t.run(async (ctx) => {
      const doc = (await ctx.db.get(documentId))!;
      return { doc, lease: doc.leaseId ? await ctx.db.get(doc.leaseId) : null };
    });
    expect(doc).toMatchObject({ status: "queued", kind: "lease", tenantId: await tenantIdFor(0, 5) });
    expect(lease?.documentId).toBe(documentId);
  });

  test("leaves other files unlinked", async () => {
    const documentId = await upload("scan-0042.pdf");
    const doc = await t.run((ctx) => ctx.db.get(documentId));
    expect(doc?.kind).toBe("other");
    expect(doc?.tenantId).toBeUndefined();
  });

  test("rejects files that are not PDFs", async () => {
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    await expect(
      asUser.mutation(api.documents.create, { storageId, filename: "notes.docx" }),
    ).rejects.toThrow(/only PDF files/);
  });
});

describe("linking", () => {
  test("a manual link copies the tenant onto existing chunks", async () => {
    const documentId = await upload("scan-0042.pdf");
    await addChunk(documentId, 0, "Notice period is 90 days.", axis(0));

    await asUser.mutation(api.documents.linkTenant, {
      documentId,
      tenantEmail: tenantFor(1, 3).email.toUpperCase(),
    });

    const chunks = await t.run((ctx) => ctx.db.query("docChunks").collect());
    expect(chunks.map((c) => c.tenantId)).toEqual([await tenantIdFor(1, 3)]);
  });
});

describe("tenant-scoped search", () => {
  test("never returns another tenant's chunks, even with an identical vector", async () => {
    const a = tenantFor(0, 1);
    const b = tenantFor(0, 2);
    const docA = await upload(`lease-${a.email}.pdf`);
    const docB = await upload(`lease-${b.email}.pdf`);
    await addChunk(docA, 0, "A: notice period is 90 days.", axis(7));
    await addChunk(docB, 0, "B: notice period is 30 days.", axis(7));

    const hits = await t.action(internal.documents.searchByVector, {
      tenantId: await tenantIdFor(0, 1),
      vector: axis(7),
    });

    expect(hits.map((h) => h.text)).toEqual(["A: notice period is 90 days."]);
    expect(hits[0].filename).toBe(`lease-${a.email}.pdf`);
  });

  test("ranks the closest chunk first", async () => {
    const a = tenantFor(2, 0);
    const doc = await upload(`lease-${a.email}.pdf`);
    await addChunk(doc, 0, "Pets clause", axis(1));
    await addChunk(doc, 1, "Notice period clause", axis(2));

    const hits = await t.action(internal.documents.searchByVector, {
      tenantId: await tenantIdFor(2, 0),
      vector: axis(2),
    });
    expect(hits[0].text).toBe("Notice period clause");
  });
});

describe("processing is safe to repeat", () => {
  test("startEmbedding clears chunks from an earlier attempt", async () => {
    const documentId = await upload(`lease-${tenantFor(0, 0).email}.pdf`);
    await addChunk(documentId, 0, "old", axis(3));

    await t.mutation(internal.documents.startEmbedding, { documentId, text: "new text", pageCount: 1 });
    await addChunk(documentId, 0, "new", axis(3));
    await t.mutation(internal.documents.finish, { documentId, chunkCount: 1 });

    const chunks = await t.run((ctx) => ctx.db.query("docChunks").collect());
    expect(chunks.map((c) => c.text)).toEqual(["new"]);
  });

  test("a ready document is not claimed again", async () => {
    const documentId = await upload("scan.pdf");
    await t.mutation(internal.documents.finish, { documentId, chunkCount: 0 });
    expect(await t.mutation(internal.documents.claim, { documentId })).toBeNull();
  });
});
