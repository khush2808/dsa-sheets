'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProviderButton, UserIcon, authRedirectUrl, supabase } from './AuthControls';
import {
  createLocalProgressAdapter,
  createSupabaseProgressAdapter,
  mergeProgress,
  normalizeNotes
} from '../lib/progress';
import { sheets } from '../lib/sheets';

const collapseStorageKey = 'dsaSheetCollapsedSections';
const themeStorageKey = 'theme';
const linkTargetStorageKey = 'dsaSheetLinkTarget';

const slug = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const difficultyKey = (value) => String(value ?? '').toLowerCase();

const problemIdFor = (sheet, problem) =>
  [sheet.type, problem.problem_id || problem.code || problem.leetcode_slug || slug(problem.problem_name)].join(':');

const groupName = (sheet, problem) => (sheet.type === 'striver' ? problem.category_name : problem.pattern);

const subName = (sheet, problem) => (sheet.type === 'striver' ? problem.subcategory_name : problem.code);

const categoryLabel = (sheet) => (sheet.type === 'striver' ? 'Sections' : 'Patterns');

const articleLink = (problem) => problem.article || problem.solution;

const googleSearchLink = (problem) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${problem.problem_name} dsa problem`)}`;

const linkSet = (problem) => [
  ['Article', articleLink(problem)],
  ['YouTube', problem.youtube],
  ['LeetCode', problem.leetcode],
  ['Google', googleSearchLink(problem)],
  ['Other', problem.link]
].filter(([, href]) => href);

const primaryLink = (problem) => articleLink(problem) || problem.leetcode || problem.youtube || problem.link;

const sheetDescriptions = {
  'strivers-a2z-sheet': 'The full A2Z DSA track with article, LeetCode, video, Plus, and editorial links.',
  'blind-75-sheet': 'The takeUforward Blind 75 list with video-backed interview problems.',
  'sde-sheet': "Striver's most frequently asked coding interview questions, grouped by topic.",
  'striver-79-sheet': 'Last-minute interview preparation with a compact set of high-signal problems.',
  'neetcode-all': 'The full NeetCode catalog with pattern filters and links to solutions.',
  'neetcode-250': 'A focused NeetCode 250 route and export for the common track.',
  'neetcode-150': 'The 150-problem NeetCode list with the same filterable UI.',
  'blind-75': 'The NeetCode-flavored Blind 75 list, kept separate from the TUF Blind 75 sheet.'
};

const markLabel = (sheet) => {
  if (sheet.slug === 'blind-75-sheet' || sheet.slug === 'blind-75') return '75';
  if (sheet.slug === 'striver-79-sheet') return '79';
  if (sheet.slug === 'sde-sheet') return 'SDE';
  if (sheet.type === 'neetcode') return 'NC';
  return 'A2Z';
};

const readCollapsed = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(collapseStorageKey) || '[]'));
  } catch {
    return new Set();
  }
};

const writeCollapsed = (set) => {
  localStorage.setItem(collapseStorageKey, JSON.stringify([...set]));
};

const readLocalSetting = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const syncStateFor = (status, user) => {
  if (status === 'Syncing...' || status === 'Checking session' || status === 'Sending code' || status === 'Verifying code' || status === 'Signing out') {
    return 'syncing';
  }
  if (status === 'Sync issue' || status === 'Auth error') return 'error';
  if (user || status === 'Synced') return 'synced';
  return 'local';
};

export default function SheetApp({ sheet, initialProblems }) {
  const localProgressAdapter = useMemo(() => createLocalProgressAdapter(), []);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState(supabase ? 'Checking session' : 'Local only');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [difficulties, setDifficulties] = useState(['easy', 'medium', 'hard']);
  const [includePro, setIncludePro] = useState(true);
  const [theme, setTheme] = useState('light');
  const [linkTarget, setLinkTarget] = useState('same');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [authStep, setAuthStep] = useState('email');
  const [authMessage, setAuthMessage] = useState('');
  const [progress, setProgress] = useState({});
  const [collapsed, setCollapsed] = useState(new Set());
  const [openNotes, setOpenNotes] = useState(new Set());
  const [pendingNoteFocus, setPendingNoteFocus] = useState('');
  const [celebratingSections, setCelebratingSections] = useState(new Set());

  useEffect(() => {
    setProgress(localProgressAdapter.loadAll());
    setCollapsed(readCollapsed());
    setTheme(readLocalSetting(themeStorageKey, 'light'));
    setLinkTarget(readLocalSetting(linkTargetStorageKey, 'same'));
  }, [localProgressAdapter]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(linkTargetStorageKey, linkTarget);
  }, [linkTarget]);

  useEffect(() => {
    if (!pendingNoteFocus) return;
    const selector = `[data-next-note-id="${CSS.escape(pendingNoteFocus)}"]`;
    const textarea = document.querySelector(selector);
    if (!textarea) return;
    textarea.focus();
    setPendingNoteFocus('');
  }, [pendingNoteFocus, progress, openNotes]);

  useEffect(() => {
    if (!supabase) return;
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
      setSyncStatus(data.session?.user ? 'Syncing...' : 'Signed out');
      setAuthMessage('');
      if (data.session?.user) await syncRemote(data.session.user);
    };
    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      setSyncStatus(session?.user ? 'Syncing...' : 'Signed out');
      setAuthMessage('');
      if (session?.user) setAuthStep('email');
      if (session?.user) await syncRemote(session.user);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const filteredProblems = useMemo(
    () =>
      initialProblems.filter((problem) => {
        const group = groupName(sheet, problem) || 'Uncategorized';
        const haystack = [problem.problem_name, groupName(sheet, problem), subName(sheet, problem), problem.difficulty, problem.code]
          .join(' ')
          .toLowerCase();
        return (
          (category === 'all' || slug(group) === category) &&
          difficulties.includes(difficultyKey(problem.difficulty)) &&
          (sheet.type !== 'neetcode' || includePro || !problem.list_membership?.pro) &&
          haystack.includes(query.toLowerCase())
        );
      }),
    [category, difficulties, includePro, initialProblems, query, sheet]
  );

  const routeProblems = useMemo(
    () => initialProblems.filter((problem) => sheet.type !== 'neetcode' || includePro || !problem.list_membership?.pro),
    [includePro, initialProblems, sheet]
  );

  const categoryOptions = useMemo(() => {
    const groups = new Map();
    routeProblems.forEach((problem) => {
      const name = groupName(sheet, problem) || 'Uncategorized';
      groups.set(name, (groups.get(name) || 0) + 1);
    });
    return [...groups.entries()];
  }, [routeProblems, sheet]);

  const stats = useMemo(
    () => ({
      problems: filteredProblems.length,
      easy: filteredProblems.filter((problem) => difficultyKey(problem.difficulty) === 'easy').length,
      medium: filteredProblems.filter((problem) => difficultyKey(problem.difficulty) === 'medium').length,
      hard: filteredProblems.filter((problem) => difficultyKey(problem.difficulty) === 'hard').length
    }),
    [filteredProblems]
  );

  const groupedProblems = useMemo(() => {
    const groups = new Map();
    filteredProblems.forEach((problem) => {
      const name = groupName(sheet, problem) || 'Uncategorized';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(problem);
    });
    return [...groups.entries()];
  }, [filteredProblems, sheet]);

  const syncRemote = async (currentUser = user) => {
    if (!supabase || !currentUser) return;
    setSyncStatus('Syncing...');
    try {
      const remoteProgressAdapter = createSupabaseProgressAdapter(supabase, currentUser);
      const merged = mergeProgress(localProgressAdapter.loadAll(), await remoteProgressAdapter.loadAll());
      localProgressAdapter.replaceAll(merged);
      setProgress(merged);
      await remoteProgressAdapter.saveProblems(merged);
      setSyncStatus('Synced');
    } catch (error) {
      console.error(error);
      setSyncStatus('Sync issue');
    }
  };

  const updateProblem = async (problemId, value) => {
    const next = localProgressAdapter.saveProblem(problemId, value);
    setProgress(next);
    if (user) {
      setSyncStatus('Syncing...');
      try {
        await createSupabaseProgressAdapter(supabase, user).saveProblem(problemId, next[problemId] || { notes: [] });
        setSyncStatus('Synced');
      } catch (error) {
        console.error(error);
        setSyncStatus('Sync issue');
      }
    }
    return next;
  };

  const toggleSection = async (problems, checked) => {
    const updates = problems.map((problem) => ({
      problemId: problemIdFor(sheet, problem),
      value: { completed: checked }
    }));
    const next = localProgressAdapter.saveProblems(updates);
    setProgress(next);
    if (user) {
      setSyncStatus('Syncing...');
      try {
        const remoteProgressAdapter = createSupabaseProgressAdapter(supabase, user);
        await Promise.all(updates.map(({ problemId }) => remoteProgressAdapter.saveProblem(problemId, next[problemId] || { notes: [] })));
        setSyncStatus('Synced');
      } catch (error) {
        console.error(error);
        setSyncStatus('Sync issue');
      }
    }
    return next;
  };

  const sectionIsComplete = (problems, records) =>
    Boolean(problems.length && problems.every((problem) => records[problemIdFor(sheet, problem)]?.completed));

  const celebrateSection = (key) => {
    setCelebratingSections((current) => new Set([...current, key]));
    setTimeout(() => {
      setCelebratingSections((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }, 900);
  };

  const toggleCollapse = (key) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed(next);
    writeCollapsed(next);
  };

  const addNote = (problemId) => {
    const now = new Date().toISOString();
    const note = { id: `note-${Date.now()}`, text: '', createdAt: now, updatedAt: now };
    updateProblem(problemId, { notes: [...normalizeNotes(progress[problemId]), note] });
    setOpenNotes(new Set([...openNotes, problemId]));
    setPendingNoteFocus(note.id);
  };

  const editNote = (problemId, noteId, text) => {
    updateProblem(problemId, {
      notes: normalizeNotes(progress[problemId]).map((note) => (note.id === noteId ? { ...note, text, updatedAt: new Date().toISOString() } : note))
    });
  };

  const deleteNote = (problemId, noteId) => {
    updateProblem(problemId, {
      notes: normalizeNotes(progress[problemId]).filter((note) => note.id !== noteId),
      noteTombstones: {
        ...(progress[problemId]?.noteTombstones || {}),
        [noteId]: new Date().toISOString()
      }
    });
  };

  const signInWithEmail = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !supabase) return;
    setSyncStatus('Sending code');
    setAuthMessage('');
    const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail, options: { emailRedirectTo: authRedirectUrl() } });
    setSyncStatus(error ? 'Auth error' : 'Code sent');
    if (error) {
      setAuthMessage('Could not send the email code.');
      return;
    }
    setAuthStep('code');
    setAuthMessage('Enter the 6-digit code from your email.');
  };

  const verifyEmailCode = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const token = otp.replace(/\D/g, '');
    if (!trimmedEmail || token.length < 6 || !supabase) return;
    setSyncStatus('Verifying code');
    setAuthMessage('');
    const { error } = await supabase.auth.verifyOtp({ email: trimmedEmail, token, type: 'email' });
    if (error) {
      setSyncStatus('Auth error');
      setAuthMessage('That code did not work. Check the email and try again.');
      return;
    }
    setOtp('');
    setAuthStep('email');
    setSyncStatus('Syncing...');
  };

  const signInWithProvider = async (provider) => {
    if (!supabase) return;
    setSyncStatus(`Opening ${provider}`);
    setAuthMessage('');
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: authRedirectUrl() } });
    if (error) {
      setSyncStatus('Auth error');
      setAuthMessage(`Could not start ${provider} sign in.`);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setSyncStatus('Signing out');
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSyncStatus('Auth error');
      setAuthMessage('Could not sign out.');
      return;
    }
    setUser(null);
    setSyncStatus('Signed out');
    setAuthMessage('');
  };

  const pickRandomProblem = () => {
    if (!filteredProblems.length) return;
    const problem = filteredProblems[Math.floor(Math.random() * filteredProblems.length)];
    setQuery(problem.problem_name);
  };

  const linkProps = linkTarget === 'new' ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  const totalCompleted = filteredProblems.filter((problem) => progress[problemIdFor(sheet, problem)]?.completed).length;
  const syncState = syncStateFor(syncStatus, user);
  const syncLabel = user?.email || syncStatus;
  const isSyncing = syncState === 'syncing';
  const shownLabel = category === 'all' ? categoryLabel(sheet) : groupedProblems[0]?.[0] || categoryLabel(sheet);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-main">
            <div className="mark">{markLabel(sheet)}</div>
            <div>
              <h1>{sheet.title}</h1>
              <p>{sheet.subtitle}</p>
            </div>
          </div>
          <button
            id="themeToggle"
            className="icon-button"
            type="button"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={theme === 'dark'}
          >
            <svg className="theme-icon moon-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z"></path>
            </svg>
            <svg className="theme-icon sun-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M12 2v2"></path>
              <path d="M12 20v2"></path>
              <path d="m4.93 4.93 1.41 1.41"></path>
              <path d="m17.66 17.66 1.41 1.41"></path>
              <path d="M2 12h2"></path>
              <path d="M20 12h2"></path>
              <path d="m6.34 17.66-1.41 1.41"></path>
              <path d="m19.07 4.93-1.41 1.41"></path>
            </svg>
          </button>
        </div>
        <nav className="nav-links">
          {sheets.map((item) => (
            <a key={item.slug} aria-current={item.slug === sheet.slug ? 'page' : undefined} href={`/${item.slug}/`}>
              {item.title}
            </a>
          ))}
          <a href="/">All sheets</a>
        </nav>
        <section className="account-panel" aria-label="Account">
          <h2>Account</h2>
          <div className="account-card">
            <div className="account-card-head">
              <span className="user-avatar" aria-hidden="true">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
              <div>
                <b>{user?.email || 'Local progress'}</b>
                <p>
                  <span className={`sync-dot ${syncState}`} aria-hidden="true"></span>
                  {user ? (syncState === 'error' ? 'Sync issue' : syncState === 'syncing' ? 'Syncing...' : 'Synced') : 'Local only'}
                </p>
              </div>
            </div>
            {user ? (
              <>
                <button type="button" onClick={() => syncRemote(user)} disabled={isSyncing}>
                  {syncState === 'error' ? 'Retry sync' : 'Sync now'}
                </button>
                <button type="button" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div className="account-auth-intro">
                  <span className="auth-avatar">
                    <UserIcon />
                  </span>
                  <div>
                    <b>Save across devices</b>
                    <p>Sign in with a code or provider.</p>
                  </div>
                </div>
                <form className="account-auth-form" onSubmit={authStep === 'code' ? verifyEmailCode : signInWithEmail}>
                  <label htmlFor="authEmail">Email</label>
                  <input
                    id="authEmail"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={!supabase}
                  />
                  {authStep === 'code' ? (
                    <>
                      <label htmlFor="authCode">Code</label>
                      <input
                        id="authCode"
                        className="otp-input"
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        disabled={!supabase}
                      />
                    </>
                  ) : null}
                  <button type="submit" disabled={!supabase || !email.trim() || (authStep === 'code' && otp.length < 6)}>
                    {authStep === 'code' ? 'Verify code' : 'Send code'}
                  </button>
                  <div className="auth-buttons">
                    <ProviderButton provider="google" onClick={() => signInWithProvider('google')} disabled={!supabase} />
                    <ProviderButton provider="github" onClick={() => signInWithProvider('github')} disabled={!supabase} />
                  </div>
                </form>
              </>
            )}
            {authMessage ? <p>{authMessage}</p> : null}
          </div>
        </section>
        <section className="link-target-panel" aria-label="Problem link behavior">
          <h2>Links</h2>
          <label htmlFor="linkTarget">Open problem links</label>
          <select id="linkTarget" value={linkTarget} onChange={(event) => setLinkTarget(event.target.value)}>
            <option value="same">Same tab</option>
            <option value="new">New tab</option>
          </select>
        </section>
        <h2>{categoryLabel(sheet)}</h2>
        <div className="category-list">
          <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>
            <span>All</span>
            <b>{routeProblems.length}</b>
          </button>
          {categoryOptions.map(([name, count]) => {
            const key = slug(name);
            return (
              <button key={name} type="button" className={category === key ? 'active' : ''} onClick={() => setCategory(key)}>
                <span>{name}</span>
                <b>{count}</b>
              </button>
            );
          })}
        </div>
      </aside>
      <main className="main">
        <section className="top">
          <div className="hero">
            <div className="hero-content">
              <p className="eyebrow">{sheet.kicker}</p>
              <h2>{sheet.title}</h2>
              <p>{sheetDescriptions[sheet.slug] || sheet.subtitle}</p>
            </div>
          </div>
          <aside className="summary">
            <div className="stat-grid">
              {[
                ['Problems', stats.problems],
                ['Easy', stats.easy],
                ['Medium', stats.medium],
                ['Hard', stats.hard]
              ].map(([label, value]) => (
                <div key={label} className="stat">
                  <b>{value}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="summary-actions">
              <a className="download" href="/sheets/dsa-problem-lists.xlsx">
                Download
              </a>
              <span>
                {totalCompleted}/{filteredProblems.length} shown completed
              </span>
            </div>
          </aside>
        </section>
        <section className="toolbar">
          <input id="search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search problems" />
          <details id="difficultyFilter" className="filter-dropdown">
            <summary>
              <span>{difficulties.length ? difficulties.map((item) => item[0].toUpperCase() + item.slice(1)).join(', ') : 'No difficulties'}</span>
            </summary>
            <div className="filter-menu">
              {['easy', 'medium', 'hard'].map((difficulty) => (
                <label key={difficulty}>
                  <input
                    type="checkbox"
                    value={difficulty}
                    checked={difficulties.includes(difficulty)}
                    onChange={(event) =>
                      setDifficulties((current) => (event.target.checked ? [...current, difficulty] : current.filter((item) => item !== difficulty)))
                    }
                  />
                  {difficulty[0].toUpperCase() + difficulty.slice(1)}
                </label>
              ))}
            </div>
          </details>
          {sheet.type === 'neetcode' ? (
            <details id="proFilter" className="filter-dropdown">
              <summary>
                <span>{includePro ? 'Pro' : 'No Pro questions'}</span>
              </summary>
              <div className="filter-menu">
                <label>
                  <input id="includePro" type="checkbox" checked={includePro} onChange={(event) => setIncludePro(event.target.checked)} />
                  Pro questions
                </label>
              </div>
            </details>
          ) : (
            <span aria-hidden="true"></span>
          )}
          <button id="randomButton" type="button" onClick={pickRandomProblem} disabled={!filteredProblems.length}>
            Random Pick
          </button>
        </section>
        <section className="problem-area">
          <div className="problem-head">
            <span>{shownLabel}</span>
            <span className="result-count">{filteredProblems.length} shown</span>
          </div>
          <div className="problem-list">
        {groupedProblems.map(([name, problems]) => {
          const key = slug(name);
          const completed = problems.filter((problem) => progress[problemIdFor(sheet, problem)]?.completed).length;
          const complete = completed === problems.length;
          const partial = completed > 0 && completed < problems.length;
          return (
            <section key={name} className={`problem-section ${complete ? 'section-complete' : ''} ${celebratingSections.has(key) ? 'section-just-completed' : ''}`}>
              <header className="section-card">
                <button className="section-collapse" type="button" onClick={() => toggleCollapse(key)} aria-label={`${collapsed.has(key) ? 'Expand' : 'Collapse'} ${name}`} aria-expanded={!collapsed.has(key)}>
                  <span aria-hidden="true"></span>
                </button>
                <div>
                  <h3>{name}</h3>
                  <p>{sheet.type === 'striver' ? 'Section' : 'Pattern'}</p>
                </div>
                <div className="section-status">
                  <label className="section-done-control" title="Mark section complete">
                    <input
                      type="checkbox"
                      checked={complete}
                      ref={(input) => {
                        if (input) input.indeterminate = partial;
                      }}
                      onChange={async (event) => {
                        const next = await toggleSection(problems, event.target.checked);
                        if (event.target.checked && !complete && sectionIsComplete(problems, next)) celebrateSection(key);
                      }}
                      aria-label={`Mark ${name} complete`}
                    />
                  </label>
                  <span>{completed}/{problems.length}</span>
                </div>
              </header>
              {!collapsed.has(key) ? (
                <div className="section-problems">
                  {problems.map((problem) => {
                    const problemId = problemIdFor(sheet, problem);
                    const record = progress[problemId] || { notes: [] };
                    const notes = normalizeNotes(record);
                    const notesOpen = openNotes.has(problemId);
                    const mainHref = primaryLink(problem);
                    const links = linkSet(problem);
                    return (
                      <article key={problemId} className={`problem-row ${mainHref ? 'clickable' : ''}`}>
                        <label className="done-control" title="Mark complete">
                          <input
                            type="checkbox"
                            checked={Boolean(record.completed)}
                            onChange={async (event) => {
                              const next = await updateProblem(problemId, { completed: event.target.checked });
                              if (event.target.checked && !complete && sectionIsComplete(problems, next)) celebrateSection(key);
                            }}
                            aria-label={`Mark ${problem.problem_name} complete`}
                          />
                        </label>
                        <div className="problem-title">
                          <div className="problem-line">
                            {mainHref ? (
                              <a className="primary-link" href={mainHref} {...linkProps}>
                                {problem.problem_name}
                              </a>
                            ) : (
                              <b>{problem.problem_name}</b>
                            )}
                            <span className={`pill ${difficultyKey(problem.difficulty)}`}>{problem.difficulty}</span>
                          </div>
                          <span>{subName(sheet, problem) || ''}</span>
                          {notesOpen ? (
                            <div className="notes-panel">
                              <div className="notes-banner">{notes.length} notes</div>
                              <div className="notes-list">
                                {notes.length ? (
                                  notes.map((note) => (
                                    <div className="note-editor" key={note.id}>
                                      <textarea
                                        value={note.text}
                                        onChange={(event) => editNote(problemId, note.id, event.target.value)}
                                        aria-label={`Note for ${problem.problem_name}`}
                                        data-next-note-id={note.id}
                                        rows={2}
                                      />
                                      <button
                                        className="delete-note-button"
                                        type="button"
                                        onClick={() => deleteNote(problemId, note.id)}
                                        aria-label="Delete note"
                                        title="Delete note"
                                      >
                                        <span aria-hidden="true"></span>
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="notes-empty">No notes yet.</p>
                                )}
                              </div>
                              <button className="add-note-button" type="button" onClick={() => addNote(problemId)} title="New note">
                                <span aria-hidden="true">+</span>
                                <span>New note</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <div className="links">
                          {links.map(([label, href]) => (
                            <a key={label} href={href} {...linkProps}>
                              {label}
                            </a>
                          ))}
                          <button
                            className={`note-toggle ${notesOpen ? 'active' : ''}`}
                            type="button"
                            onClick={() => setOpenNotes((current) => new Set(current.has(problemId) ? [...current].filter((id) => id !== problemId) : [...current, problemId]))}
                            aria-label={`Notes for ${problem.problem_name}`}
                            aria-expanded={notesOpen}
                            title="Notes"
                          >
                            <span className="note-icon" aria-hidden="true"></span>
                            <span className="note-count">{notes.length || ''}</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
          </div>
        </section>
      </main>
    </div>
  );
}
