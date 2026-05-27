# DSA Sheets

Extracted problem data, Excel exports, and static sheet browsers for:

- `strivers-a2z-sheet` - Striver's A2Z Sheet
- `striver-450-sheet` - alias to Striver's A2Z Sheet
- `blind-75-sheet` - takeUforward Blind 75 Sheet
- `sde-sheet` - Striver's SDE Sheet
- `striver-79-sheet` - Striver's 79 Sheet
- `neetcode-all` - NeetCode All
- `neetcode-250` - NeetCode 250
- `neetcode-150` - NeetCode 150
- `blind-75` - NeetCode Blind 75

## Files

- `assets/` - shared UI scripts and styles
- `data/strivers-a2z-problems.json`
- `data/blind-75-sheet-problems.json`
- `data/sde-sheet-problems.json`
- `data/striver-79-sheet-problems.json`
- `data/neetcode-problems.json`
- `sheets/strivers-a2z-problems.xlsx`
- `sheets/blind-75-sheet-problems.xlsx`
- `sheets/sde-sheet-problems.xlsx`
- `sheets/striver-79-sheet-problems.xlsx`
- `sheets/neetcode-problems.xlsx`
- `sheets/dsa-problem-lists.xlsx`

## Local Preview

Install dependencies once:

```sh
npm install
```

Run the dev server with auto-reload:

```sh
npm run dev
```

Vite serves the repository root as a static multi-page site and opens `/`. Changes to HTML, CSS, and JS reload the browser automatically.

For a no-dependency fallback, serve the folder with any static server:

```sh
python3 -m http.server 4174
```

Routes: `/strivers-a2z-sheet/`, `/blind-75-sheet/`, `/sde-sheet/`, `/striver-79-sheet/`, `/neetcode-all/`, `/neetcode-250/`, `/neetcode-150/`, and `/blind-75/`.

## Scripts

- `npm run dev` - start Vite dev server with auto-reload.
- `npm run preview` - preview the static site through Vite.
- `npm run extract:tuf` - refresh the takeUforward sheet JSON files.
- `npm run excel` - regenerate Excel exports.
- `npm run validate` - syntax-check scripts and regenerate Excel exports.
