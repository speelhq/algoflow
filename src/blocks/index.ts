// The `index` block: `nums[i]`, one item of a list found by its position, its `read` event, and
// as a target its `write`.
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
    // Python evaluates the list before the position.
    const value = yield* ctx.eval(node.list);
    const position = yield* ctx.eval(node.index);
    const { ref, items } = asList(value, node.id, ctx, position);
    const i = listIndex(items, position, node.id, ctx);
    yield { type: "read", nodeId: node.id, refs: [{ heap: ref, index: i }] };
    return items[i] ?? { t: "none" };
  },
  *store(node, value, ctx, at) {
    // Python evaluates the list before the position.
    const listValue = yield* ctx.eval(node.list);
    const position = yield* ctx.eval(node.index);
    const list = asList(listValue, at, ctx, position);
    const i = listIndex(list.items, position, at, ctx);
    list.items[i] = value;
    yield { type: "write", nodeId: at, ref: { heap: list.ref, index: i }, value };
  },
  python: (node, ctx) => `${ctx.slot(node, "list")}[${ctx.slot(node, "index")}]`,
  notation: () => "{list}[{index}]",
  menu: [{ name: "", group: "items", on: ["list"], keys: "[" }],
});
