import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

// Pinned model ids (not "-latest" aliases) so eval results are reproducible.
// Switching provider (e.g. to Claude) means changing these two factories.
export const AGENT_MODEL = "gemini-3.8-flash";
export const CLASSIFIER_MODEL = "gemini-3.5-flash-lite";
/**
 * Used when the agent step is retried: under "high demand" errors the main
 * model can stay overloaded for minutes, and a run should still finish in
 * about a minute (PRD success criterion).
 */
export const AGENT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

/** A call slower than this is aborted and retried by the workflow step. */
export const LLM_TIMEOUT_MS = 20_000;

/** Low thinking: enough for tool use, and output tokens include thinking. */
export const AGENT_PROVIDER_OPTIONS = {
  google: { thinkingConfig: { thinkingLevel: "low" as const } },
};

/** The main model on a first attempt, the fallback on retries. */
export function agentModelFor(attempt: number): { id: string; model: LanguageModel } {
  const id = attempt > 1 ? AGENT_FALLBACK_MODEL : AGENT_MODEL;
  return { id, model: google(id) };
}

export function classifierModel(): LanguageModel {
  return google(CLASSIFIER_MODEL);
}

// Paid-tier list prices in USD per 1M tokens, from
// https://ai.google.dev/gemini-api/docs/pricing (checked 2026-10-19; the
// 3.8 Flash price doubles on 2027-01-01). The free tier costs nothing; we
// log what the run would cost on the paid tier.
const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
};

export function costUsd(model: string, tokensIn: number, tokensOut: number) {
  const price = PRICES[model];
  if (!price) return 0;
  return (tokensIn * price.input + tokensOut * price.output) / 1_000_000;
}

/** Hard ceiling per run (all LLM calls); over it, the run escalates. */
export const TOKEN_CAP_PER_RUN = 40_000;
/** Tool calls the model may make in the act loop (PRD: at most 8). */
export const MAX_TOOL_CALLS = 8;
