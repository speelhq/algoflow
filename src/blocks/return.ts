// The `return` block: `return <value>` / `return`; no value → None.
import { newId } from "@/lang/id";
import { defineStmt } from "./types";

export const returnStmt = defineStmt<"return">({
  key: "return",
  category: "function",
  requires: "function",
  slots: [{ name: "value", role: "expr" }],
  create: () => ({ id: newId(), kind: "return" }),
  *run(block, ctx) {
    const value = block.value ? yield* ctx.eval(block.value) : { t: "none" as const };
    return { kind: "return", value };
  },
  python: (block, ctx) => [block.value ? `return ${ctx.expr(block.value)}` : "return"],
  // With no value its slot draws nothing (`return`), and the editor offers `+ value` for it.
  notation: () => "return {value}",
});
