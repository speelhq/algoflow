// The suggestion row of a name slot: the names the problem asks for, the names already in
// the program, then a fixed list, each once and at most `ROW` in all.
import { declaredBy } from "@/lang/scope";
import type { Id, Program } from "@/lang/types";
import { programStmts } from "@/lang/walk";

export const COMMON_NAMES: readonly Id[] = ["i", "j", "count", "found"];
/** The most names the row offers: one line beside the name input. */
export const ROW = 6;

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
  return out.slice(0, ROW);
}

/** What a name input keeps of typed text: the characters a name may have, no digit first. */
export function nameChars(text: string): string {
  return text.replace(/[^a-z0-9_]/g, "").replace(/^[0-9]+/, "");
}
