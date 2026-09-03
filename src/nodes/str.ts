// 03-nodes `str`: E-06 double-quoted with escapes.
import { newId } from "@/lang/id";
import { pyString } from "@/python/emit";
import { defineExpr } from "./types";

export const str = defineExpr<"str">({
  key: "str",
  category: "basic",
  slots: [{ name: "value", role: "text" }],
  create: () => ({ id: newId(), kind: "str", value: "" }),
  *run(node) {
    return { t: "str", v: node.value };
  },
  python: (node) => pyString(node.value),
});
