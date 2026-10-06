// The suggestion row of a name slot: the names the problem asks for, the names already in
// the program, then a fixed list, each once.
import { declaredBy } from "@/lang/scope";
import type { Id, Program } from "@/lang/types";
import { programStmts } from "@/lang/walk";

export const COMMON_NAMES: readonly Id[] = [
  "i",
  "j",
  "n",
  "tmp",
  "low",
  "high",
  "mid",
  "found",
  "count",
  "total",
];

/** Every variable name the program has: inputs, parameters, and assigned names. */
export function programNames(program: Program): Id[] {
  const names = new Set<Id>(program.inputs.map((input) => input.name));
  for (const fn of program.functions) for (const param of fn.params) names.add(param);
  for (const { stmt } of programStmts(program)) {
    for (const { name } of declaredBy(stmt)) names.add(name);
  }
  return [...names];
}

export type Suggestion = { name: Id; asked: boolean };

/** `asked` are the names of the challenge's `expect.variables`. */
export function nameSuggestions(program: Program, asked: readonly Id[]): Suggestion[] {
  const seen = new Set<Id>();
  const out: Suggestion[] = [];
  const add = (name: Id, isAsked: boolean) => {
    if (seen.has(name)) return;
    seen.add(name);
    out.push({ name, asked: isAsked });
  };
  for (const name of asked) add(name, true);
  for (const name of programNames(program)) add(name, false);
  for (const name of COMMON_NAMES) add(name, false);
  return out;
}

/** What a name input keeps of typed text: the characters of L-01. */
export function nameChars(text: string): string {
  return text.replace(/[^a-z0-9_]/g, "");
}
