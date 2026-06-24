# Architecture

## What This Project Is

DSA Sheets is a static multi-page browser for curated DSA problem lists. It serves:

- a landing page at `index.html`
- one route folder per sheet, for example `neetcode-150/` and `strivers-a2z-sheet/`
- shared UI behavior in `assets/app.js`
- shared route styling in `assets/app.css`
- landing page styling in `assets/landing.css`
- extracted JSON problem data in `data/`
- generated Excel exports in `sheets/`

Vite serves the repository root as a static site during local development.

## Important Runtime Pieces

Each sheet route defines `window.SHEET_CONFIG` in its `index.html`. The shared script reads that config to load the right JSON file and render the route.

The shared app currently owns:

- search
- category/pattern filtering
- difficulty filtering
- NeetCode Pro filtering
- theme toggle
- link target preference
- Google problem search links
- problem completion checkmarks
- section completion checkmarks
- notes per problem
- completed-section animation

## Data Model Today

Static problem data comes from JSON files:

- TUF/Striver-like problems usually have `problem_id`
- NeetCode problems usually have `code` and `leetcode_slug`

The stable progress ID is built in `assets/app.js`:

```js
[config.type, problem.problem_id || problem.code || problem.leetcode_slug || slug(problem.problem_name)].join(':')
```

Examples:

- `neetcode:0217-contains-duplicate`
- `striver:911`

This ID should remain stable when moving to backend storage.

## User Progress Today

User progress is stored in localStorage under:

```txt
dsaSheetProblemProgress:v1
```

Current record shape:

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
    "updatedAt": "2026-06-18T14:16:53.933Z"
  }
}
```

The app already wraps storage behind:

- `createLocalProgressAdapter()`
- `createProgressRepository(adapter)`
- `updateProblemProgress(problemId, value)`
- `updateManyProblemProgress(updates)`

That boundary should be preserved. A future backend integration should add an API adapter instead of spreading fetch calls through rendering/event code.

## Deployment

The project is deployed from Git through Vercel. The current preference is to keep deployment automatic:

1. implement locally
2. run validation/smoke tests
3. commit
4. push to GitHub
5. let Vercel deploy

Static assets in sheet routes use query-string cache busting like:

```html
<script src="../assets/app.js?v=13"></script>
```

When changing `assets/app.js` or `assets/app.css`, bump the route asset version across sheet pages.

## Validation

Run:

```sh
npm run validate
```

For UI behavior changes, also run a browser smoke test against a representative route such as `/neetcode-150/`.

