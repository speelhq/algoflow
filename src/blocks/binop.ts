// The `binop` block: arithmetic, comparison, logic, and `in`, with the reads of `in`, the
// `compare` events, and the operator precedence of the emitted text.
import { dictKey } from "@/lang/data";
import { newId } from "@/lang/id";
import { KINDS, type Expr, type Value } from "@/lang/types";
import { binopPrecedence, isBinOp, isComparison } from "@/python/precedence";
import { typeError } from "@/runtime/access";
import type { Event, Ref } from "@/runtime/types";
import {
  compare,
  entryOf,
  equals,
  floatFloorDiv,
  floatMod,
  isNumber,
  makeNumber,
  truthy,
} from "@/runtime/values";
import { defineExpr, type RunContext } from "./types";
import { emptyExpr } from "./empty";

type Binop = Extract<Expr, { kind: "binop" }>;

/** The kinds `<`, `≤`, `>`, and `≥` order. */
const ORDERED = ["number", "text"] as const;

function arithmetic(block: Binop, l: Value, r: Value, ctx: RunContext): Value {
  if (block.op === "+" && l.t === "str" && r.t === "str") return { t: "str", v: l.v + r.v };
  if (!isNumber(l) || !isNumber(r)) return typeError(block.id, l, r, ctx);
  const float = l.t === "float" || r.t === "float";
  const a = l.v;
  const b = r.v;
  switch (block.op) {
    case "+":
      return makeNumber(a + b, float);
    case "-":
      return makeNumber(a - b, float);
    case "*":
      return makeNumber(a * b, float);
    case "/":
      if (b === 0) return ctx.fail(block.id, "E_DIV_ZERO");
      return { t: "float", v: a / b };
    case "//":
      if (b === 0) return ctx.fail(block.id, "E_DIV_ZERO");
      return float ? { t: "float", v: floatFloorDiv(a, b) } : makeNumber(Math.floor(a / b), false);
    case "%":
      if (b === 0) return ctx.fail(block.id, "E_DIV_ZERO");
      return float
        ? { t: "float", v: floatMod(a, b) }
        : makeNumber(a - b * Math.floor(a / b), false);
    case "**":
      if (a === 0 && b < 0) return ctx.fail(block.id, "E_DIV_ZERO");
      if (float || b < 0) return { t: "float", v: a ** b };
      return makeNumber(a ** b, false);
    default:
      return typeError(block.id, l, r, ctx);
  }
}

function ordered(block: Binop, l: Value, r: Value, ctx: RunContext): boolean {
  if (block.op === "==") return equals(l, r, ctx.heap);
  if (block.op === "!=") return !equals(l, r, ctx.heap);
  const c = compare(l, r);
  if (c === undefined) return typeError(block.id, l, r, ctx);
  switch (block.op) {
    case "<":
      return c < 0;
    case "<=":
      return c <= 0;
    case ">":
      return c > 0;
    case ">=":
      return c >= 0;
    default:
      return typeError(block.id, l, r, ctx);
  }
}

/** One ref per compared list element. */
function* membership(
  block: Binop,
  l: Value,
  r: Value,
  ctx: RunContext,
): Generator<Event, boolean, void> {
  if (r.t === "list") {
    const entry = entryOf(ctx.heap, r.ref);
    if (entry.kind !== "list") return false;
    const refs: Ref[] = [];
    let found = false;
    for (let i = 0; i < entry.items.length; i += 1) {
      refs.push({ heap: r.ref, index: i });
      if (equals(l, entry.items[i] ?? { t: "none" }, ctx.heap)) {
        found = true;
        break;
      }
    }
    if (refs.length > 0) yield { type: "read", nodeId: block.id, refs };
    return found;
  }
  if (r.t === "dict") {
    const key = dictKey(l);
    if (key === undefined) return typeError(block.id, l, r, ctx);
    const entry = entryOf(ctx.heap, r.ref);
    return entry.kind === "dict" && entry.entries.has(key);
  }
  if (r.t === "str") {
    if (l.t !== "str") return typeError(block.id, l, r, ctx);
    return r.v.includes(l.v);
  }
  return typeError(block.id, l, r, ctx);
}

export const binop = defineExpr<"binop">({
  key: "binop",
  category: "basic",
  slots: [
    { name: "op", role: "text", required: true },
    { name: "left", role: "expr", required: true },
    { name: "right", role: "expr", required: true },
  ],
  precedence: (block) => binopPrecedence((block as Binop).op),
  create: () => ({ id: newId(), kind: "binop", op: "+", left: emptyExpr(), right: emptyExpr() }),
  fieldsError: (fields) =>
    typeof fields.op === "string" && isBinOp(fields.op)
      ? undefined
      : { field: "op", message: "expected a known operator" },
  *run(block, ctx) {
    if (block.op === "and" || block.op === "or") {
      // Short-circuit, returning the deciding operand
      const left = yield* ctx.eval(block.left);
      const decided = block.op === "and" ? !truthy(left, ctx.heap) : truthy(left, ctx.heap);
      if (decided) return left;
      return yield* ctx.eval(block.right);
    }
    const left = yield* ctx.eval(block.left);
    const right = yield* ctx.eval(block.right);
    if (isComparison(block.op)) {
      const result =
        block.op === "in"
          ? yield* membership(block, left, right, ctx)
          : ordered(block, left, right, ctx);
      yield { type: "compare", nodeId: block.id, result };
      return { t: "bool", v: result };
    }
    return arithmetic(block, left, right, ctx);
  },
  python: (block, ctx) => {
    const precedence = binopPrecedence(block.op);
    return `${ctx.operand(block.left, precedence, "left")} ${block.op} ${ctx.operand(block.right, precedence, "right")}`;
  },
  notation: () => "{left} {op} {right}",
  // The symbols taught at school, and Python's where school has none (`%`, `//`, `**`, `in`).
  text: (block, slot) => (slot === "op" ? (CANVAS_OPS[block.op] ?? block.op) : ""),
  kind: (block, kindOf) => {
    if (isComparison(block.op)) return "truefalse";
    const left = kindOf(block.left);
    const right = kindOf(block.right);
    const same = left !== undefined && left === right ? left : undefined;
    if (block.op === "and" || block.op === "or") return same;
    if (block.op === "+") return same === "truefalse" ? undefined : same;
    if (block.op === "*") {
      const repeated = [left, right].find((kind) => kind === "list" || kind === "text");
      if (repeated) return repeated;
    }
    return "number";
  },
  menu: [
    {
      name: "and",
      group: "conditions",
      on: ["truefalse"],
      preset: { op: "and" },
      symbol: "and",
      keys: "and",
    },
    {
      name: "or",
      group: "conditions",
      on: ["truefalse"],
      preset: { op: "or" },
      symbol: "or",
      keys: "or",
    },
    {
      name: "add",
      group: "calculate",
      on: ["number", "text"],
      preset: { op: "+" },
      symbol: "+",
      keys: "+",
    },
    {
      name: "sub",
      group: "calculate",
      on: ["number"],
      preset: { op: "-" },
      symbol: "−",
      keys: "-",
    },
    {
      name: "mul",
      group: "calculate",
      on: ["number"],
      preset: { op: "*" },
      symbol: "×",
      keys: "*",
    },
    {
      name: "div",
      group: "calculate",
      on: ["number"],
      preset: { op: "/" },
      symbol: "÷",
      keys: "/",
    },
    {
      name: "mod",
      group: "calculate",
      on: ["number"],
      preset: { op: "%" },
      symbol: "%",
      keys: "%",
    },
    {
      name: "floorDiv",
      group: "calculate",
      on: ["number"],
      preset: { op: "//" },
      symbol: "//",
      keys: "//",
    },
    {
      name: "pow",
      group: "calculate",
      on: ["number"],
      preset: { op: "**" },
      symbol: "**",
      keys: "**",
    },
    { name: "join", group: "items", on: ["list"], preset: { op: "+" }, symbol: "+" },
    { name: "eq", group: "compare", on: KINDS, preset: { op: "==" }, symbol: "=", keys: "==" },
    { name: "ne", group: "compare", on: KINDS, preset: { op: "!=" }, symbol: "≠", keys: "!=" },
    { name: "lt", group: "compare", on: ORDERED, preset: { op: "<" }, symbol: "<", keys: "<" },
    { name: "le", group: "compare", on: ORDERED, preset: { op: "<=" }, symbol: "≤", keys: "<=" },
    { name: "gt", group: "compare", on: ORDERED, preset: { op: ">" }, symbol: ">", keys: ">" },
    { name: "ge", group: "compare", on: ORDERED, preset: { op: ">=" }, symbol: "≥", keys: ">=" },
    { name: "in", group: "compare", on: KINDS, preset: { op: "in" }, symbol: "in", keys: "in" },
  ],
});

const CANVAS_OPS: Partial<Record<Binop["op"], string>> = {
  "-": "−",
  "*": "×",
  "/": "÷",
  "==": "=",
  "!=": "≠",
  "<=": "≤",
  ">=": "≥",
};
