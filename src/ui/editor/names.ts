// The list of a name slot (U-94): the names the problem asks for, then the program's other
// variables, each with its kind, filtered by what is typed, and a typed name that neither
// holds offered as a new variable.
import { variableKinds } from "@/lang/kinds";
import { declaredBy } from "@/lang/scope";
import type { Id, Kind, NodeId, Program, Stmt } from "@/lang/types";
import { isValidName } from "@/lang/validate";
import { programStmts } from "@/lang/walk";

/** Every variable name the program has: inputs, parameters, and assigned names, but `self`'s. */
export function programNames(program: Program, self?: NodeId): Id[] {
  const names = new Set<Id>(program.inputs.map((input) => input.name));
  for (const fn of program.functions) for (const param of fn.params) names.add(param);
  for (const { stmt } of programStmts(program)) {
    if (stmt.id === self) continue;
    for (const { name } of declaredBy(stmt)) names.add(name);
  }
  return [...names];
}

/** The statement that first sets `name`, in program order. */
export function firstSetIn(program: Program, name: Id): Stmt | undefined {
  for (const { stmt } of programStmts(program)) {
    if (declaredBy(stmt).some((declared) => declared.name === name)) return stmt;
  }
  return undefined;
}

export type NameRow = { name: Id; of?: Kind };
export type NameList = { problem: NameRow[]; variables: NameRow[]; fresh?: Id };

/**
 * The name list of a slot in `chart`: `asked` are the names of the challenge's
 * `expect.variables`; `typed`, when given, filters both groups and may be a new name; the
 * names statement `self` sets count only where it is not the one setting them.
 */
export function nameList(
  program: Program,
  asked: readonly Id[],
  typed: string | undefined,
  chart: NodeId | "main" = "main",
  self?: NodeId,
): NameList {
  const kinds = variableKinds(program, chart);
  const row = (name: Id): NameRow => {
    const of = kinds.get(name);
    return of ? { name, of } : { name };
  };
  const keep = (name: Id) => typed === undefined || name.includes(typed);
  const problem = asked.filter(keep).map(row);
  const variables = programNames(program, self)
    .filter((name) => !asked.includes(name) && keep(name))
    .map(row);
  const known = [...asked, ...programNames(program, self)];
  const fresh =
    typed !== undefined && typed !== "" && isValidName(typed) && !known.includes(typed)
      ? typed
      : undefined;
  return fresh ? { problem, variables, fresh } : { problem, variables };
}

/** What a name input keeps of typed text: the characters a name may have, no digit first. */
export function nameChars(text: string): string {
  return text.replace(/[^a-z0-9_]/g, "").replace(/^[0-9]+/, "");
}
