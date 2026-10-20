/** Matches provider errors that clear up by waiting (rate limits, overload). */
const TRANSIENT = /429|rate.?limit|quota|resource.?exhausted|high demand|overloaded|unavailable|503|abort/i;

type StepLike = { status: string; attempt: number; error?: string };

/**
 * While a run is active, a failed step (or a step on its second attempt or
 * later) means the workflow is backing off before retrying it. Returns the
 * message to show, or null when nothing is waiting.
 */
export function retryNotice(runActive: boolean, steps: StepLike[]): string | null {
  if (!runActive) return null;
  const last = steps.at(-1);
  if (!last) return null;
  const retrying = last.status === "failed" || (last.status === "running" && last.attempt > 1);
  if (!retrying || !last.error) return null;
  return TRANSIENT.test(last.error)
    ? "Gemini is busy (rate limit or high demand). The step is retried automatically with backoff."
    : "A step failed and is being retried automatically.";
}
