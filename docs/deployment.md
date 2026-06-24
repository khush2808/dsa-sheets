# Deployment and Environments

## Surfaces

This repo deploys to two frontend surfaces.

| Surface | Source | Build | Output | Purpose |
| --- | --- | --- | --- | --- |
| GitHub Pages | root static app | `npm run build` | `dist-static/` | Static public site |
| Vercel | `next-app/` | `npm run build:next` | `next-app/out/` | Next.js static export |

Both surfaces use the same Supabase project and the same public auth/progress tables.

## Local Environment

Create a root `.env` file. It is ignored and must stay local.

```sh
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Accepted aliases:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ANON_KEY`

Do not put service-role keys, OAuth client secrets, access tokens, or database passwords in frontend code.

## GitHub Pages

Workflow:

```txt
.github/workflows/pages.yml
```

Required repository secrets:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Build flow:

1. `npm ci`
2. `npm run build`
3. `scripts/create-supabase-config.mjs` writes `assets/supabase-config.js`.
4. `scripts/stage-static-site.mjs` copies root static files into `dist-static/`.
5. GitHub uploads `dist-static/` as the Pages artifact.

`dist-static/` is generated and ignored. Do not commit it.

## Vercel

Config:

```txt
vercel.json
```

Required Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Build flow:

1. Vercel runs `npm run build:next`.
2. `scripts/create-next-env.mjs` writes ignored `next-app/.env.local` for Next.
3. `next build` exports the static app into `next-app/out`.
4. Vercel serves `next-app/out`.

`next-app/.next/`, `next-app/out/`, and `next-app/.env.local` are generated/ignored. Do not commit them.

## Supabase

Project files:

- `supabase/config.toml`
- `supabase/migrations/*.sql`

Apply migrations:

```sh
supabase db push
```

Check migration state:

```sh
supabase migration list
```

Run security advisors:

```sh
supabase db advisors --type security --linked
```

The current project includes migrations for progress/notes tables and for removing an old `SECURITY DEFINER` helper function (`public.rls_auto_enable`).

## OAuth Redirects

OAuth provider secrets live in Supabase and provider dashboards, not in this repo. Configure redirect URLs for:

- local static dev, usually `http://localhost:5173/**`
- local Next dev, usually `http://localhost:3000/**`
- GitHub Pages production URL
- Vercel production URL
- any custom domain

See [OAuth Setup](./oauth-setup.md).

## Pre-Ship Checks

Run:

```sh
npm run build:next
npm run build
npm run validate
```

Then restore spreadsheet noise if exports were not intentionally changed:

```sh
git restore -- sheets/*.xlsx
```

For UI or auth changes, smoke a representative route such as `/neetcode-150/` in both the static app and the Next app when practical.

To preview the staged GitHub Pages artifact:

```sh
python3 -m http.server 4178 --bind 127.0.0.1 --directory dist-static
```
