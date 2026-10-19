# FlowPilot AI

Email agent for property managers: reads tenant emails, looks up tenant, unit and
lease, drafts a reply or repair ticket, and waits for human approval before
anything is sent. Full spec: `FlowPilot AI — PRD.pdf`.

@AGENTS.md

## Current stage

**Local only until Stage 7.** Build and test against the Convex dev deployment
(`next-iguana-657`) and `npm run dev`. Do not deploy to Vercel or Convex prod,
and do not seed prod. Vercel auto-deploys are off in `vercel.json`; turn them
back on in Stage 7.

- Stage 0: Setup — done (an early Stage 0 build is still on Vercel and
  Convex prod `amicable-raccoon-556`; both are stale).
- **Stage 1: Property data — done.** Schema, idempotent seed, buildings /
  building detail / tenant detail pages, tenant lookup by email.
- **Stage 2: Bulk import — done.** CSV upload → parse action → 100-row
  batches on the `importPool` Workpool → live counters on `importJobs`.
  10,000 rows import in ~2 min; re-import adds nothing.
- **Stage 3: Documents and knowledge base — done.** PDF upload → `documentPool`
  Workpool → Node action (unpdf → chunkText → Gemini `gemini-embedding-2`,
  768 dims) → `docChunks` with a vector index filtered by `tenantId`.
  50 PDFs process in ~40s; search is tenant-scoped.
- **Stage 4: Email in and out — done.** Gmail OAuth via Convex HTTP actions
  (test inbox bnaybir1@gmail.com, Google Cloud project `dacc-512019`, Testing
  mode), encrypted tokens, minute cron sync on the history API, dedupe by
  gmailMessageId, tenant linking, replies in the same Gmail thread, and a
  simulate-email form for demos.
- Next: **Stage 5: Agent engine.**

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
                    documents, inbox, gmail)
  documentsNode.ts  "use node" PDF processing action (unpdf)
  http.ts           Convex Auth routes + /gmail/oauth/callback
  crons.ts          gmail inbox sync, every minute
  convex.config.ts  components: importPool, documentPool (Workpool)
  lib/              auth helper (requireUserId), validators, crypto (AES-GCM tokens)
  model/            plain functions: upserts, CSV row schema, chunker,
                    embeddings (Gemini), vector search, Gmail REST client,
                    MIME parse/build, inbox ingest
  seed.ts           internal seed mutation (data in seedData.ts)
  *.test.ts         convex-test unit tests (modules via test.setup.ts)
  _generated/       written by `npx convex dev`, never edit
scripts/            node scripts writing test data to samples/ (gitignored)
src/app/            Next.js routes: /signin, (dashboard)/inbox, /inbox/[id], /buildings,
                    /tenants/[id], /imports, /documents
src/components/     app components; ui/ is shadcn (generated, edit sparingly)
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
```

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
- Small commits, one per feature.
