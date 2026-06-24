export const progressStorageKey = 'dsaSheetProblemProgress:v1';

export const normalizeNotes = (record = {}) =>
  Array.isArray(record.notes) ? record.notes.filter((note) => note && typeof note.text === 'string') : [];

export const shouldKeepRecord = (record = {}) => Boolean(record.completed) || normalizeNotes(record).length > 0;

export const readLocalProgress = () => {
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

export const writeLocalProgress = (records) => {
  localStorage.setItem(progressStorageKey, JSON.stringify(records));
};

export const applyProblemUpdate = (records, problemId, value, updatedAt = new Date().toISOString()) => {
  const next = { ...records };
  next[problemId] = {
    ...next[problemId],
    notes: normalizeNotes(next[problemId]),
    ...value,
    updatedAt
  };
  if (!shouldKeepRecord(next[problemId])) delete next[problemId];
  return next;
};

export const applyProblemUpdates = (records, updates, updatedAt = new Date().toISOString()) =>
  updates.reduce((next, { problemId, value }) => applyProblemUpdate(next, problemId, value, updatedAt), records);

export const createLocalProgressAdapter = () => ({
  loadAll() {
    return readLocalProgress();
  },
  replaceAll(records) {
    writeLocalProgress(records);
    return this.loadAll();
  },
  saveProblem(problemId, value) {
    const next = applyProblemUpdate(this.loadAll(), problemId, value);
    return this.replaceAll(next);
  },
  saveProblems(updates) {
    const next = applyProblemUpdates(this.loadAll(), updates);
    return this.replaceAll(next);
  }
});

export const remoteRowsToProgress = (progressRows = [], noteRows = []) => {
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

export const mergeProgress = (localRecords, remoteRecords) => {
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

export const createSupabaseProgressAdapter = (supabase, currentUser) => ({
  async loadAll() {
    if (!supabase || !currentUser) return {};
    const [{ data: progressRows, error: progressError }, { data: noteRows, error: noteError }] = await Promise.all([
      supabase.from('user_problem_progress').select('problem_id, completed, updated_at'),
      supabase.from('user_problem_notes').select('id, problem_id, body, created_at, updated_at').order('created_at')
    ]);
    if (progressError || noteError) throw progressError || noteError;
    return remoteRowsToProgress(progressRows, noteRows);
  },
  async saveProblem(problemId, record) {
    if (!supabase || !currentUser) return;
    if (!shouldKeepRecord(record)) {
      const [{ error: notesDeleteError }, { error: progressDeleteError }] = await Promise.all([
        supabase.from('user_problem_notes').delete().eq('user_id', currentUser.id).eq('problem_id', problemId),
        supabase.from('user_problem_progress').delete().eq('user_id', currentUser.id).eq('problem_id', problemId)
      ]);
      if (notesDeleteError || progressDeleteError) throw notesDeleteError || progressDeleteError;
      return;
    }

    const updatedAt = record.updatedAt || new Date().toISOString();
    const { error: progressError } = await supabase.from('user_problem_progress').upsert({
      user_id: currentUser.id,
      problem_id: problemId,
      completed: Boolean(record.completed),
      updated_at: updatedAt
    });
    if (progressError) throw progressError;

    const notes = normalizeNotes(record);
    let deleteQuery = supabase.from('user_problem_notes').delete().eq('user_id', currentUser.id).eq('problem_id', problemId);
    if (notes.length) deleteQuery = deleteQuery.not('id', 'in', `(${notes.map((note) => `"${note.id}"`).join(',')})`);
    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw deleteError;

    if (!notes.length) return;
    const { error: notesError } = await supabase.from('user_problem_notes').upsert(
      notes.map((note) => ({
        id: note.id,
        user_id: currentUser.id,
        problem_id: problemId,
        body: note.text,
        created_at: note.createdAt || updatedAt,
        updated_at: note.updatedAt || updatedAt
      }))
    );
    if (notesError) throw notesError;
  },
  async saveProblems(records) {
    if (!supabase || !currentUser) return;
    for (const [problemId, record] of Object.entries(records)) {
      await this.saveProblem(problemId, record);
    }
  }
});
