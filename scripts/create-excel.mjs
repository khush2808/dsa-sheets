import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const sheetsDir = path.join(root, 'sheets');

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const colName = (index) => {
  let name = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

const cell = (rowIndex, colIndex, value) => {
  const ref = `${colName(colIndex)}${rowIndex}`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
};

const rowXml = (row, rowIndex) =>
  `<row r="${rowIndex}">${row.map((value, colIndex) => cell(rowIndex, colIndex, value)).join('')}</row>`;

const worksheetXml = (rows) => {
  const widthCount = rows[0]?.length ?? 1;
  const cols = Array.from({ length: widthCount }, (_, index) => {
    const max = Math.min(
      60,
      Math.max(12, ...rows.map((row) => String(row[index] ?? '').length + 2))
    );
    return `<col min="${index + 1}" max="${index + 1}" width="${max}" customWidth="1"/>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <cols>${cols}</cols>
  <sheetData>${rows.map(rowXml).join('')}</sheetData>
</worksheet>`;
};

const workbookXml = (sheetName) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

const writeWorkbook = async ({ filename, sheetName, headers, rows }) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsa-sheet-xlsx-'));
  const workbookDir = path.join(tempDir, 'xl');
  const relsDir = path.join(tempDir, '_rels');
  const workbookRelsDir = path.join(workbookDir, '_rels');
  const worksheetsDir = path.join(workbookDir, 'worksheets');

  await fs.mkdir(relsDir, { recursive: true });
  await fs.mkdir(workbookRelsDir, { recursive: true });
  await fs.mkdir(worksheetsDir, { recursive: true });

  await fs.writeFile(path.join(tempDir, '[Content_Types].xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  await fs.writeFile(path.join(relsDir, '.rels'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  await fs.writeFile(path.join(workbookRelsDir, 'workbook.xml.rels'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
  await fs.writeFile(path.join(workbookDir, 'workbook.xml'), workbookXml(sheetName));
  await fs.writeFile(path.join(worksheetsDir, 'sheet1.xml'), worksheetXml([headers, ...rows]));

  await fs.mkdir(sheetsDir, { recursive: true });
  const outputPath = path.join(sheetsDir, filename);
  if (existsSync(outputPath)) await fs.rm(outputPath);
  execFileSync('zip', ['-qr', outputPath, '.'], { cwd: tempDir });
  await fs.rm(tempDir, { recursive: true, force: true });
};

const readJson = async (filename) =>
  JSON.parse(await fs.readFile(path.join(root, filename), 'utf8'));

const striver = await readJson('strivers-a2z-problems.json');
await writeWorkbook({
  filename: 'strivers-a2z-problems.xlsx',
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
});

const neetcode = await readJson('neetcode-problems.json');
await writeWorkbook({
  filename: 'neetcode-problems.xlsx',
  sheetName: 'NeetCode',
  headers: [
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
  ],
  rows: neetcode.problems.map((problem) => [
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
  ])
});

console.log(`Wrote Excel files to ${sheetsDir}`);
