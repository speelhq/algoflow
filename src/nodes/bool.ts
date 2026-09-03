// 03-nodes `bool`
import { newId } from "@/lang/id";
import { defineExpr } from "./types";

export const bool = defineExpr<"bool">({
  key: "bool",
  category: "basic",
  slots: [],
  create: () => ({ id: newId(), kind: "bool", value: true }),
  *run(node) {
    return { t: "bool", v: node.value };
  },
  python: (node) => (node.value ? "True" : "False"),
});
