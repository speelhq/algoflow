// The `while` block definition: a `loop` event after the compare of each iteration.
import { createNodeId } from "@/lang/id";
import { decide } from "@/runtime/condition";
import { defineStmt } from "./types";
import { createEmptyDraft } from "./draft";

export const whileStmt = defineStmt<"while">({
  key: "while",
  category: "control",
  loop: true,
  chart: { checked: { cond: "cond", body: "body" } },
  slots: [
    { name: "cond", role: "expr", hint: "condition" },
    { name: "body", role: "body" },
  ],
  create: () => ({ id: createNodeId(), type: "while", cond: createEmptyDraft(), body: [] }),
  *run(block, ctx) {
    for (;;) {
      if (!(yield* decide(block.cond, ctx))) break;
      yield { type: "loop", nodeId: block.id };
      const signal = yield* ctx.exec(block.body);
      if (signal?.type === "break") break;
      if (signal?.type === "return") return signal;
    }
    return undefined;
  },
  python: (block, ctx) => [`while ${ctx.expr(block.cond)}:`, ctx.region(block.body)],
  notation: () => "{cond}",
});
