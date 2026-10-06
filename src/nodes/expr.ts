// The `expr` block: an expression evaluated for its effect (method statements wrap one).
import { newId } from "@/lang/id";
import { defineStmt } from "./types";

export const exprStmt = defineStmt<"expr">({
  key: "expr",
  category: "basic",
  slots: [{ name: "expr", role: "expr", required: true }],
  create: () => ({ id: newId(), kind: "expr", expr: { id: newId(), kind: "empty" } }),
  *run(node, ctx) {
    yield* ctx.eval(node.expr);
    return undefined;
  },
  python: (node, ctx) => [ctx.expr(node.expr)],
});
