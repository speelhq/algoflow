// The names a binding target's line offers (`editor.md`, Name list; Targets): the problem's
// expected variables under `This problem`, the routine's other variables under `Variables`, each
// kept while one of its words begins with the word typed, and a typed name none of them is
// offered as a new variable.
import { declaredBy } from "@/lang/scope";
import type { Name, NodeId, Program, Routine } from "@/lang/types";
import { isValidName } from "@/lang/validate";
import { allStmts, getRoutine, routineStmts } from "@/lang/walk";

/** The words of a name: split at spaces, `_`, and `-`. */
function wordsOf(name: string): string[] {
  return name.toLowerCase().split(/[\s_-]+/);
}

/** Whether a typed word matches a name: the name, or one of its words, starts with it. */
export function matchesName(name: string, word: string): boolean {
  const w = word.toLowerCase();
  return wordsOf(name).some((part) => part.startsWith(w)) || name.toLowerCase().startsWith(w);
}

/** The names a routine's list offers: the problem's expected ones first, then the routine's others. */
export type RoutineNames = { asked: readonly Name[]; names: readonly Name[] };

/**
 * In `main` the problem's expected names (`asked`), then the inputs and the names `main` assigns;
 * in a function its parameters and the names its body assigns; each in program order. The names
 * that statement `editing` assigns are left out, because its target's line holds the name being
 * typed (`editor.md`, Name list).
 */
export function routineNames(
  program: Program,
  routine: Routine,
  asked: readonly Name[],
  editing: NodeId,
): RoutineNames {
  const def = getRoutine(program, routine);
  const main = def === "main";
  const problem = main ? [...new Set(asked)] : [];
  const names = new Set<Name>(main ? program.inputs.map((input) => input.name) : def.params);
  for (const stmt of allStmts(routineStmts(program, def))) {
    if (stmt.id === editing) continue;
    for (const { name } of declaredBy(stmt)) names.add(name);
  }
  return { asked: problem, names: [...names].filter((name) => !problem.includes(name)) };
}

/** Whether a typed name is offered as a new variable: a name that none of `known` is. */
export function isNewName(typed: string, known: readonly Name[]): boolean {
  return typed !== "" && !known.includes(typed) && isValidName(typed);
}
