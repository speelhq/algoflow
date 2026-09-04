// 03-nodes `num`: L-08 raw is the source text; float when raw has `.`, `e`, or `E`.
import { newId } from "@/lang/id";
import { defineExpr } from "./types";

export const num = defineExpr<"num">({
  key: "num",
  category: "basic",
  slots: [{ name: "value", role: "text", required: true }],
  create: () => ({ id: newId(), kind: "num", value: 0, float: false, raw: "0" }),
  zeroLike: (node) => ({
    id: newId(),
    kind: "num",
    value: 0,
    float: node.kind === "num" && node.float,
    raw: node.kind === "num" && node.float ? "0.0" : "0",
  }),
  *run(node) {
    return node.float ? { t: "float", v: node.value } : { t: "int", v: node.value };
  },
  python: (node) => node.raw,
});
