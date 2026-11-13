// A value line's text read at its caret (`editor.md`, Value line; Value list; Targets;
// Explanation line): the word being typed, what the parser reads before the caret, the rows of
// the value list and of a word's matches, the operation the explanation line explains, and the
// text and the caret that a choice writes. Each is a pure function of the text, its selection,
// and the line's context, so the value line reads them in one place. Reads the parser's reading
// and the blocks' slots, `entries`, and `create()`, never a type.
import { exprKind, type Kinds } from "@/lang/kinds";
import type { Expr, Kind } from "@/lang/types";
import { isEmptyDraft, isTarget } from "@/lang/walk";
import { createDraft, getBlockDef, registryKey } from "@/blocks/registry";
import { unparse } from "@/python/emit";
import {
  endsInText,
  isParseError,
  parseClosed,
  readBefore,
  type CaretOperation,
  type SpannedExpr,
} from "@/python/parse";
import { PRECEDENCE } from "@/python/precedence";
import { bindsAt } from "@/ui/chart/text";
import {
  expectedRows,
  expectedWordRows,
  matchSections,
  rankMatches,
  rowsAfter,
  sections,
  targetNames,
  createCall,
  type LineContext,
  type Row,
  type Section,
} from "./choices";
import { firstSlot, createEntryExpr, takesValue } from "./entries";

/** A value line's text and its selection, from `start` to `end`: the caret where they are equal. */
export type TextLine = { text: string; start: number; end: number };

/** The word being typed, and where it starts. */
export type Word = { text: string; start: number };

/** What the value list reads before the caret, less the word being typed (`editor.md`, Value list). */
export type CaretPlace =
  | { place: "text" }
  | { place: "none"; word: Word }
  | { place: "expected"; word: Word; operation?: CaretOperation }
  | {
      place: "after";
      word: Word;
      /** The expression before the caret, which chooses the entries offered. */
      before: SpannedExpr;
      /** The value just before the caret, which an entry whose first slot binds as an atom takes. */
      atom: SpannedExpr;
      kind?: Kind;
      operation?: CaretOperation;
    };

/** A name that ends at the text's end, and no part of a longer name or a number. */
const WORD = /(?<![A-Za-z0-9_])[A-Za-z_][A-Za-z0-9_]*$/u;

/**
 * The word being typed: the name that ends at the caret, outside a text (`editor.md`, Value line,
 * Words). No word is typed while text is selected, because a typed character replaces the
 * selection.
 */
export function wordAt(line: TextLine): Word {
  const none = { text: "", start: line.start };
  if (line.start !== line.end) return none;
  const found = WORD.exec(line.text.slice(0, line.start));
  if (!found || endsInText(line.text.slice(0, found.index))) return none;
  return { text: found[0], start: found.index };
}

/** What the value list reads at the caret, or before the selection. */
export function readCaret(line: TextLine, kinds: Kinds): CaretPlace {
  const word = wordAt(line);
  const reading = readBefore(line.text.slice(0, word.start));
  if (reading.place !== "after") return reading.place === "text" ? reading : { ...reading, word };
  const kind = exprKind(reading.before.expr, kinds);
  return { ...reading, word, ...(kind ? { kind } : {}) };
}

// ---------------------------------------------------------------- choosing

// Marks that no typed text holds: Unicode's noncharacters, which it keeps for a program's own use.
const EMPTY = String.fromCharCode(0xfdd0);
const TAKEN = String.fromCharCode(0xfdd1);
const CARET = String.fromCharCode(0xfdd2);
/** A run of separators that only empty slots follow, up to a closer or the end. */
const TRAILING = new RegExp(`(?:, ${EMPTY})+(?=[)\\]}]|$)`, "gu");
const CARET_AT = new RegExp(`[${EMPTY}${CARET}]`, "u");

/** A line holding `text`, with the caret at `caret`. */
const caretLine = (text: string, caret: number): TextLine => ({ text, start: caret, end: caret });

/**
 * What a choice writes: its line, and its text with each slot it doesn't fill written as a name,
 * so a target's line can tell whether the choice writes a target.
 */
type Choice = { line: TextLine; filled: string };

type Bag = Record<string, unknown>;

/**
 * `expr` with a mark in each slot that holds nothing: each empty slot, and each literal that holds
 * no text; and with `TAKEN` in its first slot when it takes a value.
 */
function markEmptySlots(expr: Expr, takes: boolean): Expr {
  const def = getBlockDef(registryKey(expr));
  const copy: Bag = { ...expr };
  const first = takes ? firstSlot(expr) : undefined;
  const mark = (value: unknown): unknown => {
    if (isEmptyDraft(value)) return createDraft(EMPTY);
    return value && typeof value === "object" ? markEmptySlots(value as Expr, false) : value;
  };
  for (const slot of def.slots) {
    const value = copy[slot.name];
    if (slot.role === "literal" && value === "") copy[slot.name] = EMPTY;
    else if (slot.role === "expr" || slot.role === "target") {
      copy[slot.name] = slot === first ? createDraft(TAKEN) : mark(value);
    } else if (slot.role === "exprs" && Array.isArray(value)) {
      copy[slot.name] = value.map((item, i) =>
        slot === first && i === 0 ? createDraft(TAKEN) : mark(item),
      );
    }
  }
  return copy as unknown as Expr;
}

/**
 * An expression as a choice writes it, as the emitter writes it (`editor.md`, Value list,
 * Choosing): each slot that it doesn't fill holds nothing, and a separator that only such slots
 * follow is left out; the caret goes where the first such slot is, or after the text. `taken` is
 * the text of the value it takes into its first slot.
 */
function writeChoice(made: Expr, taken?: string): Choice {
  const full = unparse(markEmptySlots(made, taken !== undefined));
  const firstEmpty = full.indexOf(EMPTY);
  const dropped = full.replace(TRAILING, (run: string, offset: number) =>
    offset <= firstEmpty && firstEmpty < offset + run.length ? CARET : "",
  );
  // A function, so a `$` that the learner typed is no replacement pattern.
  const text = dropped.replace(TAKEN, () => taken ?? "");
  const at = text.search(CARET_AT);
  const plain = text.replaceAll(EMPTY, "").replaceAll(CARET, "");
  return {
    line: caretLine(plain, at === -1 ? plain.length : at),
    filled: full.replace(TAKEN, () => taken ?? "").replaceAll(EMPTY, "_"),
  };
}

/** What a row writes, and where in the line the text it replaces starts. */
function choiceAt(
  line: TextLine,
  place: Extract<CaretPlace, { place: "expected" | "after" }>,
  row: Row,
): Choice & { from: number } {
  const from = place.word.start;
  switch (row.type) {
    case "variable":
    case "new":
      return { line: caretLine(row.name, row.name.length), filled: row.name, from };
    case "parentheses":
      return { line: caretLine("()", 1), filled: "(_)", from };
    case "function": {
      return { ...writeChoice(createCall(row.fn)), from };
    }
    case "entry":
      break;
  }
  const made = createEntryExpr(row.entry);
  if (place.place !== "after" || !takesValue(row.entry)) return { ...writeChoice(made), from };
  const first = firstSlot(made);
  const binds = first ? bindsAt(made, first.name) : undefined;
  // An entry whose first slot binds as an atom takes the value just before the caret; an operator
  // stands after the value before it, which then binds by its precedence; any other entry takes
  // the expression whose kind chose the value list into a slot that binds at no precedence. So
  // the value taken needs no parentheses, and keeps its text as typed.
  const taken = binds === PRECEDENCE.atom ? place.atom : place.before;
  return {
    ...writeChoice(made, line.text.slice(taken.start, taken.end)),
    from: taken.start,
  };
}

/**
 * The text and the caret a choice of `row` writes at the caret, in place of the value it takes or
 * of the word being typed, or in place of the selection (`editor.md`, Value list, Choosing).
 */
export function choose(line: TextLine, row: Row, kinds: Kinds): TextLine | undefined {
  const place = readCaret(line, kinds);
  if (place.place === "text" || place.place === "none") return undefined;
  const choice = choiceAt(line, place, row);
  const prefix = line.text.slice(0, choice.from);
  return caretLine(
    prefix + choice.line.text + line.text.slice(line.end),
    prefix.length + choice.line.start,
  );
}

/**
 * The line a block's slot holds when the block menu inserts the block: the text and the caret that
 * a choice of the operation it holds writes (`editor.md`, Block menu). For example: `greet()`.
 */
export function choiceLine(expr: Expr): TextLine {
  return writeChoice(expr).line;
}

// ---------------------------------------------------------------- the lists

/** Whether the line's text is only the word being typed, or nothing. */
function isOnlyWord(line: TextLine, word: Word): boolean {
  return line.text.slice(0, word.start).trim() === "" && line.text.slice(line.end).trim() === "";
}

/** The names a target's line offers where its text is only the word being typed, or nothing. */
function wholeTarget(line: TextLine, place: CaretPlace, ctx: LineContext): Row[] | undefined {
  if (!ctx.target || place.place === "text" || place.place === "none") return undefined;
  if (!isOnlyWord(line, place.word)) return undefined;
  return targetNames(place.word.text, ctx.target);
}

/**
 * The rows the line's slot keeps: in a target's line, those whose choice writes a target
 * (`editor.md`, Targets), read with each slot it doesn't fill as a name and each parenthesis and
 * bracket still open closed, so a row inside the target's slots stays.
 */
function keptRows(
  line: TextLine,
  place: Extract<CaretPlace, { place: "expected" | "after" }>,
  rows: readonly Row[],
  ctx: LineContext,
): Row[] {
  if (!ctx.target) return [...rows];
  return rows.filter((row) => {
    const choice = choiceAt(line, place, row);
    const filled = line.text.slice(0, choice.from) + choice.filled + line.text.slice(line.end);
    const value = parseClosed(filled);
    return !isParseError(value) && isTarget(value);
  });
}

/** The rows a word typed at the caret can name. */
function wordRows(line: TextLine, place: CaretPlace, ctx: LineContext): Row[] {
  if (place.place === "text" || place.place === "none") return [];
  const whole = wholeTarget(line, place, ctx);
  if (whole) return whole;
  return keptRows(
    line,
    place,
    place.place === "expected" ? expectedWordRows(ctx) : rowsAfter(undefined, false),
    ctx,
  );
}

function matchesAt(line: TextLine, place: CaretPlace, ctx: LineContext): Row[] {
  if (place.place === "text" || place.place === "none") return [];
  const kind = place.place === "after" ? place.kind : undefined;
  return rankMatches(wordRows(line, place, ctx), place.word.text, kind);
}

/** The rows the word typed at the caret matches, in their rank (`editor.md`, Value line, Words). */
export function caretMatches(line: TextLine, ctx: LineContext): Row[] {
  return matchesAt(line, readCaret(line, ctx.kinds), ctx);
}

/**
 * The value list's sections at the caret, or the matches of the word typed; none inside a text
 * (`editor.md`, Value list). With `all`, every entry that can be chosen there (`Show all`).
 */
export function caretSections(line: TextLine, ctx: LineContext, all: boolean): Section[] {
  const place = readCaret(line, ctx.kinds);
  // No entry can be chosen inside a text, and none has a value to take where no expression ends.
  if (place.place === "text" || place.place === "none") return [];
  const whole = wholeTarget(line, place, ctx);
  // The problem's names head a target's own list only, never the lists inside it.
  const asked = whole && ctx.target ? ctx.target.asked : [];
  if (place.word.text !== "") return matchSections(matchesAt(line, place, ctx), asked);
  const rows =
    whole ??
    keptRows(
      line,
      place,
      place.place === "expected" ? expectedRows(ctx, all) : rowsAfter(place.kind, all),
      ctx,
    );
  return sections(rows, asked);
}

/**
 * Whether the value list ends with `Show all` (`editor.md`, Value list): not while a word is typed,
 * not where it holds no row, and not over a target's names, which it would list again. It is
 * gone once chosen, which the editor knows.
 */
export function caretOffersAll(line: TextLine, ctx: LineContext): boolean {
  const place = readCaret(line, ctx.kinds);
  if (place.place === "text" || place.place === "none" || place.word.text !== "") return false;
  return wholeTarget(line, place, ctx) === undefined && caretSections(line, ctx, false).length > 0;
}

/** The rows a word can name at the caret, which the explanation line's `Did you mean` reads. */
export function caretWordRows(line: TextLine, ctx: LineContext): Row[] {
  return wordRows(line, readCaret(line, ctx.kinds), ctx);
}

// ---------------------------------------------------------------- the explanation line

/**
 * The operation the explanation line explains: the operation one of whose slots holds the caret,
 * read from the text before the caret as the value list reads it, and that slot's value
 * (`editor.md`, Explanation line).
 */
export function caretOperation(line: TextLine, kinds: Kinds): CaretOperation | undefined {
  const place = readCaret(line, kinds);
  return place.place === "expected" || place.place === "after" ? place.operation : undefined;
}
