// 03-nodes `binop`: L-10..L-19 semantics, R-04 membership reads, R-06 compare events, E-05 text.
import { dictKey } from "@/lang/data";
import { newId } from "@/lang/id";
import type { Expr, Value } from "@/lang/types";
import { binopPrecedence, isComparison } from "@/python/precedence";
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
  str,
  truthy,
} from "@/runtime/values";
import { defineExpr, type RunContext } from "./types";

type Binop = Extract<Expr, { kind: "binop" }>;

/** L-10..L-14 */
function arithmetic(node: Binop, l: Value, r: Value, ctx: RunContext): Value {
  if (node.op === "+" && l.t === "str" && r.t === "str") return { t: "str", v: l.v + r.v };
  if (!isNumber(l) || !isNumber(r)) return typeError(node.id, l, r, ctx);
  const float = l.t === "float" || r.t === "float";
  const a = l.v;
  const b = r.v;
  switch (node.op) {
    case "+":
      return makeNumber(a + b, float);
    case "-":
      return makeNumber(a - b, float);
    case "*":
      return makeNumber(a * b, float);
    case "/":
      if (b === 0) return ctx.fail(node.id, "E_DIV_ZERO");
      return { t: "float", v: a / b };
    case "//":
      if (b === 0) return ctx.fail(node.id, "E_DIV_ZERO");
      return float ? { t: "float", v: floatFloorDiv(a, b) } : makeNumber(Math.floor(a / b), false);
    case "%":
      if (b === 0) return ctx.fail(node.id, "E_DIV_ZERO");
      return float
        ? { t: "float", v: floatMod(a, b) }
        : makeNumber(a - b * Math.floor(a / b), false);
    case "**":
      if (a === 0 && b < 0) return ctx.fail(node.id, "E_DIV_ZERO");
      if (float || b < 0) return { t: "float", v: a ** b };
      return makeNumber(a ** b, false);
    default:
      return typeError(node.id, l, r, ctx);
  }
}

/** L-15, L-16 */
function ordered(node: Binop, l: Value, r: Value, ctx: RunContext): boolean {
  if (node.op === "==") return equals(l, r, ctx.heap);
  if (node.op === "!=") return !equals(l, r, ctx.heap);
  const c = compare(l, r);
  if (c === undefined) return typeError(node.id, l, r, ctx);
  switch (node.op) {
    case "<":
      return c < 0;
    case "<=":
      return c <= 0;
    case ">":
      return c > 0;
    case ">=":
      return c >= 0;
    default:
      return typeError(node.id, l, r, ctx);
  }
}

/** L-19 and R-04: one ref per compared list element. */
function* membership(
  node: Binop,
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
    if (refs.length > 0) yield { type: "read", nodeId: node.id, refs };
    return found;
  }
  if (r.t === "dict") {
    const key = dictKey(l);
    if (key === undefined) return typeError(node.id, l, r, ctx);
    const entry = entryOf(ctx.heap, r.ref);
    return entry.kind === "dict" && entry.entries.has(key);
  }
  if (r.t === "str") {
    if (l.t !== "str") return typeError(node.id, l, r, ctx);
    return r.v.includes(l.v);
  }
  return typeError(node.id, l, r, ctx);
}

export const binop = defineExpr<"binop">({
  key: "binop",
  category: "basic",
  slots: [
    { name: "op", role: "text", required: true },
    { name: "left", role: "expr", required: true },
    { name: "right", role: "expr", required: true },
  ],
  precedence: (node) => binopPrecedence((node as Binop).op),
  create: () => ({ id: newId(), kind: "binop", op: "+", left: emptyExpr(), right: emptyExpr() }),
  *run(node, ctx) {
    if (node.op === "and" || node.op === "or") {
      // L-17: short-circuit, returning the deciding operand
      const left = yield* ctx.eval(node.left);
      const decided = node.op === "and" ? !truthy(left, ctx.heap) : truthy(left, ctx.heap);
      if (decided) return left;
      return yield* ctx.eval(node.right);
    }
    const left = yield* ctx.eval(node.left);
    const right = yield* ctx.eval(node.right);
    if (isComparison(node.op)) {
      const result =
        node.op === "in"
          ? yield* membership(node, left, right, ctx)
          : ordered(node, left, right, ctx);
      yield {
        type: "compare",
        nodeId: node.id,
        text: `${str(left, ctx.heap)} ${node.op} ${str(right, ctx.heap)}`,
        result,
      };
      return { t: "bool", v: result };
    }
    return arithmetic(node, left, right, ctx);
  },
  python: (node, ctx) => {
    const precedence = binopPrecedence(node.op);
    return `${ctx.operand(node.left, precedence, "left")} ${node.op} ${ctx.operand(node.right, precedence, "right")}`;
  },
});

function emptyExpr(): Expr {
  return { id: newId(), kind: "empty" };
}

export { BINOPS } from "@/python/precedence";
