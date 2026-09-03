// 03-nodes builtin `abs`
import { isNumber, makeNumber, typeName } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

export const abs = defineBuiltin({
  name: "abs",
  category: "basic",
  params: ["x"],
  evaluate([x = { t: "none" }], node, ctx) {
    if (!isNumber(x))
      return ctx.fail(node.id, "E_TYPE", { left: "abs", right: typeName(x, ctx.heap) });
    return makeNumber(Math.abs(x.v), x.t === "float");
  },
});
