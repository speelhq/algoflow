// What an expression slot's menu offers, as data: the typed number or text, the
// variables, the values, the templates, and the groups of operators, list blocks, and
// calls. Every item is made by the parser or by a block's `create()`, so this file names
// no block kind; what an operator or a variable is comes from what the parser makes.
import { newId } from "@/lang/id";
import type { BinOp, Expr, Id, Node, Program } from "@/lang/types";
import { allExprs, childSlots, isEmptyExpr, isExpr } from "@/lang/walk";
import { getNode, keyOf, NODES } from "@/nodes";
import { pyString } from "@/python/emit";
import { isParseError, parse, type ParseScope } from "@/python/parse";
import { isComparison } from "@/python/precedence";
import { blankTemplate, exprText, nodeText } from "@/ui/chart/text";
import { CONDITION_TEMPLATES, variableName, type ConditionTemplate } from "./templates";

type Bag = Record<string, unknown>;

export type Group = "variables" | "values" | "list" | "math" | "compare" | "logic" | "call";
/** The groups below the template row, in order. */
export const GROUPS: readonly Group[] = [
  "variables",
  "values",
  "list",
  "math",
  "compare",
  "logic",
  "call",
];

/**
 * One choice of the menu. `make` builds a fresh expression; a `wraps` item takes the current
 * chip as its first operand, any other replaces the chip.
 */
export type Item = { id: string; label: string; group: Group; wraps: boolean; make: () => Expr };

export function scopeOf(program: Program): ParseScope {
  return {
    classes: program.classes.map((cls) => cls.name),
    functions: program.functions.map((fn) => fn.name),
  };
}

/** `expr` with fresh ids throughout, as a block the menu inserts. */
function fresh(expr: Expr): Expr {
  const copy = structuredClone(expr);
  const visit = (node: Expr) => {
    node.id = newId();
    for (const { expr: child } of childSlots(node)) visit(child);
  };
  visit(copy);
  return copy;
}

/** The parser's expression for `text`; the patterns below always parse. */
function parsed(text: string, scope?: ParseScope): Expr {
  const result = parse(text, scope);
  if (isParseError(result)) throw new Error(`"${text}" does not parse`);
  return fresh(result);
}

/** `pattern` with every variable named `a` or `b` replaced by an empty slot. */
export function withBlanks(pattern: Expr): Expr {
  const copy = fresh(pattern);
  const replace = (node: Node) => {
    const bag = node as unknown as Bag;
    for (const slot of getNode(keyOf(node)).slots) {
      const value = bag[slot.name];
      const swap = (item: unknown): unknown => {
        if (!isExpr(item)) return item;
        const name = variableName(item);
        if (name === "a" || name === "b") return { id: newId(), kind: "empty" };
        replace(item);
        return item;
      };
      if (slot.role === "expr") bag[slot.name] = swap(value);
      else if (slot.role === "exprs" && Array.isArray(value)) bag[slot.name] = value.map(swap);
    }
  };
  replace(copy);
  return copy;
}

/** The first empty expression inside `expr`, pre-order, if any. */
export function firstEmpty(expr: Expr): Expr | undefined {
  if (isEmptyExpr(expr)) return expr;
  for (const { expr: child } of childSlots(expr)) {
    const found = firstEmpty(child);
    if (found) return found;
  }
  return undefined;
}

/**
 * The block made by `make` with `current` as its first operand (its first `expr` slot,
 * or the first item of an `exprs` slot), focusing its next empty slot; a block with no
 * expression slot replaces the chip. `focus` is null when nothing is left to fill.
 */
export function placeItem(item: Item, current: Expr): { expr: Expr; focus: Expr | null } {
  const made = item.make();
  if (!item.wraps) return { expr: made, focus: firstEmpty(made) ?? null };
  const bag = made as unknown as Bag;
  for (const slot of getNode(keyOf(made)).slots) {
    const value = bag[slot.name];
    if (slot.role === "expr") {
      bag[slot.name] = current;
      break;
    }
    if (slot.role === "exprs" && Array.isArray(value)) {
      bag[slot.name] = value.length > 0 ? [current, ...value.slice(1)] : [current];
      break;
    }
  }
  return { expr: made, focus: firstEmpty(made) ?? null };
}

const hasExprSlot = (expr: Expr) =>
  getNode(keyOf(expr)).slots.some((slot) => slot.role === "expr" || slot.role === "exprs");

function blockItem(id: string, group: Group, label: string, make: () => Expr): Item {
  return { id, label, group, wraps: hasExprSlot(make()), make };
}

// ---------------------------------------------------------------- the items

export function variableItems(names: readonly Id[]): Item[] {
  return names.map((name) => ({
    id: `var:${name}`,
    label: name,
    group: "variables",
    wraps: false,
    make: () => parsed(name),
  }));
}

/** `true`, `false`, `none`: the literals the parser reads for `True`, `False`, `None`. */
export function valueItems(): Item[] {
  return ["True", "False", "None"].map((python) => {
    const label = exprText(parsed(python));
    return {
      id: `value:${python}`,
      label,
      group: "values",
      wraps: false,
      make: () => parsed(python),
    };
  });
}

/**
 * The number or text the field holds: digits, with or without a leading `-`, make a number,
 * a leading quote a text; anything else, or a number that does not parse, makes nothing.
 */
export function typedItem(text: string): Item | undefined {
  const trimmed = text.trim();
  if (/^-?\d/.test(trimmed)) {
    const result = parse(trimmed);
    if (isParseError(result)) return undefined;
    // A number, or a negated one: one node, or one node around a single one; no variable.
    const nodes = [...allExprs(result)];
    const negated = nodes.length === 2 && childSlots(result).length === 1;
    if (
      (nodes.length !== 1 && !negated) ||
      nodes.some((node) => variableName(node) !== undefined)
    ) {
      return undefined;
    }
    return {
      id: "typed:number",
      label: trimmed,
      group: "values",
      wraps: false,
      make: () => fresh(result),
    };
  }
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    const quote = trimmed.charAt(0);
    const body =
      trimmed.length > 1 && trimmed.endsWith(quote) ? trimmed.slice(1, -1) : trimmed.slice(1);
    const python = pyString(body);
    return {
      id: "typed:text",
      label: exprText(parsed(python)),
      group: "values",
      wraps: false,
      make: () => parsed(python),
    };
  }
  return undefined;
}

/** Every operator the parser reads, by group: arithmetic, comparisons with `in`, and logic. */
/** The operators of the Math, Compare, and Logic groups, in the order the menu lists them. */
const OPERATORS: readonly BinOp[] = [
  "+",
  "-",
  "*",
  "/",
  "//",
  "%",
  "**",
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "in",
  "and",
  "or",
];

export function operatorItems(): Item[] {
  const items: Item[] = OPERATORS.map((op) => {
    const make = () => withBlanks(parsed(`a ${op} b`));
    const sample = make();
    const group: Group = isComparison(op)
      ? "compare"
      : op === "and" || op === "or"
        ? "logic"
        : "math";
    const opSlot = getNode(keyOf(sample)).slots.find((slot) => slot.role === "text");
    const def = getNode(keyOf(sample));
    const label = (opSlot && def.text?.(sample, opSlot.name)) || op;
    return { id: `op:${op}`, label, group, wraps: true, make };
  });
  const not = () => withBlanks(parsed("not a"));
  const sample = not();
  const def = getNode(keyOf(sample));
  const form = def.form?.(sample, { creates: false }) ?? "";
  const label = nodeText(def.key, `template${form}`).split("{")[0]?.trim() || "not";
  items.push({ id: "op:not", label, group: "logic", wraps: true, make: not });
  return items;
}

/** Expression blocks of the list category, and every builtin call (in Call unless a list one). */
export function blockItems(): Item[] {
  const items: Item[] = [];
  for (const def of NODES.values()) {
    if (def.shape !== "expr" || def.hidden) continue;
    const builtin = def.params !== undefined;
    if (def.category !== "list" && !builtin) continue;
    const label = blankTemplate(nodeText(def.key, "template"));
    items.push(
      blockItem(
        def.key,
        def.category === "list" ? "list" : "call",
        label,
        () => def.create() as Expr,
      ),
    );
  }
  return items;
}

/** The program's own functions, as calls with one empty argument per parameter. */
export function functionItems(program: Program): Item[] {
  return program.functions.map((fn) => {
    const make = (): Expr => {
      const call = parsed(`${fn.name}(${fn.params.map(() => "a").join(", ")})`, scopeOf(program));
      return withBlanks(call);
    };
    const label = blankTemplate(nodeText("call", "template").replace("{fn}", fn.name));
    const item = blockItem(`fn:${fn.name}`, "call", label, make);
    // A function with no parameter has no first argument to take the chip: it replaces it.
    return fn.params.length > 0 ? item : { ...item, wraps: false };
  });
}

/** The condition templates, each as its sentence and its expression with empty blanks. */
export type TemplateItem = { template: ConditionTemplate; label: string; make: () => Expr };

export function templateItems(): TemplateItem[] {
  return CONDITION_TEMPLATES.map((template) => ({
    template,
    label: template.key,
    make: () => withBlanks(parsed(template.python)),
  }));
}

/** Every item of the groups below the template row, for the slots of statement `program`. */
export function menuItems(program: Program, visible: readonly Id[]): Item[] {
  const items = [
    ...variableItems(visible),
    ...valueItems(),
    ...operatorItems(),
    ...blockItems(),
    ...functionItems(program),
  ];
  return items.toSorted((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
}

/** The items whose label contains `query`, ignoring case. */
export function filterItems(items: readonly Item[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  return q === "" ? [...items] : items.filter((item) => item.label.toLowerCase().includes(q));
}
