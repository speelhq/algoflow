// A node's sentence as plain text, from `node.<key>.template<form>` and the block's
// slots, in the block language: school symbols for operators, words for every other
// operation, and brackets around a word operation where it meets another operation.
// Reads slot roles, `params`, `form`, `text`, and `precedence` only, never a kind.
import { t, type MessageKey } from "@/i18n/t";
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

/** Parts with the first letter capitalised when they begin with a word of the template. */
export function capitaliseParts(parts: readonly Part[]): Part[] {
  const [first, ...rest] = parts;
  if (!first || first.slot !== undefined) return [...parts];
  return [{ ...first, text: capitalise(first.text) }, ...rest];
}

/** The text a variable is written as in place of its name, or undefined to keep the name. */
export type Values = (name: string) => string | undefined;

/**
 * A run of text; `variable` marks a variable's name, drawn bold in the variable colour, and
 * `empty` an input still to fill, drawn as its dashed placeholder.
 */
export type Run = { text: string; variable?: boolean; empty?: boolean };

/** A run of a node's text: a slot's text with the slot's name, or the template's own words. */
export type Part = Run & { slot?: string };

/** Spaces collapsed across runs as one sentence, the ends trimmed, and empty runs dropped. */
function tidy<R extends Run>(runs: readonly R[]): R[] {
  const out: R[] = [];
  for (const run of runs) {
    const before = out[out.length - 1]?.text ?? "";
    let text = run.text.replace(/\s+/g, " ");
    if (before === "" || before.endsWith(" ")) text = text.replace(/^ /, "");
    if (text !== "") out.push({ ...run, text });
  }
  const last = out[out.length - 1];
  if (last) last.text = last.text.replace(/ $/, "");
  return out.filter((run) => run.text !== "");
}

/** A template with each `{name}` replaced by the runs `fill` gives for it. */
function fillRuns(template: string, fill: (name: string) => Run[]): Run[] {
  const runs: Run[] = [];
  let at = 0;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    runs.push({ text: template.slice(at, found.index) }, ...fill(found[1] ?? ""));
    at = found.index + found[0].length;
  }
  runs.push({ text: template.slice(at) });
  return tidy(runs);
}

/** An Input node's text (`Input n = 15`) as runs, the input's name as a variable; the value as written. */
export function inputRuns(name: string, value: string): Run[] {
  const runs: Run[] = [];
  let at = 0;
  const template = t("chart.input");
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    runs.push({ text: template.slice(at, found.index) });
    if (found[1] === "name") runs.push({ text: name, variable: true });
    if (found[1] === "value") runs.push({ text: value });
    at = found.index + found[0].length;
  }
  runs.push({ text: template.slice(at) });
  return runs.filter((run) => run.text !== "");
}

/** The text runs spell. */
export function joinRuns(runs: readonly Run[]): string {
  return runs.map((run) => run.text).join("");
}

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
 * A template as parts, each placeholder of a slot of `node` one part per run naming its slot.
 * Spaces are collapsed across parts, and a part with no text is dropped.
 */
function renderParts(template: string, node: Node, def: NodeDef): Part[] {
  const parts: Part[] = [];
  let at = 0;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    const name = found[1] ?? "";
    parts.push({ text: template.slice(at, found.index) });
    const isSlot = def.slots.some((slot) => slot.name === name);
    if (isSlot && isEmptySlot(node, def, name)) {
      parts.push({ text: placeholder(), slot: name, empty: true });
    } else {
      for (const run of slotRuns(node, def, name))
        parts.push(isSlot ? { ...run, slot: name } : run);
    }
    at = found.index + found[0].length;
  }
  parts.push({ text: template.slice(at) });
  return tidy(parts);
}

/** An expression's template in its form. */
export function templateOfExpr(expr: Expr): string {
  const def = getNode(keyOf(expr));
  const form = def.form?.(expr, { creates: false }) ?? "";
  return nodeText(def.key, `template${form}`);
}

/** An expression with inputs whose template has words outside its placeholders. */
export function isWordOperation(expr: Expr): boolean {
  const def = getNode(keyOf(expr));
  const inputs = def.slots.some((slot) => slot.role === "expr" || slot.role === "exprs");
  return inputs && /\p{L}/u.test(templateOfExpr(expr).replace(/\{\w+\}/g, ""));
}

/** An expression with a precedence written with symbols only. */
export function isOperator(expr: Expr): boolean {
  return getNode(keyOf(expr)).precedence !== undefined && !isWordOperation(expr);
}

/**
 * Whether a child of `parent` is bracketed as the chart writes it: a word operation next to an
 * operator, and an operation inside a word operation; operators among themselves follow Python's precedence.
 */
export function needsBrackets(child: Expr, parent: Expr, side: Side): boolean {
  if (isWordOperation(parent)) return isOperator(child) || isWordOperation(child);
  if (!isOperator(parent)) return false;
  if (isWordOperation(child)) return true;
  const precedence = getNode(keyOf(parent)).precedence?.(parent);
  return precedence !== undefined && parenthesise(child, "x", precedence, side) !== "x";
}

function operandRuns(child: Expr, parent: Expr, side: Side, values?: Values): Run[] {
  const runs = exprRuns(child, values);
  return needsBrackets(child, parent, side) ? [{ text: "(" }, ...runs, { text: ")" }] : runs;
}

/** An expression block that is a bare name: its one slot is an `id` slot. */
function isVariable(def: NodeDef): boolean {
  return def.slots.length === 1 && def.slots[0]?.role === "id";
}

/** A target reads as the expression of the same shape once that block exists (`index`, `key`, `field`). */
function targetRuns(target: Target, values?: Values): Run[] {
  const { kind, ...rest } = target;
  if (kind === "var") return [{ text: target.name, variable: true }];
  if (hasNode(kind)) return exprRuns({ id: "", kind, ...rest } as Expr, values);
  return [{ text: writeTarget(target, exprText) }];
}

/** The runs of one `{name}` placeholder of `node`'s template. */
function slotRuns(node: Node, def: NodeDef, name: string, values?: Values): Run[] {
  const bag = node as unknown as Bag;
  const slot = def.slots.find((s) => s.name === name);
  if (slot) {
    const value = bag[slot.name];
    const first = def.slots.find((s) => s.role === "expr") === slot;
    switch (slot.role) {
      case "expr":
        if (!isExpr(value)) return [];
        return def.shape === "stmt"
          ? exprRuns(value, values)
          : operandRuns(value, node as Expr, first ? "left" : "right", values);
      case "exprs":
        return Array.isArray(value)
          ? value
              .filter(isExpr)
              .flatMap((item, i) => [...(i > 0 ? [{ text: ", " }] : []), ...exprRuns(item, values)])
          : [];
      case "id":
        if (typeof value !== "string" || value === "") return [{ text: placeholder() }];
        if (isVariable(def)) {
          const known = values?.(value);
          return [known === undefined ? { text: value, variable: true } : { text: known }];
        }
        return [{ text: value, variable: def.shape === "stmt" }];
      case "text":
        return [
          {
            text:
              def.text?.(node, slot.name) ||
              (typeof value === "string" || typeof value === "number" ? String(value) : ""),
          },
        ];
      case "target":
        if (!value || typeof value !== "object") return [];
        return isEmptySlot(node, def, name)
          ? [{ text: placeholder() }]
          : targetRuns(value as Target, values);
      default:
        return [];
    }
  }
  // Builtin templates name their parameters (`{a}`, `{b}`): the i-th argument.
  const index = def.params?.indexOf(name) ?? -1;
  const arg = index >= 0 && Array.isArray(bag.args) ? (bag.args[index] as unknown) : undefined;
  return isExpr(arg) ? operandRuns(arg, node as Expr, "left", values) : [];
}

/** A piece of an expression as a value line shows it: words, or an input. */
export type Piece = (Run & { slot?: string }) | { child: Expr; bracketed: boolean };

/**
 * An expression's pieces in the order of its template: its words, its `text` and `id` slots
 * as runs naming the slot, and each input as a child, bracketed as the chart brackets it.
 */
export function exprPieces(expr: Expr): Piece[] {
  const def = getNode(keyOf(expr));
  if (isVariable(def)) return slotRuns(expr, def, def.slots[0]?.name ?? "");
  const bag = expr as unknown as Bag;
  const template = templateOfExpr(expr).trim();
  const pieces: Piece[] = [];
  const child = (item: unknown, side: Side) => {
    if (isExpr(item)) pieces.push({ child: item, bracketed: needsBrackets(item, expr, side) });
  };
  let at = 0;
  let firstInput = true;
  for (const found of template.matchAll(/\{(\w+)\}/g)) {
    const name = found[1] ?? "";
    if (found.index > at) pieces.push({ text: template.slice(at, found.index) });
    const slot = def.slots.find((s) => s.name === name);
    const side: Side = firstInput ? "left" : "right";
    if (slot?.role === "expr") {
      child(bag[name], side);
      firstInput = false;
    } else if (slot?.role === "exprs") {
      const items = Array.isArray(bag[name]) ? (bag[name] as unknown[]) : [];
      items.forEach((item, i) => {
        if (i > 0) pieces.push({ text: ", " });
        child(item, "left");
      });
      firstInput = false;
    } else if (slot) {
      for (const run of slotRuns(expr, def, name)) pieces.push({ ...run, slot: name });
    } else {
      const index = def.params?.indexOf(name) ?? -1;
      child(index >= 0 && Array.isArray(bag.args) ? bag.args[index] : undefined, "left");
      firstInput = false;
    }
    at = found.index + found[0].length;
  }
  if (at < template.length) pieces.push({ text: template.slice(at) });
  return pieces;
}

/** An expression's inputs in the order its template shows them. */
export function inputOrder(expr: Expr): Expr[] {
  return exprPieces(expr).flatMap((piece) => ("child" in piece ? [piece.child] : []));
}

/** The text of one `{name}` placeholder of `node`'s template. */
export function slotText(node: Node, def: NodeDef, name: string): string {
  return joinRuns(slotRuns(node, def, name));
}

/** What a diamond asks: its condition as the chart writes it, then `?`, as runs. */
function questionRuns(expr: Expr): Run[] {
  return fillRuns(t("chart.condition"), (name) => (name === "cond" ? exprRuns(expr) : []));
}

/** What a diamond asks: its condition as the chart writes it, then `?`. */
export function questionText(expr: Expr): string {
  return joinRuns(questionRuns(expr));
}

/**
 * An expression as runs: each block's template in its form, its inputs filled; a
 * variable for which `values` has a text is written as that text.
 */
export function exprRuns(expr: Expr, values?: Values): Run[] {
  if (isEmptyExpr(expr)) return [{ text: placeholder(), empty: true }];
  const def = getNode(keyOf(expr));
  if (isVariable(def)) return slotRuns(expr, def, def.slots[0]?.name ?? "", values);
  return fillRuns(templateOfExpr(expr), (name) => slotRuns(expr, def, name, values));
}

/** The text of an expression: each block's template in its form, its inputs filled. */
export function exprText(expr: Expr, values?: Values): string {
  return joinRuns(exprRuns(expr, values));
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
  return questionRuns(condition).map((run) => ({ ...run, slot }));
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
