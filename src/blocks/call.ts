// The `call` block definition: a user function call, positional with exact arity.
import { newId } from "@/lang/id";
import type { Value } from "@/lang/types";
import { defineExpr } from "./types";

export const call = defineExpr<"call">({
  key: "call",
  category: "function",
  slots: [
    { name: "fn", role: "name", required: true },
    { name: "args", role: "exprs" },
  ],
  create: () => ({ id: newId(), kind: "call", fn: "", args: [] }),
  callee: (block) =>
    block.kind === "call"
      ? { name: block.fn, argc: block.args.length, family: "function" }
      : { name: "", argc: 0, family: "function" },
  *run(block, ctx) {
    const args: Value[] = [];
    for (const arg of block.args) args.push(yield* ctx.eval(arg));
    return yield* ctx.call(block.fn, args, block.id);
  },
  python: (block, ctx) => `${block.fn}(${block.args.map((arg) => ctx.expr(arg)).join(", ")})`,
  notation: () => "{fn}({args})",
});
