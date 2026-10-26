// The names a name field and a binding target's line offer (`editor.md`, Name fields; Targets):
// the problem's expected variables under `This problem`, the chart's other variables under
// `Variables`, each kept while one of its words begins with the text typed, and a typed name
// none of them is offered as a new variable.
import { declaredBy } from "@/lang/scope";
import type { Name, NodeId, Program } from "@/lang/types";
import { isValidName } from "@/lang/validate";
import { allStmts } from "@/lang/walk";

/** The words of a name: split at spaces, `_`, and `-`. */
function wordsOf(name: string): string[] {
  return name.toLowerCase().split(/[\s_-]+/);
}

/** Whether a typed word matches a name: the name, or one of its words, starts with it. */
export function matchesName(name: string, word: string): boolean {
  const w = word.toLowerCase();
  return wordsOf(name).some((part) => part.startsWith(w)) || name.toLowerCase().startsWith(w);
}

/** The names a chart's list offers: the problem's expected ones first, then the chart's others. */
export type RoutineNames = { asked: readonly Name[]; names: readonly Name[] };

/**
 * In `main` the problem's expected names (`asked`), then the inputs and the names `main` assigns;
 * in a function its parameters and the names its body assigns; each in program order.
 */
export function routineNames(
  program: Program,
  routine: "main" | NodeId,
  asked: readonly Name[],
): RoutineNames {
  const fn = program.functions.find((candidate) => candidate.id === routine);
  const problem = fn ? [] : [...new Set(asked)];
  const names = new Set<Name>(fn ? fn.params : program.inputs.map((input) => input.name));
  for (const stmt of allStmts(fn ? fn.body : program.main)) {
    for (const { name } of declaredBy(stmt)) names.add(name);
  }
  return { asked: problem, names: [...names].filter((name) => !problem.includes(name)) };
}

/** Whether a typed name is offered as a new variable: a name that none of `known` is. */
export function isNewName(typed: string, known: readonly Name[]): boolean {
  return typed !== "" && !known.includes(typed) && isValidName(typed);
}

/** A name, or a new variable. */
export type NameRow = { kind: "name"; name: Name } | { kind: "new"; name: Name };
export type NameSection = { group: "problem" | "variables" | "new"; rows: NameRow[] };

/** The sections of a name field's list for the text typed. */
export function nameSections({ asked, names }: RoutineNames, typed: string): NameSection[] {
  // A whole name comes first.
  const kept = (list: readonly Name[]): NameRow[] =>
    list
      .filter((name) => matchesName(name, typed))
      .toSorted((a, b) => Number(b === typed) - Number(a === typed))
      .map((name) => ({ kind: "name", name }));
  const sections: NameSection[] = [
    { group: "problem", rows: kept(asked) },
    { group: "variables", rows: kept(names) },
  ];
  if (isNewName(typed, [...asked, ...names])) {
    sections.push({ group: "new", rows: [{ kind: "new", name: typed }] });
  }
  return sections.filter((section) => section.rows.length > 0);
}

/** What a name field keeps of typed text: the characters a name may have, no digit first. */
export function nameChars(text: string): string {
  return text.replace(/[^a-z0-9_]/g, "").replace(/^[0-9]+/, "");
}
