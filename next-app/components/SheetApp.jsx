'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const progressStorageKey = 'dsaSheetProblemProgress:v1';
const collapseStorageKey = 'dsaSheetCollapsedSections';

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

const normalizeNotes = (record = {}) => (Array.isArray(record.notes) ? record.notes.filter((note) => note && typeof note.text === 'string') : []);

const shouldKeepRecord = (record = {}) => Boolean(record.completed) || normalizeNotes(record).length > 0;

const readLocalProgress = () => {
  try {
    const records = JSON.parse(localStorage.getItem(progressStorageKey) || '{}');
    return Object.fromEntries(
      Object.entries(records).map(([problemId, record]) => [
        problemId,
        {
          ...record,
          notes: normalizeNotes(record)
        }
      ])
    );
  } catch {
    return {};
  }
};

const writeLocalProgress = (records) => {
  localStorage.setItem(progressStorageKey, JSON.stringify(records));
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

const remoteRowsToProgress = (progressRows = [], noteRows = []) => {
  const records = {};
  progressRows.forEach((row) => {
    records[row.problem_id] = {
      completed: row.completed,
      updatedAt: row.updated_at,
      notes: []
    };
  });
  noteRows.forEach((row) => {
    records[row.problem_id] ||= { notes: [] };
    records[row.problem_id].notes.push({
      id: row.id,
      text: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  });
  return records;
};

const mergeProgress = (localRecords, remoteRecords) => {
  const merged = { ...remoteRecords };
  Object.entries(localRecords).forEach(([problemId, localRecord]) => {
    const remoteRecord = merged[problemId] || { notes: [] };
    const localUpdated = Date.parse(localRecord.updatedAt || '') || 0;
    const remoteUpdated = Date.parse(remoteRecord.updatedAt || '') || 0;
    const notesById = new Map(normalizeNotes(remoteRecord).map((note) => [note.id, note]));
    normalizeNotes(localRecord).forEach((note) => {
      const existing = notesById.get(note.id);
      const noteUpdated = Date.parse(note.updatedAt || '') || 0;
      const existingUpdated = Date.parse(existing?.updatedAt || '') || 0;
      if (!existing || noteUpdated >= existingUpdated) notesById.set(note.id, note);
    });
    merged[problemId] = {
      ...remoteRecord,
      completed: localUpdated >= remoteUpdated ? Boolean(localRecord.completed) : Boolean(remoteRecord.completed),
      updatedAt: new Date(Math.max(localUpdated, remoteUpdated, Date.now())).toISOString(),
      notes: [...notesById.values()]
    };
  });
  return Object.fromEntries(Object.entries(merged).filter(([, record]) => shouldKeepRecord(record)));
};

export default function SheetApp({ sheet, initialProblems }) {
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState(supabase ? 'Checking session' : 'Local only');
  const [query, setQuery] = useState('');
  const [difficulties, setDifficulties] = useState(['easy', 'medium', 'hard']);
  const [includePro, setIncludePro] = useState(true);
  const [progress, setProgress] = useState({});
  const [collapsed, setCollapsed] = useState(new Set());
  const [openNotes, setOpenNotes] = useState(new Set());

  useEffect(() => {
    setProgress(readLocalProgress());
    setCollapsed(readCollapsed());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
      setSyncStatus(data.session?.user ? 'Syncing...' : 'Signed out');
      if (data.session?.user) await syncRemote(data.session.user);
    };
    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      setSyncStatus(session?.user ? 'Syncing...' : 'Signed out');
      if (session?.user) await syncRemote(session.user);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const filteredProblems = useMemo(
    () =>
      initialProblems.filter((problem) => {
        const haystack = [problem.problem_name, groupName(sheet, problem), subName(sheet, problem), problem.difficulty, problem.code]
          .join(' ')
          .toLowerCase();
        return (
          difficulties.includes(difficultyKey(problem.difficulty)) &&
          (sheet.type !== 'neetcode' || includePro || !problem.list_membership?.pro) &&
          haystack.includes(query.toLowerCase())
        );
      }),
    [difficulties, includePro, initialProblems, query, sheet]
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
      const [{ data: progressRows, error: progressError }, { data: noteRows, error: noteError }] = await Promise.all([
        supabase.from('user_problem_progress').select('problem_id, completed, updated_at'),
        supabase.from('user_problem_notes').select('id, problem_id, body, created_at, updated_at').order('created_at')
      ]);
      if (progressError || noteError) throw progressError || noteError;
      const merged = mergeProgress(readLocalProgress(), remoteRowsToProgress(progressRows, noteRows));
      writeLocalProgress(merged);
      setProgress(merged);
      await saveAllRemote(merged, currentUser);
      setSyncStatus('Synced');
    } catch (error) {
      console.error(error);
      setSyncStatus('Sync issue');
    }
  };

  const saveRemoteProblem = async (problemId, record, currentUser = user) => {
    if (!supabase || !currentUser) return;
    if (!shouldKeepRecord(record)) {
      await Promise.all([
        supabase.from('user_problem_notes').delete().eq('user_id', currentUser.id).eq('problem_id', problemId),
        supabase.from('user_problem_progress').delete().eq('user_id', currentUser.id).eq('problem_id', problemId)
      ]);
      return;
    }
    const updatedAt = record.updatedAt || new Date().toISOString();
    await supabase.from('user_problem_progress').upsert({
      user_id: currentUser.id,
      problem_id: problemId,
      completed: Boolean(record.completed),
      updated_at: updatedAt
    });
    const notes = normalizeNotes(record);
    let deleteQuery = supabase.from('user_problem_notes').delete().eq('user_id', currentUser.id).eq('problem_id', problemId);
    if (notes.length) deleteQuery = deleteQuery.not('id', 'in', `(${notes.map((note) => `"${note.id}"`).join(',')})`);
    await deleteQuery;
    if (notes.length) {
      await supabase.from('user_problem_notes').upsert(
        notes.map((note) => ({
          id: note.id,
          user_id: currentUser.id,
          problem_id: problemId,
          body: note.text,
          created_at: note.createdAt || updatedAt,
          updated_at: note.updatedAt || updatedAt
        }))
      );
    }
  };

  const saveAllRemote = async (records, currentUser = user) => {
    if (!supabase || !currentUser) return;
    for (const [problemId, record] of Object.entries(records)) await saveRemoteProblem(problemId, record, currentUser);
  };

  const updateProblem = async (problemId, value) => {
    const updatedAt = new Date().toISOString();
    const next = { ...progress };
    next[problemId] = { ...next[problemId], notes: normalizeNotes(next[problemId]), ...value, updatedAt };
    if (!shouldKeepRecord(next[problemId])) delete next[problemId];
    setProgress(next);
    writeLocalProgress(next);
    if (user) {
      setSyncStatus('Syncing...');
      await saveRemoteProblem(problemId, next[problemId] || { notes: [] });
      setSyncStatus('Synced');
    }
  };

  const toggleSection = async (problems, checked) => {
    const updatedAt = new Date().toISOString();
    const next = { ...progress };
    const affectedProblemIds = problems.map((problem) => problemIdFor(sheet, problem));
    problems.forEach((problem) => {
      const problemId = problemIdFor(sheet, problem);
      next[problemId] = { ...next[problemId], notes: normalizeNotes(next[problemId]), completed: checked, updatedAt };
      if (!shouldKeepRecord(next[problemId])) delete next[problemId];
    });
    setProgress(next);
    writeLocalProgress(next);
    if (user) {
      setSyncStatus('Syncing...');
      await Promise.all(affectedProblemIds.map((problemId) => saveRemoteProblem(problemId, next[problemId] || { notes: [] })));
      setSyncStatus('Synced');
    }
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
  };

  const editNote = (problemId, noteId, text) => {
    updateProblem(problemId, {
      notes: normalizeNotes(progress[problemId]).map((note) => (note.id === noteId ? { ...note, text, updatedAt: new Date().toISOString() } : note))
    });
  };

  const deleteNote = (problemId, noteId) => {
    updateProblem(problemId, { notes: normalizeNotes(progress[problemId]).filter((note) => note.id !== noteId) });
  };

  const signInWithEmail = async () => {
    const email = window.prompt('Email for magic link');
    if (!email || !supabase) return;
    setSyncStatus('Sending magic link');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    setSyncStatus(error ? 'Auth error' : 'Check your email');
  };

  const signInWithProvider = async (provider) => {
    await supabase?.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.href } });
  };

  const totalCompleted = filteredProblems.filter((problem) => progress[problemIdFor(sheet, problem)]?.completed).length;

  return (
    <main className="next-shell">
      <header className="next-toolbar">
        <a href="/">All sheets</a>
        <div>
          <span>{user?.email || syncStatus}</span>
          {user ? (
            <button type="button" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          ) : (
            <>
              <button type="button" onClick={signInWithEmail} disabled={!supabase}>
                Email
              </button>
              <button type="button" onClick={() => signInWithProvider('google')} disabled={!supabase}>
                Google
              </button>
              <button type="button" onClick={() => signInWithProvider('github')} disabled={!supabase}>
                GitHub
              </button>
            </>
          )}
        </div>
      </header>
      <section className="next-hero compact">
        <p>{sheet.kicker}</p>
        <h1>{sheet.title}</h1>
        <span>
          {totalCompleted}/{filteredProblems.length} shown completed
        </span>
      </section>
      <section className="next-filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search problems" />
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
            <section key={name} className="next-section">
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
                  onChange={(event) => toggleSection(problems, event.target.checked)}
                  aria-label={`Mark ${name} complete`}
                />
              </header>
              {!collapsed.has(key)
                ? problems.map((problem) => {
                    const problemId = problemIdFor(sheet, problem);
                    const record = progress[problemId] || { notes: [] };
                    const notes = normalizeNotes(record);
                    const notesOpen = openNotes.has(problemId);
                    return (
                      <article key={problemId}>
                        <input
                          type="checkbox"
                          checked={Boolean(record.completed)}
                          onChange={(event) => updateProblem(problemId, { completed: event.target.checked })}
                          aria-label={`Mark ${problem.problem_name} complete`}
                        />
                        <div>
                          <b>{problem.problem_name}</b>
                          <span>
                            {subName(sheet, problem)} · {problem.difficulty}
                          </span>
                          {notesOpen ? (
                            <div className="next-notes">
                              {notes.map((note) => (
                                <label key={note.id}>
                                  <textarea value={note.text} onChange={(event) => editNote(problemId, note.id, event.target.value)} />
                                  <button type="button" onClick={() => deleteNote(problemId, note.id)} aria-label="Delete note">
                                    Delete
                                  </button>
                                </label>
                              ))}
                              <button type="button" onClick={() => addNote(problemId)}>
                                New note
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <button type="button" onClick={() => setOpenNotes((current) => new Set(current.has(problemId) ? [...current].filter((id) => id !== problemId) : [...current, problemId]))}>
                          Notes {notes.length}
                        </button>
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
