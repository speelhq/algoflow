// The `assign` block definition: `<target> = <value>`; the value is stored at its target's place.
// An assignment of a target and a value is made by `createAssignment()` (`blocks.md`, Statements).
import { createNodeId } from "@/lang/id";
import type { Expr, Stmt } from "@/lang/types";
import { defineStmt } from "./types";
import { createEmptyDraft } from "./draft";

/** The assignment that stores `value` at `target`. */
export function createAssignment(target: Expr, value: Expr): Extract<Stmt, { type: "assign" }> {
  return { id: createNodeId(), type: "assign", target, value };
}

export const assign = defineStmt<"assign">({
  key: "assign",
  category: "basic",
  slots: [
    { name: "target", role: "target", hint: "variable", binds: true, stores: "value" },
    { name: "value", role: "expr", hint: "value" },
  ],
  create: () => createAssignment(createEmptyDraft(), createEmptyDraft()),
  *run(block, ctx) {
    const value = yield* ctx.eval(block.value);
    yield* ctx.store(block.target, value, block.id);
    return undefined;
  },
  python: (block, ctx) => [`${ctx.expr(block.target)} = ${ctx.expr(block.value)}`],
  // The first value and every later one alike: Python has no form of its own for the first.
  notation: () => "{target} ← {value}",
});
