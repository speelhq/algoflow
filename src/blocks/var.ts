// The `var` block: reading a variable emits no event; as a target its place is the variable.
import { newId } from "@/lang/id";
import { defineExpr } from "./types";

export const variable = defineExpr<"var">({
  key: "var",
  category: "basic",
  slots: [{ name: "name", role: "name", required: true }],
  create: () => ({ id: newId(), kind: "var", name: "" }),
  *run(block, ctx) {
    return (yield* ctx.read(block, block.id)).value;
  },
  *locate(block) {
    return { var: block.name };
  },
  python: (block) => block.name,
  notation: () => "{name}",
});
