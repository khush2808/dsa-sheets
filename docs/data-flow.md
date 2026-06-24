# Data Flow

## Checked-In Data

Problem data lives in `data/` as JSON:

- `strivers-a2z-problems.json`
- `blind-75-sheet-problems.json`
- `sde-sheet-problems.json`
- `striver-79-sheet-problems.json`
- `neetcode-problems.json`

These files are source data for both frontends and for Excel exports.

Excel exports live in `sheets/`:

- per-sheet workbooks such as `neetcode-150-problems.xlsx`
- combined workbook `dsa-problem-lists.xlsx`

The Excel files are generated but intentionally checked in as downloadable deliverables for the static site.

## Static App Consumption

Each `old/static/` route folder has an `index.html` with `window.SHEET_CONFIG`:

```js
window.SHEET_CONFIG = {
  type: 'neetcode',
  initialList: 'neetcode150',
  dataUrl: '../data/neetcode-problems.json'
};
```

`old/static/assets/app.js` fetches `dataUrl` and renders the route.

## Next App Consumption

`next-app/lib/sheets.js` defines the same sheet metadata for Next routes.

`next-app/app/[sheet]/page.jsx` loads the appropriate JSON file from `data/` at build time and passes problems into `SheetApp`.

## Extraction

Command:

```sh
npm run extract:tuf
```

Script:

```txt
scripts/extract-tuf-sheets.mjs
```

This refreshes takeUforward/Striver-style JSON files. Review diffs carefully after running it because upstream source changes can reorder or alter many records.

NeetCode data currently comes from the checked-in `data/neetcode-problems.json`; there is no separate NeetCode extractor in this repo.

## Excel Generation

Command:

```sh
npm run excel
```

Script:

```txt
scripts/create-excel.mjs
```

The script reads `data/*.json` and writes workbooks to `sheets/`.

`npm run validate` also runs `npm run excel`, so it may modify `sheets/*.xlsx`. If the JSON data did not intentionally change, restore the spreadsheet files before committing:

```sh
git restore -- sheets/*.xlsx
```

## Static Build Staging

Command:

```sh
npm run build
```

Scripts:

- `scripts/create-supabase-config.mjs`
- `scripts/stage-static-site.mjs`

The static build writes public Supabase config to `old/static/assets/supabase-config.js`, then stages these paths into `dist-static/`:

- `assets/` from `old/static/assets/`
- `data/`
- `sheets/`
- route folders from `old/static/`
- `index.html` from `old/static/index.html`

`dist-static/` is ignored and should not be committed.

## Path Change Checklist

If moving `data/`, `sheets/`, `old/static/` route folders, or `old/static/assets/`, update all of:

- `old/static/` route `index.html` files
- `scripts/stage-static-site.mjs`
- `scripts/create-excel.mjs`
- `next-app/lib/sheets.js`
- `next-app/app/[sheet]/page.jsx` if data loading changes
- README and docs
- GitHub Pages smoke test
- Next build smoke test
