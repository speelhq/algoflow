// The `var` block: reading a variable emits no event; as a target its place is the variable.
import { newId } from "@/lang/id";
import { defineExpr } from "./types";

export const variable = defineExpr<"var">({
  key: "var",
  category: "basic",
  slots: [{ name: "name", role: "id", required: true }],
  create: () => ({ id: newId(), kind: "var", name: "" }),
  *run(node, ctx) {
    return (yield* ctx.read(node, node.id)).value;
  },
  *locate(node) {
    return { var: node.name };
  },
  python: (node) => node.name,
  notation: () => "{name}",
});
