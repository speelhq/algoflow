// The `while` block definition: a `loop` event after the compare of each iteration.
import { newId } from "@/lang/id";
import { decide } from "@/runtime/condition";
import { defineStmt } from "./types";
import { emptyExpr } from "./empty";

export const whileStmt = defineStmt<"while">({
  key: "while",
  category: "control",
  loop: true,
  chart: { check: { cond: "cond", body: "body" } },
  slots: [
    { name: "cond", role: "expr", required: true },
    { name: "body", role: "body" },
  ],
  create: () => ({ id: newId(), kind: "while", cond: emptyExpr(), body: [] }),
  *run(block, ctx) {
    for (;;) {
      if (!(yield* decide(block.cond, ctx))) break;
      yield { type: "loop", nodeId: block.id };
      const signal = yield* ctx.exec(block.body);
      if (signal?.kind === "break") break;
      if (signal?.kind === "return") return signal;
    }
    return undefined;
  },
  python: (block, ctx) => [`while ${ctx.expr(block.cond)}:`, ctx.region(block.body)],
  notation: () => "{cond}",
});
