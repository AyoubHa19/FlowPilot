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
- **Dashboard pages are client components on Convex subscriptions**
  (`useQuery`, `usePaginatedQuery`): data updates live and every list is
  paginated from the start.
