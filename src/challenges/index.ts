// C-14: the browser bundles `challenges/*.json` at build time; U-12 orders the list by
// plan order, then title.
import { planRank } from "./plans";
import type { Challenge } from "./types";

const modules = import.meta.glob<Challenge>(
  ["../../challenges/*.json", "!../../challenges/plans.json"],
  { eager: true, import: "default" },
);

export const CHALLENGES: readonly Challenge[] = Object.values(modules).toSorted(
  (a, b) => planRank(a.id) - planRank(b.id) || a.title.en.localeCompare(b.title.en),
);

export function getChallenge(id: string | undefined): Challenge | undefined {
  return id === undefined ? undefined : CHALLENGES.find((challenge) => challenge.id === id);
}

export { PLANS, planOf, planRank } from "./plans";
export type { Challenge, Difficulty, Localized, Plan, Test, Topic } from "./types";
