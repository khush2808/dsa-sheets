export const sheets = [
  {
    slug: 'strivers-a2z-sheet',
    type: 'striver',
    initialList: 'all',
    title: 'Striver A2Z',
    subtitle: '474 problems',
    kicker: 'striver-a2z',
    dataFile: 'strivers-a2z-problems.json'
  },
  {
    slug: 'blind-75-sheet',
    type: 'striver',
    initialList: 'all',
    title: 'Blind 75 Sheet',
    subtitle: '75 problems',
    kicker: 'tuf-blind-75',
    dataFile: 'blind-75-sheet-problems.json'
  },
  {
    slug: 'sde-sheet',
    type: 'striver',
    initialList: 'all',
    title: 'SDE Sheet',
    subtitle: '191 problems',
    kicker: 'striver-sde',
    dataFile: 'sde-sheet-problems.json'
  },
  {
    slug: 'striver-79-sheet',
    type: 'striver',
    initialList: 'all',
    title: 'Striver 79',
    subtitle: '79 problems',
    kicker: 'striver-79',
    dataFile: 'striver-79-sheet-problems.json'
  },
  {
    slug: 'neetcode-all',
    type: 'neetcode',
    initialList: 'all',
    title: 'NeetCode All',
    subtitle: 'All NeetCode problems',
    kicker: 'neetcode-all',
    dataFile: 'neetcode-problems.json'
  },
  {
    slug: 'neetcode-250',
    type: 'neetcode',
    initialList: 'neetcode250',
    title: 'NeetCode 250',
    subtitle: '250 problems',
    kicker: 'neetcode-250',
    dataFile: 'neetcode-problems.json'
  },
  {
    slug: 'neetcode-150',
    type: 'neetcode',
    initialList: 'neetcode150',
    title: 'NeetCode 150',
    subtitle: '150 problems',
    kicker: 'neetcode-150',
    dataFile: 'neetcode-problems.json'
  },
  {
    slug: 'blind-75',
    type: 'neetcode',
    initialList: 'blind75',
    title: 'NeetCode Blind 75',
    subtitle: '75 problems',
    kicker: 'neetcode-blind-75',
    dataFile: 'neetcode-problems.json'
  }
];

export const getSheet = (slug) => sheets.find((sheet) => sheet.slug === slug);
