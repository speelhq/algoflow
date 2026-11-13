// A plan's button on the Problems page, and where `Next problem →` leads. Status comes in as
// a function so this module stays below the stores.
import { getChallengePlan } from "./plans";

/** A problem's status by its id: attempted, solved, or not yet opened. */
export type FindStatus = (id: string) => "attempted" | "solved" | undefined;

export type PlanAction = { kind: "start" | "continue"; id: string } | null;

/** `Start` before any entry, `Continue` to the first unsolved problem, else nothing. */
export function planAction(problems: readonly string[], findStatus: FindStatus): PlanAction {
  const first = problems[0];
  if (first === undefined) return null;
  if (problems.every((id) => findStatus(id) === undefined)) return { kind: "start", id: first };
  const unsolved = problems.find((id) => findStatus(id) !== "solved");
  return unsolved === undefined ? null : { kind: "continue", id: unsolved };
}

export type NextProblem = { kind: "next"; id: string } | { kind: "complete" };

/**
 * The next unsolved problem of `id`'s plan after it (wrapping round); once every other one
 * is solved, the next problem; after the last one, `Plan complete`.
 */
export function nextProblem(id: string, findStatus: FindStatus): NextProblem {
  const problems = getChallengePlan(id).problems;
  const at = problems.indexOf(id);
  const after = [...problems.slice(at + 1), ...problems.slice(0, at)];
  const unsolved = after.find((other) => findStatus(other) !== "solved");
  if (unsolved !== undefined) return { kind: "next", id: unsolved };
  const following = problems[at + 1];
  return following === undefined ? { kind: "complete" } : { kind: "next", id: following };
}
