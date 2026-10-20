import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "../_generated/api";

// Agent runs. The pool also runs the workflows' own bookkeeping steps, so 2
// slots starved 30 concurrent eval runs (43 steps in 16 minutes). 5 keeps runs
// moving; concurrent Gemini calls stay bounded because real email arrives a
// few at a time and the eval runner sends cases in small waves.
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: { maxParallelism: 5 },
});

/** PRD guardrail: LLM and tool calls retry 3 times with exponential backoff. */
export const STEP_RETRY = { maxAttempts: 4, initialBackoffMs: 2_000, base: 2 };
