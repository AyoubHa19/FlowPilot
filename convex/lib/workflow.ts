import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "../_generated/api";

// Agent runs. Low parallelism keeps concurrent Gemini calls inside the free
// tier's rate limits; steps retry with backoff when they are throttled.
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: { maxParallelism: 2 },
});

/** PRD guardrail: LLM and tool calls retry 3 times with exponential backoff. */
export const STEP_RETRY = { maxAttempts: 4, initialBackoffMs: 2_000, base: 2 };
