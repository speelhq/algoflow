// The sections of the Problems page and a plan's button; where `Next problem →`
// leads. Status comes in as a function so this module stays below the stores.
import { CHALLENGES, PLANS, planOf } from "./index";
import type { Plan } from "./types";

export type Status = (id: string) => "attempted" | "solved" | undefined;
export type Section = { plan?: Plan; problems: string[] };

/** One section per plan, then `More problems` (in no plan, by title) when it has any. */
export function sections(): Section[] {
  const more = CHALLENGES.filter((challenge) => !planOf(challenge.id)).map((c) => c.id);
  const planned: Section[] = PLANS.map((plan) => ({ plan, problems: plan.problems }));
  return more.length > 0 ? [...planned, { problems: more }] : planned;
}

/** The section a problem's row is in. */
export function sectionOf(id: string): Section | undefined {
  return sections().find((section) => section.problems.includes(id));
}

export type PlanAction = { kind: "start" | "continue"; id: string } | null;

/** `Start` before any entry, `Continue` to the first unsolved problem, else nothing. */
export function planAction(problems: readonly string[], status: Status): PlanAction {
  const first = problems[0];
  if (first === undefined) return null;
  if (problems.every((id) => status(id) === undefined)) return { kind: "start", id: first };
  const unsolved = problems.find((id) => status(id) !== "solved");
  return unsolved === undefined ? null : { kind: "continue", id: unsolved };
}

export type NextProblem = { kind: "next"; id: string } | { kind: "complete" };

/**
 * In a plan, the next unsolved problem after `id` (wrapping round); once every other
 * one is solved, the next row; after the last row, `Plan complete`. In `More problems`, the
 * next row.
 */
export function nextProblem(id: string, status: Status): NextProblem {
  const section = sectionOf(id);
  const rows = section?.problems ?? [];
  const at = rows.indexOf(id);
  if (section?.plan) {
    const after = [...rows.slice(at + 1), ...rows.slice(0, Math.max(at, 0))];
    const unsolved = after.find((other) => status(other) !== "solved");
    if (unsolved !== undefined) return { kind: "next", id: unsolved };
  }
  const following = at >= 0 ? rows[at + 1] : undefined;
  return following === undefined ? { kind: "complete" } : { kind: "next", id: following };
}
