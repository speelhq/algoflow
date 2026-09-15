// C-16: the study plans, bundled at build time (C-14) by a static import so that
// `index.ts` can leave `plans.json` out of its challenge glob.
import plans from "../../challenges/plans.json";
import type { Plan } from "./types";

export const PLANS: readonly Plan[] = plans;

const NO_PLAN = Number.MAX_SAFE_INTEGER;
/** Challenge id → running position across the plans, and the plan itself (one pass, C-16). */
const members = new Map<string, { rank: number; plan: Plan }>();
let position = 0;
for (const plan of PLANS)
  for (const id of plan.problems) members.set(id, { rank: position++, plan });

/** U-10 order: position across the plans (plan order, then member order); challenges in no plan rank last. */
export function planRank(id: string): number {
  return members.get(id)?.rank ?? NO_PLAN;
}

/** The plan a challenge belongs to, if any (each id is in at most one plan, C-16). */
export function planOf(id: string): Plan | undefined {
  return members.get(id)?.plan;
}
