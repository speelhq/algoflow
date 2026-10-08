// The `str` block: emitted double-quoted, with escapes.
import { newId } from "@/lang/id";
import { pyString } from "@/python/emit";
import { defineExpr } from "./types";

export const str = defineExpr<"str">({
  key: "str",
  category: "basic",
  slots: [{ name: "value", role: "text" }],
  create: () => ({ id: newId(), kind: "str", value: "" }),
  zeroLike: () => ({ id: newId(), kind: "str", value: "" }),
  *run(node) {
    return { t: "str", v: node.value };
  },
  kind: () => "text",
  menu: [{ name: "", group: "values" }],
  python: (node) => pyString(node.value),
});
