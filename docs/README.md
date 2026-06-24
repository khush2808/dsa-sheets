# Project Knowledge Base

This folder is the durable working memory for DSA Sheets. It should help future agents understand, verify, and deploy the project without asking the owner to reconstruct context.

## Start Here

- [Architecture](./architecture.md) - current app surfaces, runtime state, storage model, and safe organization notes.
- [Deployment and Environments](./deployment.md) - GitHub Pages, Vercel, Supabase, env vars, and deployment checks.
- [Data Flow](./data-flow.md) - JSON extracts, route data, Excel exports, and validation behavior.
- [Auth and Backend](./auth-backend-plan.md) - current Supabase schema, RLS, sync behavior, and future backend notes.
- [OAuth Setup](./oauth-setup.md) - dashboard steps for Google, GitHub, Email, and redirect URLs.

## Current Direction

The project intentionally has two frontends for now:

- The **legacy static app** in `old/static/` is the GitHub Pages production source.
- The **Next.js app** in `next-app/` is the Vercel path and the likely long-term frontend.

Keep both working until the owner explicitly decides to retire one. Do not move `old/static/` paths again unless `scripts/stage-static-site.mjs`, route URLs, docs, and deployment smoke tests are updated in the same change.

## Safe Defaults

- Keep `.env`, `next-app/.env.local`, `supabase/.temp/`, tokens, and service keys uncommitted.
- Treat `dist-static/`, `next-app/.next/`, and `next-app/out/` as disposable build outputs.
- Treat `sheets/*.xlsx` as generated but checked-in deliverables; restore them after validation unless data exports intentionally changed.
- Run `npm run build:next`, `npm run build`, and `npm run validate` before shipping structural changes.
