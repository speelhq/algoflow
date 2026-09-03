// 03-nodes `var`: R-04 variable reads emit nothing.
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
  python: (node) => node.name,
});
