// The `str` block: emitted double-quoted, with escapes.
import { newId } from "@/lang/id";
import { pyString } from "@/python/strings";
import { defineExpr } from "./types";

export const str = defineExpr<"str">({
  key: "str",
  category: "basic",
  slots: [{ name: "value", role: "text" }],
  create: () => ({ id: newId(), kind: "str", value: "" }),
  fieldsError: (fields) =>
    typeof fields.value === "string" ? undefined : { field: "value", message: "expected a text" },
  zeroLike: () => ({ id: newId(), kind: "str", value: "" }),
  *run(block) {
    return { t: "str", v: block.value };
  },
  python: (block) => pyString(block.value),
  notation: () => '"{value}"',
  kind: () => "text",
  menu: [{ name: "", group: "values" }],
});
