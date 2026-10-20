// Scores agent runs against the eval set. Pure functions: no I/O.

export type Action = "reply" | "reply+ticket" | "escalate";

export type EvalCase = {
  id: string;
  fromEmail: string;
  fromName?: string;
  subject: string;
  body: string;
  expected: {
    category: string | string[];
    /** One action, or a list of acceptable ones. */
    action: Action | Action[];
    language: string;
    urgency?: string;
    /** Each group: at least one phrase must appear in the reply. */
    mustIncludeAny?: string[][];
    /** None of these may appear in the reply. */
    mustNotInclude?: string[];
  };
  note?: string;
};

/** One row of `evals:batchResults`. */
export type RunResult = {
  caseId: string;
  status: string;
  category: string | null;
  urgency: string | null;
  language: string | null;
  draft: { subject: string; body: string } | null;
  escalationReason: string | null;
  tickets: unknown[];
  toolCalls: number;
  retries: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  draftReadyMs: number | null;
  model: string;
  promptVersion: string;
  error: string | null;
};

type Check = "category" | "action" | "language" | "facts" | "privacy" | "urgency";
export const CHECKS: Check[] = ["category", "action", "language", "facts", "privacy", "urgency"];

export type CaseScore = {
  id: string;
  passed: boolean;
  /** null = not applicable to this case. */
  checks: Record<Check, boolean | null>;
  actual: { category: string | null; action: Action | "none"; language: string | null; urgency: string | null };
  failures: string[];
};

export function actionOf(run: RunResult): Action | "none" {
  // An emergency both alerts a person and drafts safety steps: still "escalate".
  if (run.status === "escalated" || run.escalationReason) return "escalate";
  if (!run.draft) return "none";
  return run.tickets.length > 0 ? "reply+ticket" : "reply";
}

function contains(text: string, phrase: string) {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

export function scoreCase(c: EvalCase, run: RunResult | undefined): CaseScore {
  if (!run) {
    return {
      id: c.id,
      passed: false,
      checks: { category: false, action: false, language: false, facts: null, privacy: null, urgency: null },
      actual: { category: null, action: "none", language: null, urgency: null },
      failures: ["no run found"],
    };
  }
  const e = c.expected;
  const reply = run.draft ? `${run.draft.subject}\n${run.draft.body}` : "";
  const action = actionOf(run);
  const categories = Array.isArray(e.category) ? e.category : [e.category];
  const actions: string[] = Array.isArray(e.action) ? e.action : [e.action];
  const failures: string[] = [];

  const checks: Record<Check, boolean | null> = {
    category: run.category !== null && categories.includes(run.category),
    action: actions.includes(action),
    language: run.language?.toLowerCase().startsWith(e.language) ?? false,
    facts: e.mustIncludeAny ? e.mustIncludeAny.every((group) => group.some((p) => contains(reply, p))) : null,
    // An escalation writes no reply, so it cannot leak anything.
    privacy: e.mustNotInclude ? !e.mustNotInclude.some((p) => contains(reply, p)) : null,
    urgency: e.urgency ? run.urgency === e.urgency : null,
  };

  if (!checks.category) failures.push(`category ${run.category} ≠ ${categories.join("|")}`);
  if (!checks.action) failures.push(`action ${action} ≠ ${actions.join("|")}`);
  if (!checks.language) failures.push(`language ${run.language} ≠ ${e.language}`);
  if (checks.facts === false) {
    const missing = e.mustIncludeAny!.filter((g) => !g.some((p) => contains(reply, p)));
    failures.push(`missing ${missing.map((g) => `"${g[0]}"`).join(", ")}`);
  }
  if (checks.privacy === false) {
    failures.push(`LEAK: ${e.mustNotInclude!.filter((p) => contains(reply, p)).join(", ")}`);
  }
  if (checks.urgency === false) failures.push(`urgency ${run.urgency} ≠ ${e.urgency}`);
  if (run.error) failures.push(`error: ${run.error}`);

  return {
    id: c.id,
    passed: CHECKS.every((k) => checks[k] !== false),
    checks,
    actual: { category: run.category, action, language: run.language, urgency: run.urgency },
    failures,
  };
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function summarize(cases: EvalCase[], runs: RunResult[]) {
  const byId = new Map(runs.map((r) => [r.caseId, r]));
  const scores = cases.map((c) => scoreCase(c, byId.get(c.id)));
  const accuracy = Object.fromEntries(
    CHECKS.map((k) => {
      const applicable = scores.filter((s) => s.checks[k] !== null);
      const correct = applicable.filter((s) => s.checks[k] === true).length;
      return [k, { correct, total: applicable.length }];
    }),
  ) as Record<Check, { correct: number; total: number }>;
  const times = runs.map((r) => r.draftReadyMs).filter((t): t is number => t !== null);
  const cost = runs.reduce((sum, r) => sum + r.costUsd, 0);
  return {
    passed: scores.filter((s) => s.passed).length,
    total: cases.length,
    accuracy,
    costUsd: { total: cost, perRun: runs.length ? cost / runs.length : 0 },
    tokens: {
      in: runs.reduce((sum, r) => sum + r.tokensIn, 0),
      out: runs.reduce((sum, r) => sum + r.tokensOut, 0),
    },
    draftReadyMs: { p50: percentile(times, 50), p95: percentile(times, 95) },
    retries: runs.reduce((sum, r) => sum + r.retries, 0),
    model: runs[0]?.model ?? null,
    promptVersion: runs[0]?.promptVersion ?? null,
    scores,
  };
}

export type Summary = ReturnType<typeof summarize>;

const pct = (a: { correct: number; total: number }) =>
  a.total === 0 ? "n/a" : `${Math.round((a.correct / a.total) * 100)}% (${a.correct}/${a.total})`;

/** The table that goes into the README. */
export function toMarkdown(summary: Summary, date: string) {
  const a = summary.accuracy;
  const seconds = (ms: number | null) => (ms === null ? "n/a" : `${(ms / 1000).toFixed(1)}s`);
  const lines = [
    `Eval run ${date} · ${summary.total} emails · model \`${summary.model}\` · prompt \`${summary.promptVersion}\``,
    "",
    "| Metric | Result |",
    "|---|---|",
    `| All checks passed | ${pct({ correct: summary.passed, total: summary.total })} |`,
    `| Category | ${pct(a.category)} |`,
    `| Action (reply / reply + ticket / escalate) | ${pct(a.action)} |`,
    `| Reply language = email language | ${pct(a.language)} |`,
    `| Facts from the lease in the reply | ${pct(a.facts)} |`,
    `| Privacy (no data leaked to unknown senders) | ${pct(a.privacy)} |`,
    `| Urgency (safety cases) | ${pct(a.urgency)} |`,
    `| Time to draft, p50 / p95 | ${seconds(summary.draftReadyMs.p50)} / ${seconds(summary.draftReadyMs.p95)} |`,
    `| Cost per run (paid-tier prices) | $${summary.costUsd.perRun.toFixed(4)} |`,
    `| Step retries | ${summary.retries} |`,
  ];
  const failed = summary.scores.filter((s) => !s.passed);
  if (failed.length > 0) {
    lines.push("", "Failed cases:", "");
    for (const s of failed) lines.push(`- \`${s.id}\`: ${s.failures.join("; ")}`);
  }
  return lines.join("\n");
}
