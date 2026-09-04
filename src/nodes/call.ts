// 03-nodes `call`: a user function call, positional with exact arity (L-28).
import { newId } from "@/lang/id";
import type { Value } from "@/lang/types";
import { defineExpr } from "./types";

export const call = defineExpr<"call">({
  key: "call",
  category: "function",
  slots: [
    { name: "fn", role: "id", required: true },
    { name: "args", role: "exprs" },
  ],
  create: () => ({ id: newId(), kind: "call", fn: "", args: [] }),
  callee: (node) =>
    node.kind === "call"
      ? { name: node.fn, argc: node.args.length, family: "function" }
      : { name: "", argc: 0, family: "function" },
  *run(node, ctx) {
    const args: Value[] = [];
    for (const arg of node.args) args.push(yield* ctx.eval(arg));
    return yield* ctx.call(node.fn, args, node.id);
  },
  python: (node, ctx) => `${node.fn}(${node.args.map((arg) => ctx.expr(arg)).join(", ")})`,
});
