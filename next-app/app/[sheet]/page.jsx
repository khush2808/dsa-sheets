import { notFound } from 'next/navigation';
import SheetApp from '../../components/SheetApp.jsx';
import { getSheet, sheets } from '../../lib/sheets.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export function generateStaticParams() {
  return sheets.map((sheet) => ({ sheet: sheet.slug }));
}

export async function generateMetadata({ params }) {
  const { sheet: sheetSlug } = await params;
  const sheet = getSheet(sheetSlug);
  return {
    title: sheet?.title || 'DSA Sheet'
  };
}

export default async function SheetPage({ params }) {
  const { sheet: sheetSlug } = await params;
  const sheet = getSheet(sheetSlug);
  if (!sheet) notFound();
  const data = JSON.parse(await readFile(resolve(process.cwd(), '..', 'data', sheet.dataFile), 'utf8'));
  const list = sheet.initialList || 'all';
  const problems = data.problems
    .filter((problem) => list === 'all' || problem.list_membership?.[list]);
  return <SheetApp sheet={sheet} initialProblems={problems} />;
}
