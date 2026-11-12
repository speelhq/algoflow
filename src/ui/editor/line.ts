// The value line: one expression edited as a line, with a caret at
// an empty slot or after a value, the parentheses opened and not yet closed, the word
// being typed, and the first key of a two-key operator. Every change is a new `Line`.
// Blocks are made by the parser (a variable, a number, a sign, a call) or by an entry's
// block (`create()` with its preset), and read through their slots, their notation (the caret
// moves in reading order, and a call ends with its parenthesis), and `precedence`, so this file
// names no block type. A target slot's line keeps a target (`editor.md`, Targets).
import { errorText, t } from "@/i18n/t";
import { exprKind } from "@/lang/kinds";
import type { Expr, Name, NodeId, Program } from "@/lang/types";
import { refusedDefinitions } from "@/lang/validate";
import { allExprs, isEmptyExpr, isTarget, variableOf } from "@/lang/walk";
import { emptyExpr, getBlockDef, keyOf } from "@/blocks/registry";
import { unparse } from "@/python/emit";
import { isParseError, parse } from "@/python/parse";
import { levelAssociativity } from "@/python/precedence";
import {
  bindsAt,
  closedBy,
  notationOf,
  isCall,
  placeholderValue,
  notationTokens,
} from "@/ui/chart/text";
import { allEntries, firstSlot, makeEntry, takesValue, type Entry } from "./entries";
import {
  afterRows,
  callExpr,
  expectedWordRows,
  namesExactly,
  rankMatches,
  targetNames,
  type LineContext,
  type LineFunction,
  type Row,
} from "./choices";

type Bag = Record<string, unknown>;

/** At an empty slot, or after a value (or after an operation, once it is left). */
export type Caret = { at: NodeId } | { after: NodeId };

export type Line = {
  root: Expr;
  caret: Caret;
  /** The whole value is selected: a value typed replaces it, an operator's key takes it. */
  selected: boolean;
  /** The parentheses opened and not yet closed, innermost last, by the expression they hold. */
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

/** What a key or a choice did: `move` leaves the line for the next or previous field or item. */
export type Outcome = { line: Line; taken: boolean; move?: "next" | "previous" | "item" };

// ---------------------------------------------------------------- the tree

/**
 * The values in an expression's slots, each item of a list its own, in reading order as its
 * notation places them: the order the caret moves in. Which slot an entry's value goes into is
 * the slot order's (`withFirst`).
 */
export function slotValues(expr: Expr): Expr[] {
  return notationTokens(notationOf(expr)).flatMap((token) => {
    if ("text" in token) return [];
    const held = placeholderValue(expr, token.placeholder);
    if (held?.role === "expr") return held.expr ? [held.expr] : [];
    return held?.role === "exprs" ? held.items : [];
  });
}

export function find(root: Expr, id: NodeId): Expr | undefined {
  for (const expr of allExprs(root)) if (expr.id === id) return expr;
  return undefined;
}

/** The expression holding `id` in a slot, with the slot's position. */
export function parentOf(root: Expr, id: NodeId): { parent: Expr; index: number } | undefined {
  for (const expr of allExprs(root)) {
    const index = slotValues(expr).findIndex((value) => value.id === id);
    if (index >= 0) return { parent: expr, index };
  }
  return undefined;
}

/** `expr` with each slot's value replaced by what `map` makes of it. */
function mapSlotValues(expr: Expr, map: (value: Expr, index: number) => Expr): Expr {
  const copy = { ...expr } as unknown as Bag;
  let index = 0;
  for (const slot of getBlockDef(keyOf(expr)).slots) {
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
  return mapSlotValues(root, (value) => replaceIn(value, id, by));
}

/** The line with expression `id` replaced; a parenthesis that held it holds what replaces it. */
function replace(line: Line, id: NodeId, by: Expr): Line {
  return {
    ...line,
    root: replaceIn(line.root, id, by),
    open: line.open.map((group) => (group === id ? by.id : group)),
  };
}

const precedenceOf = (expr: Expr) => getBlockDef(keyOf(expr)).precedence?.(expr);

/** The slot of an operation's list of values, when it has one. */
const valuesSlot = (expr: Expr) => getBlockDef(keyOf(expr)).slots.find((s) => s.role === "exprs");

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
  const own = slotValues(expr);
  if (own.length === 0) return [{ after: expr.id }];
  const inner = own.flatMap(stops);
  // An operation with no precedence ends with its own text (a call's parenthesis): a stop of
  // its own.
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

/** Parentheses the caret has left behind close; after the value they hold, it is still inside. */
function closeBehind(line: Line): Line {
  const { caret } = line;
  const open = line.open.filter((group) =>
    within(line.root, group, "at" in caret ? caret.at : caret.after),
  );
  return { ...line, open };
}

/** The caret is after the whole value: no word typed, no open parenthesis, nothing selected. */
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

/** The caret is at an empty slot (and nothing is selected). */
export function atEmptySlot(line: Line): boolean {
  return !line.selected && "at" in line.caret;
}

/** The expression before the caret: the last value, or the selected value. */
function lastValue(line: Line): Expr | undefined {
  if (line.selected) return line.root;
  return "after" in line.caret ? find(line.root, line.caret.after) : undefined;
}

/**
 * Where an operator of `level` inserted after `value` binds: it takes the largest
 * operation ending at the caret that binds tighter, within the innermost open parentheses.
 * `chain` when it would chain a comparison.
 */
function bindAt(line: Line, value: Expr, level: number): Expr | "chain" {
  let target = value;
  for (;;) {
    if (line.open.includes(target.id)) return target;
    const up = parentOf(line.root, target.id);
    const outer = up ? precedenceOf(up.parent) : undefined;
    if (!up || outer === undefined || up.index !== slotValues(up.parent).length - 1) return target;
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
    if (up.index !== slotValues(up.parent).length - 1) return target;
    target = up.parent;
  }
}

/** The kind of the value before the caret. */
export function kindBefore(line: Line, ctx: LineContext) {
  const value = valueBefore(line);
  return value ? exprKind(value, ctx.kinds) : undefined;
}

// ---------------------------------------------------------------- made by the parser

function parsed(text: string): Expr | undefined {
  const result = parse(text);
  return isParseError(result) ? undefined : result;
}

/** A number literal for `raw`, or undefined when Python would reject it or it is no number. */
function numberOf(raw: string): Expr | undefined {
  if (!/^[0-9.]+$/.test(raw)) return undefined;
  const made = parsed(raw);
  return made && slotValues(made).length === 0 && unparse(made) === raw ? made : undefined;
}

let numberKey: string | undefined;

function isNumber(expr: Expr): boolean {
  numberKey ??= keyOf(numberOf("0") ?? emptyExpr());
  return keyOf(expr) === numberKey;
}

/** `name` as a variable. */
export function variableExpr(name: Name): Expr | undefined {
  const made = parsed(name);
  return made && variableOf(made) === name ? made : undefined;
}

/** A sign before the empty slot it leaves (`-value`). */
function signExpr(): Expr | undefined {
  const made = parsed("-a");
  return made && mapSlotValues(made, () => emptyExpr());
}

/** A list with one empty item (`[value]`), as `[` opens it. */
function listExpr(): Expr | undefined {
  const made = parsed("[a]");
  return made && mapSlotValues(made, () => emptyExpr());
}

/** The program's functions a call can name: those whose name no diagnostic refuses. */
export function callableFunctions(program: Program): LineFunction[] {
  const refused = refusedDefinitions(program);
  return program.functions
    .filter((fn) => !refused.has(fn.id))
    .map((fn) => ({ name: fn.name, params: fn.params }));
}

// ---------------------------------------------------------------- starting

/** A line opened on `root`: at the empty slot `at`, else with the value selected, else at `root`. */
export function openLine(root: Expr, at?: NodeId): Line {
  const base: Line = { root, caret: endOf(root), selected: false, open: [], word: "" };
  if (at !== undefined && find(root, at) && isEmptyExpr(find(root, at))) {
    return { ...base, caret: { at } };
  }
  return isEmptyExpr(root) ? base : { ...base, selected: true };
}

/** The value removed: one empty slot, the caret at it. */
function cleared(line: Line): Line {
  const fresh = emptyExpr();
  return { ...line, root: fresh, caret: { at: fresh.id }, selected: false, open: [], word: "" };
}

const done = (line: Line): Outcome => ({ line, taken: true });
const refused = (line: Line): Outcome => ({ line, taken: false });

/** Whether the line's slot keeps `root`: any value, or in a target slot a target or empty slot. */
function keeps(root: Expr, ctx: LineContext): boolean {
  return ctx.target === null || isEmptyExpr(root) || isTarget(root);
}

/** `outcome` where the line's slot keeps its value; else the line before it, refused with the reason. */
function inSlot(line: Line, outcome: Outcome, ctx: LineContext): Outcome {
  if (!outcome.taken || keeps(outcome.line.root, ctx)) return outcome;
  return refused({ ...line, refused: t("editor.notTarget") });
}

/** Whether the caret is at the whole value, which is then an empty slot. */
function fillsWhole(line: Line): boolean {
  return !line.selected && "at" in line.caret && line.caret.at === line.root.id;
}

// ---------------------------------------------------------------- entries

/** The first empty slot in `made`, in reading order, outside `placed`; else after it. */
function caretIn(made: Expr, placed: Expr | null): Caret {
  for (const value of slotValues(made)) {
    if (value === placed) continue;
    const empty = [...allExprs(value)].find(isEmptyExpr);
    if (empty) return { at: empty.id };
  }
  return endOf(made);
}

/** `made` with `value` as the first of its slot values, in slot order. */
function withFirst(made: Expr, value: Expr): Expr {
  return mapSlotValues(made, (held, index) => (index === 0 ? value : held));
}

/**
 * An entry chosen after a value takes it as the first expression it holds, chosen or typed
 * alike: an entry whose first expression binds at a precedence (an operator, or an item's atom)
 * binds by it.
 */
function takeValue(line: Line, entry: Entry): Outcome {
  const last = lastValue(line);
  if (!last) return refused(line);
  const made = makeEntry(entry);
  const first = firstSlot(made);
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

/** A block made where a value is expected, filling the empty slot at the caret. */
function fill(line: Line, made: Expr, text = false): Outcome {
  if (!("at" in line.caret)) return refused(line);
  const next = replace(line, line.caret.at, made);
  const caret = caretIn(made, null);
  return done({ ...next, caret, word: "", ...(text ? { text: made.id } : {}) });
}

/**
 * The slot of a value typed in a text field of its own (`Text`): a literal that holds a string. A
 * number is a literal that the learner types in the line.
 */
function textSlot(made: Expr): string | undefined {
  const bag = made as unknown as Bag;
  return getBlockDef(keyOf(made)).slots.find(
    (s) => s.role === "literal" && typeof bag[s.name] === "string",
  )?.name;
}

/** What a value typed in a text field of its own holds, or undefined for any other value. */
export function textOf(expr: Expr): string | undefined {
  const slot = textSlot(expr);
  const held = slot === undefined ? undefined : (expr as unknown as Bag)[slot];
  return typeof held === "string" ? held : undefined;
}

/** Chooses a row of the list at the caret, as the line's slot keeps it. */
export function choose(line: Line, row: Row, ctx: LineContext): Outcome {
  return inSlot(line, chooseRow(line, row), ctx);
}

function chooseRow(line: Line, row: Row): Outcome {
  let base: Line = { ...line, word: "", refused: undefined, pending: undefined };
  if (row.type === "entry" && takesValue(row.entry) && !atEmptySlot(base)) {
    // A refused choice leaves the line as it was, its word still to correct, with the reason.
    const placed = takeValue(base, row.entry);
    return placed.taken ? placed : refused({ ...line, refused: placed.line.refused });
  }
  if (base.selected) base = cleared(base);
  if (!("at" in base.caret)) return refused(line);
  switch (row.type) {
    case "variable":
    case "new": {
      const made = variableExpr(row.name);
      return made ? fill(base, made) : refused(line);
    }
    case "function": {
      const made = callExpr(row.fn);
      return made ? fill(base, made) : refused(line);
    }
    case "parentheses":
      return done({ ...base, open: [...base.open, base.caret.at] });
    case "entry": {
      const made = makeEntry(row.entry);
      return fill(base, made, textSlot(made) !== undefined);
    }
  }
}

// ---------------------------------------------------------------- words

/** The names a target's line offers where its whole value is an empty slot; undefined elsewhere. */
export function wholeTargetRows(line: Line, ctx: LineContext): Row[] | undefined {
  return ctx.target && fillsWhole(line) ? targetNames(line.word, ctx.target) : undefined;
}

/**
 * The rows of `rows` the line's slot keeps: a row is left out only when choosing it leaves a value
 * the slot refuses; one refused for another reason stays, refused when chosen.
 */
export function keptRows(line: Line, rows: readonly Row[], ctx: LineContext): Row[] {
  return rows.filter((row) => {
    const chosen = chooseRow(line, row);
    return !chosen.taken || keeps(chosen.line.root, ctx);
  });
}

/**
 * Whether a word typed names the target's names: where the whole target is an empty slot, or in
 * place of its selected value.
 */
export function namesTarget(line: Line, ctx: LineContext): boolean {
  return ctx.target !== null && (fillsWhole(line) || line.selected);
}

/** The rows a word can name at the caret: where a value is expected, or after one. */
export function wordRows(line: Line, ctx: LineContext): Row[] {
  if (ctx.target && namesTarget(line, ctx)) return targetNames(line.word, ctx.target);
  if (atEmptySlot(line) || (line.selected && line.word !== "")) return expectedWordRows(ctx);
  return keptRows(line, afterRows(), ctx);
}

/** The rows matching the word typed: a whole name first, then, after a value, its kind's. */
export function matches(line: Line, ctx: LineContext): Row[] {
  const kind = atEmptySlot(line) ? undefined : kindBefore(line, ctx);
  return rankMatches(wordRows(line, ctx), line.word, kind);
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

/** The key that opens a pair of parentheses, or a call's own after its name. */
export const PARENTHESES_KEY = "(";

/** The keys that end a word. */
const ENDS_WORD = /^[-+*/%<>=!(),[\]]$/;

/**
 * The entry taking a value whose `typed` is `typed`: an operator's keys. A key inserts no other
 * entry: a word names the entries whose keys are a word, and `[` then `]` gives `Empty list`.
 */
const operatorTyped = (typed: string) =>
  allEntries().find((entry) => takesValue(entry) && entry.declared.typed === typed);
const startsOperator = (key: string) =>
  allEntries().some(
    (entry) =>
      takesValue(entry) &&
      (entry.declared.typed ?? "").length > key.length &&
      entry.declared.typed?.startsWith(key),
  );

function typeDigit(line: Line, ch: string): Outcome {
  const base = line.selected ? cleared(line) : line;
  if ("at" in base.caret) {
    const made = numberOf(ch);
    return made ? fill(base, made) : refused(line);
  }
  const last = find(base.root, base.caret.after);
  if (!last || !isNumber(last)) return refused(line);
  const made = numberOf(unparse(last) + ch);
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
    // A call's `(` is the parenthesis the call already has.
    if (!chosen.taken || key === " " || (key === PARENTHESES_KEY && makesCall(exact)))
      return chosen;
    current = chosen.line;
  }
  if (key === " ") return done(current);
  if (current.pending) {
    const entry = operatorTyped(current.pending.key + key);
    const before = current.pending.before ?? current;
    current = { ...current, pending: undefined };
    if (entry) return takeValue({ ...before, pending: undefined }, entry);
  }
  if (/[0-9.]/.test(key)) return typeDigit(current, key);
  const value = !atEmptySlot(current);
  switch (key) {
    case PARENTHESES_KEY: {
      const base = current.selected ? cleared(current) : current;
      return "at" in base.caret
        ? done({ ...base, open: [...base.open, base.caret.at] })
        : refused(line);
    }
    case ")": {
      const group = current.open.at(-1);
      const held = group === undefined ? undefined : find(current.root, group);
      // A call begun inside the innermost parentheses closes before them.
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
      // In a call, its next argument; in a list, a new item; elsewhere, the slot's next value.
      const around = current.selected
        ? undefined
        : enclosing(current, (expr) => isCall(expr) || isSequence(expr));
      if (!around) return { line: current, taken: true, move: "item" };
      if (isSequence(around.parent)) {
        const { held, with: holding } = items(around.parent);
        const fresh = emptyExpr();
        const at = held.findIndex((item) => item.id === around.value.id) + 1;
        const next = replace(current, around.parent.id, holding(held.toSpliced(at, 0, fresh)));
        return done(closeBehind({ ...next, caret: { at: fresh.id } }));
      }
      const next = slotValues(around.parent)[around.index + 1];
      if (!next) return refused(line);
      const empty = [...allExprs(next)].find(isEmptyExpr);
      return done(closeBehind({ ...current, caret: empty ? { at: empty.id } : endOf(next) }));
    }
    case "]": {
      // Leaves the innermost list or item, a list's empty item at its end removed first.
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
    case "[": {
      // At an empty slot or in place of a selected value, a list with an empty item; a target
      // keeps no list, so there `[` makes an item of the selected value instead.
      if (value && !current.selected) break;
      const made = listExpr();
      if (!made) return refused(line);
      const opened = fill(current.selected ? cleared(current) : current, made);
      if (!current.selected || keeps(opened.line.root, ctx)) return opened;
      break;
    }
    default:
      break;
  }
  const entry = value ? operatorTyped(key) : undefined;
  if (entry) return keyed(current, entry, key);
  if (value && startsOperator(key)) return done({ ...current, pending: { key } });
  return refused(line);
}

/** The operator a key names, taking the value before the caret. */
function keyed(line: Line, entry: Entry, key: string): Outcome {
  const placed = takeValue(line, entry);
  if (placed.taken && startsOperator(key)) placed.line.pending = { key, before: line };
  return placed;
}

/** Whether a row makes a call: a function of the program, or an entry whose block is one. */
const makesCall = (row: Row) => row.type === "function" || (row.type === "entry" && row.entry.call);

/** The innermost operation `is` accepts with a slot that holds the caret, and that slot's value. */
function enclosing(
  line: Line,
  is: (expr: Expr) => boolean,
): { parent: Expr; value: Expr; index: number } | undefined {
  const { caret, root } = line;
  let id = "at" in caret ? caret.at : caret.after;
  let up = parentOf(root, id);
  while (up && !is(up.parent)) {
    id = up.parent.id;
    up = parentOf(root, id);
  }
  const value = up && slotValues(up.parent)[up.index];
  return up && value && { parent: up.parent, value, index: up.index };
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
    if (isNumber(last) && unparse(last).length > 1) {
      const made = numberOf(unparse(last).slice(0, -1));
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
    const own = slotValues(last);
    const [first] = own;
    if (first) {
      // An operator ends in a slot, and a list in its last item: what is before the caret ends it.
      if (precedenceOf(last) !== undefined || isSequence(last)) {
        const end = own.at(-1);
        return end ? removeBefore({ ...current, caret: endOf(end) }) : refused(line);
      }
      // A call ends in its parenthesis; removing it would lose the value of a later argument.
      if (own.slice(1).some((value) => !isEmptyExpr(value))) return move(current, -1);
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
  const own = slotValues(up.parent);
  const [first] = own;
  if (!first) return refused(line);
  // While a slot after the first holds a value, removing the operation would lose it.
  if (own.slice(1).some((value) => !isEmptyExpr(value))) return move(current, -1);
  if (up.index === 0) {
    const next = replace(current, up.parent.id, first);
    return done({ ...next, caret: { at: first.id } });
  }
  const next = replace(current, up.parent.id, first);
  return done({ ...next, caret: endOf(first) });
}

/** ← and →: the previous or next value or empty slot. */
export function move(line: Line, step: -1 | 1): Outcome {
  const all = stops(line.root);
  if (line.selected) {
    const caret = step < 0 ? all[0] : all.at(-1);
    return done(closeBehind({ ...line, selected: false, caret: caret ?? line.caret }));
  }
  const here = position(line);
  // → at the end of an operation's last slot leaves the operation.
  const target = all[here + step];
  if (!target) return refused(line);
  return done(closeBehind({ ...line, caret: target, pending: undefined, refused: undefined }));
}

/**
 * Tab and Shift+Tab: the next or previous empty slot, else the next or previous field. A selected
 * value is passed from its start by Tab and from its end by Shift+Tab, so its empty slots come
 * first.
 */
export function tab(line: Line, step: -1 | 1, ctx: LineContext): Outcome {
  let current: Line = { ...line, pending: undefined, refused: undefined };
  if (current.word !== "") {
    const exact = exactRow(current, ctx);
    current = exact ? choose(current, exact, ctx).line : { ...current, word: "" };
  }
  const all = stops(current.root);
  const here = current.selected ? (step > 0 ? -1 : all.length) : position(current);
  const empties = all
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop, index }) => "at" in stop && (step > 0 ? index > here : index < here));
  const empty = step > 0 ? empties[0] : empties.at(-1);
  if (!empty) return { line: current, taken: true, move: step > 0 ? "next" : "previous" };
  return done(closeBehind({ ...current, caret: empty.stop, selected: false }));
}

/**
 * A click on a value puts the caret after it, and on an empty slot at it; on a text it opens its
 * field.
 */
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
  return replace(line, id, { ...held, ...entry.declared.preset });
}
