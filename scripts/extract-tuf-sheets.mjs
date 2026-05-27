import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const sources = [
  {
    output: 'blind-75-sheet-problems.json',
    url: 'https://takeuforward.org/dsa/blind-75-leetcode-problems-detailed-video-solutions',
    slug: 'blind-75-sheet'
  },
  {
    output: 'sde-sheet-problems.json',
    url: 'https://takeuforward.org/interviews/strivers-sde-sheet-top-coding-interview-problems/',
    slug: 'sde-sheet'
  },
  {
    output: 'striver-79-sheet-problems.json',
    url: 'https://takeuforward.org/dsa/strivers-79-last-moment-dsa-sheet-ace-interviews',
    slug: 'striver-79-sheet'
  }
];

const scriptContents = (html) =>
  [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

const flightText = (html) => {
  const chunks = [];
  const context = {
    self: { __next_f: { push: (chunk) => chunks.push(chunk) } },
    document: { querySelectorAll: () => ({ forEach: () => {} }) },
    requestAnimationFrame: () => {},
    performance: { now: () => 0 },
    setTimeout: () => {},
    __name: (fn) => fn
  };

  vm.createContext(context);
  for (const script of scriptContents(html)) {
    if (!script.includes('self.__next_f.push')) continue;
    try {
      vm.runInContext(script, context, { timeout: 1000 });
    } catch {
      // Some chunks reference browser-only globals; the data chunks still evaluate.
    }
  }

  return chunks.map((chunk) => chunk[1] || '').join('');
};

const jsonObjectAroundSections = (text) => {
  const sectionIndex = text.indexOf('"sections"');
  if (sectionIndex < 0) {
    throw new Error('Could not find sections payload in TUF page');
  }

  const start = text.lastIndexOf('{"title"', sectionIndex);
  if (start < 0) {
    throw new Error('Could not find sheet object start in TUF page');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(text.slice(start, index + 1));
      }
    }
  }

  throw new Error('Could not find sheet object end in TUF page');
};

const normalizeUrl = (value) => {
  if (!value || value === '$undefined') return '';
  if (String(value).startsWith('/')) return `https://takeuforward.org${value}`;
  return value;
};

const normalizeProblem = (problem, category) => ({
  problem_id: problem.problem_id,
  problem_name: problem.problem_name,
  category_id: category.category_id,
  category_name: category.category_name,
  subcategory_id: '',
  subcategory_name: '',
  difficulty: problem.difficulty,
  article: normalizeUrl(problem.article),
  leetcode: normalizeUrl(problem.leetcode),
  youtube: normalizeUrl(problem.youtube),
  plus: normalizeUrl(problem.plus),
  editorial: normalizeUrl(problem.editorial),
  link: normalizeUrl(problem.link)
});

const extractSource = async (source) => {
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status}`);
  }

  const html = await response.text();
  const sheet = jsonObjectAroundSections(flightText(html));
  const problems = sheet.sections.flatMap((category) =>
    category.problems.map((problem) => normalizeProblem(problem, category))
  );

  return {
    title: sheet.title,
    description: sheet.description,
    last_updated: sheet.lastUpdated,
    source_url: source.url,
    slug: source.slug,
    total_problems: problems.length,
    sections: sheet.sections.map((category) => ({
      category_id: category.category_id,
      category_name: category.category_name,
      problem_count: category.problems.length
    })),
    problems
  };
};

for (const source of sources) {
  const data = await extractSource(source);
  const outputPath = path.join(root, source.output);
  await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${source.output}: ${data.total_problems} problems`);
}
