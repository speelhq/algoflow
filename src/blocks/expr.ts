// The `expr` block definition: an expression evaluated for its effect (method statements wrap one).
import { createNodeId } from "@/lang/id";
import { defineStmt } from "./types";
import { createEmptyDraft } from "./draft";

export const exprStmt = defineStmt<"expr">({
  key: "expr",
  category: "basic",
  // The menu offers it only as method statements and calls.
  hidden: true,
  slots: [{ name: "expr", role: "expr", hint: "expression" }],
  create: () => ({ id: createNodeId(), type: "expr", expr: createEmptyDraft() }),
  *run(block, ctx) {
    yield* ctx.eval(block.expr);
    return undefined;
  },
  python: (block, ctx) => [ctx.expr(block.expr)],
  notation: () => "{expr}",
});
