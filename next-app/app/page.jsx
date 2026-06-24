import { LandingAuth } from '../components/AuthControls';

const sheetCards = [
  {
    title: 'Striver A2Z',
    description: 'The full A2Z DSA track with article, LeetCode, video, Plus, and editorial links.',
    meta: ['474 problems', 'TUF'],
    route: '/strivers-a2z-sheet/',
    excel: '/sheets/strivers-a2z-problems.xlsx'
  },
  {
    title: 'Blind 75 Sheet',
    description: 'The takeUforward Blind 75 list with video-backed interview problems.',
    meta: ['75 problems', 'TUF'],
    route: '/blind-75-sheet/',
    excel: '/sheets/blind-75-sheet-problems.xlsx'
  },
  {
    title: 'SDE Sheet',
    description: "Striver's most frequently asked coding interview questions, grouped by topic.",
    meta: ['191 problems', 'TUF'],
    route: '/sde-sheet/',
    excel: '/sheets/sde-sheet-problems.xlsx'
  },
  {
    title: 'Striver 79',
    description: 'Last-minute interview preparation with a compact set of high-signal problems.',
    meta: ['79 problems', 'TUF'],
    route: '/striver-79-sheet/',
    excel: '/sheets/striver-79-sheet-problems.xlsx'
  },
  {
    title: 'NeetCode All',
    description: 'The full NeetCode catalog with pattern filters and links to solutions.',
    meta: ['973 problems', 'NeetCode'],
    route: '/neetcode-all/',
    excel: '/sheets/neetcode-problems.xlsx'
  },
  {
    title: 'NeetCode 250',
    description: 'A focused NeetCode 250 route and export for the common track.',
    meta: ['250 problems', 'NeetCode'],
    route: '/neetcode-250/',
    excel: '/sheets/neetcode-250-problems.xlsx'
  },
  {
    title: 'NeetCode 150',
    description: 'The 150-problem NeetCode list with the same filterable UI.',
    meta: ['150 problems', 'NeetCode'],
    route: '/neetcode-150/',
    excel: '/sheets/neetcode-150-problems.xlsx'
  },
  {
    title: 'NeetCode Blind 75',
    description: 'The NeetCode-flavored Blind 75 list, kept separate from the TUF Blind 75 sheet.',
    meta: ['75 problems', 'NeetCode'],
    route: '/blind-75/',
    excel: '/sheets/blind-75-problems.xlsx'
  },
  {
    title: 'Everything',
    description: 'One workbook with all problem-list tabs in one place.',
    meta: ['10 tabs', 'Excel'],
    route: null,
    excel: '/sheets/dsa-problem-lists.xlsx'
  }
];

export default function HomePage() {
  return (
    <>
      <header className="landing-page landing-nav">
        <div className="landing-brand">
          <div className="landing-mark">DSA</div>
          <span>DSA Sheets</span>
        </div>
        <div className="landing-nav-actions">
          <LandingAuth />
          <a className="landing-button" href="https://github.com/khush2808/dsa-sheets">
            GitHub
          </a>
          <a className="landing-button primary" href="/strivers-a2z-sheet/">
            Open A2Z
          </a>
        </div>
      </header>

      <main className="landing-page">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-hero-inner">
              <p className="landing-eyebrow">same sheets, less suffering</p>
              <h1>DSA problem sheets with a UI that gets out of your way.</h1>
              <p>
                Search, filter, jump into articles or solutions, and download Excel files for the Striver, takeUforward,
                and NeetCode lists you actually use.
              </p>
              <div className="landing-hero-links">
                <a className="landing-button" href="/strivers-a2z-sheet/">
                  Start with Striver A2Z
                </a>
                <a className="landing-button secondary" href="/sheets/dsa-problem-lists.xlsx">
                  Download all sheets
                </a>
              </div>
            </div>
          </div>
          <aside className="landing-panel">
            <div className="landing-quote">
              If you love the Striver sheet but hate the UI on takeUforward, you don't have to suffer anymore.
            </div>
            <div className="landing-stat-grid">
              <div className="landing-stat"><b>10</b><span>Excel tabs in the global workbook</span></div>
              <div className="landing-stat"><b>7</b><span>Focused web routes</span></div>
              <div className="landing-stat"><b>2k+</b><span>Problem rows across sources</span></div>
              <div className="landing-stat"><b>Optional</b><span>Account sync for saved progress</span></div>
            </div>
          </aside>
        </section>

        <section className="landing-section-head">
          <div>
            <h2>Pick a Sheet</h2>
            <p>Each route is a standalone static page with search, filters, direct problem links, and its own Excel export.</p>
          </div>
        </section>

        <section className="landing-sheets" aria-label="Available sheets">
          {sheetCards.map((card) => (
            <article className="landing-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <div className="landing-meta">
                {card.meta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="landing-card-actions">
                {card.route ? <a href={card.route}>Open</a> : null}
                <a href={card.excel}>{card.route ? 'Excel' : 'Download'}</a>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
