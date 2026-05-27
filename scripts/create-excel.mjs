import fs from 'node:fs/promises';
import path from 'node:path';
import writeXlsxFile from 'write-excel-file/node';

const root = path.resolve(import.meta.dirname, '..');
const sheetsDir = path.join(root, 'sheets');

const readJson = async (filename) =>
  JSON.parse(await fs.readFile(path.join(root, filename), 'utf8'));

const cell = (value) => ({
  type: typeof value === 'number' && Number.isFinite(value) ? Number : String,
  value: value ?? ''
});

const headerCell = (value) => ({
  value,
  type: String,
  fontWeight: 'bold',
  backgroundColor: '#EEF2FF'
});

const sheetDefinition = ({ sheetName, headers, rows }) => ({
  sheet: sheetName,
  data: [[...headers.map(headerCell)], ...rows.map((row) => row.map(cell))],
  columns: headers.map((header, index) => ({
    width: Math.min(
      60,
      Math.max(14, header.length + 2, ...rows.map((row) => String(row[index] ?? '').length + 2))
    )
  })),
  stickyRowsCount: 1
});

const writeWorkbook = async ({ filename, sheets }) => {
  await fs.mkdir(sheetsDir, { recursive: true });
  await writeXlsxFile(sheets.map(sheetDefinition)).toFile(path.join(sheetsDir, filename));
};

const striver = await readJson('strivers-a2z-problems.json');
const striverSheet = {
  sheetName: 'Striver A2Z',
  headers: [
    'Problem ID',
    'Problem Name',
    'Category',
    'Subcategory',
    'Difficulty',
    'Article',
    'LeetCode',
    'YouTube',
    'TUF Plus',
    'Editorial'
  ],
  rows: striver.problems.map((problem) => [
    problem.problem_id,
    problem.problem_name,
    problem.category_name,
    problem.subcategory_name,
    problem.difficulty,
    problem.article,
    problem.leetcode,
    problem.youtube,
    problem.plus,
    problem.editorial
  ])
};

const neetcode = await readJson('neetcode-problems.json');
const neetcodeHeaders = [
  'Problem Name',
  'Pattern',
  'Difficulty',
  'Code',
  'LeetCode',
  'NeetCode',
  'Solution',
  'YouTube',
  'Blind 75',
  'NeetCode 150',
  'NeetCode 250',
  'Premium Algo 100',
  'Pro'
];

const neetcodeRows = (problems) =>
  problems.map((problem) => [
    problem.problem_name,
    problem.pattern,
    problem.difficulty,
    problem.code,
    problem.leetcode,
    problem.neetcode,
    problem.solution,
    problem.youtube,
    problem.list_membership.blind75 ? 'Yes' : 'No',
    problem.list_membership.neetcode150 ? 'Yes' : 'No',
    problem.list_membership.neetcode250 ? 'Yes' : 'No',
    problem.list_membership.premium_algo100 ? 'Yes' : 'No',
    problem.list_membership.pro ? 'Yes' : 'No'
  ]);

const neetcodeSheet = {
  sheetName: 'NeetCode',
  headers: neetcodeHeaders,
  rows: neetcodeRows(neetcode.problems)
};

const neetcodeListSheets = [
  ['neetcode-250-problems.xlsx', 'NeetCode 250', 'neetcode250'],
  ['neetcode-150-problems.xlsx', 'NeetCode 150', 'neetcode150'],
  ['blind-75-problems.xlsx', 'Blind 75', 'blind75'],
  ['premium-algo-100-problems.xlsx', 'Premium Algo 100', 'premium_algo100'],
  ['neetcode-pro-problems.xlsx', 'NeetCode Pro', 'pro']
].map(([filename, sheetName, membershipKey]) => ({
  filename,
  sheet: {
    sheetName,
    headers: neetcodeHeaders,
    rows: neetcodeRows(
      neetcode.problems.filter((problem) => problem.list_membership[membershipKey])
    )
  }
}));

await writeWorkbook({ filename: 'strivers-a2z-problems.xlsx', sheets: [striverSheet] });
await writeWorkbook({ filename: 'neetcode-problems.xlsx', sheets: [neetcodeSheet] });
for (const listSheet of neetcodeListSheets) {
  await writeWorkbook({ filename: listSheet.filename, sheets: [listSheet.sheet] });
}
await writeWorkbook({
  filename: 'dsa-problem-lists.xlsx',
  sheets: [
    striverSheet,
    { ...neetcodeSheet, sheetName: 'NeetCode All' },
    ...neetcodeListSheets.map((listSheet) => listSheet.sheet)
  ]
});

console.log(`Wrote Excel files to ${sheetsDir}`);
