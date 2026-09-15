// C-16, C-18: structural checks of `challenges/plans.json` (used by scripts/check.ts).
import type { Plan } from "@/challenges/types";
import { isLocalized, isRecord } from "./challenge";

export type PlansResult = { plans: Plan[] | null; problems: string[] };

/** Validates the plans file against the ids of the challenge files on disk. */
export function checkPlans(
  json: unknown,
  knownIds: ReadonlySet<string>,
  opts: { requireJa?: boolean } = {},
): PlansResult {
  const requireJa = opts.requireJa ?? false;
  if (!Array.isArray(json)) return { plans: null, problems: ["plans.json must be an array"] };
  const problems: string[] = [];
  const planIds = new Set<string>();
  const owners = new Map<string, string>();

  json.forEach((plan, p) => {
    if (!isRecord(plan)) return problems.push(`plans[${p}] must be an object`);
    const label = typeof plan.id === "string" ? `plan "${plan.id}"` : `plans[${p}]`;
    if (typeof plan.id !== "string") problems.push(`${label} needs a string id`);
    else if (planIds.has(plan.id)) problems.push(`${label} is listed twice`);
    else planIds.add(plan.id);
    if (!isLocalized(plan.title, requireJa)) problems.push(`${label}: title must be { en, ja? }`);
    if (!isLocalized(plan.description, requireJa))
      problems.push(`${label}: description must be { en, ja? }`);

    if (!Array.isArray(plan.problems)) return problems.push(`${label}: problems must be an array`);
    if (plan.problems.length === 0) problems.push(`${label} has no problems (C-18)`);
    const seen = new Set<string>();
    for (const id of plan.problems) {
      if (typeof id !== "string") {
        problems.push(`${label}: problems must be challenge ids`);
        continue;
      }
      if (!knownIds.has(id)) problems.push(`${label}: unknown challenge "${id}"`);
      if (seen.has(id)) problems.push(`${label}: "${id}" is listed twice`);
      seen.add(id);
      const other = owners.get(id);
      if (other !== undefined && other !== label)
        problems.push(`"${id}" is in ${other} and ${label} (C-16)`);
      owners.set(id, label);
    }
  });

  return { plans: problems.length === 0 ? (json as Plan[]) : null, problems };
}
