// The `index` block definition: `nums[i]`, one item of a list found by its position, read with its `read`
// event, and as a target its place.
import { newId } from "@/lang/id";
import { asList, listIndex } from "@/runtime/access";
import { defineExpr } from "./types";
import { emptyDraft } from "./draft";

export const index = defineExpr<"index">({
  key: "index",
  category: "list",
  slots: [
    { name: "list", role: "expr", atom: true },
    { name: "index", role: "expr" },
  ],
  create: () => ({ id: newId(), type: "index", list: emptyDraft(), index: emptyDraft() }),
  *run(block, ctx) {
    return (yield* ctx.read(block, block.id)).value;
  },
  *locate(block, ctx, at) {
    // Python evaluates the list before the position.
    const value = yield* ctx.eval(block.list);
    const position = yield* ctx.eval(block.index);
    const list = asList(value, at, ctx, position);
    return { heap: list.ref, index: listIndex(list.items, position, at, ctx) };
  },
  python: (block, ctx) => `${ctx.slot(block, "list")}[${ctx.slot(block, "index")}]`,
  notation: () => "{list}[{index}]",
  entries: [{ name: "", group: "items", on: ["list"], typed: "[" }],
});
