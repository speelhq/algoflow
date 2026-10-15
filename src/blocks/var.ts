// The `var` block: reading a variable emits no event; storing one emits its `write`.
import { newId } from "@/lang/id";
import { defineExpr } from "./types";

export const variable = defineExpr<"var">({
  key: "var",
  category: "basic",
  slots: [{ name: "name", role: "id", required: true }],
  create: () => ({ id: newId(), kind: "var", name: "" }),
  *run(node, ctx) {
    return ctx.get(node.name, node.id);
  },
  *store(node, value, ctx, at) {
    ctx.set(node.name, value);
    yield { type: "write", nodeId: at, ref: { var: node.name }, value };
  },
  python: (node) => node.name,
  notation: () => "{name}",
});
