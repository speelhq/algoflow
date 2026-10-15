// The builtin `sum`: the total of a list's numbers, as CPython 3.12 adds them: ints exactly
// until the first float, then floats with Neumaier's compensation and ints added plainly.
import { asList, typeError } from "@/runtime/access";
import { isNumber, makeNumber, type NumberValue } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

export const sum = defineBuiltin({
  name: "sum",
  category: "list",
  params: [{ name: "a" }],
  kind: () => "number",
  menu: [{ name: "", group: "items", on: ["list"] }],
  evaluate([a = { t: "none" }], node, ctx) {
    if (a.t !== "list") return ctx.valueError(node, a);
    const { items } = asList(a, node.id, ctx, a);
    let total: NumberValue = { t: "int", v: 0 };
    let compensation = 0;
    for (const item of items) {
      if (!isNumber(item)) return typeError(node.id, total, item, ctx);
      if (total.t === "int") {
        total =
          item.t === "int"
            ? makeNumber(total.v + item.v, false)
            : { t: "float", v: total.v + item.v };
      } else if (item.t === "float") {
        const next: number = total.v + item.v;
        compensation +=
          Math.abs(total.v) >= Math.abs(item.v) ? total.v - next + item.v : item.v - next + total.v;
        total = { t: "float", v: next };
      } else {
        total = { t: "float", v: total.v + item.v };
      }
    }
    if (total.t === "float" && compensation !== 0 && Number.isFinite(compensation)) {
      return { t: "float", v: total.v + compensation };
    }
    return total;
  },
});
