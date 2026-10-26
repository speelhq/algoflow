// The `assign` block: `<target> = <value>`; the value is stored at its target's place.
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
  *run(block, ctx) {
    const value = yield* ctx.eval(block.value);
    yield* ctx.store(block.target, value, block.id);
    return undefined;
  },
  python: (block, ctx) => [`${ctx.expr(block.target)} = ${ctx.expr(block.value)}`],
  // The first value and every later one alike: Python has no form of its own for the first.
  notation: () => "{target} ← {value}",
});
