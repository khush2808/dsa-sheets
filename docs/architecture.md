# Architecture

## Overview

DSA Sheets has two frontend implementations that share the same problem data and Supabase backend.

```txt
data/*.json + sheets/*.xlsx
        |
        +-- root static app -> GitHub Pages -> dist-static/
        |
        +-- next-app/ -> Vercel -> next-app/out/
        |
        +-- Supabase Auth + Postgres/RLS for signed-in progress and notes
```

The root static app is older, but it is still the GitHub Pages production path. The Next.js app is newer and is the Vercel path. Keep both deployable until the owner explicitly chooses a single frontend.

## Root Static App

Runtime files:

- `index.html` - landing page.
- Route folders such as `neetcode-150/` and `strivers-a2z-sheet/`.
- `assets/app.js` - route UI, auth, local-first progress, Supabase sync, notes, filters.
- `assets/app.css` - route styling.
- `assets/landing.css` - landing page styling.
- `assets/supabase-config.js` - generated public Supabase browser config.

Each route folder defines `window.SHEET_CONFIG`, then loads shared assets:

```html
<script src="../assets/supabase-config.js?v=1"></script>
<script src="../assets/app.js?v=14"></script>
```

When changing `assets/app.js` or `assets/app.css`, bump route asset query strings if browser cache invalidation matters.

GitHub Pages deployment does not serve the repo root directly. `npm run build` stages the static app into `dist-static/` using `scripts/stage-static-site.mjs`, and the Pages workflow uploads that directory.

## Next.js App

Runtime files:

- `next-app/app/page.jsx` - Next landing page.
- `next-app/app/[sheet]/page.jsx` - generated sheet routes.
- `next-app/components/SheetApp.jsx` - interactive client app.
- `next-app/lib/progress.js` - local/Supabase progress adapters and merge logic.
- `next-app/lib/sheets.js` - sheet metadata.
- `next-app/app/styles.css` - Next app styling.

`next-app/next.config.mjs` uses `output: 'export'`, so Vercel serves a static export from `next-app/out`. Browser code talks directly to Supabase with the publishable key and RLS policies.

## Progress Storage

Anonymous/local cache uses:

```txt
dsaSheetProblemProgress:v1
```

Stable problem IDs are generated from sheet type plus the strongest available problem identifier:

```js
[type, problem_id || code || leetcode_slug || slug(problem_name)].join(':')
```

Record shape:

```json
{
  "neetcode:0217-contains-duplicate": {
    "completed": true,
    "notes": [
      {
        "id": "note-1781792213883",
        "text": "Retry sliding window",
        "createdAt": "2026-06-18T14:16:53.883Z",
        "updatedAt": "2026-06-18T14:16:53.914Z"
      }
    ],
    "noteTombstones": {
      "note-1781792213883": "2026-06-18T15:00:00.000Z"
    },
    "updatedAt": "2026-06-18T15:00:00.000Z"
  }
}
```

`noteTombstones` preserve offline/local deletions so old remote notes do not reappear on the next merge.

## Supabase Runtime

Supabase stores signed-in data in:

- `public.user_problem_progress`
- `public.user_problem_notes`

Both tables have RLS policies that restrict access to `auth.uid() = user_id`. The frontend uses direct Supabase client calls; there are currently no custom API routes for progress.

## Organization Notes

Safe cleanup:

- Delete ignored build outputs: `dist-static/`, `next-app/.next/`, `next-app/out/`.
- Delete local junk: `.DS_Store`, empty temp files.
- Restore `sheets/*.xlsx` after validation unless data changed intentionally.

Risky moves:

- Moving root route folders or `assets/` will break GitHub Pages unless `scripts/stage-static-site.mjs`, route HTML, docs, and smoke tests are updated together.
- Moving `data/` affects the static app, Next app, and Excel generation.
- Moving `sheets/` affects GitHub Pages downloads and docs.
