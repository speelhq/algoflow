// C-01: the challenge schema. A leaf module: scripts run with tsx import it, so it
// must not import `index.ts` (which uses `import.meta.glob`, C-14).
import type { Data, Id, Input, Program } from "@/lang/types";

export const TRACKS = ["day1", "day2", "day3", "classic", "micrograd"] as const;
export type Track = (typeof TRACKS)[number];

export type Localized = { en: string; ja?: string };
export type Test = {
  name: Localized;
  inputs: Record<Id, Data>;
  seed?: number;
  expect: { variables?: Record<Id, Data>; stdout?: string[] };
};
export type Challenge = {
  id: string;
  track: Track;
  order: number;
  title: Localized;
  description: Localized;
  inputs: Input[];
  tests: Test[];
  hints: Localized[];
  starter?: Program;
  solution: Program;
};
