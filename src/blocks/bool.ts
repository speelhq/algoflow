// The `bool` block definition
import { newId } from "@/lang/id";
import { defineExpr } from "./types";

export const bool = defineExpr<"bool">({
  key: "bool",
  category: "basic",
  slots: [],
  create: () => ({ id: newId(), kind: "bool", value: true }),
  fieldsError: (fields) =>
    typeof fields.value === "boolean"
      ? undefined
      : { field: "value", message: "expected true or false" },
  zeroLike: () => ({ id: newId(), kind: "bool", value: false }),
  *run(block) {
    return { t: "bool", v: block.value };
  },
  python: (block) => (block.value ? "True" : "False"),
  notation: (block) => (block.value ? "True" : "False"),
  kind: () => "truefalse",
  menu: [
    { name: "true", group: "values", preset: { value: true } },
    { name: "false", group: "values", preset: { value: false } },
  ],
});
