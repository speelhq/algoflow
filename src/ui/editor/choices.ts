// The rows a value line's lists offer, whatever the line holds: a variable, a new variable, an
// entry, the parentheses, or a function of the program; the rows where a value is expected and
// after one; what a typed word names and the order of its matches; and the groups the rows are
// listed in, in one order everywhere (`editor.md`, Value line, Words; Value list; Targets).
import type { Kinds } from "@/lang/kinds";
import type { Expr, Kind, Name, Program } from "@/lang/types";
import { refusedDefinitions } from "@/lang/validate";
import type { ValueGroup } from "@/blocks/types";
import { emptyExpr } from "@/blocks/registry";
import { isParseError, parse } from "@/python/parse";
import { allEntries, firstSlot, GROUPS, takesValue, type Entry } from "./entries";
import { isNewName, matchesName, type RoutineNames } from "./names";

export type LineFunction = { name: Name; params: readonly Name[] };

/** The key that opens a pair of parentheses, which the explanation line names for `( )`. */
export const PARENTHESES_KEY = "(";

/**
 * A target slot's line: the names offered where the whole target is an empty slot, the
 * problem's expected ones (`asked`) first, and whether a name typed that none is makes a new
 * variable.
 */
export type TargetLine = RoutineNames & { binds: boolean };

export type LineContext = {
  /** The variables visible at the statement, the latest first. */
  variables: readonly Name[];
  kinds: Kinds;
  functions: readonly LineFunction[];
  /** The target slot the line edits, or null for a slot that takes any value. */
  target: TargetLine | null;
};

/**
 * A choice of the list: a variable, a new variable named by the word typed, an entry, the
 * parentheses, or a function of the program.
 */
export type Row =
  | { type: "variable"; name: Name }
  | { type: "new"; name: Name }
  | { type: "entry"; entry: Entry }
  | { type: "parentheses" }
  | { type: "function"; fn: LineFunction };

export function rowName(row: Row): string {
  switch (row.type) {
    case "variable":
    case "new":
      return row.name;
    case "entry":
      return row.entry.label;
    case "function":
      return row.fn.name;
    case "parentheses":
      return "";
  }
}

/** Whether the row is named exactly by the word: its name, or the entry's keys. */
function namesExactly(row: Row, word: string): boolean {
  if (row.type === "entry" && row.entry.declared.typed === word) return true;
  return rowName(row).toLowerCase() === word.toLowerCase();
}

/**
 * The names offered where a target slot's whole value is an empty slot (`editor.md`, Targets),
 * and in a slot that binds the word typed as a new variable when it names none and is a name.
 */
export function targetNames(word: string, target: TargetLine): Row[] {
  const names = [...target.asked, ...target.names];
  const rows = names.map((name): Row => ({ type: "variable", name }));
  if (target.binds && isNewName(word, names)) rows.push({ type: "new", name: word });
  return rows;
}

/** The program's functions a call can name: those whose name no diagnostic refuses. */
export function callableFunctions(program: Program): LineFunction[] {
  const refused = refusedDefinitions(program);
  return program.functions
    .filter((fn) => !refused.has(fn.id))
    .map((fn) => ({ name: fn.name, params: fn.params }));
}

/** A call of one of the program's functions, its arguments empty slots. */
export function callExpr(fn: LineFunction): Expr | undefined {
  const call = parse(`${fn.name}()`);
  const args = isParseError(call) ? undefined : firstSlot(call);
  if (isParseError(call) || args?.role !== "exprs") return undefined;
  return { ...call, [args.name]: fn.params.map(() => emptyExpr()) };
}

/** The rows a word names where a value is expected: the variables, the entries, and every call. */
export function expectedWordRows(ctx: LineContext): Row[] {
  return [
    ...ctx.variables.map((name): Row => ({ type: "variable", name })),
    ...allEntries()
      .filter((entry) => !takesValue(entry) || entry.call)
      .map((entry): Row => ({ type: "entry", entry })),
    ...ctx.functions.map((fn): Row => ({ type: "function", fn })),
  ];
}

/** Every entry that takes a value, as rows: those offered after a value of no known kind. */
export function afterRows(): Row[] {
  return after(undefined, false);
}

/**
 * The rows of `rows` that the word matches, a whole name first, then, after a value of `kind`,
 * the entries for its kind, and a new variable last, because a name the program has is the
 * likelier one meant.
 */
export function rankMatches(rows: readonly Row[], word: string, kind: Kind | undefined): Row[] {
  if (word === "") return [];
  const found = rows.filter(
    (row) =>
      matchesName(rowName(row), word) ||
      (row.type === "entry" && (row.entry.declared.typed ?? "").startsWith(word)),
  );
  const rank = (row: Row) =>
    row.type === "new"
      ? 3
      : namesExactly(row, word)
        ? 0
        : kind !== undefined && row.type === "entry" && row.entry.declared.on?.includes(kind)
          ? 1
          : 2;
  return found
    .map((row, index) => ({ row, index }))
    .toSorted((a, b) => rank(a.row) - rank(b.row) || a.index - b.index)
    .map(({ row }) => row);
}

export type ListGroup = "problem" | "variables" | "new" | ValueGroup | "functions";
const LIST_GROUPS: readonly ListGroup[] = ["problem", "variables", "new", ...GROUPS, "functions"];

export type Section = { group: ListGroup; rows: Row[] };

/** The group a row is listed under: among a target's names, one the problem expects under `This problem`. */
function groupOf(row: Row, asked: readonly string[]): ListGroup {
  switch (row.type) {
    case "variable":
      return asked.includes(row.name) ? "problem" : "variables";
    case "new":
      return "new";
    case "entry":
      return row.entry.declared.group;
    case "parentheses":
      return "calculate";
    case "function":
      return "functions";
  }
}

export function sections(rows: readonly Row[], asked: readonly string[]): Section[] {
  return LIST_GROUPS.map((group) => ({
    group,
    rows: rows.filter((row) => groupOf(row, asked) === group),
  })).filter((section) => section.rows.length > 0);
}

/** The rows offered where a value is expected; with `all`, every entry too. */
export function expected(ctx: LineContext, all: boolean): Row[] {
  const offered = allEntries().filter((entry) => all || !takesValue(entry));
  // The parentheses follow the calculations offered where a value is expected.
  const last = offered.findLastIndex(
    (entry) => entry.declared.group === "calculate" && !takesValue(entry),
  );
  const entries = offered.map((entry): Row => ({ type: "entry", entry }));
  entries.splice(last + 1, 0, { type: "parentheses" });
  return [
    ...ctx.variables.map((name): Row => ({ type: "variable", name })),
    ...entries,
    ...ctx.functions.map((fn): Row => ({ type: "function", fn })),
  ];
}

/** The entries offered after a value of `kind`; every one that takes a value when it is unknown. */
export function after(kind: Kind | undefined, all: boolean): Row[] {
  return allEntries()
    .filter(
      (entry) =>
        takesValue(entry) && (all || kind === undefined || entry.declared.on?.includes(kind)),
    )
    .map((entry): Row => ({ type: "entry", entry }));
}

/** The matches of a word in their rank, a heading wherever the group changes. */
export function matchSections(rows: readonly Row[], asked: readonly string[]): Section[] {
  const out: Section[] = [];
  for (const row of rows) {
    const group = groupOf(row, asked);
    const last = out.at(-1);
    if (last?.group === group) last.rows.push(row);
    else out.push({ group, rows: [row] });
  }
  return out;
}

/** The rows of the sections in order, as ↑ and ↓ walk them. */
export function listRows(list: readonly Section[]): Row[] {
  return list.flatMap((section) => section.rows);
}
