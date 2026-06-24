# DSA Sheets

DSA Sheets is a curated problem browser with two deployable frontends backed by the same static data and Supabase user-progress database.

- **GitHub Pages/static app**: root HTML routes plus `assets/app.js`.
- **Vercel/Next app**: `next-app/`, statically exported to `next-app/out`.
- **Supabase**: Auth, Postgres, and RLS for signed-in progress and notes.
- **Local-first UX**: anonymous usage stores progress in `localStorage`; signed-in usage merges local records with Supabase.

## Routes

- `strivers-a2z-sheet` - Striver A2Z
- `striver-450-sheet` - alias to Striver A2Z
- `blind-75-sheet` - takeUforward Blind 75 Sheet
- `sde-sheet` - Striver SDE Sheet
- `striver-79-sheet` - Striver 79
- `neetcode-all` - NeetCode All
- `neetcode-250` - NeetCode 250
- `neetcode-150` - NeetCode 150
- `blind-75` - NeetCode Blind 75

## Repository Layout

- `assets/` - legacy/static app JavaScript and CSS used by GitHub Pages.
- Root route folders such as `neetcode-150/` - static app HTML entrypoints.
- `next-app/` - Next.js implementation used by Vercel.
- `data/` - checked-in JSON extracts used by both apps and Excel generation.
- `sheets/` - checked-in Excel exports generated from `data/`.
- `scripts/` - extract, export, env generation, and static staging scripts.
- `supabase/` - Supabase config and migrations.
- `.github/workflows/pages.yml` - GitHub Pages deployment.
- `vercel.json` - Vercel build/output configuration.
- `docs/` - project knowledge base for future agents.

Generated/local-only paths are ignored: `dist-static/`, `next-app/.next/`, `next-app/out/`, `.env`, `next-app/.env.local`, `supabase/.temp/`, and `node_modules/`.

## Local Setup

Install dependencies:

```sh
npm install
```

Create `.env` locally with the public Supabase values:

```sh
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

The publishable key is safe for browser code. Do not commit service-role keys, provider secrets, tokens, or `.env` files.

## Common Commands

- `npm run dev` - start the root static app with Vite.
- `npm run dev:next` - generate `next-app/.env.local` and start Next.js.
- `npm run preview` - Vite preview helper.
- `npm run build` - generate `assets/supabase-config.js` and stage GitHub Pages output in `dist-static/`.
- `npm run build:next` - generate `next-app/.env.local` and static-export the Next app to `next-app/out`.
- `npm run extract:tuf` - refresh takeUforward JSON extracts.
- `npm run excel` - regenerate Excel exports in `sheets/`.
- `npm run validate` - syntax-check scripts and regenerate Excel exports.

`npm run validate` may rewrite `.xlsx` files. Restore spreadsheet noise with `git restore -- sheets/*.xlsx` unless the exports intentionally changed.

To preview the staged GitHub Pages artifact after `npm run build`:

```sh
python3 -m http.server 4178 --bind 127.0.0.1 --directory dist-static
```

## Deployment

GitHub Pages:

1. `.github/workflows/pages.yml` runs on `main`.
2. The workflow runs `npm ci` and `npm run build`.
3. `dist-static/` is uploaded as the Pages artifact.
4. Required secrets: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.

Vercel:

1. `vercel.json` runs `npm run build:next`.
2. Vercel serves `next-app/out`.
3. Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Supabase:

- Apply migrations in `supabase/migrations/` with `supabase db push`.
- Configure redirect URLs and OAuth providers in the Supabase dashboard.
- See [docs/oauth-setup.md](./docs/oauth-setup.md).

## More Detail

Start with [docs/README.md](./docs/README.md) for architecture, deployment, data flow, and auth/backend notes.
