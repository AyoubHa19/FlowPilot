# FlowPilot AI

An email agent for property managers. It reads tenant emails, looks up the
tenant, unit and lease, drafts a reply or a repair ticket, and waits for a human
to approve before anything is sent.

Built with Next.js, Convex, Convex Auth, shadcn/ui and Gemini.

> Live demo: https://flow-pilot-rose.vercel.app
>
> Status: Stage 1 (property data) done. Architecture, schema, decisions and eval results
> will be documented here as the stages land.

## Run locally

```bash
npm install
npx convex dev          # first run: log in and create a dev deployment
npm run dev             # http://localhost:3000
```

Convex Auth needs `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL` on the deployment;
see the [Convex Auth manual setup](https://labs.convex.dev/auth/setup/manual).

See [docs/decisions.md](docs/decisions.md) for the reasoning behind each choice.

## Deploy

Vercel builds with `npx convex deploy --cmd 'npm run build'` (see `vercel.json`):
each production build pushes the Convex functions to the production deployment
and injects `NEXT_PUBLIC_CONVEX_URL`. Vercel needs one env var,
`CONVEX_DEPLOY_KEY` (a production deploy key from the Convex dashboard).

After the first deploy, set the Convex Auth keys on production once:

```bash
npx @convex-dev/auth --prod --web-server-url https://<your-app>.vercel.app
```
