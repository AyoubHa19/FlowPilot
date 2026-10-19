import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { tenantFor } from "./seedData";
import { modules } from "./test.setup";

// Ingest starts an agent run; that is covered in agent.test.ts. Here the
// agent is stubbed so these tests stay about inbox behaviour.
vi.mock("./model/agentRuns", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./model/agentRuns")>()),
  startAgentRun: vi.fn(),
}));

let t: ReturnType<typeof convexTest>;
let asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

const felix = tenantFor(0, 5);

function inbound(overrides: {
  gmailMessageId?: string;
  gmailThreadId?: string;
  from?: string;
  subject?: string;
  receivedAt?: number;
  direction?: "inbound" | "outbound";
} = {}) {
  return {
    gmailMessageId: "m1",
    gmailThreadId: "t1",
    direction: "inbound" as const,
    from: `Felix Braun <${felix.email.toUpperCase()}>`,
    to: "flowpilot.demo@gmail.com",
    subject: "Heizung kaputt",
    bodyText: "Die Heizung geht seit gestern nicht.",
    rfcMessageId: "<m1@mail.gmail.com>",
    receivedAt: 1_000,
    ...overrides,
  };
}

async function counts() {
  return await t.run(async (ctx) => ({
    threads: (await ctx.db.query("emailThreads").collect()).length,
    messages: (await ctx.db.query("emailMessages").collect()).length,
  }));
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  await t.mutation(internal.seed.run, {});
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  asUser = t.withIdentity({ subject: `${userId}|test-session` });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ingest", () => {
  test("the same Gmail message twice is stored once", async () => {
    expect(await t.mutation(internal.gmail.ingest, inbound())).toBe(true);
    expect(await t.mutation(internal.gmail.ingest, inbound())).toBe(false);
    expect(await counts()).toEqual({ threads: 1, messages: 1 });
  });

  test("messages are grouped by Gmail thread", async () => {
    await t.mutation(internal.gmail.ingest, inbound());
    await t.mutation(internal.gmail.ingest, inbound({ gmailMessageId: "m2", receivedAt: 2_000 }));
    await t.mutation(internal.gmail.ingest, inbound({ gmailMessageId: "m3", gmailThreadId: "t2" }));
    expect(await counts()).toEqual({ threads: 2, messages: 3 });
  });

  test("links the thread to the tenant by sender email, ignoring case", async () => {
    await t.mutation(internal.gmail.ingest, inbound());
    const { page } = await asUser.query(api.inbox.listThreads, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0].tenant?.name).toBe(felix.name);
    expect(page[0].counterpartEmail).toBe(felix.email);
    expect(page[0].counterpartName).toBe("Felix Braun");
  });

  test("an unknown sender gets no tenant", async () => {
    await t.mutation(internal.gmail.ingest, inbound({ from: "stranger@example.org" }));
    const { page } = await asUser.query(api.inbox.listThreads, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0].tenant).toBeNull();
  });

  test("the inbox lists the most recent conversation first", async () => {
    await t.mutation(internal.gmail.ingest, inbound({ gmailThreadId: "old", receivedAt: 1_000 }));
    await t.mutation(
      internal.gmail.ingest,
      inbound({ gmailMessageId: "m2", gmailThreadId: "new", subject: "Newer", receivedAt: 5_000 }),
    );
    const { page } = await asUser.query(api.inbox.listThreads, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.map((p) => p.subject)).toEqual(["Newer", "Heizung kaputt"]);
  });
});

describe("simulated email and replies", () => {
  test("a simulated email threads and links like a real one", async () => {
    const threadId = await asUser.mutation(api.inbox.simulateEmail, {
      fromEmail: felix.email,
      fromName: "Felix Braun",
      subject: "Wasser tropft",
      body: "Unter der Spüle tropft es.",
    });
    const detail = await asUser.query(api.inbox.getThread, { threadId });
    expect(detail?.thread.simulated).toBe(true);
    expect(detail?.tenant?.name).toBe(felix.name);
    expect(detail?.messages.map((m) => m.direction)).toEqual(["inbound"]);
  });

  test("a reply on a simulated thread is marked sent without calling Gmail", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const threadId = await asUser.mutation(api.inbox.simulateEmail, {
      fromEmail: felix.email,
      subject: "Wasser tropft",
      body: "Unter der Spüle tropft es.",
    });
    await asUser.mutation(api.inbox.queueReply, { threadId, body: "Wir kommen morgen." });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const detail = await asUser.query(api.inbox.getThread, { threadId });
    const reply = detail!.messages.find((m) => m.direction === "outbound");
    expect(reply).toMatchObject({ sendStatus: "sent", bodyText: "Wir kommen morgen." });
    expect(detail!.thread.status).toBe("replied");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("a real thread cannot be answered before Gmail is connected", async () => {
    await t.mutation(internal.gmail.ingest, inbound());
    const threadId = await t.run(async (ctx) => (await ctx.db.query("emailThreads").first())!._id);
    await expect(
      asUser.mutation(api.inbox.queueReply, { threadId, body: "Hallo" }),
    ).rejects.toThrow(/Connect Gmail first/);
  });

  test("rejects an invalid sender and empty replies", async () => {
    await expect(
      asUser.mutation(api.inbox.simulateEmail, { fromEmail: "nope", subject: "s", body: "b" }),
    ).rejects.toThrow(/valid sender email/);
    const threadId = await asUser.mutation(api.inbox.simulateEmail, {
      fromEmail: felix.email,
      subject: "s",
      body: "b",
    });
    await expect(asUser.mutation(api.inbox.queueReply, { threadId, body: "  " })).rejects.toThrow(
      /Write a reply/,
    );
  });
});

describe("OAuth state", () => {
  test("is single use and expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret";
    process.env.CONVEX_SITE_URL = "https://example.convex.site";

    const url = new URL(await asUser.mutation(api.gmail.startConnect, {}));
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.convex.site/gmail/oauth/callback",
    );
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/gmail.modify");
    const state = url.searchParams.get("state")!;

    expect(await t.mutation(internal.gmail.consumeState, { state })).toBe(true);
    expect(await t.mutation(internal.gmail.consumeState, { state })).toBe(false);

    const late = new URL(await asUser.mutation(api.gmail.startConnect, {})).searchParams.get("state")!;
    vi.setSystemTime(new Date("2026-10-19T12:11:00Z"));
    expect(await t.mutation(internal.gmail.consumeState, { state: late })).toBe(false);
    expect(await t.mutation(internal.gmail.consumeState, { state: "forged" })).toBe(false);
  });

  test("signed-out callers cannot start a connection or read the inbox", async () => {
    await expect(t.mutation(api.gmail.startConnect, {})).rejects.toThrow(/Not authenticated/);
    await expect(
      t.query(api.inbox.listThreads, { paginationOpts: { numItems: 5, cursor: null } }),
    ).rejects.toThrow(/Not authenticated/);
  });
});
