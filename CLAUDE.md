# FlowPilot AI

Email agent for property managers: reads tenant emails, looks up tenant, unit and
lease, drafts a reply or repair ticket, and waits for human approval before
anything is sent. Full spec: `FlowPilot AI — PRD.pdf`.

@AGENTS.md

## Current stage

**Stage 0: Setup** — app, Convex and Convex Auth (password) work locally.
Still open in Stage 0: GitHub repo, Vercel deploy, Convex production deploy,
login on the deployed URL.

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
convex/             backend: schema, functions, auth
  lib/              shared helpers (requireUserId, ...)
  _generated/       written by `npx convex dev`, never edit
src/app/            Next.js routes (/, /signin)
src/components/     app components; ui/ is shadcn (generated, edit sparingly)
src/proxy.ts        Next 16 "proxy" (formerly middleware): optimistic auth redirects
docs/decisions.md   one short entry per technical choice
```

## Commands

```
npm run dev:backend   # convex dev: push functions + codegen, watch
npm run dev           # next dev on :3000
npm run typecheck     # next typegen + tsc for app and convex/
npm run lint
npm run build
```

## Rules

- Strict TypeScript; no `any`.
- Validate every input: Convex validators on every function, zod on every form,
  tool input and import row.
- Every public query and mutation calls `requireUserId(ctx)` first.
- Every lookup goes through an index; no full table scans; paginate long lists.
- Secrets only in Convex environment variables (`npx convex env set`), never in
  code or committed files.
- Never render email HTML raw.
- Small commits, one per feature.
