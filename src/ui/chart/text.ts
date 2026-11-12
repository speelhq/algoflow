// A block's text as spans: its block's `notation()` with the block's slots filled in, the same in
// every locale; a variable is drawn bold in its own color, and an empty slot as its hint, gray.
// Operators are parenthesized as the emitter does. Reads slot roles, `hint`, `params`, `callee`,
// `notation`, `text`, `chart`, and `precedence` only, never a type; a variable shown with its
// value is written by the `assign` block's notation.
import { toValue } from "@/lang/data";
import type { Data, Expr, Heap, Block, NodeId, Program, Stmt, Value } from "@/lang/types";
import { conditionOf, emptySlots, isEmptyExpr, isExpr, paramArg, variableOf } from "@/lang/walk";
import { getBlockDef, keyOf } from "@/blocks/registry";
import type { Generated, BlockDef, Side } from "@/blocks/types";
import { needsParens, PRECEDENCE } from "@/python/precedence";
import { str, writeValue } from "@/runtime/values";

type Bag = Record<string, unknown>;

/** A token of a notation or a template: its own text, or a placeholder naming a slot or a param. */
export type NotationToken = { text: string } | { placeholder: string };

/**
 * A notation or a template as its own text and its placeholders in reading order: the one
 * reading of either.
 */
export function notationTokens(template: string): NotationToken[] {
  const tokens: NotationToken[] = [];
  let at = 0;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    if (found.index > at) tokens.push({ text: template.slice(at, found.index) });
    tokens.push({ placeholder: found[1] ?? "" });
    at = found.index + found[0].length;
  }
  if (at < template.length) tokens.push({ text: template.slice(at) });
  return tokens;
}

/** A statement's notation with every slot written as its hint, as the block menu lists it. */
export function notationWithHints(stmt: Stmt): string {
  return notationTokens(notationOf(stmt))
    .map((token) => ("text" in token ? token.text : slotHint(stmt, token.placeholder)))
    .join("");
}

/**
 * A span of a block's text: the template's own words, or what a slot holds (`slot` names the
 * statement's slot it belongs to). `variable` marks a variable's name, `hint` the hint of an
 * empty slot, and `emptyId` the empty slot a click on the span opens. A caption takes its chart
 * node's place as a span with text alone (`chart.md`, Shapes).
 */
export type NotationSpan = {
  text: string;
  slot?: string;
  hint?: boolean;
  emptyId?: NodeId;
  variable?: boolean;
  /** The slot the editor's caret is in. */
  underline?: boolean;
};

/** The text the spans spell. */
export function joinSpans(spans: readonly NotationSpan[]): string {
  return spans.map((span) => span.text).join("");
}

/** The hint of an expression's slot that no call of the program's function names (`blocks.md`, Notation, Drawing). */
const VALUE_HINT = "value";

/** The `hint` that slot `slot` of a statement declares; every expression slot of one declares one. */
export function slotHint(stmt: Block, slot: string): string {
  const found = getBlockDef(keyOf(stmt)).slots.find((s) => s.name === slot);
  const hint = found && "hint" in found ? found.hint : undefined;
  if (hint === undefined) throw new Error(`slot ${slot} of ${keyOf(stmt)} declares no hint`);
  return hint;
}

/**
 * The hint of the value in slot position `index` of an expression: the parameter's name for an
 * argument of a call of the program's function, else `value`.
 */
export function exprHint(holder: Expr, index: number | undefined, program: Program): string {
  const callee = getBlockDef(keyOf(holder)).callee?.(holder);
  const fn =
    callee?.family === "function"
      ? program.functions.find((each) => each.name === callee.name)
      : undefined;
  return (index === undefined ? undefined : fn?.params[index]) ?? VALUE_HINT;
}

/** An empty slot written as its hint, which a click opens. */
function hintSpan(empty: Expr, hint: string): NotationSpan {
  return { text: hint, hint: true, emptyId: empty.id };
}

/** How an expression is written: `value` gives the text a variable is written as instead of its name. */
export type Writing = { value?: (name: string) => string | undefined };

/**
 * A template as spans, each placeholder replaced by the spans `fill` gives. The template's own
 * text has its spaces collapsed as in a sentence, so a placeholder that holds nothing leaves
 * no double or edge space; what a placeholder holds keeps its text, a text's spaces included. A
 * span left with no text is dropped.
 */
export function filledSpans(
  template: string,
  fill: (name: string) => NotationSpan[],
): NotationSpan[] {
  const spans = notationTokens(template).flatMap((token) =>
    "text" in token
      ? [{ span: { text: token.text }, own: true }]
      : fill(token.placeholder).map((span) => ({ span, own: false })),
  );
  const out: { span: NotationSpan; own: boolean }[] = [];
  for (const { span, own } of spans) {
    const before = out.at(-1)?.span.text ?? "";
    let text = span.text;
    if (own) {
      text = text.replace(/\s+/g, " ");
      if (before === "" || before.endsWith(" ")) text = text.replace(/^ /, "");
    }
    if (text !== "") out.push({ span: { ...span, text }, own });
  }
  const last = out.at(-1);
  if (last?.own) last.span.text = last.span.text.replace(/ $/, "");
  // Adjacent text of one slot is one span.
  const merged: NotationSpan[] = [];
  for (const { span } of out) {
    const before = merged[merged.length - 1];
    if (
      before &&
      plain(before) &&
      plain(span) &&
      before.slot === span.slot &&
      before.emptyId === span.emptyId
    ) {
      before.text += span.text;
    } else if (span.text !== "") merged.push({ ...span });
  }
  return merged;
}

const plain = (span: NotationSpan) => !span.variable && !span.hint && !span.underline;

/** A block's notation (`blocks.md`, Notation). */
export function notationOf(block: Block): string {
  return getBlockDef(keyOf(block)).notation(block);
}

/** Whether an expression's notation ends with `closer`: a call's `)`, a list's or an item's `]`. */
export function closedBy(expr: Expr, closer: ")" | "]"): boolean {
  const last = notationTokens(notationOf(expr)).at(-1);
  return last !== undefined && "text" in last && last.text.endsWith(closer);
}

/** Whether an expression is a call: its notation ends with its own parenthesis (`abs({x})`). */
export function isCall(expr: Expr): boolean {
  return closedBy(expr, ")");
}

const precedenceOf = (expr: Expr) => getBlockDef(keyOf(expr)).precedence?.(expr);

/**
 * The precedence the value in slot `slot` of `block` binds at: the block's own, as an operator's
 * values do, else an atom's where the slot declares one (the list of an item), else none.
 */
export function bindsAt(block: Block, slot: string): number | undefined {
  const def = getBlockDef(keyOf(block));
  const own = def.shape === "expr" ? def.precedence?.(block as Expr) : undefined;
  const found = def.slots.find((s) => s.name === slot);
  return own ?? (found?.role === "expr" && found.atom ? PRECEDENCE.atom : undefined);
}

/** Whether `child`, the value `held` places, is put in parentheses: as the emitter does. */
export function parenthesized(
  child: Expr,
  held: { binds: number | undefined; side: Side },
): boolean {
  const own = precedenceOf(child);
  return own !== undefined && held.binds !== undefined && needsParens(own, held.binds, held.side);
}

function inParentheses(spans: NotationSpan[]): NotationSpan[] {
  return [{ text: "(" }, ...spans, { text: ")" }];
}

/** The spans of the value `held` places, written as `hint` when it is an empty slot. */
function operandSpans(
  child: Expr,
  held: { binds: number | undefined; side: Side },
  hint: string,
  program: Program,
  writing: Writing,
): NotationSpan[] {
  if (isEmptyExpr(child)) return [hintSpan(child, hint)];
  const spans = exprSpans(child, program, writing);
  return parenthesized(child, held) ? inParentheses(spans) : spans;
}

/**
 * What a placeholder of a block's notation or template holds: an expression slot, a target slot,
 * or a builtin's parameter (its argument, and the side it is on), a list of values, a name, or a
 * literal or an operator as its block writes it. Undefined when the placeholder holds nothing
 * drawn (a body).
 */
export type Held =
  | { role: "expr"; expr: Expr | undefined; side: Side; binds: number | undefined }
  | { role: "exprs"; items: Expr[] }
  | { role: "name"; name: string }
  | { role: "literal" | "operator"; text: string };

/** What the placeholder `name` of `block`'s notation or template holds. */
export function placeholderValue(block: Block, name: string): Held | undefined {
  const def = getBlockDef(keyOf(block));
  const slot = def.slots.find((s) => s.name === name);
  if (!slot) {
    // A builtin's notation names its parameters (`{a}`, `{b}`).
    const found = paramArg(block, name);
    const side = found?.index === 0 ? "left" : "right";
    return found && { role: "expr", expr: found.arg, side, binds: bindsAt(block, name) };
  }
  const value = (block as unknown as Bag)[name];
  switch (slot.role) {
    // A target is written as the expression it is (`language.md`, Statements).
    case "expr":
    case "target": {
      const first = def.slots.find((s) => s.role === "expr" || s.role === "target");
      const side = slot === first ? "left" : "right";
      const expr = isExpr(value) ? value : undefined;
      return { role: "expr", expr, side, binds: bindsAt(block, name) };
    }
    case "exprs":
      return { role: "exprs", items: Array.isArray(value) ? value.filter(isExpr) : [] };
    case "name":
      return { role: "name", name: typeof value === "string" ? value : "" };
    case "literal":
    case "operator":
      return { role: slot.role, text: writtenText(block, def, name) };
    case "body":
      return undefined;
  }
}

/**
 * An expression as the chart writes it, each empty slot in it as its hint (`blocks.md`, Notation,
 * Drawing). An empty slot itself is written by what holds it, which gives its hint.
 */
export function exprSpans(expr: Expr, program: Program, writing: Writing = {}): NotationSpan[] {
  if (isEmptyExpr(expr)) throw new Error(`empty slot ${expr.id} is written by what holds it`);
  const name = variableOf(expr);
  if (name !== undefined) {
    const value = writing.value?.(name);
    return value === undefined ? [{ text: name, variable: true }] : [{ text: value }];
  }
  return filledSpans(notationOf(expr), (placeholderName) => {
    const held = placeholderValue(expr, placeholderName);
    switch (held?.role) {
      case "expr":
        return held.expr
          ? operandSpans(held.expr, held, exprHint(expr, undefined, program), program, writing)
          : [];
      case "exprs":
        return listSpans(held.items, (item, i) =>
          operandSpans(item, ARGUMENT, exprHint(expr, i, program), program, writing),
        );
      case "name":
        return [{ text: held.name }];
      case "literal":
      case "operator":
        return [{ text: held.text }];
      default:
        return [];
    }
  });
}

/** What separates items, arguments, and parameters, as Python separates them, in every locale. */
export const SEPARATOR = ", ";

function listSpans(
  items: Expr[],
  write: (item: Expr, i: number) => NotationSpan[],
): NotationSpan[] {
  return items.flatMap((item, i) =>
    i === 0 ? write(item, i) : [{ text: SEPARATOR }, ...write(item, i)],
  );
}

/** How a list places an item: unparenthesized, as `, ` separates it. */
const ARGUMENT = { binds: undefined, side: "left" } as const;

/** What the notation writes for a literal or an operator slot: `text()`, else its value. */
function writtenText(block: Block, def: BlockDef, slot: string): string {
  const value = (block as unknown as Bag)[slot];
  return (
    def.text?.(block, slot) ||
    (typeof value === "string" || typeof value === "number" ? String(value) : "")
  );
}

/** The text of an expression as the chart writes it. */
export function exprText(expr: Expr, program: Program, writing: Writing = {}): string {
  return joinSpans(exprSpans(expr, program, writing));
}

/**
 * What one slot of a statement holds, as the chart writes it, each span naming the slot. An empty
 * slot is written as the slot's hint.
 */
export function slotSpans(block: Block, name: string, program: Program): NotationSpan[] {
  const spans = (): NotationSpan[] => {
    const held = placeholderValue(block, name);
    switch (held?.role) {
      case "expr":
        return held.expr ? operandSpans(held.expr, held, slotHint(block, name), program, {}) : [];
      case "exprs":
        return listSpans(held.items, (item) =>
          operandSpans(item, ARGUMENT, slotHint(block, name), program, {}),
        );
      case "literal":
      case "operator":
        return [{ text: held.text }];
      default:
        return [];
    }
  };
  return spans().map((span) => ({ ...span, slot: name }));
}

/** A statement's notation, or a generated chart node's text, as spans, one or more per slot. */
function stmtSpans(notation: string, block: Block, program: Program): NotationSpan[] {
  return filledSpans(notation, (name) => slotSpans(block, name, program));
}

/** A block's notation as spans: an expression as the chart writes it, a statement by its slots. */
export function notationSpans(block: Block, program: Program): NotationSpan[] {
  const def = getBlockDef(keyOf(block));
  return def.shape === "expr"
    ? exprSpans(block as Expr, program)
    : stmtSpans(def.notation(block), block, program);
}

/** A block's notation as text. */
export function notationText(block: Block, program: Program): string {
  return joinSpans(notationSpans(block, program));
}

/** Whether a statement has an empty slot, at any depth of its slots. */
export function hasEmptySlot(block: Block): boolean {
  return emptySlots(block).length > 0;
}

/**
 * The chart's own texts, the same in every locale as a notation is, so no chart node's text comes
 * from a catalog (`chart.md`, Shapes).
 */
export const CHART_TEXT = {
  start: "Start",
  /** A function chart's `Start`: `Start double(x)`. */
  functionStart: "Start {signature}",
  end: "End",
  /** An Input chart node: `Input n ← 15`. */
  input: "Input {assignment}",
  /** A diamond asks its condition: `i < n?`. */
  question: "{condition}?",
};

/**
 * The text a counted loop's generated chart node draws, with the loop's `{slot}` placeholders: its
 * check asked as every diamond asks its condition; none for another block.
 */
export function generatedNotation(block: Block, which: Generated): string | undefined {
  const chart = getBlockDef(keyOf(block)).chart;
  if (!chart || !("counted" in chart)) return undefined;
  const text = chart.counted[which];
  if (which !== "check") return text;
  return notationTokens(CHART_TEXT.question)
    .map((token) => ("text" in token ? token.text : text))
    .join("");
}

/** A counted loop's generated chart node as spans, its slots being the loop's; none for another. */
export function generatedSpans(block: Block, which: Generated, program: Program): NotationSpan[] {
  const notation = generatedNotation(block, which);
  return notation === undefined ? [] : stmtSpans(notation, block, program);
}

/** A diamond's text: its condition followed by `?`, or its hint without it while it is empty. */
export function questionSpans(block: Block, program: Program): NotationSpan[] {
  const condition = conditionOf(block);
  if (!condition) return [];
  const spans = slotSpans(block, condition.slot, program);
  if (isEmptyExpr(condition.expr)) return spans;
  return filledSpans(CHART_TEXT.question, () => spans);
}

/** A value as the blocks write it: a text in quotes, the rest as `str()` (`True`, `None`). */
export function valueText(value: Value, heap: Heap): string {
  return writeValue(value, heap, (scalar) =>
    scalar.t === "str" ? `"${scalar.v}"` : str(scalar, heap),
  );
}

/** A case's input value (`Input n ← 15`), written like any other value. */
export function dataText(data: Data): string {
  const heap: Heap = new Map();
  return valueText(toValue(data, heap), heap);
}

/** The block whose notation writes a variable with its value. */
const ASSIGN = getBlockDef("assign").create();

/**
 * A variable shown with its value, written as an assignment writes it (`n ← 15`): its name in
 * the target's place, a variable, and the value's text in the value's.
 */
export function assignmentSpans(name: string, value: string): NotationSpan[] {
  return filledSpans(notationOf(ASSIGN), (placeholderName) =>
    getBlockDef(keyOf(ASSIGN)).slots.find((slot) => slot.name === placeholderName)?.role ===
    "target"
      ? [{ text: name, variable: true }]
      : [{ text: value }],
  );
}

/** A variable shown with its value, as text (`n ← 15`). */
export function assignmentText(name: string, value: string): string {
  return joinSpans(assignmentSpans(name, value));
}

/** An Input chart node's text, its name a variable (`Input n ← 15`). */
export function inputSpans(name: string, value: Data): NotationSpan[] {
  return filledSpans(CHART_TEXT.input, () => assignmentSpans(name, dataText(value)));
}
