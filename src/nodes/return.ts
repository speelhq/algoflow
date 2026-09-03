// 03-nodes `return`: `return <value>` / `return`; no value → None (L-28).
import { newId } from "@/lang/id";
import { defineStmt } from "./types";

export const returnStmt = defineStmt<"return">({
  key: "return",
  category: "function",
  requires: "function",
  slots: [{ name: "value", role: "expr" }],
  create: () => ({ id: newId(), kind: "return" }),
  *run(node, ctx) {
    const value = node.value ? yield* ctx.eval(node.value) : { t: "none" as const };
    return { kind: "return", value };
  },
  python: (node, ctx) => [node.value ? `return ${ctx.expr(node.value)}` : "return"],
});
