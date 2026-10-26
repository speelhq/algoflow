// The builtin `randint` of `random`: an int drawn from mulberry32, both bounds included.
import { typeName } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

export const randomInt = defineBuiltin({
  name: "randint",
  category: "basic",
  params: [{ name: "a" }, { name: "b" }],
  kind: () => "number",
  menu: [{ name: "", group: "calculate" }],
  module: "random",
  evaluate([a = { t: "none" }, b = { t: "none" }], block, ctx) {
    if (a.t !== "int" || b.t !== "int") {
      return ctx.fail(block.id, "E_TYPE", {
        left: typeName(a),
        right: typeName(b),
      });
    }
    // CPython raises ValueError("empty range") when a > b.
    if (a.v > b.v) return ctx.fail(block.id, "E_EMPTY_RANGE", { a: a.v, b: b.v });
    return { t: "int", v: ctx.random.int(a.v, b.v) };
  },
});
