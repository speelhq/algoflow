// 03-nodes builtin `max`: two values ordered per L-15.
import { isNumber, typeName } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

export const max = defineBuiltin({
  name: "max",
  category: "basic",
  params: ["a", "b"],
  evaluate([a = { t: "none" }, b = { t: "none" }], node, ctx) {
    if (isNumber(a) && isNumber(b)) return b.v > a.v ? b : a;
    if (a.t === "str" && b.t === "str") return b.v > a.v ? b : a;
    return ctx.fail(node.id, "E_TYPE", {
      left: typeName(a, ctx.heap),
      right: typeName(b, ctx.heap),
    });
  },
});
