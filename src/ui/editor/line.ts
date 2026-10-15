// The value line: one expression edited as a line, with a caret at
// an input still to fill or after a value, the brackets opened and not yet closed, the word
// being typed, and the first key of a two-key operator. Every change is a new `Line`.
// Blocks are made by the parser (a variable, a number, a sign, a call) or by an entry's
// block (`create()` with its preset), and read through their slots, their notation (the caret
// moves in reading order, and a call ends with its bracket), and `precedence`, so this file
// names no block kind. A target slot's line keeps a target (`editor.md`, Targets).
import { errorText, t } from "@/i18n/t";
import type { Kinds } from "@/lang/kinds";
import { exprKind } from "@/lang/kinds";
import type { Expr, Id, NodeId, Program } from "@/lang/types";
import { refusedDefinitions } from "@/lang/validate";
import { allExprs, isEmptyExpr, isTarget, variableOf } from "@/lang/walk";
import { emptyExpr, getBlock, keyOf } from "@/blocks/registry";
import { isParseError, NO_DEFINITIONS, parse, type ParseScope } from "@/python/parse";
import { levelAssociativity } from "@/python/precedence";
import {
  bindsAt,
  closedBy,
  notationOf,
  exprText,
  isCall,
  placeholderValue,
  templatePieces,
} from "@/ui/chart/text";
import { allEntries, makeEntry, takesValue, type Entry } from "./entries";
import { isNewName, matchesName, type ChartNames } from "./names";

type Bag = Record<string, unknown>;

/** At an input still to fill, or after a value (or after an operation, once it is left). */
export type Caret = { at: NodeId } | { after: NodeId };

export type Line = {
  root: Expr;
  caret: Caret;
  /** The whole value is selected: a value typed replaces it, an operator's key takes it. */
  selected: boolean;
  /** The brackets opened and not yet closed, innermost last, by the expression they hold. */
  open: readonly NodeId[];
  /** The word being typed at the caret. */
  word: string;
  /** The first key of a two-key operator, and the line before that key applied. */
  pending?: { key: string; before?: Line };
  /** The message of the key last refused. */
  refused?: string;
  /** The text whose field is being typed in. */
  text?: NodeId;
};

export type LineFunction = { name: Id; params: readonly Id[] };

/**
 * A target slot's line: the names offered where the whole target is to fill, the problem's
 * expected ones (`asked`) first, and whether a name typed that none is makes a new variable.
 */
export type TargetLine = ChartNames & { binds: boolean };

export type LineContext = {
  /** The variables visible at the statement, the latest first. */
  variables: readonly Id[];
  kinds: Kinds;
  scope: ParseScope;
  functions: readonly LineFunction[];
  /** The target slot the line edits, or null for a slot that takes any value. */
  target: TargetLine | null;
};

/**
 * A choice of the list: a variable, a new variable named by the word typed, an entry, the
 * brackets, or a function of the program.
 */
export type Row =
  | { kind: "variable"; name: Id }
  | { kind: "new"; name: Id }
  | { kind: "entry"; entry: Entry }
  | { kind: "brackets" }
  | { kind: "function"; fn: LineFunction };

/** What a key or a choice did: `move` leaves the line for the next or previous slot or item. */
export type Outcome = { line: Line; taken: boolean; move?: "next" | "previous" | "item" };

// ---------------------------------------------------------------- the tree

/**
 * The inputs of an expression in reading order, as its notation places them: the order the
 * caret moves in. Which input an entry's value goes into is the slot order's (`withFirst`).
 */
export function inputs(expr: Expr): Expr[] {
  return templatePieces(notationOf(expr)).flatMap((piece) => {
    if ("words" in piece) return [];
    const held = placeholderValue(expr, piece.name);
    if (held?.role === "expr") return held.expr ? [held.expr] : [];
    return held?.role === "exprs" ? held.items : [];
  });
}

export function find(root: Expr, id: NodeId): Expr | undefined {
  for (const expr of allExprs(root)) if (expr.id === id) return expr;
  return undefined;
}

/** The expression holding `id` as an input, with the input's position. */
export function parentOf(root: Expr, id: NodeId): { parent: Expr; index: number } | undefined {
  for (const expr of allExprs(root)) {
    const index = inputs(expr).findIndex((input) => input.id === id);
    if (index >= 0) return { parent: expr, index };
  }
  return undefined;
}

/** `expr` with each input replaced by what `map` makes of it. */
function mapInputs(expr: Expr, map: (input: Expr, index: number) => Expr): Expr {
  const copy = { ...expr } as unknown as Bag;
  let index = 0;
  for (const slot of getBlock(keyOf(expr)).slots) {
    const value = copy[slot.name];
    if (slot.role === "expr" && value && typeof value === "object") {
      copy[slot.name] = map(value as Expr, index);
      index += 1;
    } else if (slot.role === "exprs" && Array.isArray(value)) {
      copy[slot.name] = (value as Expr[]).map((item) => {
        const made = map(item, index);
        index += 1;
        return made;
      });
    }
  }
  return copy as unknown as Expr;
}

function replaceIn(root: Expr, id: NodeId, by: Expr): Expr {
  if (root.id === id) return by;
  return mapInputs(root, (input) => replaceIn(input, id, by));
}

/** The line with expression `id` replaced; a bracket that held it holds what replaces it. */
function replace(line: Line, id: NodeId, by: Expr): Line {
  return {
    ...line,
    root: replaceIn(line.root, id, by),
    open: line.open.map((group) => (group === id ? by.id : group)),
  };
}

const precedenceOf = (expr: Expr) => getBlock(keyOf(expr)).precedence?.(expr);

/** The slot of an operation's list of values, when it has one. */
const valuesSlot = (expr: Expr) => getBlock(keyOf(expr)).slots.find((s) => s.role === "exprs");

/** An operation that holds a list of values and is no call (`[a, b]`): `,` adds a value to it. */
function isSequence(expr: Expr): boolean {
  return valuesSlot(expr) !== undefined && !isCall(expr);
}

/** The values of a sequence, and the sequence holding `items` in their place. */
function items(expr: Expr): { held: Expr[]; with: (items: Expr[]) => Expr } {
  const name = valuesSlot(expr)?.name ?? "";
  const held = (expr as unknown as Bag)[name];
  return {
    held: Array.isArray(held) ? held : [],
    with: (next) => ({ ...expr, [name]: next }),
  };
}

/** The caret stops of an expression in reading order. */
export function stops(expr: Expr): Caret[] {
  if (isEmptyExpr(expr)) return [{ at: expr.id }];
  const own = inputs(expr);
  if (own.length === 0) return [{ after: expr.id }];
  const inner = own.flatMap(stops);
  // An operation with no precedence ends with its own text (a call's bracket): a stop of its own.
  return precedenceOf(expr) === undefined ? [...inner, { after: expr.id }] : inner;
}

const sameCaret = (a: Caret, b: Caret) =>
  "at" in a ? "at" in b && a.at === b.at : "after" in b && a.after === b.after;

/** The caret at the end of `expr`. */
function endOf(expr: Expr): Caret {
  return stops(expr).at(-1) ?? { after: expr.id };
}

/** The caret's position among the stops (after an operation counts as its end). */
function position(line: Line): number {
  const all = stops(line.root);
  const exact = all.findIndex((stop) => sameCaret(stop, line.caret));
  if (exact >= 0) return exact;
  const after = "after" in line.caret ? find(line.root, line.caret.after) : undefined;
  return after ? all.findIndex((stop) => sameCaret(stop, endOf(after))) : all.length - 1;
}

function within(root: Expr, group: NodeId, id: NodeId): boolean {
  const held = find(root, group);
  return held !== undefined && find(held, id) !== undefined;
}

/** Brackets the caret has left behind close; after the value they hold, it is still inside them. */
function closeBehind(line: Line): Line {
  const { caret } = line;
  const open = line.open.filter((group) =>
    within(line.root, group, "at" in caret ? caret.at : caret.after),
  );
  return { ...line, open };
}

/** The caret is after the whole value, with no word typed, no bracket open, and nothing selected. */
export function atEnd(line: Line): boolean {
  const { caret, root } = line;
  return (
    !line.selected &&
    line.word === "" &&
    line.open.length === 0 &&
    !isEmptyExpr(root) &&
    sameCaret(caret, endOf(root))
  );
}

/** The caret is at an input still to fill (and nothing is selected). */
export function atInput(line: Line): boolean {
  return !line.selected && "at" in line.caret;
}

/** The expression before the caret: the last value, or the selected value. */
function lastValue(line: Line): Expr | undefined {
  if (line.selected) return line.root;
  return "after" in line.caret ? find(line.root, line.caret.after) : undefined;
}

/**
 * Where an operator of `level` inserted after `value` binds: it takes the largest
 * operation ending at the caret that binds tighter, within the innermost open brackets.
 * `chain` when it would chain a comparison.
 */
function bindAt(line: Line, value: Expr, level: number): Expr | "chain" {
  let target = value;
  for (;;) {
    if (line.open.includes(target.id)) return target;
    const up = parentOf(line.root, target.id);
    const outer = up ? precedenceOf(up.parent) : undefined;
    if (!up || outer === undefined || up.index !== inputs(up.parent).length - 1) return target;
    if (outer > level) target = up.parent;
    else if (outer === level && levelAssociativity(level) === "left") target = up.parent;
    else if (outer === level && levelAssociativity(level) === "none") return "chain";
    else return target;
  }
}

/** The value the list after a value is about: what an operator would take there. */
function valueBefore(line: Line): Expr | undefined {
  const last = lastValue(line);
  if (!last || line.selected) return last;
  let target = last;
  for (;;) {
    if (line.open.includes(target.id)) return target;
    const up = parentOf(line.root, target.id);
    if (!up || precedenceOf(up.parent) === undefined) return target;
    if (up.index !== inputs(up.parent).length - 1) return target;
    target = up.parent;
  }
}

/** The kind of the value before the caret. */
export function kindBefore(line: Line, ctx: LineContext) {
  const value = valueBefore(line);
  return value ? exprKind(value, ctx.kinds) : undefined;
}

// ---------------------------------------------------------------- made by the parser

function parsed(text: string, scope: ParseScope): Expr | undefined {
  const result = parse(text, scope);
  return isParseError(result) ? undefined : result;
}

/** A number literal for `raw`, or undefined when Python would reject it or it is no number. */
function numberOf(raw: string): Expr | undefined {
  if (!/^[0-9.]+$/.test(raw)) return undefined;
  const made = parsed(raw, NO_DEFINITIONS);
  return made && inputs(made).length === 0 && exprText(made) === raw ? made : undefined;
}

let numberKey: string | undefined;

function isNumber(expr: Expr): boolean {
  numberKey ??= keyOf(numberOf("0") ?? emptyExpr());
  return keyOf(expr) === numberKey;
}

/** `name` as a variable. */
export function variableExpr(name: Id): Expr | undefined {
  const made = parsed(name, NO_DEFINITIONS);
  return made && variableOf(made) === name ? made : undefined;
}

/** A sign before the input it leaves to fill (`−…`). */
function signExpr(): Expr | undefined {
  const made = parsed("-a", NO_DEFINITIONS);
  return made && mapInputs(made, () => emptyExpr());
}

/** A call of one of the program's functions, its arguments to fill. */
export function callExpr(fn: LineFunction, scope: ParseScope): Expr | undefined {
  const made = parsed(`${fn.name}(${fn.params.map(() => "a").join(", ")})`, scope);
  return made && mapInputs(made, () => emptyExpr());
}

/** The program's functions a call can name: those whose name no diagnostic refuses. */
export function callableFunctions(program: Program): LineFunction[] {
  const refused = refusedDefinitions(program);
  return program.functions
    .filter((fn) => !refused.has(fn.id))
    .map((fn) => ({ name: fn.name, params: fn.params }));
}

// ---------------------------------------------------------------- starting

/** A line opened on `root`: at the given input, else with the value selected, else at its input. */
export function openLine(root: Expr, at?: NodeId): Line {
  const base: Line = { root, caret: endOf(root), selected: false, open: [], word: "" };
  if (at !== undefined && find(root, at) && isEmptyExpr(find(root, at))) {
    return { ...base, caret: { at } };
  }
  return isEmptyExpr(root) ? base : { ...base, selected: true };
}

/** The value removed: one input to fill, the caret at it. */
function cleared(line: Line): Line {
  const fresh = emptyExpr();
  return { ...line, root: fresh, caret: { at: fresh.id }, selected: false, open: [], word: "" };
}

const done = (line: Line): Outcome => ({ line, taken: true });
const refused = (line: Line): Outcome => ({ line, taken: false });

/** Whether the line's slot keeps `root`: any value, or in a target slot a target or an input to fill. */
function keeps(root: Expr, ctx: LineContext): boolean {
  return ctx.target === null || isEmptyExpr(root) || isTarget(root);
}

/** `outcome` where the line's slot keeps its value; else the line before it, refused with the reason. */
function inSlot(line: Line, outcome: Outcome, ctx: LineContext): Outcome {
  if (!outcome.taken || keeps(outcome.line.root, ctx)) return outcome;
  return refused({ ...line, refused: t("editor.notTarget") });
}

/** Whether the caret is at the whole value, still to fill. */
function fillsWhole(line: Line): boolean {
  return !line.selected && "at" in line.caret && line.caret.at === line.root.id;
}

// ---------------------------------------------------------------- entries

/** The first input of `made` still to fill, in reading order, other than `placed`; else after it. */
function caretIn(made: Expr, placed: Expr | null): Caret {
  for (const input of inputs(made)) {
    if (input === placed) continue;
    const empty = [...allExprs(input)].find(isEmptyExpr);
    if (empty) return { at: empty.id };
  }
  return endOf(made);
}

/** `made` with `value` as its first input, in slot order. */
function withFirst(made: Expr, value: Expr): Expr {
  return mapInputs(made, (input, index) => (index === 0 ? value : input));
}

/**
 * An entry chosen after a value takes it as its first input, chosen or typed alike: an entry
 * whose first input binds at a precedence (an operator, or an item's atom) binds by it.
 */
function takeValue(line: Line, entry: Entry): Outcome {
  const last = lastValue(line);
  if (!last) return refused(line);
  const made = makeEntry(entry);
  const first = getBlock(keyOf(made)).slots.find((s) => s.role === "expr" || s.role === "exprs");
  const level = first ? bindsAt(made, first.name) : undefined;
  // An operator binds by its precedence; any other entry takes what the list was about.
  const target = line.selected
    ? last
    : level === undefined
      ? (valueBefore(line) ?? last)
      : bindAt(line, last, level);
  if (target === "chain") {
    return refused({ ...line, refused: errorText({ code: "E_PARSE_CHAIN", params: {} }) });
  }
  const placed = withFirst(made, target);
  const next = replace(line, target.id, placed);
  return done({ ...next, caret: caretIn(placed, target), selected: false, word: "" });
}

/** A block made where a value is expected, filling the input at the caret. */
function fill(line: Line, made: Expr, text = false): Outcome {
  if (!("at" in line.caret)) return refused(line);
  const next = replace(line, line.caret.at, made);
  const caret = caretIn(made, null);
  return done({ ...next, caret, word: "", ...(text ? { text: made.id } : {}) });
}

/** The slot of a value typed in a text field of its own (`Text`); a number is typed in the line. */
function textSlot(made: Expr): string | undefined {
  if (isNumber(made) || inputs(made).length > 0) return undefined;
  return getBlock(keyOf(made)).slots.find((s) => s.role === "text")?.name;
}

/** What a value typed in a text field of its own holds, or undefined for any other value. */
export function textOf(expr: Expr): string | undefined {
  const slot = textSlot(expr);
  const held = slot === undefined ? undefined : (expr as unknown as Bag)[slot];
  return typeof held === "string" ? held : undefined;
}

/** Chooses a row of the list at the caret, as the line's slot keeps it. */
export function choose(line: Line, row: Row, ctx: LineContext): Outcome {
  return inSlot(line, chooseRow(line, row, ctx), ctx);
}

function chooseRow(line: Line, row: Row, ctx: LineContext): Outcome {
  let base: Line = { ...line, word: "", refused: undefined, pending: undefined };
  if (row.kind === "entry" && takesValue(row.entry) && !atInput(base)) {
    // A refused choice leaves the line as it was, its word still to correct, with the reason.
    const placed = takeValue(base, row.entry);
    return placed.taken ? placed : refused({ ...line, refused: placed.line.refused });
  }
  if (base.selected) base = cleared(base);
  if (!("at" in base.caret)) return refused(line);
  switch (row.kind) {
    case "variable":
    case "new": {
      const made = variableExpr(row.name);
      return made ? fill(base, made) : refused(line);
    }
    case "function": {
      const made = callExpr(row.fn, ctx.scope);
      return made ? fill(base, made) : refused(line);
    }
    case "brackets":
      return done({ ...base, open: [...base.open, base.caret.at] });
    case "entry": {
      const made = makeEntry(row.entry);
      return fill(base, made, textSlot(made) !== undefined);
    }
  }
}

// ---------------------------------------------------------------- words

function rowName(row: Row): string {
  switch (row.kind) {
    case "variable":
    case "new":
      return row.name;
    case "entry":
      return row.entry.label;
    case "function":
      return row.fn.name;
    case "brackets":
      return "";
  }
}

/** Whether the row is named exactly by the word: its name, or the entry's keys. */
function namesExactly(row: Row, word: string): boolean {
  if (row.kind === "entry" && row.entry.menu.keys === word) return true;
  return rowName(row).toLowerCase() === word.toLowerCase();
}

/**
 * The names offered where a target slot's whole value is to fill (`editor.md`, Targets), and in a
 * slot that binds the word typed as a new variable when it names none and is a name.
 */
function targetNames(word: string, target: TargetLine): Row[] {
  const names = [...target.asked, ...target.names];
  const rows = names.map((name): Row => ({ kind: "variable", name }));
  if (target.binds && isNewName(word, names)) rows.push({ kind: "new", name: word });
  return rows;
}

/** The names a target's line offers where its whole value is to fill; undefined elsewhere. */
export function wholeTargetRows(line: Line, ctx: LineContext): Row[] | undefined {
  return ctx.target && fillsWhole(line) ? targetNames(line.word, ctx.target) : undefined;
}

/**
 * The rows of `rows` the line's slot keeps: a row is left out only when choosing it leaves a value
 * the slot refuses; one refused for another reason stays, refused when chosen.
 */
export function keptRows(line: Line, rows: readonly Row[], ctx: LineContext): Row[] {
  return rows.filter((row) => {
    const chosen = chooseRow(line, row, ctx);
    return !chosen.taken || keeps(chosen.line.root, ctx);
  });
}

/**
 * Whether a word typed names the target's names: where the whole target is to fill, or in place
 * of its selected value.
 */
export function namesTarget(line: Line, ctx: LineContext): boolean {
  return ctx.target !== null && (fillsWhole(line) || line.selected);
}

/** The rows a word can name at the caret: where a value is expected, or after one. */
export function wordRows(line: Line, ctx: LineContext): Row[] {
  if (ctx.target && namesTarget(line, ctx)) return targetNames(line.word, ctx.target);
  if (atInput(line) || (line.selected && line.word !== "")) {
    return [
      ...ctx.variables.map((name): Row => ({ kind: "variable", name })),
      ...allEntries()
        .filter((entry) => !takesValue(entry) || entry.call)
        .map((entry): Row => ({ kind: "entry", entry })),
      ...ctx.functions.map((fn): Row => ({ kind: "function", fn })),
    ];
  }
  const after = allEntries()
    .filter(takesValue)
    .map((entry): Row => ({ kind: "entry", entry }));
  return keptRows(line, after, ctx);
}

/** The rows matching the word typed: a whole name first, then, after a value, its kind's. */
export function matches(line: Line, ctx: LineContext): Row[] {
  const word = line.word;
  if (word === "") return [];
  const kind = atInput(line) ? undefined : kindBefore(line, ctx);
  const found = wordRows(line, ctx).filter(
    (row) =>
      matchesName(rowName(row), word) ||
      (row.kind === "entry" && (row.entry.menu.keys ?? "").startsWith(word)),
  );
  // A new variable comes last: a name the program has is the likelier one meant.
  const rank = (row: Row) =>
    row.kind === "new"
      ? 3
      : namesExactly(row, word)
        ? 0
        : kind !== undefined && row.kind === "entry" && row.entry.menu.on?.includes(kind)
          ? 1
          : 2;
  return found
    .map((row, index) => ({ row, index }))
    .toSorted((a, b) => rank(a.row) - rank(b.row) || a.index - b.index)
    .map(({ row }) => row);
}

/** The row the word names exactly, if any. */
export function exactRow(line: Line, ctx: LineContext): Row | undefined {
  return matches(line, ctx).find((row) => namesExactly(row, line.word));
}

/** The word typed, chosen when it names a row exactly, as when the line is left. */
export function settle(line: Line, ctx: LineContext): Line {
  const exact = line.word === "" ? undefined : exactRow(line, ctx);
  return exact ? choose(line, exact, ctx).line : line;
}

// ---------------------------------------------------------------- typing

/** The key that opens a pair of brackets, or a call's own after its name. */
export const BRACKETS_KEY = "(";

/** The keys that end a word. */
const ENDS_WORD = /^[-+*/%<>=!(),[\]]$/;

/** The entries `keys` name, the one that fills an input before the one that takes a value. */
const entriesByKeys = (keys: string) =>
  allEntries()
    .filter((entry) => entry.menu.keys === keys)
    .toSorted((a, b) => Number(takesValue(a)) - Number(takesValue(b)));
const startsKeys = (key: string) =>
  allEntries().some(
    (entry) => (entry.menu.keys ?? "").length > key.length && entry.menu.keys?.startsWith(key),
  );

function typeDigit(line: Line, ch: string): Outcome {
  const base = line.selected ? cleared(line) : line;
  if ("at" in base.caret) {
    const made = numberOf(ch);
    return made ? fill(base, made) : refused(line);
  }
  const last = find(base.root, base.caret.after);
  if (!last || !isNumber(last)) return refused(line);
  const made = numberOf(exprText(last) + ch);
  if (!made) return refused(line);
  return done(replace(base, last.id, { ...made, id: last.id }));
}

/**
 * Whether the line takes a key: one typed without Ctrl or Cmd, or a character AltGr makes (which
 * Windows reports with Ctrl). Every other key is the page's.
 */
export function lineTakes(
  event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "getModifierState">,
): boolean {
  return (!event.ctrlKey && !event.metaKey) || event.getModifierState("AltGraph");
}

/** One key typed in the line, as the line's slot keeps it. */
export function type(line: Line, key: string, ctx: LineContext): Outcome {
  return inSlot(line, typeKey(line, key, ctx), ctx);
}

function typeKey(line: Line, key: string, ctx: LineContext): Outcome {
  if (key.length !== 1) return refused(line);
  let current: Line = { ...line, refused: undefined };
  if (/[A-Za-z_]/.test(key) || (current.word !== "" && /[0-9]/.test(key))) {
    if (current.word === "" && current.selected) current = cleared(current);
    return done({ ...current, word: current.word + key, pending: undefined });
  }
  if (current.word !== "") {
    // A space or a key of the table ends the word when it names one; else the word stays.
    if (key !== " " && !ENDS_WORD.test(key)) return refused(line);
    const exact = exactRow(current, ctx);
    if (!exact) return refused(line);
    const chosen = choose(current, exact, ctx);
    // A call's `(` is the bracket the call already has.
    if (!chosen.taken || key === " " || (key === BRACKETS_KEY && makesCall(exact))) return chosen;
    current = chosen.line;
  }
  if (key === " ") return done(current);
  if (current.pending) {
    const entry = entriesByKeys(current.pending.key + key).find(takesValue);
    const before = current.pending.before ?? current;
    current = { ...current, pending: undefined };
    if (entry) return takeValue({ ...before, pending: undefined }, entry);
  }
  if (/[0-9.]/.test(key)) return typeDigit(current, key);
  const value = !atInput(current);
  switch (key) {
    case BRACKETS_KEY: {
      const base = current.selected ? cleared(current) : current;
      return "at" in base.caret
        ? done({ ...base, open: [...base.open, base.caret.at] })
        : refused(line);
    }
    case ")": {
      const group = current.open.at(-1);
      const held = group === undefined ? undefined : find(current.root, group);
      // A call begun inside the innermost brackets closes before them.
      const around = enclosing(current, isCall);
      if (around && (group === undefined || (held && find(held, around.parent.id)))) {
        return done({ ...current, caret: { after: around.parent.id } });
      }
      if (group === undefined) return refused(line);
      return done({
        ...current,
        open: current.open.slice(0, -1),
        caret: { after: held ? held.id : group },
      });
    }
    case ",": {
      // In a call, the call's next input; in a list, a new item; elsewhere, the slot's next value.
      const around = current.selected
        ? undefined
        : enclosing(current, (expr) => isCall(expr) || isSequence(expr));
      if (!around) return { line: current, taken: true, move: "item" };
      if (isSequence(around.parent)) {
        const { held, with: holding } = items(around.parent);
        const fresh = emptyExpr();
        const at = held.findIndex((item) => item.id === around.input.id) + 1;
        const next = replace(current, around.parent.id, holding(held.toSpliced(at, 0, fresh)));
        return done(closeBehind({ ...next, caret: { at: fresh.id } }));
      }
      const next = inputs(around.parent)[around.index + 1];
      if (!next) return refused(line);
      const empty = [...allExprs(next)].find(isEmptyExpr);
      return done(closeBehind({ ...current, caret: empty ? { at: empty.id } : endOf(next) }));
    }
    case "]": {
      // Leaves the innermost list or item, a list's item still to fill at its end removed first.
      const around = current.selected
        ? undefined
        : enclosing(current, (expr) => closedBy(expr, "]"));
      if (!around) return refused(line);
      const list = isSequence(around.parent) ? items(around.parent) : undefined;
      const last = list?.held.at(-1);
      const trailing = list !== undefined && last !== undefined && isEmptyExpr(last);
      const kept = trailing ? list.with(list.held.slice(0, -1)) : around.parent;
      const next = replace(current, around.parent.id, kept);
      return done(closeBehind({ ...next, caret: { after: kept.id } }));
    }
    case "-":
      if (!value || current.selected) {
        const base = current.selected ? cleared(current) : current;
        const sign = signExpr();
        return sign ? fill(base, sign) : refused(line);
      }
      break;
    default:
      break;
  }
  // Of the entries the key names that apply at the caret, the first the slot keeps; a selected
  // value is both an input to fill and a value (`editor.md`, Backspace and keys).
  const applying = entriesByKeys(key)
    .filter((entry) => (takesValue(entry) ? value : !value || current.selected))
    .map((entry) => keyed(current, entry, key));
  const inserted =
    applying.find((outcome) => outcome.taken && keeps(outcome.line.root, ctx)) ?? applying[0];
  if (inserted) return inserted;
  if (value && startsKeys(key)) return done({ ...current, pending: { key } });
  return refused(line);
}

/**
 * The entry a key names, inserted at the caret: filling the input or the selected value's place (a
 * list opens with an item to fill, `[`), or taking the value before it.
 */
function keyed(line: Line, entry: Entry, key: string): Outcome {
  if (!takesValue(entry)) {
    const base = line.selected ? cleared(line) : line;
    const made = makeEntry(entry);
    return fill(base, isSequence(made) ? items(made).with([emptyExpr()]) : made);
  }
  const placed = takeValue(line, entry);
  if (placed.taken && startsKeys(key)) placed.line.pending = { key, before: line };
  return placed;
}

/** Whether a row makes a call: a function of the program, or an entry whose block is one. */
const makesCall = (row: Row) => row.kind === "function" || (row.kind === "entry" && row.entry.call);

/** The innermost operation `is` accepts with an input that holds the caret, and that input. */
function enclosing(
  line: Line,
  is: (expr: Expr) => boolean,
): { parent: Expr; input: Expr; index: number } | undefined {
  const { caret, root } = line;
  let id = "at" in caret ? caret.at : caret.after;
  let up = parentOf(root, id);
  while (up && !is(up.parent)) {
    id = up.parent.id;
    up = parentOf(root, id);
  }
  const input = up && inputs(up.parent)[up.index];
  return up && input && { parent: up.parent, input, index: up.index };
}

// ---------------------------------------------------------------- removing and moving

/** Backspace removes what is before the caret, as the line's slot keeps it. */
export function backspace(line: Line, ctx: LineContext): Outcome {
  return inSlot(line, removeBefore(line), ctx);
}

function removeBefore(line: Line): Outcome {
  const current: Line = { ...line, refused: undefined, pending: undefined };
  if (current.word !== "") return done({ ...current, word: current.word.slice(0, -1) });
  if (current.selected) return done(cleared(current));
  const { caret, root } = current;
  if ("after" in caret) {
    const last = find(root, caret.after);
    if (!last) return refused(line);
    if (isNumber(last) && exprText(last).length > 1) {
      const made = numberOf(exprText(last).slice(0, -1));
      if (made) return done(replace(current, last.id, { ...made, id: last.id }));
    }
    // A text loses its last character as its field counts one, and the field opens on the rest.
    const typed = textOf(last);
    if (typed) {
      const characters = Array.from(new Intl.Segmenter().segment(typed), (part) => part.segment);
      return done({
        ...setText(current, last.id, characters.slice(0, -1).join("")),
        text: last.id,
      });
    }
    const own = inputs(last);
    const [first] = own;
    if (first) {
      // An operator ends in an input, and a list in its last item: what is before the caret ends it.
      if (precedenceOf(last) !== undefined || isSequence(last)) {
        const end = own.at(-1);
        return end ? removeBefore({ ...current, caret: endOf(end) }) : refused(line);
      }
      // A call ends in its bracket; removing it would lose the value of an input after the first.
      if (own.slice(1).some((input) => !isEmptyExpr(input))) return move(current, -1);
      const next = replace(current, last.id, first);
      return done({ ...next, caret: endOf(first) });
    }
    const fresh = emptyExpr();
    return done({ ...replace(current, last.id, fresh), caret: { at: fresh.id } });
  }
  if (current.open.at(-1) === caret.at)
    return done({ ...current, open: current.open.slice(0, -1) });
  const up = parentOf(root, caret.at);
  if (!up) return refused(line);
  const item = isSequence(up.parent) ? items(up.parent) : undefined;
  const at = item ? item.held.findIndex((each) => each.id === caret.at) : -1;
  const before = item?.held[at - 1];
  if (item && before) {
    // An item of a list, other than its first, goes alone; the caret ends the one before it.
    const next = replace(current, up.parent.id, item.with(item.held.toSpliced(at, 1)));
    return done({ ...next, caret: endOf(before) });
  }
  const own = inputs(up.parent);
  const [first] = own;
  if (!first) return refused(line);
  // While an input after the first holds a value, removing the operation would lose it.
  if (own.slice(1).some((input) => !isEmptyExpr(input))) return move(current, -1);
  if (up.index === 0) {
    const next = replace(current, up.parent.id, first);
    return done({ ...next, caret: { at: first.id } });
  }
  const next = replace(current, up.parent.id, first);
  return done({ ...next, caret: endOf(first) });
}

/** ← and →: the previous or next value or input. */
export function move(line: Line, step: -1 | 1): Outcome {
  const all = stops(line.root);
  if (line.selected) {
    const caret = step < 0 ? all[0] : all.at(-1);
    return done(closeBehind({ ...line, selected: false, caret: caret ?? line.caret }));
  }
  const here = position(line);
  // → at the end of an operation's last input leaves the operation.
  const target = all[here + step];
  if (!target) return refused(line);
  return done(closeBehind({ ...line, caret: target, pending: undefined, refused: undefined }));
}

/** Tab and Shift+Tab: the next or previous input still to fill, else the next or previous slot. */
export function tab(line: Line, step: -1 | 1, ctx: LineContext): Outcome {
  let current: Line = { ...line, pending: undefined, refused: undefined };
  if (current.word !== "") {
    const exact = exactRow(current, ctx);
    current = exact ? choose(current, exact, ctx).line : { ...current, word: "" };
  }
  const all = stops(current.root);
  const here = current.selected ? (step > 0 ? all.length - 1 : 0) : position(current);
  const fields = all
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop, index }) => "at" in stop && (step > 0 ? index > here : index < here));
  const field = step > 0 ? fields[0] : fields.at(-1);
  if (!field) return { line: current, taken: true, move: step > 0 ? "next" : "previous" };
  return done(closeBehind({ ...current, caret: field.stop, selected: false }));
}

/** A click on a value puts the caret after it, and on an input at it; on a text it opens its field. */
export function clickAt(line: Line, id: NodeId): Line {
  const clicked = find(line.root, id);
  if (!clicked) return line;
  const caret: Caret = isEmptyExpr(clicked) ? { at: id } : endOf(clicked);
  const text = textSlot(clicked) === undefined ? undefined : id;
  return closeBehind({ ...line, caret, selected: false, word: "", pending: undefined, text });
}

/** The text being typed changes. */
export function setText(line: Line, id: NodeId, text: string): Line {
  const held = find(line.root, id);
  const slot = held ? textSlot(held) : undefined;
  if (!held || slot === undefined) return line;
  return replace(line, id, { ...held, [slot]: text });
}

/** The text field ends; the caret is after the text. */
export function endText(line: Line): Line {
  return line.text === undefined ? line : { ...line, text: undefined, caret: { after: line.text } };
}

/** The operator clicked is replaced by another entry of its block in its group. */
export function switchTo(line: Line, id: NodeId, entry: Entry): Line {
  const held = find(line.root, id);
  if (!held) return line;
  return replace(line, id, { ...held, ...entry.menu.preset });
}
