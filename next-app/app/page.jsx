import Link from 'next/link';
import { sheets } from '../lib/sheets.js';

export default function HomePage() {
  return (
    <main className="next-shell">
      <section className="next-hero">
        <p>DSA Sheets Next preview</p>
        <h1>Same sheets, ready for authenticated progress.</h1>
      </section>
      <section className="sheet-grid">
        {sheets.map((sheet) => (
          <Link key={sheet.slug} className="sheet-card" href={`/${sheet.slug}/`}>
            <b>{sheet.title}</b>
            <span>{sheet.subtitle}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
