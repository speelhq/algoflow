// The `num` block definition: `raw` is the source text; float when raw has `.`, `e`, or `E`.
import { newId } from "@/lang/id";
import { numberLiteral } from "@/python/number";
import { makeNumber } from "@/runtime/values";
import { defineExpr } from "./types";

export const num = defineExpr<"num">({
  key: "num",
  category: "basic",
  slots: [{ name: "value", role: "text", required: true }],
  create: () => ({ id: newId(), kind: "num", value: 0, float: false, raw: "0" }),
  zeroLike: (block) => ({
    id: newId(),
    kind: "num",
    value: 0,
    float: block.kind === "num" && block.float,
    raw: block.kind === "num" && block.float ? "0.0" : "0",
  }),
  fieldsError: (fields) => {
    const literal = typeof fields.raw === "string" ? numberLiteral(fields.raw) : undefined;
    if (!literal) return { field: "raw", message: "expected a number literal within range" };
    if (literal.value !== fields.value) {
      return { field: "value", message: "expected the number raw writes" };
    }
    return literal.float === fields.float
      ? undefined
      : { field: "float", message: "expected whether raw writes a float" };
  },
  *run(block) {
    return makeNumber(block.value, block.float);
  },
  python: (block) => block.raw,
  notation: () => "{value}",
  text: (block) => block.raw, // the literal as typed
  kind: () => "number",
});
