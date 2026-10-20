import workflow from "@convex-dev/workflow/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

// The agent itself is covered in agent.test.ts.
vi.mock("./model/agentRuns", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./model/agentRuns")>()),
  startAgentRun: vi.fn(),
}));

let t: ReturnType<typeof convexTest>;

async function signedIn(email: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  return t.withIdentity({ subject: `${userId}|test-session` });
}

beforeEach(() => {
  t = convexTest(schema, modules);
  workflow.register(t, "workflow");
  process.env.OWNER_EMAILS = "owner@example.com";
});

afterEach(() => {
  delete process.env.OWNER_EMAILS;
});

describe("roles", () => {
  test("OWNER_EMAILS decides who is owner; everyone else is demo", async () => {
    const owner = await signedIn("Owner@Example.com");
    const demo = await signedIn("demo@example.com");
    expect((await owner.query(api.users.viewer, {}))?.role).toBe("owner");
    expect((await demo.query(api.users.viewer, {}))?.role).toBe("demo");
  });

  test("without OWNER_EMAILS (local development) everyone is owner", async () => {
    delete process.env.OWNER_EMAILS;
    const someone = await signedIn("someone@example.com");
    expect((await someone.query(api.users.viewer, {}))?.role).toBe("owner");
  });

  test("the demo account cannot connect Gmail, upload or import", async () => {
    const demo = await signedIn("demo@example.com");
    await expect(demo.mutation(api.gmail.startConnect, {})).rejects.toThrow(/demo account/);
    await expect(demo.mutation(api.documents.generateUploadUrl, {})).rejects.toThrow(/demo account/);
    await expect(demo.mutation(api.imports.generateUploadUrl, {})).rejects.toThrow(/demo account/);
  });

  test("the demo account can reply to simulated email but not to real email", async () => {
    const demo = await signedIn("demo@example.com");
    const simulated = await demo.mutation(api.inbox.simulateEmail, {
      fromEmail: "someone@example.org",
      subject: "Hello",
      body: "Test",
    });
    await demo.mutation(api.inbox.queueReply, { threadId: simulated, body: "Hi" });

    await t.mutation(internal.gmail.ingest, {
      gmailMessageId: "real-1",
      gmailThreadId: "real-thread",
      direction: "inbound",
      from: "tenant@example.org",
      to: "inbox@example.com",
      subject: "Real",
      bodyText: "A real email",
      receivedAt: 1,
    });
    const real = await t.run(async (ctx) => {
      const threads = await ctx.db.query("emailThreads").collect();
      return threads.find((th) => th.gmailThreadId === "real-thread")!._id;
    });
    await expect(demo.mutation(api.inbox.queueReply, { threadId: real, body: "Hi" })).rejects.toThrow(
      /demo account/,
    );
  });
});
