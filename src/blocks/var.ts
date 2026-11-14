// The `var` block definition: reading a variable emits no event; as a target its place is the variable.
// Every variable of a program is made from its name by `createVariable()` (`blocks.md`, Expressions).
import { createNodeId } from "@/lang/id";
import type { Expr, Name } from "@/lang/types";
import { defineExpr } from "./types";

/**
 * The variable named `name`. Throws for `""`, which `migrate()` rejects, a caller's error; any
 * other name that breaks the identifier rules is `validate()`'s to report (`E_BAD_NAME`).
 */
export function createVariable(name: Name): Extract<Expr, { type: "var" }> {
  if (name === "") throw new Error("no variable can be named with no text");
  return { id: createNodeId(), type: "var", name };
}

export const variable = defineExpr<"var">({
  key: "var",
  category: "basic",
  slots: [{ name: "name", role: "name" }],
  // Nothing calls it: a variable is made only from its name, by `createVariable()`.
  create: () => ({ id: createNodeId(), type: "var", name: "" }),
  *run(block, ctx) {
    return (yield* ctx.read(block, block.id)).value;
  },
  *locate(block) {
    return { var: block.name };
  },
  python: (block) => block.name,
  notation: () => "{name}",
});
