// The list under a value line: the groups chosen by what is before the caret, in one
// order everywhere, or the rows a typed word matches; `Show all` lists every entry that can be
// chosen there. A target's line leaves out the rows that would leave no target, and where its
// whole value is an empty slot lists names (`editor.md`, Targets). Reads the entries' `group`
// and `on` only.
import {
  atEmptySlot,
  keptRows,
  kindBefore,
  matches,
  namesTarget,
  wholeTargetRows,
  type Line,
} from "./line";
import {
  after,
  expected,
  matchSections,
  sections,
  type LineContext,
  type Section,
} from "./choices";

/** The list's sections at the caret, or the matches of the word typed, in their rank. */
export function listSections(line: Line, ctx: LineContext, all = false): Section[] {
  // The problem's names head a target's own list only, never the lists inside it.
  const asked = ctx.target && namesTarget(line, ctx) ? ctx.target.asked : [];
  if (line.word !== "") return matchSections(matches(line, ctx), asked);
  const rows =
    wholeTargetRows(line, ctx) ??
    keptRows(line, atEmptySlot(line) ? expected(ctx, all) : after(kindBefore(line, ctx), all), ctx);
  return sections(rows, asked);
}

/** Whether the list ends with `Show all`: not over a target's names, which it would list again. */
export function offersAll(line: Line, ctx: LineContext): boolean {
  return wholeTargetRows(line, ctx) === undefined;
}
