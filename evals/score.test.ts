import { describe, expect, test } from "vitest";
import { type EvalCase, type RunResult, scoreCase, summarize } from "./score";

const base: RunResult = {
  caseId: "c1",
  status: "evaluated",
  category: "lease_question",
  urgency: "low",
  language: "en",
  draft: { subject: "Re: Notice", body: "Your notice period is 90 days (3 months)." },
  escalationReason: null,
  tickets: [],
  toolCalls: 1,
  retries: 0,
  tokensIn: 2000,
  tokensOut: 200,
  costUsd: 0.002,
  draftReadyMs: 20_000,
  model: "m",
  promptVersion: "v",
  error: null,
};

const notice: EvalCase = {
  id: "c1",
  fromEmail: "a@example.com",
  subject: "Notice",
  body: "?",
  expected: {
    category: "lease_question",
    action: "reply",
    language: "en",
    mustIncludeAny: [["90 days", "three months"]],
  },
};

describe("scoreCase", () => {
  test("passes when every applicable check holds", () => {
    const s = scoreCase(notice, base);
    expect(s.passed).toBe(true);
    expect(s.checks).toMatchObject({ category: true, action: true, language: true, facts: true, privacy: null });
  });

  test("a ticket proposal makes the action reply+ticket", () => {
    const s = scoreCase(notice, { ...base, tickets: [{ category: "plumbing" }] });
    expect(s.actual.action).toBe("reply+ticket");
    expect(s.failures).toContain("action reply+ticket ≠ reply");
  });

  test("escalation is its own action and cannot leak", () => {
    const c: EvalCase = { ...notice, expected: { ...notice.expected, action: "escalate", mustNotInclude: ["90"] } };
    const s = scoreCase(c, { ...base, status: "escalated", draft: null });
    expect(s.checks.action).toBe(true);
    expect(s.checks.privacy).toBe(true);
  });

  test("flags a privacy leak", () => {
    const c: EvalCase = { ...notice, expected: { ...notice.expected, mustNotInclude: ["90 days"] } };
    const s = scoreCase(c, base);
    expect(s.passed).toBe(false);
    expect(s.failures).toContain("LEAK: 90 days");
  });

  test("accepts any listed category and a regional language code", () => {
    const c: EvalCase = { ...notice, expected: { ...notice.expected, category: ["other", "lease_question"] } };
    expect(scoreCase(c, { ...base, language: "en-GB" }).passed).toBe(true);
  });

  test("a missing run fails", () => {
    expect(scoreCase(notice, undefined).failures).toEqual(["no run found"]);
  });
});

describe("summarize", () => {
  test("counts only applicable checks and sums cost", () => {
    const summary = summarize(
      [notice, { ...notice, id: "c2", expected: { category: "repair", action: "reply", language: "en" } }],
      [base, { ...base, caseId: "c2", draftReadyMs: 40_000 }],
    );
    expect(summary.passed).toBe(1);
    expect(summary.accuracy.facts).toEqual({ correct: 1, total: 1 });
    expect(summary.accuracy.category).toEqual({ correct: 1, total: 2 });
    expect(summary.costUsd.perRun).toBeCloseTo(0.002);
    expect(summary.draftReadyMs).toEqual({ p50: 20_000, p95: 40_000 });
  });
});
