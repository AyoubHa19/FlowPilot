import workflow from "@convex-dev/workflow/test";
import type { LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { automatedReason } from "./model/agentRuns";
import { EMBEDDING_DIMENSIONS } from "./model/embeddings";
import schema from "./schema";
import { tenantFor } from "./seedData";
import { modules } from "./test.setup";

// --- Scripted model --------------------------------------------------------

const mock = vi.hoisted(() => ({
  classification: {
    category: "repair",
    urgency: "high",
    language: "en",
    summary: "Heating is broken",
  } as Record<string, string>,
  /** Agent responses, one per turn. A thrown error fails that attempt. */
  agentTurns: [] as (LanguageModelV4GenerateResult | Error)[],
  agentCalls: [] as { attempt: number }[],
}));

function usage(input: number, output: number) {
  return {
    inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: output, text: output, reasoning: 0 },
  };
}

function toolCall(toolName: string, input: unknown, tokensIn = 200): LanguageModelV4GenerateResult {
  return {
    content: [
      { type: "tool-call", toolCallId: `call-${Math.random()}`, toolName, input: JSON.stringify(input) },
    ],
    finishReason: { unified: "tool-calls", raw: "tool_calls" },
    usage: usage(tokensIn, 30),
    warnings: [],
  };
}

function text(value: string): LanguageModelV4GenerateResult {
  return {
    content: [{ type: "text", text: value }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: usage(150, 40),
    warnings: [],
  };
}

const DRAFT = { subject: "Re: Heating", body: "Dear Felix, a technician will come." };

vi.mock("./model/llm", async (importOriginal) => {
  const original = await importOriginal<typeof import("./model/llm")>();
  return {
    ...original,
    classifierModel: () =>
      new MockLanguageModelV4({
        doGenerate: async () => text(JSON.stringify(mock.classification)),
      }),
    agentModelFor: (attempt: number) => ({
      id: attempt > 1 ? original.AGENT_FALLBACK_MODEL : original.AGENT_MODEL,
      model: new MockLanguageModelV4({
        doGenerate: async () => {
          mock.agentCalls.push({ attempt });
          const next = mock.agentTurns.shift();
          if (!next) throw new Error("Script exhausted");
          if (next instanceof Error) throw next;
          return next;
        },
      }),
    }),
  };
});

// Every query lands on the same axis, so search returns the tenant's chunk.
vi.mock("./model/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./model/embeddings")>()),
  embedQuery: async () => {
    const vector = new Array<number>(768).fill(0);
    vector[0] = 1;
    return vector;
  },
}));

// --- Harness ---------------------------------------------------------------

let t: ReturnType<typeof convexTest>;
let asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;
const felix = tenantFor(0, 5);

beforeEach(async () => {
  vi.useFakeTimers();
  mock.agentTurns = [];
  mock.agentCalls = [];
  mock.classification = { category: "repair", urgency: "high", language: "en", summary: "Heating is broken" };
  t = convexTest(schema, modules);
  workflow.register(t, "workflow");
  await t.mutation(internal.seed.run, {});
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  asUser = t.withIdentity({ subject: `${userId}|test-session` });
});

afterEach(() => {
  vi.useRealTimers();
});

async function simulate(from = felix.email, options: { forceToolFailure?: boolean } = {}) {
  const threadId = await asUser.mutation(api.inbox.simulateEmail, {
    fromEmail: from,
    subject: "Heating",
    body: "The heating is broken.",
    ...options,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers, 500);
  return threadId;
}

async function latestRun(threadId: Id<"emailThreads">) {
  const result = await asUser.query(api.agent.runForThread, { threadId });
  if (!result) throw new Error("No run");
  return result;
}

async function addLeaseChunk() {
  const tenant = await asUser.query(api.tenants.findByEmail, { email: felix.email });
  const tenantId = tenant!._id;
  await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["pdf"]));
    const documentId = await ctx.db.insert("documents", {
      storageId, filename: "lease.pdf", kind: "lease", status: "ready", chunkCount: 1, tenantId,
    });
    const embedding = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    embedding[0] = 1;
    await ctx.db.insert("docChunks", {
      documentId, tenantId, chunkIndex: 0, text: "The notice period is 90 days.", embedding,
    });
  });
}

// --- Tests -----------------------------------------------------------------

describe("a repair email from a tenant", () => {
  test("gets a category, the tenant's context and a draft reply", async () => {
    await addLeaseChunk();
    mock.agentTurns = [toolCall("draft_reply", DRAFT)];
    const { run, steps } = await latestRun(await simulate());

    expect(run).toMatchObject({ status: "awaiting_approval", category: "repair", urgency: "high", draft: DRAFT });
    expect(steps.map((s) => s.name)).toEqual([
      "classify",
      "find_tenant_by_email",
      "get_lease",
      "list_open_tickets",
      "search_lease_documents",
      "agent",
      "draft_reply",
      "send_reply",
    ]);
    // Every step succeeded; the last one waits for a person.
    expect(steps.slice(0, -1).every((s) => s.status === "succeeded")).toBe(true);
    expect(steps.at(-1)).toMatchObject({ type: "approval", status: "running" });
    // Context reached the model: tenant, lease, the open heating ticket, the lease passage.
    expect(steps[1].output).toContain(felix.name);
    expect(steps[2].output).toContain('"noticePeriodDays": 90');
    expect(steps[3].output).toContain("No heating in the whole flat");
    expect(steps[4].output).toContain("The notice period is 90 days.");
    // Tokens and cost are summed on the run.
    expect(run.tokensIn).toBe(steps.reduce((sum, s) => sum + (s.tokensIn ?? 0), 0));
    expect(run.costUsd).toBeGreaterThan(0);
    expect(run.toolCalls).toBe(1);
  });

  test("a forced tool failure is retried and the run still completes", async () => {
    mock.agentTurns = [toolCall("draft_reply", DRAFT)];
    const { run, steps } = await latestRun(await simulate(felix.email, { forceToolFailure: true }));

    const search = steps.find((s) => s.name === "search_lease_documents")!;
    expect(search).toMatchObject({ status: "succeeded", attempt: 2 });
    expect(search.error).toMatch(/Injected failure/);
    expect(run.status).toBe("awaiting_approval");
  });

  test("a failed model call is retried with the fallback model", async () => {
    mock.agentTurns = [new Error("high demand"), toolCall("draft_reply", DRAFT)];
    const { run, steps } = await latestRun(await simulate());

    expect(mock.agentCalls.map((c) => c.attempt)).toEqual([1, 2]);
    const agent = steps.find((s) => s.name === "agent")!;
    expect(agent).toMatchObject({ status: "succeeded", attempt: 2 });
    expect(agent.output).toContain("gemini-3.5-flash-lite");
    expect(run.status).toBe("awaiting_approval");
  });
});

describe("guardrails", () => {
  test("an unknown sender gets no tenant data, even if the model asks", async () => {
    mock.agentTurns = [
      toolCall("find_tenant_by_email", { email: felix.email }),
      toolCall("get_lease", {}),
      toolCall("draft_reply", { subject: "Re: Heating", body: "Please tell us your name and address." }),
    ];
    const { run, steps } = await latestRun(await simulate("stranger@example.org"));

    expect(steps.map((s) => s.name)).not.toContain("list_open_tickets");
    const lookups = steps.filter((s) => s.type === "tool" && s.name !== "draft_reply");
    expect(lookups.map((s) => s.output)).toEqual([
      expect.stringContaining('"found": false'),
      expect.stringContaining("Only the sender of this email can be looked up"),
      expect.stringContaining("not a known tenant"),
    ]);
    expect(steps.some((s) => s.output?.includes(felix.name))).toBe(false);
    expect(run.status).toBe("awaiting_approval");
  });

  test("invalid tool input is returned to the model, which can correct it", async () => {
    mock.agentTurns = [
      toolCall("search_lease_documents", { query: "" }),
      toolCall("draft_reply", DRAFT),
    ];
    const { run, steps } = await latestRun(await simulate());
    const bad = steps.filter((s) => s.name === "search_lease_documents").at(-1)!;
    expect(bad.output).toMatch(/Invalid input. query/);
    expect(run.status).toBe("awaiting_approval");
  });

  test("more than 8 tool calls escalates to a human", async () => {
    mock.agentTurns = Array.from({ length: 9 }, () => toolCall("get_lease", {}));
    const threadId = await simulate();
    const { run } = await latestRun(threadId);

    expect(run.status).toBe("escalated");
    expect(run.toolCalls).toBe(8);
    expect(run.escalationReason).toMatch(/Tool call limit of 8/);
    const detail = await asUser.query(api.inbox.getThread, { threadId });
    expect(detail?.thread.status).toBe("needs_human");
  });

  test("the token cap escalates instead of calling the model again", async () => {
    mock.agentTurns = [toolCall("get_lease", {}, 45_000), toolCall("draft_reply", DRAFT)];
    const { run } = await latestRun(await simulate());
    expect(run.status).toBe("escalated");
    expect(run.escalationReason).toMatch(/Token cap/);
    expect(mock.agentCalls).toHaveLength(1);
  });

  test("a plain-text answer is kept as the draft", async () => {
    mock.agentTurns = [text("Dear Felix, we are on it.")];
    const { run } = await latestRun(await simulate());
    expect(run).toMatchObject({ status: "awaiting_approval", draft: { body: "Dear Felix, we are on it." } });
  });
});

describe("triggering", () => {
  test("automated mail is skipped without any LLM call", async () => {
    await t.mutation(internal.gmail.ingest, {
      gmailMessageId: "news-1",
      gmailThreadId: "news",
      direction: "inbound",
      from: "Newsletter <news@shop.example>",
      to: "inbox@flowpilot.demo",
      subject: "Sale",
      bodyText: "50% off",
      receivedAt: 1,
      automatedReason: "Mailing list (List-Unsubscribe)",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const runs = await t.run((ctx) => ctx.db.query("agentRuns").collect());
    expect(runs.map((r) => [r.status, r.skipReason])).toEqual([
      ["skipped", "Mailing list (List-Unsubscribe)"],
    ]);
    expect(mock.agentCalls).toHaveLength(0);
  });

  test("the same Gmail message twice starts one run", async () => {
    mock.agentTurns = [toolCall("draft_reply", DRAFT)];
    const message = {
      gmailMessageId: "m1", gmailThreadId: "t1", direction: "inbound" as const,
      from: felix.email, to: "inbox@flowpilot.demo", subject: "Heating", bodyText: "Broken", receivedAt: 1,
    };
    await t.mutation(internal.gmail.ingest, message);
    await t.mutation(internal.gmail.ingest, message);
    await t.finishAllScheduledFunctions(vi.runAllTimers, 500);
    expect(await t.run(async (ctx) => (await ctx.db.query("agentRuns").collect()).length)).toBe(1);
  });

  test("outbound messages do not start runs", async () => {
    await t.mutation(internal.gmail.ingest, {
      gmailMessageId: "out-1", gmailThreadId: "t1", direction: "outbound",
      from: "inbox@flowpilot.demo", to: felix.email, subject: "Re: Heating", bodyText: "Hi", receivedAt: 1,
    });
    expect(await t.run(async (ctx) => (await ctx.db.query("agentRuns").collect()).length)).toBe(0);
  });
});

describe("automatedReason", () => {
  test("recognises machine-sent mail", () => {
    expect(automatedReason({ fromEmail: "no-reply@accounts.google.com" })).toBe("Automated sender address");
    expect(automatedReason({ fromEmail: "news@tiktok.com", labelIds: ["INBOX", "CATEGORY_SOCIAL"] })).toBe(
      "Gmail category social",
    );
    expect(
      automatedReason({ fromEmail: "shop@x.com", headers: { "list-unsubscribe": "<mailto:u@x.com>" } }),
    ).toBe("Mailing list (List-Unsubscribe)");
  });

  test("lets a person's email through", () => {
    expect(automatedReason({ fromEmail: "felix.braun@example.com", labelIds: ["INBOX", "UNREAD"] })).toBeUndefined();
  });
});

// --- Approvals (Stage 6) ---------------------------------------------------

async function approvalsFor(threadId: Id<"emailThreads">) {
  const { run } = await latestRun(threadId);
  return await asUser.query(api.approvals.forRun, { runId: run._id });
}

async function outbound(threadId: Id<"emailThreads">) {
  const detail = await asUser.query(api.inbox.getThread, { threadId });
  return detail!.messages.filter((m) => m.direction === "outbound");
}

const TICKET = { category: "heating", priority: "high", description: "Heating does not work in the flat." };

describe("approvals", () => {
  test("the run waits: nothing is sent before a decision", async () => {
    mock.agentTurns = [toolCall("draft_reply", DRAFT)];
    const threadId = await simulate();
    const [approval] = await approvalsFor(threadId);

    expect(approval).toMatchObject({ action: "send_reply", status: "pending", payload: DRAFT });
    expect(await outbound(threadId)).toEqual([]);
    expect(await asUser.query(api.approvals.pendingCount, {})).toBe(1);
    const detail = await asUser.query(api.inbox.getThread, { threadId });
    expect(detail?.thread.status).toBe("awaiting_approval");
  });

  test("Approve sends the draft", async () => {
    mock.agentTurns = [toolCall("draft_reply", DRAFT)];
    const threadId = await simulate();
    const [approval] = await approvalsFor(threadId);

    await asUser.mutation(api.approvals.approve, { approvalId: approval._id });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 500);

    const sent = await outbound(threadId);
    expect(sent.map((m) => [m.sendStatus, m.subject, m.bodyText])).toEqual([["sent", DRAFT.subject, DRAFT.body]]);
    expect((await latestRun(threadId)).run.status).toBe("completed");
    expect((await approvalsFor(threadId))[0].status).toBe("executed");
    expect(await asUser.query(api.approvals.pendingCount, {})).toBe(0);
  });

  test("Edit sends the edited text, not the draft", async () => {
    mock.agentTurns = [toolCall("draft_reply", DRAFT)];
    const threadId = await simulate();
    const [approval] = await approvalsFor(threadId);
    const edited = { subject: "Re: Heating", body: "Edited by the manager: Thursday 9-12." };

    await asUser.mutation(api.approvals.approveEdited, { approvalId: approval._id, payload: edited });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 500);

    expect((await outbound(threadId)).map((m) => m.bodyText)).toEqual([edited.body]);
    expect((await approvalsFor(threadId))[0]).toMatchObject({ status: "executed", editedPayload: edited });
  });

  test("Reject sends nothing and records the reason", async () => {
    mock.agentTurns = [toolCall("draft_reply", DRAFT)];
    const threadId = await simulate();
    const [approval] = await approvalsFor(threadId);

    await asUser.mutation(api.approvals.reject, { approvalId: approval._id, reason: "Wrong tone" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 500);

    expect(await outbound(threadId)).toEqual([]);
    const { run, steps } = await latestRun(threadId);
    expect(run.status).toBe("rejected");
    expect(steps.at(-1)?.output).toMatch(/Rejected: Wrong tone. Nothing was sent./);
    const detail = await asUser.query(api.inbox.getThread, { threadId });
    expect(detail?.thread.status).toBe("open");
  });

  test("a proposed ticket is created only after approval, before the reply", async () => {
    mock.agentTurns = [toolCall("create_ticket", TICKET), toolCall("draft_reply", DRAFT)];
    const threadId = await simulate();
    const approvals = await approvalsFor(threadId);
    const ticket = approvals.find((a) => a.action === "create_ticket")!;
    const reply = approvals.find((a) => a.action === "send_reply")!;
    const ticketsBefore = await t.run(async (ctx) => (await ctx.db.query("tickets").collect()).length);

    // The workflow waits on the ticket first.
    const { steps } = await latestRun(threadId);
    expect(steps.at(-1)).toMatchObject({ type: "approval", name: "create_ticket", status: "running" });

    await asUser.mutation(api.approvals.approve, { approvalId: ticket._id });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 500);
    const created = await t.run((ctx) => ctx.db.query("tickets").order("desc").first());
    expect(created).toMatchObject({ ...TICKET, status: "open", agentRunId: ticket.runId });
    expect(await t.run(async (ctx) => (await ctx.db.query("tickets").collect()).length)).toBe(ticketsBefore + 1);

    await asUser.mutation(api.approvals.reject, { approvalId: reply._id, reason: "Will call instead" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 500);
    expect(await outbound(threadId)).toEqual([]);
  });

  test("a rejected ticket is never created", async () => {
    mock.agentTurns = [toolCall("create_ticket", TICKET), toolCall("draft_reply", DRAFT)];
    const threadId = await simulate();
    const ticket = (await approvalsFor(threadId)).find((a) => a.action === "create_ticket")!;
    const before = await t.run(async (ctx) => (await ctx.db.query("tickets").collect()).length);

    await asUser.mutation(api.approvals.reject, { approvalId: ticket._id, reason: "Duplicate" });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 500);
    expect(await t.run(async (ctx) => (await ctx.db.query("tickets").collect()).length)).toBe(before);
  });

  test("a decision counts once; double clicks and bad edits are refused", async () => {
    mock.agentTurns = [toolCall("draft_reply", DRAFT)];
    const threadId = await simulate();
    const [approval] = await approvalsFor(threadId);

    await expect(
      asUser.mutation(api.approvals.approveEdited, { approvalId: approval._id, payload: { subject: "x", body: " " } }),
    ).rejects.toThrow(/The reply is empty/);
    await expect(asUser.mutation(api.approvals.reject, { approvalId: approval._id, reason: "" })).rejects.toThrow(
      /Give a short reason/,
    );
    await asUser.mutation(api.approvals.approve, { approvalId: approval._id });
    await expect(asUser.mutation(api.approvals.approve, { approvalId: approval._id })).rejects.toThrow(
      /already decided/,
    );
    await expect(t.mutation(api.approvals.approve, { approvalId: approval._id })).rejects.toThrow(
      /Not authenticated/,
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers, 500);
    expect(await outbound(threadId)).toHaveLength(1);
  });

  test("an escalated run asks for nothing", async () => {
    mock.agentTurns = [toolCall("escalate_to_human", { reason: "Legal threat" })];
    const threadId = await simulate();
    expect(await approvalsFor(threadId)).toEqual([]);
    expect((await latestRun(threadId)).run.status).toBe("escalated");
  });
});
