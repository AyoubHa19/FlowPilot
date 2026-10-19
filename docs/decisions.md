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
