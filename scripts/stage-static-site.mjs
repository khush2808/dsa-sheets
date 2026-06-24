import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const outputDir = 'dist-static';
const paths = [
  'assets',
  'data',
  'sheets',
  'blind-75',
  'blind-75-sheet',
  'neetcode-150',
  'neetcode-250',
  'neetcode-all',
  'sde-sheet',
  'striver-450-sheet',
  'striver-79-sheet',
  'strivers-a2z-sheet',
  'index.html'
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const path of paths) {
  await cp(path, `${outputDir}/${path}`, { recursive: true });
}

await writeFile(`${outputDir}/.nojekyll`, '');
