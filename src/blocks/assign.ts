// The `assign` block: `<target> = <value>`; its target's block stores the value.
import { newId } from "@/lang/id";
import { defineStmt } from "./types";
import { emptyExpr } from "./empty";

export const assign = defineStmt<"assign">({
  key: "assign",
  category: "basic",
  slots: [
    { name: "target", role: "target", required: true, binds: true },
    { name: "value", role: "expr", required: true },
  ],
  create: () => ({ id: newId(), kind: "assign", target: emptyExpr(), value: emptyExpr() }),
  *run(node, ctx) {
    const value = yield* ctx.eval(node.value);
    yield* ctx.store(node.target, value, node.id);
    return undefined;
  },
  python: (node, ctx) => [`${ctx.expr(node.target)} = ${ctx.expr(node.value)}`],
  // The first value and every later one alike: Python has no form of its own for the first.
  notation: () => "{target} ← {value}",
});
