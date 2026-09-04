// 03-nodes builtin `random_int`: L-32 inclusive int draw from mulberry32; N-05 imports random.
import { typeName } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

export const randomInt = defineBuiltin({
  name: "random_int",
  category: "basic",
  params: ["a", "b"],
  python: "random.randint",
  aliases: ["random.randint"],
  imports: "random",
  evaluate([a = { t: "none" }, b = { t: "none" }], node, ctx) {
    if (a.t !== "int" || b.t !== "int") {
      return ctx.fail(node.id, "E_TYPE", {
        left: typeName(a, ctx.heap),
        right: typeName(b, ctx.heap),
      });
    }
    // CPython raises ValueError("empty range") when a > b.
    if (a.v > b.v) return ctx.fail(node.id, "E_TYPE", { left: a.v, right: b.v });
    return { t: "int", v: ctx.random.int(a.v, b.v) };
  },
});
