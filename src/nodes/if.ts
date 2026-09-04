// 03-nodes `if`: `if <cond>:` … `else:` (else omitted when empty; empty region → pass).
import { newId } from "@/lang/id";
import { truthy } from "@/runtime/values";
import { defineStmt } from "./types";

export const ifStmt = defineStmt<"if">({
  key: "if",
  category: "control",
  slots: [
    { name: "cond", role: "expr", required: true },
    { name: "then", role: "body", labelled: true },
    { name: "else", role: "body", labelled: true },
  ],
  create: () => ({
    id: newId(),
    kind: "if",
    cond: { id: newId(), kind: "empty" },
    then: [],
    else: [],
  }),
  *run(node, ctx) {
    const cond = yield* ctx.eval(node.cond);
    return yield* ctx.exec(truthy(cond, ctx.heap) ? node.then : node.else);
  },
  python: (node, ctx) => [
    `if ${ctx.expr(node.cond)}:`,
    ctx.block(node.then),
    ...(node.else.length > 0 ? ["else:", ctx.block(node.else)] : []),
  ],
});
