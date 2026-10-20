import type { WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { workflow } from "./lib/workflow";
import { ingestMessage } from "./model/inbox";

// Eval harness (Stage 7). Driven from the CLI by scripts/run-evals.ts:
//   npx convex run evals:startBatch / evals:batchProgress / evals:batchResults
// Eval emails run through the real pipeline (ingest → workflow → Gemini) but
// are hidden from the inbox and never reach the approval queue.

const caseValidator = v.object({
  id: v.string(),
  fromEmail: v.string(),
  fromName: v.optional(v.string()),
  subject: v.string(),
  body: v.string(),
});

/** Ingests every case as a simulated eval email; each starts an agent run. */
export const startBatch = internalMutation({
  args: { batchId: v.string(), cases: v.array(caseValidator) },
  handler: async (ctx, { batchId, cases }) => {
    for (const c of cases) {
      const key = `eval-${batchId}-${c.id}`;
      await ingestMessage(ctx, {
        gmailMessageId: key,
        gmailThreadId: key,
        direction: "inbound",
        from: c.fromName ? `${c.fromName} <${c.fromEmail}>` : c.fromEmail,
        to: "inbox@flowpilot.demo",
        subject: c.subject,
        bodyText: c.body,
        rfcMessageId: `<${key}@flowpilot.eval>`,
        receivedAt: Date.now(),
        simulated: true,
        evalCase: { batchId, caseId: c.id },
      });
    }
    return cases.length;
  },
});

const FINISHED = new Set(["evaluated", "escalated", "failed", "skipped", "completed", "rejected"]);

/** Stops every unfinished run of a batch (e.g. an aborted eval). */
export const cancelBatch = internalMutation({
  args: { batchId: v.string() },
  handler: async (ctx, { batchId }) => {
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_eval_batch", (q) => q.eq("evalBatchId", batchId))
      .collect();
    let canceled = 0;
    for (const run of runs) {
      if (FINISHED.has(run.status) || !run.workflowId) continue;
      await workflow.cancel(ctx, run.workflowId as WorkflowId);
      await ctx.db.patch(run._id, { status: "failed", error: "Eval batch canceled", finishedAt: Date.now() });
      canceled += 1;
    }
    return canceled;
  },
});

export const batchProgress = internalQuery({
  args: { batchId: v.string() },
  handler: async (ctx, { batchId }) => {
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_eval_batch", (q) => q.eq("evalBatchId", batchId))
      .collect();
    return { total: runs.length, finished: runs.filter((r) => FINISHED.has(r.status)).length };
  },
});

/** Everything the scorer needs, one row per case. */
export const batchResults = internalQuery({
  args: { batchId: v.string() },
  handler: async (ctx, { batchId }) => {
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_eval_batch", (q) => q.eq("evalBatchId", batchId))
      .collect();
    return await Promise.all(
      runs.map(async (run) => {
        const proposals = await ctx.db
          .query("approvals")
          .withIndex("by_run", (q) => q.eq("runId", run._id))
          .collect();
        const steps = await ctx.db
          .query("agentSteps")
          .withIndex("by_run_index", (q) => q.eq("runId", run._id))
          .collect();
        // Time until the draft (or escalation) existed: the last LLM/tool step.
        const work = steps.filter((s) => s.type !== "approval");
        const lastStep = work.at(-1);
        const draftReadyMs = lastStep ? lastStep.startedAt + (lastStep.durationMs ?? 0) - run.startedAt : null;
        return {
          caseId: run.evalCaseId!,
          status: run.status,
          category: run.category ?? null,
          urgency: run.urgency ?? null,
          language: run.language ?? null,
          draft: run.draft ?? null,
          escalationReason: run.escalationReason ?? null,
          tickets: proposals.filter((p) => p.action === "create_ticket").map((p) => p.payload),
          toolCalls: run.toolCalls,
          retries: steps.reduce((sum, s) => sum + (s.attempt - 1), 0),
          tokensIn: run.tokensIn,
          tokensOut: run.tokensOut,
          costUsd: run.costUsd,
          draftReadyMs,
          model: run.model,
          promptVersion: run.promptVersion,
          error: run.error ?? null,
        };
      }),
    );
  },
});
