// A node's sentence as plain text, from `node.<key>.template<form>` and the block's
// slots, in the block language: school symbols for operators, words for every other
// operation, and brackets around a word operation where it meets another operation.
// Reads slot roles, `params`, `form`, `text`, and `precedence` only, never a kind.
import { fillPlaceholders, t, type MessageKey } from "@/i18n/t";
import { toValue } from "@/lang/data";
import type { Data, Expr, Heap, Node, Program, Target, Value } from "@/lang/types";
import { firstAssignments } from "@/lang/validate";
import { isEmptyExpr, isExpr } from "@/lang/walk";
import { getNode, hasNode, keyOf } from "@/nodes";
import type { NodeDef, Side } from "@/nodes/types";
import { parenthesise, writeTarget } from "@/python/emit";
import { str, writeValue } from "@/runtime/values";

type Bag = Record<string, unknown>;

/** The one place a registry key becomes an i18n key (the key check does not scan dynamic keys). */
export function nodeText(key: string, part: string, params?: Record<string, string>): string {
  return t(`node.${key}.${part}` as MessageKey, params);
}

/** A template with every `{slot}` written as `…`. */
export function blankTemplate(template: string): string {
  return template.replace(/\{\w+\}/g, t("chart.blank"));
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Parts with the first letter capitalised when they begin with a word of the template (N-08). */
export function capitaliseParts(parts: readonly Part[]): Part[] {
  const [first, ...rest] = parts;
  if (!first || first.slot !== undefined) return [...parts];
  return [{ ...first, text: capitalise(first.text) }, ...rest];
}

/** A template with its slots filled; a sentence drops the space an empty slot leaves. */
function render(template: string, fill: (name: string) => string): string {
  return fillPlaceholders(template, fill).replace(/\s+/g, " ").trim();
}

/** A run of a node's text: a slot's text with the slot's name, or the template's own words. */
export type Part = { text: string; slot?: string; empty?: boolean };

/** The text the parts spell. */
export function joinParts(parts: readonly Part[]): string {
  return parts.map((part) => part.text).join("");
}

/** The empty slot's placeholder, `choose a value`. */
export function placeholder(): string {
  return nodeText("empty", "template");
}

/** Whether a slot holds nothing yet: an empty expression, an empty name, or no item. */
function isEmptySlot(node: Node, def: NodeDef, name: string): boolean {
  const slot = def.slots.find((s) => s.name === name);
  const value = (node as unknown as Bag)[name];
  switch (slot?.role) {
    case "expr":
      return isEmptyExpr(value);
    case "exprs":
      // A list with no item is empty only where the slot is required.
      return (
        Array.isArray(value) &&
        (value.length === 0 ? slot?.required === true : value.every(isEmptyExpr))
      );
    case "id":
      return value === "";
    case "target":
      return (
        (value as Target | undefined)?.kind === "var" && (value as { name: string }).name === ""
      );
    default:
      return false;
  }
}

/**
 * A template as parts, each placeholder of a slot of `node` a part naming its slot. Spaces
 * are collapsed across parts, as `render` does, and a part with no text is dropped.
 */
function renderParts(template: string, node: Node, def: NodeDef): Part[] {
  const parts: Part[] = [];
  let at = 0;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    const name = found[1] ?? "";
    parts.push({ text: template.slice(at, found.index) });
    const text = slotText(node, def, name);
    const isSlot = def.slots.some((slot) => slot.name === name);
    if (!isSlot) parts.push({ text });
    else if (isEmptySlot(node, def, name))
      parts.push({ text: placeholder(), slot: name, empty: true });
    else parts.push({ text, slot: name });
    at = found.index + found[0].length;
  }
  parts.push({ text: template.slice(at) });
  const out: Part[] = [];
  for (const part of parts) {
    const before = out[out.length - 1]?.text ?? "";
    let text = part.text.replace(/\s+/g, " ");
    if (before === "" || before.endsWith(" ")) text = text.replace(/^ /, "");
    if (text !== "") out.push({ ...part, text });
  }
  const last = out[out.length - 1];
  if (last) last.text = last.text.replace(/ $/, "");
  return out.filter((part) => part.text !== "");
}

/** An expression's template in its form. */
function templateOfExpr(expr: Expr): string {
  const def = getNode(keyOf(expr));
  const form = def.form?.(expr, { creates: false }) ?? "";
  return nodeText(def.key, `template${form}`);
}

/** An expression with inputs whose template has words outside its placeholders (N-08). */
export function isWordOperation(expr: Expr): boolean {
  const def = getNode(keyOf(expr));
  const inputs = def.slots.some((slot) => slot.role === "expr" || slot.role === "exprs");
  return inputs && /\p{L}/u.test(templateOfExpr(expr).replace(/\{\w+\}/g, ""));
}

/** An expression with a precedence written with symbols only (N-08). */
export function isOperator(expr: Expr): boolean {
  return getNode(keyOf(expr)).precedence !== undefined && !isWordOperation(expr);
}

/**
 * A child of `parent` as the chart writes it: a word operation next to an operator, and an
 * operation inside a word operation, are bracketed; operators among themselves follow E-05.
 */
function operand(child: Expr, parent: Expr, side: Side): string {
  const text = exprText(child);
  const bracketed = `(${text})`;
  if (isWordOperation(parent)) {
    return isOperator(child) || isWordOperation(child) ? bracketed : text;
  }
  if (!isOperator(parent)) return text;
  if (isWordOperation(child)) return bracketed;
  const precedence = getNode(keyOf(parent)).precedence?.(parent);
  return precedence === undefined ? text : parenthesise(child, text, precedence, side);
}

/** A target reads as the expression of the same shape once that block exists (`index`, `key`, `field`). */
function targetText(target: Target): string {
  const { kind, ...rest } = target;
  if (kind !== "var" && hasNode(kind)) return exprText({ id: "", kind, ...rest } as Expr);
  return writeTarget(target, exprText);
}

/** The text of one `{name}` placeholder of `node`'s template. */
export function slotText(node: Node, def: NodeDef, name: string): string {
  const bag = node as unknown as Bag;
  const slot = def.slots.find((s) => s.name === name);
  if (slot) {
    const value = bag[slot.name];
    const first = def.slots.find((s) => s.role === "expr") === slot;
    switch (slot.role) {
      case "expr":
        if (!isExpr(value)) return "";
        return def.shape === "stmt"
          ? exprText(value)
          : operand(value, node as Expr, first ? "left" : "right");
      case "exprs":
        return Array.isArray(value) ? value.filter(isExpr).map(exprText).join(", ") : "";
      case "id":
        return typeof value === "string" && value !== "" ? value : placeholder();
      case "text":
        return (
          def.text?.(node, slot.name) ||
          (typeof value === "string" || typeof value === "number" ? String(value) : "")
        );
      case "target":
        if (!value || typeof value !== "object") return "";
        return isEmptySlot(node, def, name) ? placeholder() : targetText(value as Target);
      default:
        return "";
    }
  }
  // Builtin templates name their parameters (`{a}`, `{b}`): the i-th argument.
  const index = def.params?.indexOf(name) ?? -1;
  const arg = index >= 0 && Array.isArray(bag.args) ? (bag.args[index] as unknown) : undefined;
  return isExpr(arg) ? operand(arg, node as Expr, "left") : "";
}

/** What a diamond asks: its condition as the chart writes it, then `?`. */
export function questionText(expr: Expr): string {
  return t("chart.condition", { cond: exprText(expr) });
}

/** The text of an expression: each block's template in its form, its inputs filled (N-08). */
export function exprText(expr: Expr): string {
  const def = getNode(keyOf(expr));
  return render(templateOfExpr(expr), (name) => slotText(expr, def, name));
}

/** The sentence of a statement or expression, as written in the catalog (not capitalised). */
export function sentence(node: Node, program: Program): string {
  const def = getNode(keyOf(node));
  if (def.shape === "expr") return exprText(node as Expr);
  return joinParts(sentenceParts(node, program));
}

/** The template of a statement in its form for this program (`templateCreate`, …). */
export function templateOf(node: Node, program: Program): string {
  const def = getNode(keyOf(node));
  const form = def.form?.(node, { creates: firstAssignments(program).has(node.id) }) ?? "";
  return nodeText(def.key, `template${form}`);
}

/** A statement's sentence as parts, one per slot (not capitalised). */
export function sentenceParts(node: Node, program: Program): Part[] {
  return renderParts(templateOf(node, program), node, getNode(keyOf(node)));
}

/** The text of a generated node (`init`, `check`, `step`), with the loop's own slots. */
export function generatedText(node: Node, part: "init" | "check" | "step"): string {
  return joinParts(generatedParts(node, part));
}

/** A generated node's text as parts, its slots being the loop's. */
export function generatedParts(node: Node, part: "init" | "check" | "step"): Part[] {
  const def = getNode(keyOf(node));
  return renderParts(nodeText(def.key, part), node, def);
}

/** A diamond's text: its question as one part of the condition's slot, or the placeholder. */
export function questionParts(node: Node): Part[] {
  const def = getNode(keyOf(node));
  const slot = def.slots.find((s) => s.role === "expr")?.name;
  const condition = conditionOf(node);
  if (!slot || !condition) return [];
  if (isEmptyExpr(condition)) return [{ text: placeholder(), slot, empty: true }];
  return [{ text: questionText(condition), slot }];
}

/** The expression a diamond asks about: the block's first `expr` slot (`branch`, `check`). */
export function conditionOf(node: Node): Expr | undefined {
  const def = getNode(keyOf(node));
  const slot = def.slots.find((s) => s.role === "expr");
  const value = slot ? (node as unknown as Bag)[slot.name] : undefined;
  return isExpr(value) ? value : undefined;
}

/** A value as the blocks write it: `true` / `false` / `none`, a text in quotes, the rest as `str()`. */
export function valueText(value: Value, heap: Heap): string {
  return writeValue(value, heap, (scalar) => {
    switch (scalar.t) {
      case "bool":
        return t(scalar.v ? "node.bool.template" : "node.bool.templateFalse");
      case "none":
        return t("node.none.template");
      case "str":
        return t("node.str.template", { value: scalar.v });
      default:
        return str(scalar, heap);
    }
  });
}

/** A case's input value (`Input n = 15`), written like any other value. */
export function dataText(data: Data): string {
  const heap: Heap = new Map();
  return valueText(toValue(data, heap), heap);
}
