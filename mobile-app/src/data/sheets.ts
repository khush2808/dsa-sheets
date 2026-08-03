import striversA2ZData from './strivers-a2z-problems.json';
import blind75SheetData from './blind-75-sheet-problems.json';
import sdeSheetData from './sde-sheet-problems.json';
import striver79SheetData from './striver-79-sheet-problems.json';
import neetcodeData from './neetcode-problems.json';

export interface Problem {
  problem_id?: string;
  problem_name: string;
  category_name?: string;
  subcategory_name?: string;
  difficulty: string;
  article?: string;
  leetcode?: string;
  youtube?: string;
  plus?: string;
  editorial?: string;
  pattern?: string;
  solution?: string;
  code?: string;
  neetcode?: string;
  list_membership?: {
    blind75?: boolean;
    neetcode150?: boolean;
    neetcode250?: boolean;
    premium_algo100?: boolean;
    pro?: boolean;
  };
}

export interface SheetMeta {
  id: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  problems: Problem[];
}

export const SHEETS: SheetMeta[] = [
  {
    id: 'strivers-a2z',
    title: 'Striver A2Z DSA Track',
    shortTitle: 'Striver A2Z',
    subtitle: '474 Problems • TUF',
    description: 'The complete A2Z DSA track with article, video, LeetCode, and editorial links.',
    problems: striversA2ZData.problems as Problem[]
  },
  {
    id: 'blind-75-sheet',
    title: 'Blind 75 Sheet',
    shortTitle: 'Blind 75',
    subtitle: '75 Problems • TUF',
    description: 'The takeUforward Blind 75 interview problem list.',
    problems: blind75SheetData.problems as Problem[]
  },
  {
    id: 'sde-sheet',
    title: 'SDE Sheet',
    shortTitle: 'SDE Sheet',
    subtitle: '191 Problems • TUF',
    description: "Striver's most frequently asked coding interview questions by topic.",
    problems: sdeSheetData.problems as Problem[]
  },
  {
    id: 'striver-79',
    title: 'Striver 79',
    shortTitle: 'Striver 79',
    subtitle: '79 Problems • TUF',
    description: 'Last-minute interview prep with a compact high-signal problem set.',
    problems: striver79SheetData.problems as Problem[]
  },
  {
    id: 'neetcode-150',
    title: 'NeetCode 150',
    shortTitle: 'NeetCode 150',
    subtitle: '150 Problems • NeetCode',
    description: 'The 150-problem NeetCode interview roadmap.',
    problems: (neetcodeData.problems as Problem[]).filter(
      (p) => p.list_membership && p.list_membership.neetcode150
    )
  },
  {
    id: 'neetcode-250',
    title: 'NeetCode 250',
    shortTitle: 'NeetCode 250',
    subtitle: '250 Problems • NeetCode',
    description: 'The expanded NeetCode 250 problem track.',
    problems: (neetcodeData.problems as Problem[]).filter(
      (p) => p.list_membership && p.list_membership.neetcode250
    )
  },
  {
    id: 'neetcode-all',
    title: 'NeetCode All',
    shortTitle: 'NeetCode All',
    subtitle: '973 Problems • NeetCode',
    description: 'Full NeetCode problem catalog with pattern filters.',
    problems: neetcodeData.problems as Problem[]
  }
];
