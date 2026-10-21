// A node's text as runs: its block's `notation()` with the block's slots filled in, the same in
// every locale; a variable is drawn bold in its own color, and an input still to fill as the
// placeholder. Operators are parenthesized as the emitter does. Reads slot roles, `params`,
// `notation`, `text`, `chart`, and `precedence` only, never a kind; a variable shown with its
// value is written by the `assign` block's notation.
import { t } from "@/i18n/t";
import { toValue } from "@/lang/data";
import type { Data, Expr, Heap, Node, NodeId, Value } from "@/lang/types";
import { conditionOf, isEmptyExpr, isExpr, paramArg, variableOf } from "@/lang/walk";
import { emptyExpr, getBlock, keyOf } from "@/blocks/registry";
import type { Generated, BlockDef, Side } from "@/blocks/types";
import { needsParens, PRECEDENCE } from "@/python/precedence";
import { str, writeValue } from "@/runtime/values";

type Bag = Record<string, unknown>;

/** A piece of a notation or a template: its own text, or a placeholder naming a slot or a param. */
export type Piece = { words: string } | { name: string };

/**
 * A notation or a template as its own text and its placeholders in reading order: the one
 * reading of either.
 */
export function templatePieces(template: string): Piece[] {
  const pieces: Piece[] = [];
  let at = 0;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    if (found.index > at) pieces.push({ words: template.slice(at, found.index) });
    pieces.push({ name: found[1] ?? "" });
    at = found.index + found[0].length;
  }
  if (at < template.length) pieces.push({ words: template.slice(at) });
  return pieces;
}

/** A template with every placeholder written as the placeholder `…`. */
export function blankTemplate(template: string): string {
  return templatePieces(template)
    .map((piece) => ("words" in piece ? piece.words : placeholder()))
    .join("");
}

/**
 * A run of a node's text: the template's own words, or what a slot holds (`slot` names the
 * statement's slot it belongs to). `variable` marks a variable's name, `empty` the placeholder
 * of an input still to fill, and `hole` the input a click on the run opens.
 */
export type Part = {
  text: string;
  slot?: string;
  empty?: boolean;
  hole?: NodeId;
  variable?: boolean;
  /** The input the editor's caret is in. */
  underline?: boolean;
};

/** The text the parts spell. */
export function joinParts(parts: readonly Part[]): string {
  return parts.map((part) => part.text).join("");
}

/** An input still to fill, whose block's notation is the placeholder. */
const EMPTY = emptyExpr();

/** The placeholder of an input still to fill: the `empty` block's notation, `…`. */
export function placeholder(): string {
  return notationOf(EMPTY);
}

/** How an expression is written: `value` gives the text a variable is written as instead of its name. */
export type Writing = { value?: (name: string) => string | undefined };

/**
 * A template as parts, each placeholder replaced by the parts `fill` gives. The template's own
 * words have their spaces collapsed as in a sentence, so a placeholder that holds nothing leaves
 * no double or edge space; what a placeholder holds keeps its text, a text's spaces included. A
 * part left with no text is dropped.
 */
export function templateParts(template: string, fill: (name: string) => Part[]): Part[] {
  const parts = templatePieces(template).flatMap((piece) =>
    "words" in piece
      ? [{ part: { text: piece.words }, words: true }]
      : fill(piece.name).map((part) => ({ part, words: false })),
  );
  const out: { part: Part; words: boolean }[] = [];
  for (const { part, words } of parts) {
    const before = out.at(-1)?.part.text ?? "";
    let text = part.text;
    if (words) {
      text = text.replace(/\s+/g, " ");
      if (before === "" || before.endsWith(" ")) text = text.replace(/^ /, "");
    }
    if (text !== "") out.push({ part: { ...part, text }, words });
  }
  const last = out.at(-1);
  if (last?.words) last.part.text = last.part.text.replace(/ $/, "");
  // Adjacent words of one slot are one run.
  const merged: Part[] = [];
  for (const { part } of out) {
    const before = merged[merged.length - 1];
    if (
      before &&
      plain(before) &&
      plain(part) &&
      before.slot === part.slot &&
      before.hole === part.hole
    ) {
      before.text += part.text;
    } else if (part.text !== "") merged.push({ ...part });
  }
  return merged;
}

const plain = (part: Part) => !part.variable && !part.empty && !part.underline;

/** A node's notation (`blocks.md`, Node text). */
export function notationOf(node: Node): string {
  return getBlock(keyOf(node)).notation(node);
}

/** Whether an expression's notation ends with `closer`: a call's `)`, a list's or an item's `]`. */
export function closedBy(expr: Expr, closer: ")" | "]"): boolean {
  const last = templatePieces(notationOf(expr)).at(-1);
  return last !== undefined && "words" in last && last.words.endsWith(closer);
}

/** Whether an expression is a call: its notation ends with its own parenthesis (`abs({x})`). */
export function isCall(expr: Expr): boolean {
  return closedBy(expr, ")");
}

const precedenceOf = (expr: Expr) => getBlock(keyOf(expr)).precedence?.(expr);

/**
 * The precedence the input in slot `slot` of `node` binds at: the node's own, as an operator's
 * inputs do, else an atom's where the slot declares one (the list of an item), else none.
 */
export function bindsAt(node: Node, slot: string): number | undefined {
  const def = getBlock(keyOf(node));
  const own = def.shape === "expr" ? def.precedence?.(node as Expr) : undefined;
  return own ?? (def.slots.find((s) => s.name === slot)?.atom ? PRECEDENCE.atom : undefined);
}

/** Whether `child`, the input `held` places, is put in parentheses: as the emitter does. */
export function parenthesized(
  child: Expr,
  held: { binds: number | undefined; side: Side },
): boolean {
  const own = precedenceOf(child);
  return own !== undefined && held.binds !== undefined && needsParens(own, held.binds, held.side);
}

function inParentheses(parts: Part[]): Part[] {
  return [{ text: "(" }, ...parts, { text: ")" }];
}

/** The parts of the input `held` places. */
function operandParts(
  child: Expr,
  held: { binds: number | undefined; side: Side },
  writing: Writing,
): Part[] {
  const parts = exprParts(child, writing);
  return parenthesized(child, held) ? inParentheses(parts) : parts;
}

/**
 * What a placeholder of a node's notation or template holds: an expression slot, a target slot,
 * or a builtin's parameter (its input, and the side it is on), a list of values, a name, or a
 * literal field as its block writes it. Undefined when the placeholder holds nothing drawn (a
 * body).
 */
export type Held =
  | { role: "expr"; expr: Expr | undefined; side: Side; binds: number | undefined }
  | { role: "exprs"; items: Expr[] }
  | { role: "id"; name: string }
  | { role: "text"; text: string };

/** What the placeholder `name` of `node`'s notation or template holds. */
export function placeholderValue(node: Node, name: string): Held | undefined {
  const def = getBlock(keyOf(node));
  const slot = def.slots.find((s) => s.name === name);
  if (!slot) {
    // A builtin's notation names its parameters (`{a}`, `{b}`).
    const found = paramArg(node, name);
    const side = found?.index === 0 ? "left" : "right";
    return found && { role: "expr", expr: found.arg, side, binds: bindsAt(node, name) };
  }
  const value = (node as unknown as Bag)[name];
  switch (slot.role) {
    // A target is written as the expression it is (`language.md`, Statements).
    case "expr":
    case "target": {
      const first = def.slots.find((s) => s.role === "expr" || s.role === "target");
      const side = slot === first ? "left" : "right";
      const expr = isExpr(value) ? value : undefined;
      return { role: "expr", expr, side, binds: bindsAt(node, name) };
    }
    case "exprs":
      return { role: "exprs", items: Array.isArray(value) ? value.filter(isExpr) : [] };
    case "id":
      return { role: "id", name: typeof value === "string" ? value : "" };
    case "text":
      return { role: "text", text: textOf(node, def, name) };
    case "body":
      return undefined;
  }
}

/** An expression as the chart writes it. */
export function exprParts(expr: Expr, writing: Writing = {}): Part[] {
  if (isEmptyExpr(expr)) return [{ text: placeholder(), empty: true, hole: expr.id }];
  const name = variableOf(expr);
  if (name !== undefined) {
    const value = writing.value?.(name);
    return value === undefined ? [{ text: name, variable: true }] : [{ text: value }];
  }
  return templateParts(notationOf(expr), (placeholderName) => {
    const held = placeholderValue(expr, placeholderName);
    switch (held?.role) {
      case "expr":
        return held.expr ? operandParts(held.expr, held, writing) : [];
      case "exprs":
        return listParts(held.items, (item) => exprParts(item, writing));
      case "id":
        return [{ text: held.name }];
      case "text":
        return [{ text: held.text }];
      default:
        return [];
    }
  });
}

/** What separates items, arguments, and parameters, as Python separates them, in every locale. */
export const SEPARATOR = ", ";

function listParts(items: Expr[], write: (item: Expr) => Part[]): Part[] {
  return items.flatMap((item, i) =>
    i === 0 ? write(item) : [{ text: SEPARATOR }, ...write(item)],
  );
}

function textOf(node: Node, def: BlockDef, slot: string): string {
  const value = (node as unknown as Bag)[slot];
  return (
    def.text?.(node, slot) ||
    (typeof value === "string" || typeof value === "number" ? String(value) : "")
  );
}

/** The text of an expression as the chart writes it. */
export function exprText(expr: Expr, writing: Writing = {}): string {
  return joinParts(exprParts(expr, writing));
}

/** Whether a slot is drawn as the placeholder: an empty expression, an empty name, or no item. */
function drawsPlaceholder(node: Node, def: BlockDef, name: string): boolean {
  const slot = def.slots.find((s) => s.name === name);
  const value = (node as unknown as Bag)[name];
  switch (slot?.role) {
    case "expr":
    case "target":
      return isEmptyExpr(value);
    case "exprs":
      // A list with no item is empty only where the slot is required.
      return Array.isArray(value) && value.length === 0 && slot.required === true;
    case "id":
      return value === "";
    default:
      return false;
  }
}

/** The parts of one slot of a statement, each naming the slot. */
function stmtSlotParts(node: Node, def: BlockDef, name: string): Part[] {
  const parts = (): Part[] => {
    if (drawsPlaceholder(node, def, name)) return [{ text: placeholder(), empty: true }];
    const held = placeholderValue(node, name);
    switch (held?.role) {
      case "expr":
        return held.expr ? operandParts(held.expr, held, {}) : [];
      case "exprs":
        return listParts(held.items, (item) => exprParts(item));
      case "id":
        return [{ text: held.name, variable: true }];
      case "text":
        return [{ text: held.text }];
      default:
        return [];
    }
  };
  return parts().map((part) => ({ ...part, slot: name }));
}

/** What one slot of a statement holds, as the chart writes it. */
export function slotParts(node: Node, slot: string): Part[] {
  return stmtSlotParts(node, getBlock(keyOf(node)), slot);
}

/** A statement's notation, or a generated node's text, as parts, one or more per slot. */
function stmtParts(notation: string, node: Node): Part[] {
  const def = getBlock(keyOf(node));
  return templateParts(notation, (name) => stmtSlotParts(node, def, name));
}

/** A node's notation as parts: an expression as the chart writes it, a statement by its slots. */
export function notationParts(node: Node): Part[] {
  const def = getBlock(keyOf(node));
  return def.shape === "expr" ? exprParts(node as Expr) : stmtParts(def.notation(node), node);
}

/** A node's notation as text. */
export function notationText(node: Node): string {
  return joinParts(notationParts(node));
}

/** Whether a statement has an input still to fill in any of its slots, at any depth. */
export function hasInputToFill(node: Node): boolean {
  const def = getBlock(keyOf(node));
  return def.slots.some((slot) => stmtSlotParts(node, def, slot.name).some((part) => part.empty));
}

/**
 * The text a counted loop's generated node draws, with the loop's `{slot}` placeholders: its
 * check asked as every diamond asks its condition (`chart.condition`); none for another block.
 */
export function generatedNotation(node: Node, part: Generated): string | undefined {
  const chart = getBlock(keyOf(node)).chart;
  if (!chart || !("counted" in chart)) return undefined;
  const text = chart.counted[part];
  if (part !== "check") return text;
  return templatePieces(t("chart.condition"))
    .map((piece) => ("words" in piece ? piece.words : text))
    .join("");
}

/** A counted loop's generated node as parts, its slots being the loop's; none for another. */
export function generatedParts(node: Node, part: Generated): Part[] {
  const notation = generatedNotation(node, part);
  return notation === undefined ? [] : stmtParts(notation, node);
}

/** A diamond's text: its condition followed by `?`, or the placeholder without it. */
export function questionParts(node: Node): Part[] {
  const condition = conditionOf(node);
  if (!condition) return [];
  const parts = exprParts(condition.expr).map((part) => ({ ...part, slot: condition.slot }));
  if (isEmptyExpr(condition.expr)) return parts;
  return templateParts(t("chart.condition"), () => parts);
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
const ASSIGN = getBlock("assign").create();

/**
 * A variable shown with its value, written as an assignment writes it (`n ← 15`): its name in
 * the target's place, a variable, and the value's text in the value's.
 */
export function assignmentParts(name: string, value: string): Part[] {
  return templateParts(notationOf(ASSIGN), (placeholderName) =>
    getBlock(keyOf(ASSIGN)).slots.find((slot) => slot.name === placeholderName)?.role === "target"
      ? [{ text: name, variable: true }]
      : [{ text: value }],
  );
}

/** A variable shown with its value, as text (`n ← 15`). */
export function assignmentText(name: string, value: string): string {
  return joinParts(assignmentParts(name, value));
}

/** An Input node's text, its name a variable (`Input n ← 15`). */
export function inputParts(name: string, value: Data): Part[] {
  return templateParts(t("chart.input"), () => assignmentParts(name, dataText(value)));
}
