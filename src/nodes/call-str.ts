// The builtin `str`: a value's text form.
import { str as text } from "@/runtime/values";
import { defineBuiltin } from "./builtin";
import { ANY_KIND } from "./types";

export const strCall = defineBuiltin({
  name: "str",
  category: "basic",
  params: ["x"],
  menu: [{ name: "", group: "convert", on: ANY_KIND }],
  kind: () => "text",
  evaluate([x = { t: "none" }], _node, ctx) {
    return { t: "str", v: text(x, ctx.heap) };
  },
});
