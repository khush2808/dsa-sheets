'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import {
  createLocalProgressAdapter,
  createSupabaseProgressAdapter,
  mergeProgress,
  normalizeNotes
} from '../lib/progress';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
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
  if (status === 'Syncing...' || status === 'Checking session' || status === 'Sending magic link' || status === 'Signing out') return 'syncing';
  if (status === 'Sync issue' || status === 'Auth error') return 'error';
  if (user || status === 'Synced') return 'synced';
  return 'local';
};

const authRedirectUrl = () => `${window.location.origin}${window.location.pathname}`;

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
    updateProblem(problemId, { notes: normalizeNotes(progress[problemId]).filter((note) => note.id !== noteId) });
  };

  const signInWithEmail = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !supabase) return;
    setSyncStatus('Sending magic link');
    setAuthMessage('');
    const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail, options: { emailRedirectTo: authRedirectUrl() } });
    setSyncStatus(error ? 'Auth error' : 'Check your email');
    setAuthMessage(error ? 'Could not send magic link.' : 'Check your email for the magic link.');
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

  return (
    <main className="next-shell">
      <header className="next-toolbar">
        <a href="/">All sheets</a>
        <div className="next-toolbar-controls">
          <label>
            Links
            <select value={linkTarget} onChange={(event) => setLinkTarget(event.target.value)}>
              <option value="same">Same tab</option>
              <option value="new">New tab</option>
            </select>
          </label>
          <button type="button" onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} aria-pressed={theme === 'dark'}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <span className="next-sync" data-state={syncState} aria-live="polite">
            <span className="next-sync-dot" aria-hidden="true"></span>
            <span>{syncLabel}</span>
          </span>
          {user ? (
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          ) : (
            <>
              <form className="next-auth-form" onSubmit={signInWithEmail}>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={!supabase}
                />
                <button type="submit" disabled={!supabase || !email.trim()}>
                  Email
                </button>
              </form>
              <button type="button" onClick={() => signInWithProvider('google')} disabled={!supabase}>
                Google
              </button>
              <button type="button" onClick={() => signInWithProvider('github')} disabled={!supabase}>
                GitHub
              </button>
            </>
          )}
          {authMessage ? <span className="next-auth-message">{authMessage}</span> : null}
        </div>
      </header>
      <section className="next-hero compact">
        <p>{sheet.kicker}</p>
        <h1>{sheet.title}</h1>
        <span>
          {totalCompleted}/{filteredProblems.length} shown completed
        </span>
      </section>
      <section className="next-overview" aria-label="Sheet overview">
        <div className="next-stats">
          {[
            ['Problems', stats.problems],
            ['Easy', stats.easy],
            ['Medium', stats.medium],
            ['Hard', stats.hard]
          ].map(([label, value]) => (
            <div key={label} className="next-stat">
              <b>{value}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <nav className="next-categories" aria-label={categoryLabel(sheet)}>
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
        </nav>
      </section>
      <section className="next-filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search problems" />
        <button type="button" onClick={pickRandomProblem} disabled={!filteredProblems.length}>
          Random
        </button>
        {['easy', 'medium', 'hard'].map((difficulty) => (
          <label key={difficulty}>
            <input
              type="checkbox"
              checked={difficulties.includes(difficulty)}
              onChange={(event) =>
                setDifficulties((current) => (event.target.checked ? [...current, difficulty] : current.filter((item) => item !== difficulty)))
              }
            />
            {difficulty}
          </label>
        ))}
        {sheet.type === 'neetcode' ? (
          <label>
            <input type="checkbox" checked={includePro} onChange={(event) => setIncludePro(event.target.checked)} />
            Pro
          </label>
        ) : null}
      </section>
      <section className="next-problems">
        {groupedProblems.map(([name, problems]) => {
          const key = slug(name);
          const completed = problems.filter((problem) => progress[problemIdFor(sheet, problem)]?.completed).length;
          const complete = completed === problems.length;
          const partial = completed > 0 && completed < problems.length;
          return (
            <section key={name} className={`next-section ${complete ? 'complete' : ''} ${celebratingSections.has(key) ? 'celebrating' : ''}`}>
              <header>
                <button type="button" onClick={() => toggleCollapse(key)} aria-expanded={!collapsed.has(key)}>
                  {collapsed.has(key) ? '>' : 'v'}
                </button>
                <div>
                  <h2>{name}</h2>
                  <span>
                    {completed}/{problems.length}
                  </span>
                </div>
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
              </header>
              {!collapsed.has(key)
                ? problems.map((problem) => {
                    const problemId = problemIdFor(sheet, problem);
                    const record = progress[problemId] || { notes: [] };
                    const notes = normalizeNotes(record);
                    const notesOpen = openNotes.has(problemId);
                    const mainHref = primaryLink(problem);
                    const links = linkSet(problem);
                    return (
                      <article key={problemId}>
                        <input
                          type="checkbox"
                          checked={Boolean(record.completed)}
                          onChange={async (event) => {
                            const next = await updateProblem(problemId, { completed: event.target.checked });
                            if (event.target.checked && !complete && sectionIsComplete(problems, next)) celebrateSection(key);
                          }}
                          aria-label={`Mark ${problem.problem_name} complete`}
                        />
                        <div>
                          {mainHref ? (
                            <a className="next-problem-link" href={mainHref} {...linkProps}>
                              {problem.problem_name}
                            </a>
                          ) : (
                            <b>{problem.problem_name}</b>
                          )}
                          <span>
                            {subName(sheet, problem)} · {problem.difficulty}
                          </span>
                          {notesOpen ? (
                            <div className="next-notes">
                              <div className="next-notes-banner">{notes.length} notes</div>
                              <div className="next-notes-list">
                                {notes.length ? (
                                  notes.map((note) => (
                                    <div className="next-note-editor" key={note.id}>
                                      <textarea
                                        value={note.text}
                                        onChange={(event) => editNote(problemId, note.id, event.target.value)}
                                        aria-label={`Note for ${problem.problem_name}`}
                                        data-next-note-id={note.id}
                                        rows={2}
                                      />
                                      <button
                                        className="next-delete-note-button"
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
                                  <p className="next-notes-empty">No notes yet.</p>
                                )}
                              </div>
                              <button className="next-add-note-button" type="button" onClick={() => addNote(problemId)} title="New note">
                                <span aria-hidden="true">+</span>
                                <span>New note</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <div className="next-row-actions">
                          <div className="next-links">
                            {links.map(([label, href]) => (
                              <a key={label} href={href} {...linkProps}>
                                {label}
                              </a>
                            ))}
                          </div>
                          <button
                            className={`next-note-toggle ${notesOpen ? 'active' : ''}`}
                            type="button"
                            onClick={() => setOpenNotes((current) => new Set(current.has(problemId) ? [...current].filter((id) => id !== problemId) : [...current, problemId]))}
                            aria-label={`Notes for ${problem.problem_name}`}
                            aria-expanded={notesOpen}
                            title="Notes"
                          >
                            <span className="next-note-icon" aria-hidden="true"></span>
                            <span className="next-note-count">{notes.length}</span>
                          </button>
                        </div>
                      </article>
                    );
                  })
                : null}
            </section>
          );
        })}
      </section>
    </main>
  );
}
