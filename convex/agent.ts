import { vResultValidator, vWorkflowId } from "@convex-dev/workflow";
import { generateText, type JSONValue, type ModelMessage, Output, type ToolResultPart } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { agentStepStatus, agentStepType, emailCategory, urgency } from "./lib/validators";
import { STEP_RETRY, workflow } from "./lib/workflow";
import { executeTool, type RunScope, toolSetForModel } from "./model/agentTools";
import {
  AGENT_PROVIDER_OPTIONS,
  agentModelFor,
  CLASSIFIER_MODEL,
  classifierModel,
  costUsd,
  LLM_TIMEOUT_MS,
  MAX_TOOL_CALLS,
  TOKEN_CAP_PER_RUN,
} from "./model/llm";
import { normalizeEmail } from "./model/properties";
import { agentSystemPrompt, agentUserPrompt } from "./prompts/agent";
import { CLASSIFY_SYSTEM, classifyPrompt } from "./prompts/classify";

const MAX_LOGGED_CHARS = 4_000;

const classificationSchema = z.object({
  category: z.enum(["repair", "payment", "lease_question", "move_in_out", "complaint", "other"]),
  urgency: z.enum(["low", "medium", "high", "urgent"]),
  language: z.string().min(2).max(8),
  summary: z.string().min(3).max(300),
});
type Classification = z.infer<typeof classificationSchema>;

function logged(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 1);
  return text.length > MAX_LOGGED_CHARS ? `${text.slice(0, MAX_LOGGED_CHARS)}…` : text;
}

/** Convex values cannot hold undefined; model messages sometimes do. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// --- The durable run -------------------------------------------------------

/**
 * One inbound email → one run. Every LLM call and every tool call is its own
 * workflow step: the result is journaled, so a crash or a retry re-runs only
 * the step that failed, never the ones that already succeeded.
 */
export const runAgent = workflow.define({
  args: { runId: v.id("agentRuns") },
  handler: async (step, { runId }) => {
    const start = await step.runMutation(internal.agent.markRunning, { runId });
    let index = 0;

    // 1. Classify (small model, structured output).
    const classification: Classification = await step.runAction(
      internal.agent.classify,
      { runId, stepIndex: index++ },
      { retry: STEP_RETRY },
    );

    // 2. Gather context with the same sender-scoped tools, no LLM involved.
    const lookup = async (toolName: string, input: unknown) =>
      (
        await step.runAction(
          internal.agent.runTool,
          { runId, stepIndex: index++, toolName, input },
          { retry: STEP_RETRY },
        )
      ).output;
    const context: Record<string, unknown> = {
      tenant: await lookup("find_tenant_by_email", { email: start.senderEmail }),
    };
    if (start.tenantKnown) {
      context.lease = await lookup("get_lease", {});
      context.openTickets = await lookup("list_open_tickets", {});
      context.leasePassages = await lookup("search_lease_documents", {
        query: classification.summary,
      });
    }

    // 3. Act: the model drafts, calling at most MAX_TOOL_CALLS tools.
    let messages: ModelMessage[] = [
      {
        role: "user",
        content: agentUserPrompt({ email: start.email, classification, context }),
      },
    ];
    let toolCalls = 0;
    for (;;) {
      const turn = await step.runAction(
        internal.agent.llmTurn,
        { runId, stepIndex: index++, messages, language: classification.language },
        { retry: STEP_RETRY },
      );
      if (turn.overBudget) {
        await step.runMutation(internal.agent.escalate, {
          runId,
          reason: `Token cap of ${TOKEN_CAP_PER_RUN} reached`,
        });
        break;
      }
      messages = [...messages, ...turn.responseMessages];
      if (turn.toolCalls.length === 0) {
        // The model answered in plain text instead of calling draft_reply.
        await step.runMutation(internal.agent.saveDraft, {
          runId,
          draft: { subject: `Re: ${start.email.subject}`, body: turn.text || "(empty)" },
        });
        break;
      }

      let finished = false;
      const results: ToolResultPart[] = [];
      for (const call of turn.toolCalls) {
        if (toolCalls >= MAX_TOOL_CALLS) {
          await step.runMutation(internal.agent.escalate, {
            runId,
            reason: `Tool call limit of ${MAX_TOOL_CALLS} reached without a draft`,
          });
          finished = true;
          break;
        }
        toolCalls += 1;
        const result = await step.runAction(
          internal.agent.runTool,
          { runId, stepIndex: index++, toolName: call.toolName, input: call.input, counted: true },
          { retry: STEP_RETRY },
        );
        results.push({
          type: "tool-result",
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          // runTool returns JSON-serialized output, so this is a JSON value.
          output: { type: "json", value: (result.output ?? null) as JSONValue },
        });
        if (result.terminal) {
          finished = true;
          break;
        }
      }
      if (finished) break;
      messages = [...messages, { role: "tool", content: results }];
    }

    await step.runMutation(internal.agent.finishRun, { runId });
  },
});

/** Records a crashed workflow (all retries used) on the run. */
export const workflowDone = internalMutation({
  args: { workflowId: vWorkflowId, result: vResultValidator, context: v.object({ runId: v.id("agentRuns") }) },
  handler: async (ctx, { result, context }) => {
    if (result.kind === "success") return;
    const run = await ctx.db.get(context.runId);
    if (!run || run.finishedAt) return;
    await ctx.db.patch(context.runId, {
      status: "failed",
      error: result.kind === "failed" ? result.error : "Run was canceled",
      finishedAt: Date.now(),
    });
  },
});

// --- Steps -----------------------------------------------------------------

export const classify = internalAction({
  args: { runId: v.id("agentRuns"), stepIndex: v.number() },
  handler: async (ctx, { runId, stepIndex }): Promise<Classification> => {
    const { email } = await ctx.runQuery(internal.agent.runInput, { runId });
    const prompt = classifyPrompt(email);
    await ctx.runMutation(internal.agent.startStep, {
      runId, index: stepIndex, type: "llm", name: "classify", input: logged(prompt),
    });
    const startedAt = Date.now();
    try {
      const result = await generateText({
        model: classifierModel(),
        system: CLASSIFY_SYSTEM,
        prompt,
        output: Output.object({ schema: classificationSchema }),
        // Retries belong to the workflow step, where they are logged.
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });
      const classification = classificationSchema.parse(result.output);
      const tokensIn = result.usage.inputTokens ?? 0;
      const tokensOut = result.usage.outputTokens ?? 0;
      await ctx.runMutation(internal.agent.finishStep, {
        runId, index: stepIndex, status: "succeeded", output: logged(classification),
        durationMs: Date.now() - startedAt, tokensIn, tokensOut,
        costUsd: costUsd(CLASSIFIER_MODEL, tokensIn, tokensOut),
      });
      await ctx.runMutation(internal.agent.setClassification, { runId, ...classification });
      return classification;
    } catch (error) {
      await ctx.runMutation(internal.agent.finishStep, {
        runId, index: stepIndex, status: "failed", error: String(error), durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  },
});

export const llmTurn = internalAction({
  args: {
    runId: v.id("agentRuns"),
    stepIndex: v.number(),
    messages: v.array(v.any()),
    language: v.string(),
  },
  handler: async (ctx, { runId, stepIndex, messages, language }) => {
    const { tokensUsed } = await ctx.runQuery(internal.agent.runInput, { runId });
    if (tokensUsed >= TOKEN_CAP_PER_RUN) {
      return { overBudget: true, responseMessages: [], toolCalls: [], text: "" };
    }
    const attempt = await ctx.runMutation(internal.agent.startStep, {
      runId, index: stepIndex, type: "llm", name: "agent", input: logged(messages.at(-1)),
    });
    const { id: modelId, model } = agentModelFor(attempt);
    const startedAt = Date.now();
    try {
      const result = await generateText({
        model,
        system: agentSystemPrompt(language),
        messages: messages as ModelMessage[],
        tools: toolSetForModel(),
        providerOptions: AGENT_PROVIDER_OPTIONS,
        // Retries belong to the workflow step (logged, with a fallback model).
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });
      const toolCalls = result.toolCalls.map((c) => ({
        toolCallId: c.toolCallId,
        toolName: c.toolName,
        input: plain(c.input ?? {}),
      }));
      const tokensIn = result.usage.inputTokens ?? 0;
      const tokensOut = result.usage.outputTokens ?? 0;
      await ctx.runMutation(internal.agent.finishStep, {
        runId, index: stepIndex, status: "succeeded",
        output: logged({
          model: modelId,
          result: toolCalls.length ? toolCalls.map((c) => ({ tool: c.toolName, input: c.input })) : result.text,
        }),
        durationMs: Date.now() - startedAt, tokensIn, tokensOut,
        costUsd: costUsd(modelId, tokensIn, tokensOut),
      });
      return {
        overBudget: false,
        // Keeps provider metadata (e.g. Gemini thought signatures) for the next turn.
        responseMessages: plain(result.response.messages),
        toolCalls,
        text: result.text,
      };
    } catch (error) {
      await ctx.runMutation(internal.agent.finishStep, {
        runId, index: stepIndex, status: "failed", error: String(error), durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  },
});

/**
 * Runs one tool call: zod-validated input, sender-scoped handler, logged as
 * a step. Throwing makes the workflow retry this step only.
 */
export const runTool = internalAction({
  args: {
    runId: v.id("agentRuns"),
    stepIndex: v.number(),
    toolName: v.string(),
    input: v.any(),
    counted: v.optional(v.boolean()),
  },
  handler: async (ctx, { runId, stepIndex, toolName, input, counted }) => {
    const { scope, failToolOnce } = await ctx.runQuery(internal.agent.runInput, { runId });
    const attempt = await ctx.runMutation(internal.agent.startStep, {
      runId, index: stepIndex, type: "tool", name: toolName, toolName, input: logged(input ?? {}),
    });
    const startedAt = Date.now();
    try {
      if (failToolOnce === toolName && attempt === 1) {
        throw new Error(`Injected failure for testing (${toolName}, attempt 1)`);
      }
      const result = await executeTool(ctx, scope, toolName, input);
      await ctx.runMutation(internal.agent.finishStep, {
        runId, index: stepIndex, status: "succeeded", output: logged(result.output),
        durationMs: Date.now() - startedAt, countToolCall: counted === true,
      });
      return { output: plain(result.output ?? null), terminal: result.terminal };
    } catch (error) {
      await ctx.runMutation(internal.agent.finishStep, {
        runId, index: stepIndex, status: "failed",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  },
});

// --- Run state -------------------------------------------------------------

/** Everything a step needs about its run, read fresh on every attempt. */
export const runInput = internalQuery({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    const run = (await ctx.db.get(runId))!;
    const message = (await ctx.db.get(run.messageId))!;
    const scope: RunScope = {
      runId,
      threadId: run.threadId,
      senderEmail: normalizeEmail(message.fromEmail),
      tenantId: run.tenantId,
    };
    return {
      scope,
      failToolOnce: run.failToolOnce,
      tokensUsed: run.tokensIn + run.tokensOut,
      email: { from: message.from, subject: message.subject, body: message.bodyText.slice(0, 20_000) },
    };
  },
});

export const markRunning = internalMutation({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    const run = (await ctx.db.get(runId))!;
    const message = (await ctx.db.get(run.messageId))!;
    await ctx.db.patch(runId, { status: "running" });
    return {
      senderEmail: message.fromEmail,
      tenantKnown: run.tenantId !== undefined,
      email: { from: message.from, subject: message.subject, body: message.bodyText.slice(0, 20_000) },
    };
  },
});

/** Creates the step row, or bumps the attempt when the step is retried. */
export const startStep = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    index: v.number(),
    type: agentStepType,
    name: v.string(),
    toolName: v.optional(v.string()),
    input: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agentSteps")
      .withIndex("by_run_index", (q) => q.eq("runId", args.runId).eq("index", args.index))
      .unique();
    if (existing) {
      const attempt = existing.attempt + 1;
      await ctx.db.patch(existing._id, { status: "running", attempt, startedAt: Date.now() });
      return attempt;
    }
    await ctx.db.insert("agentSteps", { ...args, status: "running", attempt: 1, startedAt: Date.now() });
    return 1;
  },
});

export const finishStep = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    index: v.number(),
    status: agentStepStatus,
    output: v.optional(v.string()),
    error: v.optional(v.string()),
    durationMs: v.number(),
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    countToolCall: v.optional(v.boolean()),
  },
  handler: async (ctx, { runId, index, countToolCall, ...result }) => {
    const step = await ctx.db
      .query("agentSteps")
      .withIndex("by_run_index", (q) => q.eq("runId", runId).eq("index", index))
      .unique();
    if (step) {
      // A success keeps the last failure's message, so retries stay visible.
      await ctx.db.patch(step._id, { ...result, error: result.error ?? step.error });
    }
    // Tokens are spent on every attempt, failed or not.
    const run = (await ctx.db.get(runId))!;
    await ctx.db.patch(runId, {
      tokensIn: run.tokensIn + (result.tokensIn ?? 0),
      tokensOut: run.tokensOut + (result.tokensOut ?? 0),
      costUsd: run.costUsd + (result.costUsd ?? 0),
      toolCalls: run.toolCalls + (countToolCall ? 1 : 0),
    });
  },
});

export const setClassification = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    category: emailCategory,
    urgency,
    language: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, { runId, ...classification }) => {
    await ctx.db.patch(runId, classification);
  },
});

export const saveDraft = internalMutation({
  args: { runId: v.id("agentRuns"), draft: v.object({ subject: v.string(), body: v.string() }) },
  handler: async (ctx, { runId, draft }) => {
    await ctx.db.patch(runId, { draft });
  },
});

export const escalate = internalMutation({
  args: { runId: v.id("agentRuns"), reason: v.string() },
  handler: async (ctx, { runId, reason }) => {
    const run = (await ctx.db.get(runId))!;
    await ctx.db.patch(runId, { escalationReason: reason });
    await ctx.db.patch(run.threadId, { status: "needs_human" });
  },
});

export const finishRun = internalMutation({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    const run = (await ctx.db.get(runId))!;
    await ctx.db.patch(runId, {
      status: run.escalationReason ? "escalated" : run.draft ? "drafted" : "failed",
      ...(!run.escalationReason && !run.draft && { error: "Finished without a draft" }),
      finishedAt: Date.now(),
    });
  },
});

// --- Read-only data for tools (all by index) -------------------------------

export const tenantProfile = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
      .unique();
    if (!tenant) return null;
    const unit = tenant.unitId ? await ctx.db.get(tenant.unitId) : null;
    const building = unit ? await ctx.db.get(unit.buildingId) : null;
    return {
      found: true,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone ?? null,
      unit: unit && { label: unit.label, floor: unit.floor, sizeSqm: unit.sizeSqm },
      building: building && { name: building.name, address: building.address },
    };
  },
});

export const activeLease = internalQuery({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const leases = await ctx.db
      .query("leases")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();
    const lease = leases.find((l) => l.status === "active");
    return (
      lease && {
        startDate: lease.startDate,
        endDate: lease.endDate ?? null,
        monthlyRentEur: lease.rentCents / 100,
        noticePeriodDays: lease.noticePeriodDays,
        status: lease.status,
      }
    );
  },
});

export const openTickets = internalQuery({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const tenant = await ctx.db.get(tenantId);
    if (!tenant?.unitId) return [];
    const unitId = tenant.unitId;
    const open = await ctx.db
      .query("tickets")
      .withIndex("by_unit_status", (q) => q.eq("unitId", unitId).eq("status", "open"))
      .collect();
    const inProgress = await ctx.db
      .query("tickets")
      .withIndex("by_unit_status", (q) => q.eq("unitId", unitId).eq("status", "in_progress"))
      .collect();
    return [...open, ...inProgress].map((t) => ({
      category: t.category,
      priority: t.priority,
      status: t.status,
      description: t.description,
      openedAt: new Date(t._creationTime).toISOString().slice(0, 10),
    }));
  },
});

// --- Dashboard -------------------------------------------------------------

/** The latest run for a thread, with its steps in order. */
export const runForThread = query({
  args: { threadId: v.id("emailThreads") },
  handler: async (ctx, { threadId }) => {
    await requireUserId(ctx);
    const run = await ctx.db
      .query("agentRuns")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("desc")
      .first();
    if (!run) return null;
    const steps = await ctx.db
      .query("agentSteps")
      .withIndex("by_run_index", (q) => q.eq("runId", run._id))
      .collect();
    const { failToolOnce: _f, workflowId: _w, ...visible } = run;
    return { run: visible, steps };
  },
});
