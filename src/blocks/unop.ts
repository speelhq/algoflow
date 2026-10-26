// The `unop` block definition: `-x` and `not x`.
import { newId } from "@/lang/id";
import type { Expr } from "@/lang/types";
import { PRECEDENCE } from "@/python/precedence";
import { isNumber, makeNumber, truthy } from "@/runtime/values";
import { defineExpr } from "./types";
import { emptyExpr } from "./empty";

type Unop = Extract<Expr, { kind: "unop" }>;

/** Each operator with its precedence. */
const OPS: Record<Unop["op"], number> = { neg: PRECEDENCE.unary, not: PRECEDENCE.not };

const precedenceOf = (block: Unop) => OPS[block.op];

export const unop = defineExpr<"unop">({
  key: "unop",
  category: "basic",
  slots: [
    { name: "op", role: "text", required: true },
    { name: "operand", role: "expr", required: true },
  ],
  precedence: (block) => precedenceOf(block as Unop),
  create: () => ({ id: newId(), kind: "unop", op: "neg", operand: emptyExpr() }),
  fieldsError: (fields) =>
    typeof fields.op === "string" && Object.hasOwn(OPS, fields.op)
      ? undefined
      : { field: "op", message: "expected a known operator" },
  *run(block, ctx) {
    const value = yield* ctx.eval(block.operand);
    if (block.op === "not") return { t: "bool", v: !truthy(value, ctx.heap) };
    if (!isNumber(value)) return ctx.valueError(block, value);
    // `-x` keeps the sign rules of Python: `-(0.0)` is `-0.0`; ints have no negative zero.
    return makeNumber(-value.v, value.t === "float");
  },
  python: (block, ctx) => {
    const operand = ctx.operand(block.operand, precedenceOf(block), "right");
    return block.op === "neg" ? `-${operand}` : `not ${operand}`;
  },
  notation: (block) => (block.op === "not" ? "not {operand}" : "−{operand}"),
  kind: (block) => (block.op === "not" ? "truefalse" : "number"),
  menu: [{ name: "not", group: "conditions", preset: { op: "not" }, symbol: "not", keys: "not" }],
});
