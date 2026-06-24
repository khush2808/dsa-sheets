import { notFound } from 'next/navigation';
import SheetPreview from '../../components/SheetPreview.jsx';
import { getSheet, sheets } from '../../lib/sheets.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export function generateStaticParams() {
  return sheets.map((sheet) => ({ sheet: sheet.slug }));
}

export function generateMetadata({ params }) {
  const sheet = getSheet(params.sheet);
  return {
    title: sheet?.title || 'DSA Sheet'
  };
}

export default async function SheetPage({ params }) {
  const sheet = getSheet(params.sheet);
  if (!sheet) notFound();
  const data = JSON.parse(await readFile(resolve(process.cwd(), 'data', sheet.dataFile), 'utf8'));
  const list = sheet.initialList || 'all';
  const problems = data.problems
    .filter((problem) => list === 'all' || problem.list_membership?.[list])
    .slice(0, 24);
  return <SheetPreview sheet={sheet} initialProblems={problems} />;
}
