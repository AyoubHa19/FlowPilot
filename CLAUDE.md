# FlowPilot AI

Email agent for property managers: reads tenant emails, looks up tenant, unit and
lease, drafts a reply or repair ticket, and waits for human approval before
anything is sent. Full spec: `FlowPilot AI — PRD.pdf`.

@AGENTS.md

## Current stage

**Stage 7: deploy.** Everything else is built and tested against the Convex
dev deployment (`next-iguana-657`). Production is Convex `amicable-raccoon-556`
and Vercel. Prod env vars are set and Vercel git deploys are on: every push
to `main` deploys Convex prod and the site (the user sets prod secrets; never
print them).

- Stages 0–6 — done: property data, CSV import (Workpool), lease PDFs with
  tenant-scoped vector search, Gmail in/out, the durable agent workflow,
  approvals with awaitEvent and the live run timeline.
- **Stage 7 — done except the deploy.** 32-case eval (97% pass, prompt
  `agent-v5`), safety emergencies (`flag_emergency` + safety draft), sign-up
  allowlist and owner/demo roles (`requireOwner`), dark-only glass design with
  the mouse-revealed glyph background (`components/cursor-field.tsx`), the
  FlowPilot identity (envelope-and-flight-path logo, signal lime, Instrument
  Serif titles) and the landing page with the scroll story
  (`components/landing/`).
- Left: Convex prod env vars, Google redirect URI for prod, Vercel env vars,
  deploy, seed prod, demo account, video, public repo.

Work one stage at a time. Do not start a stage until every "Done when" box of
the previous one is ticked. Add one entry to `docs/decisions.md` per stage.

## Stack

- Next.js 16 (App Router, `src/`), React 19, Tailwind v4, shadcn/ui (base-nova, Base UI)
- Convex: queries, mutations, actions, crons, file storage, vector search
- Convex Workpool (imports, Stage 2) and Workflow (agent runs, Stage 5) components
- Convex Auth, Password provider
- Vercel AI SDK + Google Gemini (LLM and embeddings, from Stage 3/5)
- Gmail API (Stage 4), unpdf, Papa Parse, zod, Vitest + convex-test

## Folder layout

```
convex/             backend: schema, public functions (buildings, tenants, imports,
                    documents, inbox, gmail, agent)
  agent.ts          agent workflow (runAgent), steps, run logging, runTimeline
  approvals.ts      approval queue, decide (approve/edit/reject), execute
  prompts/          versioned prompts (classify.ts, agent.ts with PROMPT_VERSION)
  documentsNode.ts  "use node" PDF processing action (unpdf)
  http.ts           Convex Auth routes + /gmail/oauth/callback
  crons.ts          gmail inbox sync, every minute
  convex.config.ts  components: importPool, documentPool (Workpool), workflow
  lib/              auth, validators, crypto (AES-GCM tokens), workflow manager
  model/            plain functions: upserts, CSV row schema, chunker,
                    embeddings, vector search, Gmail client, MIME, inbox
                    ingest, llm (models, prices), agentTools (tool registry),
                    agentRuns (start run, automated-mail filter)
  seed.ts           internal seed mutation (data in seedData.ts)
  *.test.ts         convex-test unit tests (modules via test.setup.ts)
  _generated/       written by `npx convex dev`, never edit
scripts/            node scripts writing test data to samples/ (gitignored)
src/app/            Next.js routes: / (landing), /signin, (dashboard)/home, /inbox, /inbox/[id], /approvals, /runs,
                    /runs/[id], /buildings, /tenants/[id], /imports, /documents
src/components/     app components; ui/ is shadcn (generated, edit sparingly);
                    landing/ is the landing page; app-shell/ the sidebar layout and logo
src/lib/            format.ts (cents → €, ISO dates), time.ts (x ago), download.ts
src/proxy.ts        Next 16 "proxy" (formerly middleware): optimistic auth redirects
docs/decisions.md   one short entry per technical choice
```

## Commands

```
npm run dev:backend   # convex dev: push functions + codegen, watch
npm run dev           # next dev on :3000
npm run typecheck     # next typegen + tsc for app and convex/
npm run lint
npm test              # vitest + convex-test
npm run build
npx convex run seed:run   # idempotent demo data (dev deployment)
npm run generate:import-csv -- --rows 10000 --broken 3   # test CSV in samples/
npm run generate:lease-pdfs -- --count 50               # lease PDFs in samples/leases/
npx convex run documents:reindex   # re-chunk + re-embed all documents
npm run eval                       # 30-case eval on dev (real Gemini), updates README table
npm run eval -- --only <id,id>     # a few cases, no README update
npx convex run evals:cancelBatch '{"batchId":"b…"}'   # stop an aborted eval
```

Evals: cases in `evals/emails.json`, scoring in `evals/score.ts` (unit tested),
runner `scripts/run-evals.ts`. Eval threads have `eval: true` (hidden from the
inbox) and eval runs `mode: "eval"` (stop after the draft; proposals get status
"eval", never pending). Don't edit `convex/` while an eval runs: the dev
watcher deploys immediately. After a prompt change, bump `PROMPT_VERSION` and
rerun the eval.

Secrets on the Convex dev deployment: `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini),
`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` (Gmail OAuth client),
`TOKEN_ENCRYPTION_KEY` (32 bytes base64, encrypts Gmail tokens), plus the
Convex Auth keys. Never print their values.

The Gmail OAuth app is in Testing mode, so Google expires the refresh token
after ~7 days: the inbox card then shows "Reconnect Gmail". Simulated threads
(`simulated: true`) never call Gmail.

On this Windows checkout the Next.js dev server sometimes misses edits to
components rendered by the `(dashboard)` layout (e.g. `dashboard-nav.tsx`) and
serves a stale server render, which shows up as a hydration mismatch. Restart
`npm run dev` when that happens; production builds are not affected.

## Rules

- Strict TypeScript; no `any`.
- Validate every input: Convex validators on every function, zod on every form,
  tool input and import row.
- Every public query and mutation calls `requireUserId(ctx)` first.
- Every lookup goes through an index; no full table scans; paginate long lists.
- Money is integer cents (`rentCents`); dates are ISO `YYYY-MM-DD` strings.
- Emails are stored lowercase; look tenants up with `findTenantByEmail`.
- Ids from URLs are `v.string()` + `ctx.db.normalizeId`, returning null when invalid.
- Secrets only in Convex environment variables (`npx convex env set`), never in
  code or committed files.
- Never render email HTML raw.
- Agent tools never take a tenant id from the model; they are bound to the
  run's sender (`RunScope`). New tools go in `model/agentTools.ts` with a zod
  schema and a `requiresApproval` flag.
- A side-effect tool's handler only calls `proposeAction`; the effect itself
  runs in `approvals.execute` after a person approved. Never send email or
  write tenant data from a tool handler.
- Changing a prompt: bump `PROMPT_VERSION` in `convex/prompts/agent.ts`.
- Agent tests mock the model with `MockLanguageModelV4` via `vi.mock("./model/llm")`
  (see `convex/agent.test.ts`); never call Gemini from tests.
- Small commits, one per feature.
