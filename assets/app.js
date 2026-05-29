const state = {
  data: null,
  category: 'all',
  difficulties: ['easy', 'medium', 'hard'],
  includePro: true,
  theme: localStorage.getItem('theme') || 'light',
  query: ''
};

const $ = (selector) => document.querySelector(selector);

const config = window.SHEET_CONFIG;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeAttr = escapeHtml;

const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const groupName = (problem) =>
  config.type === 'striver' ? problem.category_name : problem.pattern;

const subName = (problem) =>
  config.type === 'striver' ? problem.subcategory_name : problem.code;

const difficultyKey = (value) => String(value ?? '').toLowerCase();

const articleLink = (problem) => problem.article || problem.solution;

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
        const rows = groupProblems
          .map((problem) => {
            const mainHref = primaryLink(problem);
            const links = linkSet(problem)
              .filter(([, href]) => href)
              .map(([label, href]) => `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>`)
              .join('');

            return `<article class="problem-row ${mainHref ? 'clickable' : ''}" ${mainHref ? `data-primary-link="${escapeAttr(mainHref)}"` : ''}>
              <div class="problem-title">
                <div class="problem-line">
                  ${
                    mainHref
                      ? `<a class="primary-link" href="${escapeAttr(mainHref)}">${escapeHtml(problem.problem_name)}</a>`
                      : `<b>${escapeHtml(problem.problem_name)}</b>`
                  }
                  <span class="pill ${String(problem.difficulty).toLowerCase()}">${escapeHtml(problem.difficulty)}</span>
                </div>
                <span>${escapeHtml(subName(problem) || '')}</span>
              </div>
              <div class="links">${links}</div>
            </article>`;
          })
          .join('');

        return `<section class="problem-section">
          <header class="section-card">
            <div>
              <h3>${escapeHtml(name)}</h3>
              <p>${escapeHtml(config.type === 'striver' ? 'Section' : 'Pattern')}</p>
            </div>
            <span>${groupProblems.length}</span>
          </header>
          <div class="section-problems">${rows}</div>
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
};

const init = async () => {
  applyTheme();
  state.data = await fetch(config.dataUrl).then((response) => response.json());
  document.title = config.title;
  $('.brand h1').textContent = config.shortTitle;
  $('.brand p').textContent = config.subtitle;
  $('.eyebrow').textContent = config.kicker;
  $('.hero h2').textContent = config.title;
  $('.hero p').textContent = config.description;
  $('.download').href = config.excelUrl;

  renderFilters();
  renderCanvas();
  rerender();

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
    if (event.target.closest('a')) return;
    const row = event.target.closest('.problem-row[data-primary-link]');
    if (!row) return;
    window.location.href = row.dataset.primaryLink;
  });
};

init();
