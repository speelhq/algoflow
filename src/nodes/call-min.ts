// The builtin `min`: the smaller of two numbers or texts.
import { typeError } from "@/runtime/access";
import { compare } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

export const min = defineBuiltin({
  name: "min",
  category: "basic",
  params: ["a", "b"],
  menu: [{ name: "", group: "functions" }],
  kind: ([a]) => a,
  evaluate([a = { t: "none" }, b = { t: "none" }], node, ctx) {
    const c = compare(a, b);
    if (c === undefined) return typeError(node.id, a, b, ctx);
    return c > 0 ? b : a;
  },
});
