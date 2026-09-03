// 03-nodes builtin `float`: numbers, numeric text, `True` → 1.0.
import { typeName } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

const NUMBER = /^\s*[+-]?(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)\s*$/;

export const floatCall = defineBuiltin({
  name: "float",
  category: "basic",
  params: ["x"],
  evaluate([x = { t: "none" }], node, ctx) {
    switch (x.t) {
      case "int":
      case "float":
        return { t: "float", v: x.v };
      case "bool":
        return { t: "float", v: x.v ? 1 : 0 };
      case "str":
        if (NUMBER.test(x.v)) return { t: "float", v: Number(x.v.trim()) };
        return ctx.fail(node.id, "E_TYPE", { left: "float", right: x.v });
      default:
        return ctx.fail(node.id, "E_TYPE", { left: "float", right: typeName(x, ctx.heap) });
    }
  },
});
