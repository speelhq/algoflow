// The builtin `len`: how many items a list or a dict holds, or characters a text holds.
import type { HeapEntry } from "@/lang/types";
import { entryOf } from "@/runtime/values";
import { defineBuiltin } from "./builtin";

const countOf = (entry: HeapEntry): number =>
  entry.kind === "list" ? entry.items.length : entry.entries.size;

export const len = defineBuiltin({
  name: "len",
  category: "list",
  params: [{ name: "a" }],
  kind: () => "number",
  menu: [{ name: "", group: "items", on: ["list", "text", "dict"] }],
  evaluate([a = { t: "none" }], block, ctx) {
    switch (a.t) {
      case "str":
        // oxlint-disable-next-line no-misused-spread -- Python counts code points, as the spread does
        return { t: "int", v: [...a.v].length };
      case "list":
      case "dict":
        return { t: "int", v: countOf(entryOf(ctx.heap, a.ref)) };
      default:
        return ctx.valueError(block, a);
    }
  },
});
