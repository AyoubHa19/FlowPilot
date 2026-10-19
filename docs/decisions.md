# Decisions

One short entry per technical choice, newest last.

## Stage 0 — Setup

- **Convex Auth with the Password provider.** One login method is enough for a
  single-user MVP and needs no OAuth app. GitHub login can be added later as a
  second provider.
- **Convex Auth's Next.js integration (server provider + `src/proxy.ts`).** The
  auth cookie lets the proxy redirect signed-out visitors before the page
  renders. The proxy is only an optimistic check; the real boundary is
  `requireUserId` in every Convex function.
- **Cache Components turned off.** `create-next-app` enables it by default, but
  the dashboard reads live data from Convex subscriptions on the client, so
  there is nothing to cache on the server and it would force every
  cookie-reading layout behind `<Suspense>`.
- **Auth signing keys generated locally and stored as Convex env vars**
  (`JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`), never in the repo.
- **Convex prod is deployed by the Vercel build** (`vercel.json`:
  `npx convex deploy --cmd 'npm run build'`), so frontend and backend always
  ship together from the same commit. Vercel only holds `CONVEX_DEPLOY_KEY`.

## Stage 1 — Property data

- **Upserts by natural key** (building name, building + unit label, tenant
  email, tenant + unit + lease start, unit + ticket description) live in
  `convex/model/properties.ts`. The seed uses them now and the CSV import will
  in Stage 2, so running either twice never creates duplicates.
- **No `by_building` index on units.** `by_building_label` starts with
  `buildingId`, so a prefix query on it already lists a building's units.
  Same for tickets: `by_unit_status` replaces `by_unit` and also answers
  "open tickets for this unit", which the agent needs in Stage 5. Each extra
  index costs a write on every insert and patch.
- **Rent in integer cents, dates as ISO strings.** No floating-point money
  errors; ISO dates sort correctly as strings and carry no timezone.
- **Emails are normalised to lowercase on write and on lookup**, so
  `Felix.Braun@…` and `felix.braun@…` are the same tenant, with one index read.
- **Deterministic seed data written by hand, no faker.** Same output every
  run (the idempotency test depends on it) and nothing large in the Convex
  bundle.
- **Ids from the URL are validated with `normalizeId`.** A bad link shows
  "not found" instead of throwing a validator error.
- **Develop locally, deploy once in Stage 7.** Vercel builds kept failing and
  each retry cost time without moving a stage forward, so auto-deploys are off
  (`git.deploymentEnabled: false`) and every stage is built and tested against
  the Convex dev deployment. The production deploy is part of Stage 7.
- **Dashboard pages are client components on Convex subscriptions**
  (`useQuery`, `usePaginatedQuery`): data updates live and every list is
  paginated from the start.

## Stage 2 — Bulk import

- **One flat CSV, one row per unit** (building + unit + tenant + optional
  lease). It matches how property managers export from other tools, and the
  natural keys make every row an independent upsert.
- **Pipeline: upload → parse action → Workpool batches of 100 rows.** The
  browser uploads straight to Convex storage. A scheduled action parses the
  file with Papa Parse and queues one mutation per batch on the `importPool`
  Workpool (`maxParallelism: 4`, under the free plan's 20). Each batch is a
  transaction, so a batch is applied fully or not at all and counters never
  drift.
- **Running counters on `importJobs`** (`processed`, `failed`, `created`,
  `total`): the progress bar subscribes to one document. The job completes
  when `processed + failed === total`.
- **Bad rows are data, not exceptions.** Each row is validated with zod; a
  failure inserts an `importRowErrors` row (line number, message, raw row) and
  the batch moves on. A batch that fails as a whole is caught by a Workpool
  `onComplete` handler and its rows are counted as failed, so a job can never
  hang at 99%.
- **`importRowErrors` is its own table**, not an array on the job: a file with
  thousands of bad rows would hit Convex's 1 MB document limit. The report is
  downloaded page by page and rebuilt as a CSV in the browser.
- **Upserts skip unchanged rows** (`hasChanges`). A re-import writes nothing,
  and parallel batches stop conflicting on the building row they all read.
  Measured: 10,000 rows in 114s first time, 107s re-import, 0 new rows.
- **Parsing in memory, not streamed.** 10,000 rows is 1.6 MB; the upload limit
  is 20 MB, well inside an action's memory. Streaming would be the next step
  for much larger files.
- **Downloaded CSVs start with a UTF-8 BOM** so Excel shows umlauts; the
  importer trims header names, which strips it again.

## Stage 3 — Documents and knowledge base

- **`tenantId` is copied onto every chunk.** Convex vector search filters only
  on fields of the indexed table, so the tenant has to live on the chunk. The
  filter runs inside the index: a search for tenant A cannot return tenant B's
  lease, even with an identical vector (tested). This is the PRD privacy rule
  enforced by the data model, not by prompt instructions.
- **One Workpool job per PDF on its own `documentPool`** (`maxParallelism: 3`).
  A separate pool means a 10,000-row import never delays documents, and the
  low parallelism keeps us inside Gemini's free-tier rate limit. Jobs retry 3
  times with exponential backoff; unreadable or scanned PDFs throw a
  `NonRetryableError` so they fail fast with a clear reason.
- **Processing is idempotent.** A run reclaims any non-ready document and
  deletes earlier chunks before writing new ones, so a retry or a
  `documents:reindex` never duplicates chunks.
- **PDF text in a Node action (`"use node"`)** with unpdf, as the PRD planned;
  everything else stays in the default runtime.
- **Chunking by sentences, not characters.** The first version cut at every
  dot and overlapped by raw characters: "EUR 2,175.00" was split and chunks
  began mid-sentence, so "notice period" ranked the tail of the section first.
  The fix: unwrap PDF lines, treat short unpunctuated lines as section
  headings, split only at a real sentence end, pack whole sentences into
  800-character chunks and overlap by whole sentences (150 chars). The
  notice-period section now lands whole in one chunk and ranks first.
- **`gemini-embedding-2` at 768 dimensions**, with `RETRIEVAL_DOCUMENT` /
  `RETRIEVAL_QUERY` task types (asymmetric retrieval). 768 instead of 3072
  cuts storage and index size by 4x for a negligible quality loss at this
  scale. Model and size are constants in `model/embeddings.ts`; changing them
  means updating the vector index and running `documents:reindex`.
- **Link by filename (`lease-<email>.pdf`) or by hand.** The email is the
  tenant's natural key, so no ids leak into filenames; files that do not match
  stay "Unlinked" and can be linked from the table.
- **Sample leases vary per tenant** (rent, dates, pets, parking), so the search
  test proves it returns *that* tenant's clause: "Can I keep a dog?" returns
  "may keep one dog and one cat" for Anna and "no dogs or cats" for Felix.

## Stage 4 — Email in and out

- **OAuth through Convex HTTP actions, not Next.js routes.** The redirect URI
  is the Convex site URL (`…convex.site/gmail/oauth/callback`), which is HTTPS
  even in local development, so Google accepts it and the client secret never
  touches the frontend. A one-time `state` row (10-minute expiry, single use)
  protects the callback against CSRF.
- **One scope: `gmail.modify`.** It covers reading and sending, which is all
  the MVP needs; the app stays in Google's Testing mode with one test user, so
  no verification is required. Trade-off: refresh tokens expire after ~7 days,
  handled by a "Reconnect Gmail" state and the simulate-email form.
- **Tokens encrypted at rest** with AES-256-GCM (Web Crypto) and a key in the
  Convex environment. A leaked database export alone cannot read the inbox. No
  public query returns tokens.
- **Polling with the history API, not Pub/Sub push.** A one-minute cron (about
  43,000 runs a month, inside the free tier) asks Gmail only for messages added
  since the stored `historyId`. Push would need a public Pub/Sub topic and
  webhook verification; the PRD's "within a minute" goal does not need it. A
  lock on the account row stops overlapping runs; a stale cursor falls back to
  the last two days of inbox.
- **Dedupe on `gmailMessageId`** (index + a check inside the ingest
  transaction), so overlapping or repeated syncs store each message once.
- **Plain text only.** text/plain is preferred; HTML-only mail is converted to
  text on ingest and the HTML is discarded, so the dashboard never renders
  email HTML (PRD security rule) and the agent gets clean text.
- **Replies stay in the thread** by sending with the Gmail `threadId` plus
  `In-Reply-To` / `References` from the tenant's last message. Header values
  are stripped of newlines (no header injection) and subjects are RFC 2047
  encoded for umlauts.
- **Sending is never retried blindly.** The outbound row is written first
  ("sending"), then the action sends once. Only a 429 is retried, because a
  5xx or dropped connection may already have delivered the mail and a retry
  would send it twice. Failures stay visible on the message.
- **Simulated threads share the real pipeline** (same ingest, threading and
  tenant linking) but never call Gmail, so demos work even when OAuth expired.

## Stage 5 — Agent engine

- **Convex Workflow, one step per LLM call and per tool call.** Each step's
  result is journaled, so a retry (or a server restart) re-runs only the step
  that failed. A forced failure of `search_lease_documents` shows as
  "retried ×1" and the run still finishes (tested, and checked live).
- **The model proposes, the workflow executes.** `generateText` runs with tool
  definitions but no `execute`: it returns tool calls, and the workflow runs
  each one as its own retryable step. Retries live in the workflow
  (`maxRetries: 0` on the SDK), so every retry is visible in the timeline
  instead of hidden inside the SDK.
- **Context first, without the LLM.** After classification, the workflow looks
  up tenant, lease, open tickets and lease passages with the same tools, and
  hands them to the model in the first prompt. Most emails then need a single
  model turn (one `draft_reply` call), which keeps runs at ~$0.002.
- **Privacy is enforced in the tools, not the prompt.** No tool accepts a
  tenant id. Every lookup is bound to the email's sender (`RunScope`):
  `find_tenant_by_email` refuses any other address, and lease search is
  filtered by the sender's tenant inside the vector index. An unknown sender
  gets nothing (tested with a model that actively asks for another tenant).
- **zod on every tool input, errors back to the model.** Invalid input is
  returned as a tool error the model can correct, not thrown.
- **Guardrails:** at most 8 tool calls and a 40k-token cap per run; either
  escalates the conversation to a person (`needs_human`).
- **Two models.** Classification uses `gemini-3.5-flash-lite` (cheap, fast,
  structured output); the agent uses `gemini-3.8-flash` with low thinking.
  During testing 3.8 Flash returned "high demand" errors and calls of 40–75s,
  which broke the "under a minute" goal. Each call now has a 20s timeout, and a
  retried agent step uses the Flash-Lite fallback: the run finished in 32s with
  attempt 1 cut off and the fallback answering in 2s. The step records which
  model answered.
- **Cost is logged at paid list prices** (constants in `model/llm.ts`, source
  and date in the comment) even on the free tier, so cost per run is real.
- **Automated mail never reaches the LLM.** Newsletters and notifications
  (no-reply senders, Gmail Promotions/Social/Updates, `List-Unsubscribe`,
  `Precedence: bulk`) are recorded as skipped runs.
- **Prompts are versioned TypeScript files** (`convex/prompts/`). Each run
  stores `promptVersion` and `model`. v2 added "mention an open ticket that
  already covers the problem" after a draft ignored one; v3 localized the
  sign-off after a German draft ended in English.
- **Tests drive the real workflow with a scripted mock model**
  (`MockLanguageModelV4`), so retries, fallback, tool limits, the token cap and
  the privacy rules are tested without calling Gemini.
