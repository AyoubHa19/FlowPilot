# FlowPilot AI

An email agent for property managers. It reads tenant emails, looks up the
tenant, unit and lease, drafts a reply or a repair ticket, and waits for a human
to approve before anything is sent.

Built with Next.js, Convex, Convex Auth, shadcn/ui and Gemini.

> Status: Stage 0 (setup). Architecture, schema, decisions and eval results
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
