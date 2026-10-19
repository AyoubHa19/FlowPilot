# FlowPilot AI

Email agent for property managers: reads tenant emails, looks up tenant, unit and
lease, drafts a reply or repair ticket, and waits for human approval before
anything is sent. Full spec: `FlowPilot AI — PRD.pdf`.

@AGENTS.md

## Current stage

Live at https://flow-pilot-rose.vercel.app (Vercel) with Convex prod
`amicable-raccoon-556`.

- Stage 0: Setup — done.
- **Stage 1: Property data — done.** Schema, idempotent seed, buildings /
  building detail / tenant detail pages, tenant lookup by email.
- Next: **Stage 2: Bulk import.** Reuse the upserts in `convex/model/properties.ts`.

Work one stage at a time. Do not start a stage until every "Done when" box of
the previous one is ticked. Add one entry to `docs/decisions.md` per stage.

## Stack

- Next.js 16 (App Router, `src/`), React 19, Tailwind v4, shadcn/ui (base-nova, Base UI)
- Convex: queries, mutations, actions, crons, file storage, vector search
- Convex Workflow + Workpool components for durable jobs (from Stage 2)
- Convex Auth, Password provider
- Vercel AI SDK + Google Gemini (LLM and embeddings, from Stage 3/5)
- Gmail API (Stage 4), unpdf, Papa Parse, zod, Vitest + convex-test

## Folder layout

```
convex/             backend: schema, public functions (buildings.ts, tenants.ts, ...)
  lib/              auth helper (requireUserId), shared validators
  model/            plain functions on ctx: natural-key upserts, lookups
  seed.ts           internal seed mutation (data in seedData.ts)
  *.test.ts         convex-test unit tests (modules via test.setup.ts)
  _generated/       written by `npx convex dev`, never edit
src/app/            Next.js routes: /signin, (dashboard)/buildings, /tenants/[id]
src/components/     app components; ui/ is shadcn (generated, edit sparingly)
src/lib/format.ts   money (cents → €) and ISO date formatting
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
```

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
