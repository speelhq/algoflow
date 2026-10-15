// The `index` block: `nums[i]`, one item of a list found by its position, read with its `read`
// event, and as a target its place.
import { newId } from "@/lang/id";
import { asList, listIndex } from "@/runtime/access";
import { defineExpr } from "./types";
import { emptyExpr } from "./empty";

export const index = defineExpr<"index">({
  key: "index",
  category: "list",
  slots: [
    { name: "list", role: "expr", required: true, atom: true },
    { name: "index", role: "expr", required: true },
  ],
  create: () => ({ id: newId(), kind: "index", list: emptyExpr(), index: emptyExpr() }),
  *run(node, ctx) {
    return (yield* ctx.read(node, node.id)).value;
  },
  *locate(node, ctx, at) {
    // Python evaluates the list before the position.
    const value = yield* ctx.eval(node.list);
    const position = yield* ctx.eval(node.index);
    const list = asList(value, at, ctx, position);
    return { heap: list.ref, index: listIndex(list.items, position, at, ctx) };
  },
  python: (node, ctx) => `${ctx.slot(node, "list")}[${ctx.slot(node, "index")}]`,
  notation: () => "{list}[{index}]",
  menu: [{ name: "", group: "items", on: ["list"], keys: "[" }],
});
