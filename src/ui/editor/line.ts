// The value line: one expression edited as a line, with a caret at
// an empty slot or after a value, the parentheses opened and not yet closed, the word
// being typed, and the first key of a two-key operator. Every change is a new `Line`.
// Blocks are made by the parser (a variable, a number, a sign, a call) or by an entry's
// block (`create()` with its preset), and read through their slots, their notation (the caret
// moves in reading order, and a call ends with its parenthesis), and `precedence`, so this file
// names no block type. A target slot's line keeps a target (`editor.md`, Targets).
import { errorText, t } from "@/i18n/t";
import type { Kinds } from "@/lang/kinds";
import { exprKind } from "@/lang/kinds";
import type { Expr, Name, NodeId, Program } from "@/lang/types";
import { refusedDefinitions } from "@/lang/validate";
import { allExprs, isEmptyExpr, isTarget, variableOf } from "@/lang/walk";
import { emptyExpr, getBlockDef, keyOf } from "@/blocks/registry";
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
import { isNewName, matchesName, type RoutineNames } from "./names";

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
  /** The keys refused, each kept where it was typed until Backspace removes it. */
  refused: readonly RefusedText[];
  /** The reason a key with no character was refused, Backspace or Delete, until the next key. */
  notice?: string;
  /** The text whose field is being typed in. */
  text?: NodeId;
};

/**
 * Keys the line refused, kept where they were typed and drawn in red (`editor.md`, Backspace and
 * keys, Refused keys). A refused choice is kept as its row's keys.
 */
export type RefusedText = {
  /** The caret where its first key was typed: at an empty slot or before a value, or after one. */
  at: Caret;
  /** Its keys, as typed. */
  text: string;
  /** The reason its first key was refused. */
  message: string;
  /** Keys typed at its place join it, until a space or a move ends it. */
  open: boolean;
};

/** The reasons the line refuses a key, each with its message `editor.refused.<reason>`. */
export type Reason =
  | "number"
  | "tooLarge"
  | "afterValue"
  | "member"
  | "word"
  | "open"
  | "close"
  | "lastArgument"
  | "oneValue"
  | "bracket"
  | "noValue"
  | "quote"
  | "unused"
  | "pair"
  | "leave"
  | "nothing"
  | "delete";

export type LineFunction = { name: Name; params: readonly Name[] };

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
  scope: ParseScope;
  functions: readonly LineFunction[];
  /** The target slot the line edits, or null for a slot that takes any value. */
  target: TargetLine | null;
  /** The field is an item of an `exprs` slot, where `,` outside every call and list adds one. */
  item: boolean;
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

/**
 * What a key or a choice did: `move` leaves the line for the next or previous field or item, and
 * `reason` is a refusal's reason until the key or the row that made it names it.
 */
export type Outcome = {
  line: Line;
  taken: boolean;
  move?: "next" | "previous" | "item";
  reason?: string;
};

// ---------------------------------------------------------------- the tree

/**
 * The values in an expression's slots, each item of a list its own, in reading order as its
 * notation places them: the order the caret moves in. Which slot an entry's value goes into is
 * the slot order's (`withFirst`).
 */
export function slotValues(expr: Expr): Expr[] {
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

/** The id a caret names: of its empty slot, or of the value it is after. */
const caretId = (caret: Caret): NodeId => ("at" in caret ? caret.at : caret.after);

/**
 * The line with expression `id` replaced; a parenthesis that held it holds what replaces it, and
 * keys refused at it stay at what replaces it, unless it is still in the line (taken into an
 * operation). Keys refused at a value that leaves the line go with it.
 */
function replace(line: Line, id: NodeId, by: Expr): Line {
  const root = replaceIn(line.root, id, by);
  const kept = find(root, id) !== undefined;
  const refused = line.refused
    .map((text): RefusedText => {
      if (kept || caretId(text.at) !== id) return text;
      return { ...text, at: "at" in text.at ? { at: by.id } : { after: by.id } };
    })
    .filter((text) => find(root, caretId(text.at)) !== undefined);
  return {
    ...line,
    root,
    open: line.open.map((group) => (group === id ? by.id : group)),
    refused,
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

function parsed(text: string, scope: ParseScope): Expr | undefined {
  const result = parse(text, scope);
  return isParseError(result) ? undefined : result;
}

/** A number literal for `raw`, or undefined when Python would reject it or it is no number. */
function numberOf(raw: string): Expr | undefined {
  if (!/^[0-9.]+$/.test(raw)) return undefined;
  const made = parsed(raw, NO_DEFINITIONS);
  return made && slotValues(made).length === 0 && exprText(made) === raw ? made : undefined;
}

let numberKey: string | undefined;

function isNumber(expr: Expr): boolean {
  numberKey ??= keyOf(numberOf("0") ?? emptyExpr());
  return keyOf(expr) === numberKey;
}

/** `name` as a variable. */
export function variableExpr(name: Name): Expr | undefined {
  const made = parsed(name, NO_DEFINITIONS);
  return made && variableOf(made) === name ? made : undefined;
}

/** A sign before the empty slot it leaves (`−…`). */
function signExpr(): Expr | undefined {
  const made = parsed("-a", NO_DEFINITIONS);
  return made && mapSlotValues(made, () => emptyExpr());
}

/** A list with one empty item (`[…]`), as `[` opens it. */
function listExpr(): Expr | undefined {
  const made = parsed("[a]", NO_DEFINITIONS);
  return made && mapSlotValues(made, () => emptyExpr());
}

/** A call of one of the program's functions, its arguments empty slots. */
export function callExpr(fn: LineFunction, scope: ParseScope): Expr | undefined {
  const made = parsed(`${fn.name}(${fn.params.map(() => "a").join(", ")})`, scope);
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
  const base: Line = {
    root,
    caret: endOf(root),
    selected: false,
    open: [],
    word: "",
    refused: [],
  };
  if (at !== undefined && find(root, at) && isEmptyExpr(find(root, at))) {
    return { ...base, caret: { at } };
  }
  return isEmptyExpr(root) ? base : { ...base, selected: true };
}

/** The value removed: one empty slot, the caret at it. */
function cleared(line: Line): Line {
  const fresh = emptyExpr();
  return {
    ...line,
    root: fresh,
    caret: { at: fresh.id },
    selected: false,
    open: [],
    word: "",
    refused: [],
  };
}

const done = (line: Line): Outcome => ({ line, taken: true });

/** The line as it was, refusing with `message`; the keys or the row that made it are kept. */
const refused = (line: Line, message: string): Outcome => ({ line, taken: false, reason: message });

/** The message of a reason (`editor.md`, Backspace and keys, Refused keys). */
const because = (reason: Reason, params?: Record<string, string>): string =>
  t(`editor.refused.${reason}`, params);

/** The keys refused at the caret, if any. */
export function refusedAt(line: Line): RefusedText | undefined {
  return line.refused.find((text) => sameCaret(text.at, line.caret));
}

/** The line with no refused keys open: a space or a move ends them where they are. */
function closeRefused(line: Line): Line {
  if (!line.refused.some((text) => text.open)) return line;
  return { ...line, refused: line.refused.map((text) => ({ ...text, open: false })) };
}

/** The line as it was, taking nothing and showing nothing: ← and → at the line's ends. */
const unmoved = (line: Line): Outcome => ({ line: closeRefused(line), taken: false });

/**
 * `line` with `keys` refused for `message`: they join the refused keys at the caret, after a
 * space when those are ended, or are kept there as new ones. The word typed and a first key
 * waiting for its second are among `keys`.
 */
function refuse(line: Line, keys: string, message: string, open: boolean): Line {
  const base: Line = { ...line, word: "", pending: undefined, notice: undefined };
  const here = refusedAt(base);
  const refusedKeys = here
    ? base.refused.map((text) =>
        text === here ? { ...text, text: text.text + (text.open ? "" : " ") + keys, open } : text,
      )
    : [...base.refused, { at: base.caret, text: keys, message, open }];
  return { ...base, refused: refusedKeys };
}

/** A text the line holds before it is a value: a word, or a first key waiting for its second. */
const WORD = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Backspace at refused keys removes the last; what is left goes back to the word or the first
 * key it was before it was refused, and is otherwise refused still, open to more keys.
 */
function unrefuse(line: Line, here: RefusedText): Line {
  const rest = Array.from(here.text).slice(0, -1).join("");
  const others = line.refused.filter((text) => text !== here);
  if (rest === "") return { ...line, refused: others };
  if (WORD.test(rest)) return { ...line, refused: others, word: rest };
  if (startsOperator(rest) && !operatorTyped(rest)) {
    return { ...line, refused: others, pending: { key: rest } };
  }
  return {
    ...line,
    refused: line.refused.map((text) =>
      text === here ? { ...text, text: rest, open: true } : text,
    ),
  };
}

/**
 * The reason of a refusal that `after` holds and `before` didn't, for a live region to read: a
 * notice, or refused keys at the caret that are new or open again. Keys that only join open ones
 * give none, so a screen reader reads a reason once.
 */
export function newRefusal(before: Line | null, after: Line | null): string | undefined {
  if (!after) return undefined;
  if (after.notice) return after.notice;
  const here = refusedAt(after);
  if (!here) return undefined;
  const was = before?.refused.find((text) => sameCaret(text.at, here.at));
  return was?.open ? undefined : here.message;
}

/** `line` refusing to be left while it holds refused keys, with the reason. */
export function refuseLeaving(line: Line): Line {
  return { ...line, notice: because("leave") };
}

/** A row as the caret shows it refused: by its keys, as typing them would show them. */
function rowKeys(row: Row): string {
  switch (row.type) {
    case "variable":
    case "new":
      return row.name;
    case "function":
      return row.fn.name;
    case "parentheses":
      return PARENTHESES_KEY;
    case "entry":
      // An entry with no keys shows its name, until every entry has keys.
      return row.entry.declared.typed ?? row.entry.label;
  }
}

/** Whether the line's slot keeps `root`: any value, or in a target slot a target or empty slot. */
function keeps(root: Expr, ctx: LineContext): boolean {
  return ctx.target === null || isEmptyExpr(root) || isTarget(root);
}

/** `outcome` where the line's slot keeps its value; else the line before it, refused with the reason. */
function inSlot(line: Line, outcome: Outcome, ctx: LineContext): Outcome {
  if (!outcome.taken || keeps(outcome.line.root, ctx)) return outcome;
  return refused(line, t("editor.notTarget"));
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
  // Every caller has a value before the caret.
  if (!last) throw new Error("no value before the caret");
  const made = makeEntry(entry);
  const first = getBlockDef(keyOf(made)).slots.find((s) => s.role === "expr" || s.role === "exprs");
  const level = first ? bindsAt(made, first.name) : undefined;
  // An operator binds by its precedence; any other entry takes what the list was about.
  const target = line.selected
    ? last
    : level === undefined
      ? (valueBefore(line) ?? last)
      : bindAt(line, last, level);
  if (target === "chain") {
    return refused(line, errorText({ code: "E_PARSE_CHAIN", params: {} }));
  }
  const placed = withFirst(made, target);
  const next = replace(line, target.id, placed);
  return done({ ...next, caret: caretIn(placed, target), selected: false, word: "" });
}

/** A block made where a value is expected, filling the empty slot at the caret. */
function fill(line: Line, made: Expr, text = false): Outcome {
  // Every caller fills an empty slot.
  if (!("at" in line.caret)) throw new Error("the caret is at no empty slot");
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

/** Chooses a row of the list at the caret, as the line's slot keeps it; refused, its keys stay. */
export function choose(line: Line, row: Row, ctx: LineContext): Outcome {
  const outcome = inSlot(line, chooseRow(line, row, ctx), ctx);
  if (outcome.reason === undefined) return outcome;
  return { line: refuse(line, rowKeys(row), outcome.reason, true), taken: false };
}

function chooseRow(line: Line, row: Row, ctx: LineContext): Outcome {
  let base: Line = { ...closeRefused(line), word: "", pending: undefined };
  if (row.type === "entry" && takesValue(row.entry) && !atEmptySlot(base)) {
    // A refused choice leaves the line as it was, its word still to correct, with the reason.
    const placed = takeValue(base, row.entry);
    return placed.taken ? placed : { line, taken: false, reason: placed.reason };
  }
  if (base.selected) base = cleared(base);
  // After a value, the list offers only entries that take it.
  if (!("at" in base.caret)) throw new Error(`${row.type} chosen after a value`);
  switch (row.type) {
    case "variable":
    case "new": {
      const made = variableExpr(row.name);
      if (!made) throw new Error(`${row.name} is no variable`);
      return fill(base, made);
    }
    case "function": {
      const made = callExpr(row.fn, ctx.scope);
      if (!made) throw new Error(`${row.fn.name} makes no call`);
      return fill(base, made);
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

function rowName(row: Row): string {
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
function targetNames(word: string, target: TargetLine): Row[] {
  const names = [...target.asked, ...target.names];
  const rows = names.map((name): Row => ({ type: "variable", name }));
  if (target.binds && isNewName(word, names)) rows.push({ type: "new", name: word });
  return rows;
}

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
    const chosen = chooseRow(line, row, ctx);
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
function wordRows(line: Line, ctx: LineContext): Row[] {
  if (ctx.target && namesTarget(line, ctx)) return targetNames(line.word, ctx.target);
  if (atEmptySlot(line) || (line.selected && line.word !== "")) {
    return [
      ...ctx.variables.map((name): Row => ({ type: "variable", name })),
      ...allEntries()
        .filter((entry) => !takesValue(entry) || entry.call)
        .map((entry): Row => ({ type: "entry", entry })),
      ...ctx.functions.map((fn): Row => ({ type: "function", fn })),
    ];
  }
  const after = allEntries()
    .filter(takesValue)
    .map((entry): Row => ({ type: "entry", entry }));
  return keptRows(line, after, ctx);
}

/** The edit distance of two words, ignoring case. */
function distance(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= y.length; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      next.push(Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + cost));
    }
    row = next;
  }
  return row[y.length] ?? 0;
}

/** The closest name to a word that matches nothing: one letter in three may differ, one at least. */
function closestName(line: Line, ctx: LineContext): string | undefined {
  const allowed = Math.max(1, Math.floor(line.word.length / 3));
  let best: { name: string; d: number } | undefined;
  for (const row of wordRows(line, ctx)) {
    const names =
      row.type === "variable"
        ? [row.name]
        : row.type === "entry"
          ? [row.entry.label]
          : row.type === "function"
            ? [row.fn.name]
            : [];
    for (const name of names) {
      const d = distance(line.word, name);
      if (d <= allowed && (!best || d < best.d)) best = { name, d };
    }
  }
  return best?.name;
}

/** What the explanation line says of a word that matches nothing: the closest name, if one is close. */
export function closestText(line: Line, ctx: LineContext): string {
  const closest = closestName(line, ctx);
  return closest ? t("editor.didYouMean", { name: closest }) : t("editor.nothingLike");
}

/** The rows matching the word typed: a whole name first, then, after a value, its kind's. */
export function matches(line: Line, ctx: LineContext): Row[] {
  const word = line.word;
  if (word === "") return [];
  const kind = atEmptySlot(line) ? undefined : kindBefore(line, ctx);
  const found = wordRows(line, ctx).filter(
    (row) =>
      matchesName(rowName(row), word) ||
      (row.type === "entry" && (row.entry.declared.typed ?? "").startsWith(word)),
  );
  // A new variable comes last: a name the program has is the likelier one meant.
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

/** Why a first key that inserts nothing alone is refused: it goes only in its operator. */
function pairReason(first: string): string {
  const keys =
    allEntries().find((entry) => takesValue(entry) && entry.declared.typed?.startsWith(first))
      ?.declared.typed ?? first;
  return because("pair", { key: first, keys, second: keys.slice(first.length) });
}

/** A number's form as Python writes it: an int with no leading zero, or a float. */
const NUMBER_FORM = /^(0+|[1-9][0-9]*|[0-9]+\.[0-9]*|\.[0-9]+)$/;

/** Why `text` is no number: too large when it has a number's form, else a form Python rejects. */
function numberReason(text: string): string {
  return NUMBER_FORM.test(text) ? because("tooLarge", { text }) : because("number", { text });
}

/**
 * Why the line takes a key that no row of the key table holds: a quote begins a text, and `.`
 * after a word would begin a method or an attribute.
 */
function unknownKey(key: string): Reason {
  if (key === '"' || key === "'") return "quote";
  return key === "." ? "member" : "unused";
}

function typeDigit(line: Line, ch: string): Outcome {
  const base = line.selected ? cleared(line) : line;
  if ("at" in base.caret) {
    const made = numberOf(ch);
    return made ? fill(base, made) : refused(line, numberReason(ch));
  }
  const last = find(base.root, base.caret.after);
  // After any other value, `.` would begin a method or an attribute, and a digit a second value.
  if (!last || !isNumber(last)) return refused(line, because(ch === "." ? "member" : "afterValue"));
  const made = numberOf(exprText(last) + ch);
  if (!made) return refused(line, numberReason(exprText(last) + ch));
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

/**
 * One key typed in the line, as the line's slot keeps it. A refused key stays where it was typed,
 * with the word and a waiting first key before it, and keys typed there join it until a space.
 */
export function type(line: Line, key: string, ctx: LineContext): Outcome {
  const here = refusedAt(line);
  if (here?.open) {
    if (key === " ") return done(closeRefused(line));
    return done(refuse(line, key, here.message, true));
  }
  const outcome = inSlot(line, typeKey(line, key, ctx), ctx);
  if (outcome.reason === undefined) return outcome;
  // The line as the refusal left it: with the word, unless the key chose it.
  const before = outcome.line;
  const waiting = before.pending && !before.pending.before ? before.pending.key : "";
  const space = key === " ";
  return {
    line: refuse(before, before.word + waiting + (space ? "" : key), outcome.reason, !space),
    taken: false,
  };
}

function typeKey(line: Line, key: string, ctx: LineContext): Outcome {
  if (key.length !== 1) throw new Error(`${key} is no character`);
  let current: Line = { ...closeRefused(line), notice: undefined };
  // A first key that inserts nothing alone, with any key that makes no operator, is refused.
  const waiting = current.pending;
  if (waiting && !waiting.before && !operatorTyped(waiting.key + key)) {
    return refused(line, pairReason(waiting.key));
  }
  // The line as it was before the key, its word chosen once the key ends it.
  let untyped = line;
  if (/[A-Za-z_]/.test(key) || (current.word !== "" && /[0-9]/.test(key))) {
    if (current.word === "" && current.selected) current = cleared(current);
    return done({ ...current, word: current.word + key, pending: undefined });
  }
  if (current.word !== "") {
    // A space or a key of the table ends the word when it names one; else the word stays.
    if (key !== " " && !ENDS_WORD.test(key)) return refused(line, because(unknownKey(key)));
    const exact = exactRow(current, ctx);
    if (!exact) {
      // A word that matches nothing is refused with the closest name, which says more.
      const reason =
        matches(current, ctx).length > 0
          ? because("word", { word: current.word })
          : closestText(current, ctx);
      return refused(line, reason);
    }
    // A refused choice keeps the word with the key that ended it.
    const chosen = inSlot(current, chooseRow(current, exact, ctx), ctx);
    if (chosen.reason !== undefined) return refused(line, chosen.reason);
    // A call's `(` is the parenthesis the call already has.
    if (key === " " || (key === PARENTHESES_KEY && makesCall(exact))) return chosen;
    current = chosen.line;
    // The word stands chosen: a key refused after it is refused alone.
    untyped = current;
  }
  if (current.pending) {
    const { key: first, before } = current.pending;
    const entry = operatorTyped(first + key);
    current = { ...current, pending: undefined };
    if (entry) {
      // A two-key operator refused keeps both its keys.
      const placed = takeValue({ ...(before ?? current), pending: undefined }, entry);
      return placed.reason === undefined ? placed : refused(untyped, placed.reason);
    }
  }
  if (key === " ") return done(current);
  if (/[0-9.]/.test(key)) return typeDigit(current, key);
  const value = !atEmptySlot(current);
  switch (key) {
    case PARENTHESES_KEY: {
      const base = current.selected ? cleared(current) : current;
      return "at" in base.caret
        ? done({ ...base, open: [...base.open, base.caret.at] })
        : refused(untyped, because("open"));
    }
    case ")": {
      const group = current.open.at(-1);
      const held = group === undefined ? undefined : find(current.root, group);
      // A call begun inside the innermost parentheses closes before them.
      const around = enclosing(current, isCall);
      if (around && (group === undefined || (held && find(held, around.parent.id)))) {
        return done({ ...current, caret: { after: around.parent.id } });
      }
      if (group === undefined) return refused(untyped, because("close"));
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
      if (!around) {
        return ctx.item
          ? { line: current, taken: true, move: "item" }
          : refused(untyped, because("oneValue"));
      }
      if (isSequence(around.parent)) {
        const { held, with: holding } = items(around.parent);
        const fresh = emptyExpr();
        const at = held.findIndex((item) => item.id === around.value.id) + 1;
        const next = replace(current, around.parent.id, holding(held.toSpliced(at, 0, fresh)));
        return done(closeBehind({ ...next, caret: { at: fresh.id } }));
      }
      const next = slotValues(around.parent)[around.index + 1];
      if (!next) return refused(untyped, because("lastArgument"));
      const empty = [...allExprs(next)].find(isEmptyExpr);
      return done(closeBehind({ ...current, caret: empty ? { at: empty.id } : endOf(next) }));
    }
    case "]": {
      // Leaves the innermost list or item, a list's empty item at its end removed first.
      const around = current.selected
        ? undefined
        : enclosing(current, (expr) => closedBy(expr, "]"));
      if (!around) return refused(untyped, because("bracket"));
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
        if (!sign) throw new Error("the parser makes no sign");
        return fill(base, sign);
      }
      break;
    case "[": {
      // At an empty slot or in place of a selected value, a list with an empty item; a target
      // keeps no list, so there `[` makes an item of the selected value instead.
      if (value && !current.selected) break;
      const made = listExpr();
      if (!made) throw new Error("the parser makes no list");
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
  return refused(
    untyped,
    because(startsOperator(key) || operatorTyped(key) ? "noValue" : unknownKey(key)),
  );
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

/** Delete removes a selected value as Backspace does; with nothing selected, it is refused. */
export function deleteKey(line: Line, ctx: LineContext): Outcome {
  if (line.selected) return backspace(line, ctx);
  return { line: { ...line, notice: because("delete") }, taken: false };
}

/**
 * Backspace removes the last refused key at the caret, else what is before the caret, as the
 * line's slot keeps it.
 */
export function backspace(line: Line, ctx: LineContext): Outcome {
  const here = refusedAt(line);
  if (here) return done(unrefuse({ ...line, notice: undefined }, here));
  const outcome = inSlot(line, removeBefore(line), ctx);
  if (outcome.reason === undefined) return outcome;
  return { line: { ...line, notice: outcome.reason }, taken: false };
}

/** Backspace that removes nothing and moves the caret left; at the line's first stop, refused. */
function leftOf(current: Line, line: Line): Outcome {
  const moved = move(current, -1);
  return moved.taken ? moved : refused(line, because("nothing"));
}

function removeBefore(line: Line): Outcome {
  const current: Line = { ...closeRefused(line), notice: undefined, pending: undefined };
  if (current.word !== "") return done({ ...current, word: current.word.slice(0, -1) });
  if (current.selected) return done(cleared(current));
  const { caret, root } = current;
  if ("after" in caret) {
    const last = find(root, caret.after);
    if (!last) throw new Error(`the caret is after ${caret.after}, which the line does not hold`);
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
    const own = slotValues(last);
    const [first] = own;
    if (first) {
      // An operator ends in a slot, and a list in its last item: what is before the caret ends it.
      if (precedenceOf(last) !== undefined || isSequence(last)) {
        const end = own.at(-1);
        if (!end) throw new Error("an operation with a first value and no last one");
        return removeBefore({ ...current, caret: endOf(end) });
      }
      // A call ends in its parenthesis; removing it would lose the value of a later argument.
      if (own.slice(1).some((value) => !isEmptyExpr(value))) return leftOf(current, line);
      const next = replace(current, last.id, first);
      return done({ ...next, caret: endOf(first) });
    }
    const fresh = emptyExpr();
    return done({ ...replace(current, last.id, fresh), caret: { at: fresh.id } });
  }
  if (current.open.at(-1) === caret.at)
    return done({ ...current, open: current.open.slice(0, -1) });
  const up = parentOf(root, caret.at);
  if (!up) return refused(line, because("nothing"));
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
  if (!first) throw new Error("an operation around the caret with no slot");
  // While a slot after the first holds a value, removing the operation would lose it.
  if (own.slice(1).some((value) => !isEmptyExpr(value))) return leftOf(current, line);
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
    return done(
      closeBehind({ ...closeRefused(line), selected: false, caret: caret ?? line.caret }),
    );
  }
  const here = position(line);
  // → at the end of an operation's last slot leaves the operation.
  const target = all[here + step];
  if (!target) return unmoved(line);
  return done(closeBehind({ ...closeRefused(line), caret: target, pending: undefined }));
}

/**
 * Tab and Shift+Tab: the next or previous empty slot, else the next or previous field. A selected
 * value is passed from its start by Tab and from its end by Shift+Tab, so its empty slots come
 * first.
 */
export function tab(line: Line, step: -1 | 1, ctx: LineContext): Outcome {
  let current: Line = { ...closeRefused(line), pending: undefined, notice: undefined };
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
  return closeBehind({
    ...closeRefused(line),
    caret,
    selected: false,
    word: "",
    pending: undefined,
    notice: undefined,
    text,
  });
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
