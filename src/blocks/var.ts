// The `var` block definition: reading a variable emits no event; as a target its place is the variable.
import { createNodeId } from "@/lang/id";
import { defineExpr } from "./types";

export const variable = defineExpr<"var">({
  key: "var",
  category: "basic",
  slots: [{ name: "name", role: "name" }],
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
