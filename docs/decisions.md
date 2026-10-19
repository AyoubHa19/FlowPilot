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
