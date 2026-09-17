// N-08: a node's sentence as plain text, from `node.<key>.template<form>` and the block's
// slots; U-50: a statement's slot holding an expression that matches a condition template
// reads as that template's sentence, while the chips nested inside an expression keep symbols.
// Reads slot roles, `params`, `form`, `text`, and `precedence` only, never a kind (N-01).
import { t, type MessageKey } from "@/i18n/t";
import { keyValue, toValue } from "@/lang/data";
import type { Data, Expr, Heap, Node, Program, Target, Value } from "@/lang/types";
import { firstAssignments } from "@/lang/validate";
import { isExpr } from "@/lang/walk";
import { getNode, hasNode, keyOf } from "@/nodes";
import type { NodeDef, Side } from "@/nodes/types";
import { needsParens } from "@/python/precedence";
import { str } from "@/runtime/values";
import { matchTemplate } from "@/ui/expression/templates";

type Bag = Record<string, unknown>;

/** The one place a registry key becomes an i18n key (dynamic keys are not scanned by T-08). */
export function nodeText(key: string, part: string, params?: Record<string, string>): string {
  return t(`node.${key}.${part}` as MessageKey, params);
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** `{name}` placeholders of a template, filled by `fill`; unknown names become empty. */
function render(template: string, fill: (name: string) => string): string {
  return template
    .replace(/\{(\w+)\}/g, (_, name: string) => fill(name))
    .replace(/\s+/g, " ")
    .trim();
}

/** A child is parenthesised where the emitter would parenthesise it (E-05). */
function operand(child: Expr, parent: number | undefined, side: Side): string {
  const text = exprText(child);
  const own = getNode(keyOf(child)).precedence?.(child);
  return own !== undefined && parent !== undefined && needsParens(own, parent, side)
    ? `(${text})`
    : text;
}

function targetText(target: Target): string {
  if (target.kind === "var") return target.name;
  // A target reads as the expression of the same shape once that block exists (`index`, `key`, `field`).
  const { kind, ...rest } = target;
  if (hasNode(kind)) return exprText({ id: "", kind, ...rest } as Expr);
  if (target.kind === "field") return `${exprText(target.obj)}.${target.field}`;
  return target.kind === "index"
    ? `${exprText(target.list)}[${exprText(target.index)}]`
    : `${exprText(target.dict)}[${exprText(target.key)}]`;
}

/** The text of one `{name}` placeholder of `node`'s template. */
export function slotText(node: Node, def: NodeDef, name: string): string {
  const bag = node as unknown as Bag;
  const precedence = def.shape === "expr" ? def.precedence?.(node as Expr) : undefined;
  const slot = def.slots.find((s) => s.name === name);
  if (slot) {
    const value = bag[slot.name];
    const first = def.slots.find((s) => s.role === "expr") === slot;
    switch (slot.role) {
      case "expr":
        if (!isExpr(value)) return "";
        return def.shape === "stmt"
          ? slotSentence(value)
          : operand(value, precedence, first ? "left" : "right");
      case "exprs":
        return Array.isArray(value)
          ? value
              .filter(isExpr)
              .map(def.shape === "stmt" ? slotSentence : exprText)
              .join(", ")
          : "";
      case "id":
        return typeof value === "string" ? value : "";
      case "text":
        return (
          def.text?.(node, slot.name) ||
          (typeof value === "string" || typeof value === "number" ? String(value) : "")
        );
      case "target":
        return value && typeof value === "object" ? targetText(value as Target) : "";
      default:
        return "";
    }
  }
  // Builtin templates name their parameters (`{a}`, `{b}`): the i-th argument.
  const index = def.params?.indexOf(name) ?? -1;
  const arg = index >= 0 && Array.isArray(bag.args) ? (bag.args[index] as unknown) : undefined;
  return isExpr(arg) ? exprText(arg) : "";
}

/** The blanks of a matched template, parenthesised as operands of the matched expression. */
function blanks(expr: Expr, a: Expr, b: Expr): { a: string; b: string } {
  const precedence = getNode(keyOf(expr)).precedence?.(expr);
  return { a: operand(a, precedence, "left"), b: operand(b, precedence, "right") };
}

/** U-50: what a slot shows: the template's sentence when the expression matches one, else its chips. */
export function slotSentence(expr: Expr): string {
  const matched = matchTemplate(expr);
  return matched ? t(matched.template.key, blanks(expr, matched.a, matched.b)) : exprText(expr);
}

/** U-33: what a diamond asks: the template's question, else `Is <chips>?`. */
export function questionText(expr: Expr): string {
  const matched = matchTemplate(expr);
  return matched
    ? t(matched.template.question, blanks(expr, matched.a, matched.b))
    : t("chart.condition", { cond: exprText(expr) });
}

/** N-08 text of an expression as chips: each block's template, with symbols for operators. */
export function exprText(expr: Expr): string {
  const def = getNode(keyOf(expr));
  const form = def.form?.(expr, { creates: false }) ?? "";
  return render(nodeText(def.key, `template${form}`), (name) => slotText(expr, def, name));
}

/** N-08: the sentence of a statement or expression, as written in the catalog (not capitalised). */
export function sentence(node: Node, program: Program): string {
  const def = getNode(keyOf(node));
  if (def.shape === "expr") return exprText(node as Expr);
  const form = def.form?.(node, { creates: firstAssignments(program).has(node.id) }) ?? "";
  return render(nodeText(def.key, `template${form}`), (name) => slotText(node, def, name));
}

/** N-09: the text of a generated node (`init`, `check`, `step`), with the loop's own slots. */
export function generatedText(node: Node, part: "init" | "check" | "step"): string {
  const def = getNode(keyOf(node));
  return render(nodeText(def.key, part), (name) => slotText(node, def, name));
}

/** The expression a diamond asks about: the block's first `expr` slot (N-09 `branch`, `check`). */
export function conditionOf(node: Node): Expr | undefined {
  const def = getNode(keyOf(node));
  const slot = def.slots.find((s) => s.role === "expr");
  const value = slot ? (node as unknown as Bag)[slot.name] : undefined;
  return isExpr(value) ? value : undefined;
}

/** A value as the blocks write it: `true` / `false` / `none`, a text in quotes, the rest as `str()`. */
export function valueText(value: Value, heap: Heap): string {
  switch (value.t) {
    case "bool":
      return t(value.v ? "node.bool.template" : "node.bool.templateFalse");
    case "none":
      return t("node.none.template");
    case "str":
      return t("node.str.template", { value: value.v });
    case "int":
    case "float":
      return str(value, heap);
    default: {
      const entry = heap.get(value.ref);
      if (entry?.kind === "list") {
        return `[${entry.items.map((item) => valueText(item, heap)).join(", ")}]`;
      }
      if (entry?.kind === "dict") {
        const pairs = [...entry.entries].map(
          ([key, item]) => `${valueText(keyValue(key), heap)}: ${valueText(item, heap)}`,
        );
        return `{${pairs.join(", ")}}`;
      }
      if (entry?.kind === "obj") {
        const fields = [...entry.fields].map(([name, item]) => `${name}=${valueText(item, heap)}`);
        return `${entry.cls}(${fields.join(", ")})`;
      }
      return str(value, heap);
    }
  }
}

/** A case's input value (U-32, U-31 `Input n = 15`), written like any other value. */
export function dataText(data: Data): string {
  const heap: Heap = new Map();
  return valueText(toValue(data, heap), heap);
}
