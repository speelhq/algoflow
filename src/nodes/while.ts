// 03-nodes `while`: R-07 loop event after the compare of each iteration.
import { newId } from "@/lang/id";
import { truthy } from "@/runtime/values";
import { defineStmt } from "./types";

export const whileStmt = defineStmt<"while">({
  key: "while",
  category: "control",
  loop: true,
  slots: [
    { name: "cond", role: "expr", required: true },
    { name: "body", role: "body" },
  ],
  create: () => ({ id: newId(), kind: "while", cond: { id: newId(), kind: "empty" }, body: [] }),
  *run(node, ctx) {
    for (;;) {
      const cond = yield* ctx.eval(node.cond);
      if (!truthy(cond, ctx.heap)) break;
      yield { type: "loop", nodeId: node.id };
      const signal = yield* ctx.exec(node.body);
      if (signal?.kind === "break") break;
      if (signal?.kind === "return") return signal;
    }
    return undefined;
  },
  python: (node, ctx) => [`while ${ctx.expr(node.cond)}:`, ctx.block(node.body)],
});
