// C-16: the study plans, bundled at build time (C-14) by a static import so that
// `index.ts` can leave `plans.json` out of its challenge glob.
import plans from "../../challenges/plans.json";
import type { Plan } from "./types";

export const PLANS: readonly Plan[] = plans;

const NO_PLAN = Number.MAX_SAFE_INTEGER;
const ranks = new Map<string, number>();
PLANS.forEach((plan, p) => plan.problems.forEach((id, i) => ranks.set(id, p * 1000 + i)));

/** U-10 order: position in the plans (plan order, then member order); challenges in no plan rank last. */
export function planRank(id: string): number {
  return ranks.get(id) ?? NO_PLAN;
}

/** The plan a challenge belongs to, if any (each id is in at most one plan, C-16). */
export function planOf(id: string): Plan | undefined {
  return PLANS.find((plan) => plan.problems.includes(id));
}
