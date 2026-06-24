const state = {
  data: null,
  category: 'all',
  difficulties: ['easy', 'medium', 'hard'],
  includePro: true,
  theme: localStorage.getItem('theme') || 'light',
  query: '',
  linkTarget: localStorage.getItem('dsaSheetLinkTarget') || 'same',
  progress: {},
  openNotes: new Set(),
  celebratingSections: new Set(),
  collapsedSections: new Set(JSON.parse(localStorage.getItem('dsaSheetCollapsedSections') || '[]')),
  supabase: null,
  user: null,
  authStatus: 'local',
  syncStatus: 'local'
};

const $ = (selector) => document.querySelector(selector);

const config = window.SHEET_CONFIG;

const createSupabaseClient = () => {
  const supabaseGlobal = window.supabase;
  const supabaseConfig = window.DSA_SUPABASE_CONFIG;
  if (!supabaseGlobal || !supabaseConfig?.url || !supabaseConfig?.publishableKey) return null;
  return supabaseGlobal.createClient(supabaseConfig.url, supabaseConfig.publishableKey);
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeAttr = escapeHtml;

const linkTargetAttrs = () =>
  state.linkTarget === 'new' ? ' target="_blank" rel="noopener noreferrer"' : '';

const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const progressStorageKey = 'dsaSheetProblemProgress:v1';

const writeLocalProgress = (records) => {
  localStorage.setItem(progressStorageKey, JSON.stringify(records));
};

const problemProgressId = (problem) =>
  [config.type, problem.problem_id || problem.code || problem.leetcode_slug || slug(problem.problem_name)].join(':');

const normalizeNotes = (record = {}) => {
  if (Array.isArray(record.notes)) {
    return record.notes.filter((note) => note && typeof note.text === 'string');
  }
  if (typeof record.notes === 'string' && record.notes.trim()) {
    const now = record.updatedAt || new Date().toISOString();
    return [
      {
        id: `note-${Date.parse(now) || Date.now()}`,
        text: record.notes,
        createdAt: now,
        updatedAt: now
      }
    ];
  }
  return [];
};

const noteCount = (record = {}) => normalizeNotes(record).length;

const shouldKeepProgressRecord = (record = {}) =>
  Boolean(record.completed) || noteCount(record);

const createLocalProgressAdapter = () => {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(progressStorageKey) || '{}');
    } catch {
      return {};
    }
  };

  const applyProblemUpdate = (records, problemId, value, updatedAt) => {
    const existing = records[problemId] || {};
    records[problemId] = {
      ...existing,
      notes: normalizeNotes(existing),
      ...value,
      updatedAt
    };
    if (!shouldKeepProgressRecord(records[problemId])) {
      delete records[problemId];
    }
  };

  return {
    async loadAll() {
      const records = read();
      return Object.fromEntries(
        Object.entries(records).map(([problemId, record]) => [
          problemId,
          {
            ...record,
            notes: normalizeNotes(record)
          }
        ])
      );
    },
    async saveProblem(problemId, value) {
      const records = read();
      applyProblemUpdate(records, problemId, value, new Date().toISOString());
      writeLocalProgress(records);
      return this.loadAll();
    },
    async saveProblems(updates) {
      const records = read();
      const updatedAt = new Date().toISOString();
      updates.forEach(({ problemId, value }) => {
        applyProblemUpdate(records, problemId, value, updatedAt);
      });
      writeLocalProgress(records);
      return this.loadAll();
    }
  };
};

const createProgressRepository = (adapter) => ({
  loadAll: () => adapter.loadAll(),
  saveProblem: (problemId, value) => adapter.saveProblem(problemId, value),
  saveProblems: (updates) => adapter.saveProblems(updates)
});

const progressRepository = createProgressRepository(createLocalProgressAdapter());

const remoteRowsToProgress = (progressRows = [], noteRows = []) => {
  const records = {};
  progressRows.forEach((row) => {
    records[row.problem_id] = {
      ...records[row.problem_id],
      completed: row.completed,
      updatedAt: row.updated_at,
      notes: []
    };
  });
  noteRows.forEach((row) => {
    if (!records[row.problem_id]) {
      records[row.problem_id] = { notes: [] };
    }
    records[row.problem_id].notes.push({
      id: row.id,
      text: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  });
  return Object.fromEntries(
    Object.entries(records).map(([problemId, record]) => [
      problemId,
      {
        ...record,
        notes: normalizeNotes(record)
      }
    ])
  );
};

const loadRemoteProgress = async () => {
  if (!state.supabase || !state.user) return {};
  const [{ data: progressRows, error: progressError }, { data: noteRows, error: notesError }] = await Promise.all([
    state.supabase.from('user_problem_progress').select('problem_id, completed, updated_at'),
    state.supabase.from('user_problem_notes').select('id, problem_id, body, created_at, updated_at').order('created_at')
  ]);
  if (progressError || notesError) {
    throw progressError || notesError;
  }
  return remoteRowsToProgress(progressRows, noteRows);
};

const saveRemoteProblem = async (problemId, record) => {
  if (!state.supabase || !state.user) return;
  const notes = normalizeNotes(record);
  const updatedAt = record.updatedAt || new Date().toISOString();
  const { error: progressError } = await state.supabase.from('user_problem_progress').upsert({
    user_id: state.user.id,
    problem_id: problemId,
    completed: Boolean(record.completed),
    updated_at: updatedAt
  });
  if (progressError) throw progressError;

  const noteIds = notes.map((note) => note.id);
  let deleteQuery = state.supabase
    .from('user_problem_notes')
    .delete()
    .eq('user_id', state.user.id)
    .eq('problem_id', problemId);
  if (noteIds.length) {
    deleteQuery = deleteQuery.not('id', 'in', `(${noteIds.map((id) => `"${id}"`).join(',')})`);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  if (!notes.length) return;
  const { error: notesError } = await state.supabase.from('user_problem_notes').upsert(
    notes.map((note) => ({
      id: note.id,
      user_id: state.user.id,
      problem_id: problemId,
      body: note.text,
      created_at: note.createdAt || updatedAt,
      updated_at: note.updatedAt || updatedAt
    }))
  );
  if (notesError) throw notesError;
};

const saveRemoteProblems = async (progress) => {
  if (!state.supabase || !state.user) return;
  for (const [problemId, record] of Object.entries(progress)) {
    await saveRemoteProblem(problemId, record);
  }
};

const mergeProgressRecords = (localRecords, remoteRecords) => {
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
      if (!existing || noteUpdated >= existingUpdated) {
        notesById.set(note.id, note);
      }
    });
    merged[problemId] = {
      ...remoteRecord,
      completed: localUpdated >= remoteUpdated ? Boolean(localRecord.completed) : Boolean(remoteRecord.completed),
      updatedAt: new Date(Math.max(localUpdated, remoteUpdated, Date.now())).toISOString(),
      notes: [...notesById.values()]
    };
  });
  return Object.fromEntries(Object.entries(merged).filter(([, record]) => shouldKeepProgressRecord(record)));
};

const persistRemoteIfSignedIn = async (problemId, record) => {
  if (!state.user) return;
  state.syncStatus = 'syncing';
  renderAccountPanel();
  try {
    await saveRemoteProblem(problemId, record);
    state.syncStatus = 'synced';
  } catch (error) {
    console.error(error);
    state.syncStatus = 'error';
  }
  renderAccountPanel();
};

const persistAllRemoteIfSignedIn = async () => {
  if (!state.user) return;
  state.syncStatus = 'syncing';
  renderAccountPanel();
  try {
    await saveRemoteProblems(state.progress);
    state.syncStatus = 'synced';
  } catch (error) {
    console.error(error);
    state.syncStatus = 'error';
  }
  renderAccountPanel();
};

const updateProblemProgress = async (problemId, value) => {
  state.progress = await progressRepository.saveProblem(problemId, value);
  await persistRemoteIfSignedIn(problemId, state.progress[problemId] || { notes: [] });
};

const updateManyProblemProgress = async (updates) => {
  state.progress = await progressRepository.saveProblems(updates);
  await persistAllRemoteIfSignedIn();
};

const renderNotesButton = (problemId, progress) => {
  const count = noteCount(progress);
  return `<button class="note-toggle ${state.openNotes.has(problemId) ? 'active' : ''}" type="button" data-notes-toggle="${escapeAttr(problemId)}" aria-expanded="${state.openNotes.has(problemId)}" title="Notes">
    <span class="note-icon" aria-hidden="true"></span>
    <span class="note-count">${count}</span>
  </button>`;
};

const renderNotesPanel = (problemId, progress) => {
  if (!state.openNotes.has(problemId)) return '';
  const notes = normalizeNotes(progress);
  const rows = notes.length
    ? notes
        .map(
          (note) => `<div class="note-editor">
            <textarea data-note-edit="${escapeAttr(problemId)}" data-note-id="${escapeAttr(note.id)}" rows="2">${escapeHtml(note.text)}</textarea>
            <button class="delete-note-button" type="button" data-note-delete="${escapeAttr(problemId)}" data-note-id="${escapeAttr(note.id)}" title="Delete note" aria-label="Delete note">
              <span aria-hidden="true"></span>
            </button>
          </div>`
        )
        .join('')
    : '<p class="notes-empty">No notes yet.</p>';

  return `<div class="notes-panel">
    <div class="notes-banner">${noteCount(progress)} notes</div>
    <div class="notes-list">${rows}</div>
    <button class="add-note-button" type="button" data-note-add="${escapeAttr(problemId)}" title="New note">
      <span aria-hidden="true">+</span>
      <span>New note</span>
    </button>
  </div>`;
};

const problemCompleted = (problem) => Boolean(state.progress[problemProgressId(problem)]?.completed);

const sectionProgress = (problems) => {
  const completed = problems.filter(problemCompleted).length;
  return {
    completed,
    total: problems.length,
    isComplete: Boolean(problems.length && completed === problems.length),
    isPartial: completed > 0 && completed < problems.length
  };
};

const sectionKey = (name) => slug(name || 'uncategorized');

const saveCollapsedSections = () => {
  localStorage.setItem('dsaSheetCollapsedSections', JSON.stringify([...state.collapsedSections]));
};

const celebrateSection = (key) => {
  state.celebratingSections.add(key);
  setTimeout(() => {
    state.celebratingSections.delete(key);
    renderRows();
    applySectionCheckboxStates();
  }, 900);
};

const applySectionCheckboxStates = () => {
  document.querySelectorAll('input[data-section-toggle]').forEach((input) => {
    input.indeterminate = input.dataset.sectionPartial === 'true';
  });
};

const groupName = (problem) =>
  config.type === 'striver' ? problem.category_name : problem.pattern;

const subName = (problem) =>
  config.type === 'striver' ? problem.subcategory_name : problem.code;

const difficultyKey = (value) => String(value ?? '').toLowerCase();

const articleLink = (problem) => problem.article || problem.solution;

const googleSearchLink = (problem) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${problem.problem_name} dsa problem`)}`;

const isInList = (problem, list) => {
  if (list === 'all') return true;
  return Boolean(problem.list_membership?.[list]);
};

const allowsPro = (problem) =>
  config.type !== 'neetcode' || state.includePro || !problem.list_membership?.pro;

const linkSet = (problem) => [
  ['Article', articleLink(problem)],
  ['YouTube', problem.youtube],
  ['LeetCode', problem.leetcode],
  ['Google', googleSearchLink(problem)],
  ['Other', problem.link]
];

const primaryLink = (problem) =>
  articleLink(problem) || problem.leetcode || problem.youtube || problem.link;

const filteredProblems = () =>
  state.data.problems.filter((problem) => {
    const haystack = [
      problem.problem_name,
      groupName(problem),
      subName(problem),
      problem.difficulty,
      problem.code
    ].join(' ').toLowerCase();

    return (
      (state.category === 'all' || slug(groupName(problem)) === state.category) &&
      state.difficulties.includes(difficultyKey(problem.difficulty)) &&
      isInList(problem, config.initialList || 'all') &&
      allowsPro(problem) &&
      haystack.includes(state.query.toLowerCase())
    );
  });

const routeProblems = () =>
  state.data.problems.filter((problem) => isInList(problem, config.initialList || 'all') && allowsPro(problem));

const updateDropdownSummary = (id, fallback) => {
  const dropdown = $(`#${id}`);
  if (!dropdown) return;
  const summary = dropdown.querySelector('summary span');
  const checked = [...dropdown.querySelectorAll('input[type="checkbox"]:checked')].map((checkbox) => checkbox.dataset.label || checkbox.value);
  summary.textContent = checked.length ? checked.join(', ') : fallback;
};

const renderFilterSummaries = () => {
  updateDropdownSummary('difficultyFilter', 'No difficulties');
  updateDropdownSummary('proFilter', 'No Pro questions');
};

const applyTheme = () => {
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem('theme', state.theme);
  const button = $('#themeToggle');
  if (button) {
    const label = state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(state.theme === 'dark'));
  }
};

const renderStats = () => {
  const problems = filteredProblems();
  const easy = problems.filter((problem) => difficultyKey(problem.difficulty) === 'easy').length;
  const medium = problems.filter((problem) => difficultyKey(problem.difficulty) === 'medium').length;
  const hard = problems.filter((problem) => difficultyKey(problem.difficulty) === 'hard').length;
  $('.stat-grid').innerHTML = [
    ['Problems', problems.length],
    ['Easy', easy],
    ['Medium', medium],
    ['Hard', hard]
  ]
    .map(([label, value]) => `<div class="stat"><b>${value}</b><span>${escapeHtml(label)}</span></div>`)
    .join('');
};

const renderCategories = () => {
  const groups = config.type === 'striver' ? state.data.sections : state.data.patterns;
  const routeScopedProblems = routeProblems();
  $('.category-list').innerHTML = [
    `<button class="${state.category === 'all' ? 'active' : ''}" data-category="all"><span>All</span><b>${routeScopedProblems.length}</b></button>`,
    ...groups.map((group) => {
      const name = config.type === 'striver' ? group.category_name : group.pattern_name;
      const count = routeScopedProblems.filter((problem) => groupName(problem) === name).length;
      if (!count) return '';
      return `<button class="${state.category === slug(name) ? 'active' : ''}" data-category="${slug(name)}"><span>${escapeHtml(name)}</span><b>${count}</b></button>`;
    })
  ].join('');
};

const renderLinkTargetControl = () => {
  const nav = $('.nav-links');
  nav.insertAdjacentHTML(
    'afterend',
    `<section class="link-target-panel" aria-label="Problem link behavior">
      <h2>Links</h2>
      <label for="linkTarget">Open problem links</label>
      <select id="linkTarget">
        <option value="same">Same tab</option>
        <option value="new">New tab</option>
      </select>
    </section>`
  );
  $('#linkTarget').value = state.linkTarget;
};

const syncLabel = () => {
  if (!state.user) return 'Local only';
  if (state.syncStatus === 'syncing') return 'Syncing...';
  if (state.syncStatus === 'error') return 'Sync issue';
  return 'Synced';
};

const renderAccountPanel = () => {
  const panel = $('.account-panel');
  if (!panel) return;
  if (state.authStatus === 'loading') {
    panel.innerHTML = '<h2>Account</h2><div class="account-card"><span class="sync-dot"></span><p>Checking session...</p></div>';
    return;
  }
  if (state.user) {
    const label = state.user.email || 'Signed in';
    panel.innerHTML = `<h2>Account</h2>
      <div class="account-card">
        <div>
          <b>${escapeHtml(label)}</b>
          <p><span class="sync-dot ${state.syncStatus}"></span>${escapeHtml(syncLabel())}</p>
        </div>
        <button type="button" data-auth-action="sign-out">Sign out</button>
      </div>`;
    return;
  }
  panel.innerHTML = `<h2>Account</h2>
    <div class="account-card">
      <label for="authEmail">Email</label>
      <input id="authEmail" type="email" placeholder="you@example.com" autocomplete="email" />
      <button type="button" data-auth-action="email">Send magic link</button>
      <div class="auth-buttons">
        <button type="button" data-auth-provider="google">Google</button>
        <button type="button" data-auth-provider="github">GitHub</button>
      </div>
      <p><span class="sync-dot"></span>${escapeHtml(syncLabel())}</p>
    </div>`;
};

const redirectUrl = () => `${location.origin}${location.pathname}`;

const signInWithEmail = async () => {
  if (!state.supabase) return;
  const email = $('#authEmail')?.value.trim();
  if (!email) return;
  state.syncStatus = 'syncing';
  renderAccountPanel();
  const { error } = await state.supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl()
    }
  });
  state.syncStatus = error ? 'error' : 'synced';
  renderAccountPanel();
};

const signInWithProvider = async (provider) => {
  if (!state.supabase) return;
  await state.supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl()
    }
  });
};

const signOut = async () => {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  state.user = null;
  state.authStatus = 'local';
  state.syncStatus = 'local';
  renderAccountPanel();
};

const syncSignedInProgress = async () => {
  if (!state.supabase || !state.user) return;
  state.syncStatus = 'syncing';
  renderAccountPanel();
  try {
    const localRecords = await progressRepository.loadAll();
    const remoteRecords = await loadRemoteProgress();
    state.progress = mergeProgressRecords(localRecords, remoteRecords);
    writeLocalProgress(state.progress);
    await saveRemoteProblems(state.progress);
    state.syncStatus = 'synced';
    rerender();
  } catch (error) {
    console.error(error);
    state.syncStatus = 'error';
  }
  renderAccountPanel();
};

const initAuth = async () => {
  state.supabase = createSupabaseClient();
  if (!state.supabase) {
    state.authStatus = 'local';
    state.syncStatus = 'local';
    renderAccountPanel();
    return;
  }
  state.authStatus = 'loading';
  renderAccountPanel();
  const { data } = await state.supabase.auth.getSession();
  state.user = data.session?.user || null;
  state.authStatus = state.user ? 'signed-in' : 'local';
  state.syncStatus = state.user ? 'syncing' : 'local';
  renderAccountPanel();
  if (state.user) {
    await syncSignedInProgress();
  }
  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    state.authStatus = state.user ? 'signed-in' : 'local';
    state.syncStatus = state.user ? 'syncing' : 'local';
    renderAccountPanel();
    if (state.user) {
      await syncSignedInProgress();
    }
  });
};

const renderRows = () => {
  const problems = filteredProblems();
  const headLabel = state.category === 'all' ? 'Sections' : problems[0] ? groupName(problems[0]) : 'Section';
  $('.problem-head').innerHTML = `
    <span>${escapeHtml(headLabel)}</span>
    <span class="result-count">${problems.length} shown</span>`;
  const groupedProblems = problems.reduce((groups, problem) => {
    const name = groupName(problem) || 'Uncategorized';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(problem);
    return groups;
  }, new Map());

  $('.problem-list').innerHTML =
    [...groupedProblems.entries()]
      .map(([name, groupProblems]) => {
        const key = sectionKey(name);
        const groupProgress = sectionProgress(groupProblems);
        const groupProblemIds = groupProblems.map(problemProgressId).join(' ');
        const isCollapsed = state.collapsedSections.has(key);
        const rows = groupProblems
          .map((problem) => {
            const mainHref = primaryLink(problem);
            const problemId = problemProgressId(problem);
            const progress = state.progress[problemId] || {};
            const links = linkSet(problem)
              .filter(([, href]) => href)
              .map(([label, href]) => `<a href="${escapeAttr(href)}"${linkTargetAttrs()}>${escapeHtml(label)}</a>`)
              .join('');

            return `<article class="problem-row ${mainHref ? 'clickable' : ''}" ${mainHref ? `data-primary-link="${escapeAttr(mainHref)}"` : ''}>
              <label class="done-control" title="Mark complete">
                <input type="checkbox" data-progress-id="${escapeAttr(problemId)}" data-progress-field="completed" ${progress.completed ? 'checked' : ''} />
              </label>
              <div class="problem-title">
                <div class="problem-line">
                  ${
                    mainHref
                      ? `<a class="primary-link" href="${escapeAttr(mainHref)}"${linkTargetAttrs()}>${escapeHtml(problem.problem_name)}</a>`
                      : `<b>${escapeHtml(problem.problem_name)}</b>`
                  }
                  <span class="pill ${String(problem.difficulty).toLowerCase()}">${escapeHtml(problem.difficulty)}</span>
                </div>
                <span>${escapeHtml(subName(problem) || '')}</span>
                ${renderNotesPanel(problemId, progress)}
              </div>
              <div class="links">${links}${renderNotesButton(problemId, progress)}</div>
            </article>`;
          })
          .join('');

        return `<section class="problem-section ${groupProgress.isComplete ? 'section-complete' : ''} ${state.celebratingSections.has(key) ? 'section-just-completed' : ''}" data-section-key="${escapeAttr(key)}">
          <header class="section-card">
            <button class="section-collapse" type="button" data-section-collapse="${escapeAttr(key)}" aria-label="${isCollapsed ? 'Expand' : 'Collapse'} ${escapeAttr(name)}" aria-expanded="${!isCollapsed}">
              <span aria-hidden="true"></span>
            </button>
            <div>
              <h3>${escapeHtml(name)}</h3>
              <p>${escapeHtml(config.type === 'striver' ? 'Section' : 'Pattern')}</p>
            </div>
            <div class="section-status">
              <label class="section-done-control" title="Mark section complete">
                <input type="checkbox" data-section-toggle data-section-partial="${groupProgress.isPartial}" data-problem-ids="${escapeAttr(groupProblemIds)}" aria-label="Mark ${escapeAttr(name)} complete" ${groupProgress.isComplete ? 'checked' : ''} />
              </label>
              <span>${groupProgress.completed}/${groupProgress.total}</span>
            </div>
          </header>
          <div class="section-problems" ${isCollapsed ? 'hidden' : ''}>${rows}</div>
        </section>`;
      })
      .join('') || `<div class="empty">No problems match the current filters.</div>`;
};

const renderFilters = () => {
  $('#proFilter').hidden = config.type !== 'neetcode';

  document.querySelectorAll('#difficultyFilter input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = state.difficulties.includes(checkbox.value);
  });
  $('#includePro').checked = state.includePro;
  renderFilterSummaries();
};

const renderCanvas = () => {
  const canvas = $('#heroCanvas');
  const ctx = canvas.getContext('2d');
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * devicePixelRatio);
    canvas.height = Math.floor(rect.height * devicePixelRatio);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    draw();
  };
  const draw = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    const colors = ['#0f8b8d', '#edae49', '#d1495b', '#ffffff'];
    for (let i = 0; i < 42; i++) {
      const x = ((i * 97) % width) + 20;
      const y = ((i * 53) % height) + 12;
      const size = 2 + (i % 5);
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.72;
      ctx.fillRect(x, y, size, size);
      if (i % 3 === 0) {
        ctx.strokeStyle = colors[(i + 1) % colors.length];
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo((x + 140) % width, (y + 90) % height);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  };
  resize();
  addEventListener('resize', resize);
};

const rerender = () => {
  renderStats();
  renderCategories();
  renderRows();
  applySectionCheckboxStates();
};

const init = async () => {
  applyTheme();
  state.data = await fetch(config.dataUrl).then((response) => response.json());
  state.progress = await progressRepository.loadAll();
  document.title = config.title;
  $('.brand h1').textContent = config.shortTitle;
  $('.brand p').textContent = config.subtitle;
  $('.eyebrow').textContent = config.kicker;
  $('.hero h2').textContent = config.title;
  $('.hero p').textContent = config.description;

  renderFilters();
  renderLinkTargetControl();
  renderAccountPanel();
  renderCanvas();
  rerender();
  await initAuth();

  $('#search').addEventListener('input', (event) => {
    state.query = event.target.value;
    rerender();
  });
  $('#difficultyFilter').addEventListener('change', () => {
    state.difficulties = [...document.querySelectorAll('#difficultyFilter input[type="checkbox"]:checked')].map(
      (checkbox) => checkbox.value
    );
    renderFilterSummaries();
    rerender();
  });
  $('#proFilter').addEventListener('change', () => {
    state.includePro = $('#includePro').checked;
    renderFilterSummaries();
    rerender();
  });
  $('#themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  });
  $('#linkTarget').addEventListener('change', (event) => {
    state.linkTarget = event.target.value;
    localStorage.setItem('dsaSheetLinkTarget', state.linkTarget);
    rerender();
  });
  $('.side').addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-auth-action]');
    if (actionButton?.dataset.authAction === 'email') {
      await signInWithEmail();
      return;
    }
    if (actionButton?.dataset.authAction === 'sign-out') {
      await signOut();
      return;
    }
    const providerButton = event.target.closest('[data-auth-provider]');
    if (providerButton) {
      await signInWithProvider(providerButton.dataset.authProvider);
    }
  });
  $('#randomButton').addEventListener('click', () => {
    const problems = filteredProblems();
    if (!problems.length) return;
    const problem = problems[Math.floor(Math.random() * problems.length)];
    state.query = problem.problem_name;
    $('#search').value = problem.problem_name;
    rerender();
  });
  $('.category-list').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    rerender();
  });
  $('.problem-list').addEventListener('click', (event) => {
    if (event.target.closest('a, button, input, textarea, select, label')) return;
    const row = event.target.closest('.problem-row[data-primary-link]');
    if (!row) return;
    if (state.linkTarget === 'new') {
      window.open(row.dataset.primaryLink, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.href = row.dataset.primaryLink;
  });
  $('.problem-list').addEventListener('change', async (event) => {
    const sectionInput = event.target.closest('input[data-section-toggle]');
    if (sectionInput) {
      const section = sectionInput.closest('.problem-section');
      const sectionWasComplete = section?.classList.contains('section-complete');
      const sectionKey = section?.dataset.sectionKey;
      const problemIds = sectionInput.dataset.problemIds.split(' ').filter(Boolean);
      await updateManyProblemProgress(
        problemIds.map((problemId) => ({
          problemId,
          value: { completed: sectionInput.checked }
        }))
      );
      if (sectionInput.checked && !sectionWasComplete && sectionKey) {
        celebrateSection(sectionKey);
      }
      rerender();
      return;
    }

    const input = event.target.closest('input[data-progress-field="completed"]');
    if (!input) return;
    const section = input.closest('.problem-section');
    const sectionWasComplete = section?.classList.contains('section-complete');
    const sectionKey = section?.dataset.sectionKey;
    await updateProblemProgress(input.dataset.progressId, { completed: input.checked });
    if (!sectionWasComplete && sectionKey) {
      const problemIds = section
        ? [...section.querySelectorAll('input[data-progress-field="completed"]')].map((checkbox) => checkbox.dataset.progressId)
        : [];
      const isNowComplete = problemIds.length > 0 && problemIds.every((problemId) => state.progress[problemId]?.completed);
      if (isNowComplete) {
        celebrateSection(sectionKey);
      }
    }
    rerender();
  });
  $('.problem-list').addEventListener('click', async (event) => {
    const collapseButton = event.target.closest('button[data-section-collapse]');
    if (collapseButton) {
      const key = collapseButton.dataset.sectionCollapse;
      if (state.collapsedSections.has(key)) {
        state.collapsedSections.delete(key);
      } else {
        state.collapsedSections.add(key);
      }
      saveCollapsedSections();
      rerender();
      return;
    }

    const toggle = event.target.closest('button[data-notes-toggle]');
    if (toggle) {
      const problemId = toggle.dataset.notesToggle;
      if (state.openNotes.has(problemId)) {
        state.openNotes.delete(problemId);
      } else {
        state.openNotes.add(problemId);
      }
      rerender();
      return;
    }

    const addButton = event.target.closest('button[data-note-add]');
    if (addButton) {
      const problemId = addButton.dataset.noteAdd;
      const progress = state.progress[problemId] || {};
      const now = new Date().toISOString();
      const notes = [
        ...normalizeNotes(progress),
        {
          id: `note-${Date.now()}`,
          text: '',
          createdAt: now,
          updatedAt: now
        }
      ];
      await updateProblemProgress(problemId, { notes });
      state.openNotes.add(problemId);
      rerender();
      $(`textarea[data-note-id="${notes[notes.length - 1].id}"]`)?.focus();
      return;
    }

    const deleteButton = event.target.closest('button[data-note-delete]');
    if (!deleteButton) return;
    const problemId = deleteButton.dataset.noteDelete;
    const noteId = deleteButton.dataset.noteId;
    const progress = state.progress[problemId] || {};
    const notes = normalizeNotes(progress).filter((note) => note.id !== noteId);
    await updateProblemProgress(problemId, { notes });
    state.openNotes.add(problemId);
    rerender();
  });
  $('.problem-list').addEventListener('input', async (event) => {
    const textarea = event.target.closest('textarea[data-note-edit]');
    if (!textarea) return;
    const problemId = textarea.dataset.noteEdit;
    const noteId = textarea.dataset.noteId;
    const progress = state.progress[problemId] || {};
    const notes = normalizeNotes(progress).map((note) =>
      note.id === noteId ? { ...note, text: textarea.value, updatedAt: new Date().toISOString() } : note
    );
    await updateProblemProgress(problemId, { notes });
  });
};

init();
