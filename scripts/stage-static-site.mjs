import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const outputDir = 'dist-static';
const staticRoot = 'old/static';
const staticPaths = [
  'assets',
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
const sharedPaths = ['data', 'sheets'];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const path of staticPaths) {
  await cp(`${staticRoot}/${path}`, `${outputDir}/${path}`, { recursive: true });
}

for (const path of sharedPaths) {
  await cp(path, `${outputDir}/${path}`, { recursive: true });
}

await writeFile(`${outputDir}/.nojekyll`, '');
