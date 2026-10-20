// Runs the eval set through the real agent on the Convex dev deployment and
// scores the results.
//
//   npm run eval                       # all 30 cases
//   npm run eval -- --only repair-tap-en,lease-notice-en
//
// Writes evals/results/latest.json and evals/results/latest.md (the table in
// the README). Uses Gemini: about $0.002 per case at paid-tier prices, free on
// the free tier.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { type EvalCase, type RunResult, summarize, toMarkdown } from "../evals/score.ts";

const POLL_MS = 10_000;
const TIMEOUT_MS = 40 * 60_000;

const { values } = parseArgs({
  options: { only: { type: "string" }, concurrency: { type: "string" } },
});
const all: EvalCase[] = JSON.parse(readFileSync("evals/emails.json", "utf8")).cases;
const only = values.only?.split(",").map((s) => s.trim());
const cases = only ? all.filter((c) => only.includes(c.id)) : all;
if (cases.length === 0) throw new Error("No cases selected");

const cli = join("node_modules", "convex", "bin", "main.js");
function convexRun<T>(fn: string, args: unknown): T {
  const out = execFileSync(process.execPath, [cli, "run", fn, JSON.stringify(args)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 50 * 1024 * 1024,
  });
  return JSON.parse(out) as T;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Cases go in small waves, like real mail arriving a few at a time. Sending
// all 30 at once starved the workflow pool and Gemini's free-tier rate limit,
// which measured the queue instead of the agent.
const concurrency = Number(values.concurrency ?? 3);
const batchId = `b${Date.now()}`;
console.log(`Eval batch ${batchId}: ${cases.length} cases, ${concurrency} at a time`);

const started = Date.now();
let submitted = 0;
for (let i = 0; i < cases.length; i += concurrency) {
  const wave = cases.slice(i, i + concurrency);
  convexRun("evals:startBatch", {
    batchId,
    cases: wave.map(({ id, fromEmail, fromName, subject, body }) => ({ id, fromEmail, fromName, subject, body })),
  });
  submitted += wave.length;
  for (;;) {
    await sleep(POLL_MS);
    const { finished } = convexRun<{ total: number; finished: number }>("evals:batchProgress", { batchId });
    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`  ${finished}/${cases.length} finished · ${elapsed}s`);
    if (finished >= submitted) break;
    if (Date.now() - started > TIMEOUT_MS) break;
  }
  if (Date.now() - started > TIMEOUT_MS) {
    console.log("  timed out; scoring what finished");
    break;
  }
}

const runs = convexRun<RunResult[]>("evals:batchResults", { batchId });
const summary = summarize(cases, runs);
const date = new Date().toISOString().slice(0, 10);
const markdown = toMarkdown(summary, date);

mkdirSync("evals/results", { recursive: true });
writeFileSync(
  "evals/results/latest.json",
  JSON.stringify({ batchId, date, ...summary, runs }, null, 2) + "\n",
);
writeFileSync("evals/results/latest.md", markdown + "\n");

// A full run updates the table in the README between the EVAL markers.
if (!only) {
  const readme = readFileSync("README.md", "utf8");
  const updated = readme.replace(
    /<!-- EVAL:START -->[\s\S]*<!-- EVAL:END -->/,
    `<!-- EVAL:START -->\n${markdown}\n<!-- EVAL:END -->`,
  );
  writeFileSync("README.md", updated);
}

console.log("\n" + markdown);
console.log("\nPer case:");
for (const s of summary.scores) {
  console.log(`  ${s.passed ? "PASS" : "FAIL"}  ${s.id.padEnd(28)} ${s.failures.join("; ")}`);
}
