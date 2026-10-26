// The builtin `abs`
import { isNumber, makeNumber } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

export const abs = defineBuiltin({
  name: "abs",
  category: "basic",
  params: [{ name: "x" }],
  kind: () => "number",
  menu: [{ name: "", group: "calculate", on: ["number"] }],
  evaluate([x = { t: "none" }], block, ctx) {
    if (!isNumber(x)) return ctx.valueError(block, x);
    return makeNumber(Math.abs(x.v), x.t === "float");
  },
});
