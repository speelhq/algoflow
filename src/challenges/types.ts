// C-01, C-16: the challenge and plan schemas. A leaf module: scripts run with tsx
// import it, so it must not import `index.ts` (which uses `import.meta.glob`, C-14).
import type { Data, Id, Input, Program } from "@/lang/types";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** U-14: the fixed topic list. */
export const TOPICS = [
  "output",
  "variables",
  "loops",
  "conditions",
  "lists",
  "searching",
  "sorting",
  "recursion",
  "dictionaries",
  "classes",
  "gradients",
] as const;
export type Topic = (typeof TOPICS)[number];

export type Localized = { en: string; ja?: string };
export type Test = {
  /** A test is shown by these values; it has no name. */
  inputs: Record<Id, Data>;
  /** C-03: a boundary case; every challenge has at least one. */
  edge?: boolean;
  seed?: number;
  expect: { variables?: Record<Id, Data>; stdout?: string[] };
};
export type Challenge = {
  id: string;
  title: Localized;
  difficulty: Difficulty;
  topics: Topic[];
  description: Localized;
  inputs: Input[];
  tests: Test[];
  hints: Localized[];
  /** U-83: one sentence shown as `What you used`. */
  takeaway?: Localized;
  starter?: Program;
  solution: Program;
};

/** C-16: one study plan of `challenges/plans.json`. */
export type Plan = {
  id: string;
  title: Localized;
  description: Localized;
  problems: string[];
};
