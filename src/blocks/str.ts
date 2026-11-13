// The `str` block definition: emitted double-quoted, with escapes.
import { createNodeId } from "@/lang/id";
import { pyString } from "@/python/strings";
import { defineExpr } from "./types";

export const str = defineExpr<"str">({
  key: "str",
  category: "basic",
  slots: [{ name: "value", role: "literal" }],
  create: () => ({ id: createNodeId(), type: "str", value: "" }),
  fieldsError: (fields) =>
    typeof fields.value === "string" ? undefined : { field: "value", message: "expected a text" },
  createZero: () => ({ id: createNodeId(), type: "str", value: "" }),
  *run(block) {
    return { t: "str", v: block.value };
  },
  python: (block) => pyString(block.value),
  notation: () => '"{value}"',
  yields: () => "text",
  entries: [{ name: "", group: "values" }],
});
