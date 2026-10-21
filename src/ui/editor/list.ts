// The list under a value line: the groups chosen by what is before the caret, in one
// order everywhere, or the rows a typed word matches; `Show all` lists every entry that can be
// chosen there. A target's line leaves out the rows that would leave no target, and where its
// whole value is to fill lists names (`editor.md`, Targets). Reads the entries' `group` and `on`
// only.
import type { Kind } from "@/lang/types";
import type { MenuGroup } from "@/blocks/types";
import { allEntries, GROUPS, takesValue } from "./entries";
import {
  atInput,
  keptRows,
  kindBefore,
  matches,
  namesTarget,
  wholeTargetRows,
  type Line,
  type LineContext,
  type Row,
} from "./line";

export type ListGroup = "problem" | "variables" | "new" | MenuGroup | "functions";
const LIST_GROUPS: readonly ListGroup[] = ["problem", "variables", "new", ...GROUPS, "functions"];

export type Section = { group: ListGroup; rows: Row[] };

/** The group a row is listed under: among a target's names, one the problem expects under `This problem`. */
function groupOf(row: Row, asked: readonly string[]): ListGroup {
  switch (row.kind) {
    case "variable":
      return asked.includes(row.name) ? "problem" : "variables";
    case "new":
      return "new";
    case "entry":
      return row.entry.menu.group;
    case "parentheses":
      return "calculate";
    case "function":
      return "functions";
  }
}

function sections(rows: readonly Row[], asked: readonly string[]): Section[] {
  return LIST_GROUPS.map((group) => ({
    group,
    rows: rows.filter((row) => groupOf(row, asked) === group),
  })).filter((section) => section.rows.length > 0);
}

/** The rows offered where a value is expected; with `all`, every entry too. */
function expected(ctx: LineContext, all: boolean): Row[] {
  const offered = allEntries().filter((entry) => all || !takesValue(entry));
  // The parentheses follow the calculations offered where a value is expected.
  const last = offered.findLastIndex(
    (entry) => entry.menu.group === "calculate" && !takesValue(entry),
  );
  const entries = offered.map((entry): Row => ({ kind: "entry", entry }));
  entries.splice(last + 1, 0, { kind: "parentheses" });
  return [
    ...ctx.variables.map((name): Row => ({ kind: "variable", name })),
    ...entries,
    ...ctx.functions.map((fn): Row => ({ kind: "function", fn })),
  ];
}

/** The entries offered after a value of `kind`; every one that takes a value when it is unknown. */
function after(kind: Kind | undefined, all: boolean): Row[] {
  return allEntries()
    .filter(
      (entry) => takesValue(entry) && (all || kind === undefined || entry.menu.on?.includes(kind)),
    )
    .map((entry): Row => ({ kind: "entry", entry }));
}

/** The list's sections at the caret, or the matches of the word typed, in their rank. */
export function listSections(line: Line, ctx: LineContext, all = false): Section[] {
  // The problem's names head a target's own list only, never the lists inside it.
  const asked = ctx.target && namesTarget(line, ctx) ? ctx.target.asked : [];
  if (line.word !== "") {
    // Matches keep their rank; a heading starts wherever the group changes.
    const out: Section[] = [];
    for (const row of matches(line, ctx)) {
      const group = groupOf(row, asked);
      const last = out.at(-1);
      if (last?.group === group) last.rows.push(row);
      else out.push({ group, rows: [row] });
    }
    return out;
  }
  const rows =
    wholeTargetRows(line, ctx) ??
    keptRows(line, atInput(line) ? expected(ctx, all) : after(kindBefore(line, ctx), all), ctx);
  return sections(rows, asked);
}

/** Whether the list ends with `Show all`: not over a target's names, which it would list again. */
export function offersAll(line: Line, ctx: LineContext): boolean {
  return wholeTargetRows(line, ctx) === undefined;
}

/** The rows of the sections in order, as ↑ and ↓ walk them. */
export function listRows(list: readonly Section[]): Row[] {
  return list.flatMap((section) => section.rows);
}
