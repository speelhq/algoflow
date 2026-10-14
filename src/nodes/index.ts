// The `index` block: `nums[i]`, one item of a list found by its position, and its `read` event.
import { newId } from "@/lang/id";
import { PRECEDENCE } from "@/python/precedence";
import { asList, listIndex } from "@/runtime/access";
import { defineExpr } from "./types";
import { emptyExpr } from "./empty";

export const index = defineExpr<"index">({
  key: "index",
  category: "list",
  slots: [
    { name: "list", role: "expr", required: true },
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
  // The list binds as an atom: an operation before the brackets is put in parentheses.
  python: (node, ctx) =>
    `${ctx.operand(node.list, PRECEDENCE.atom, "left")}[${ctx.expr(node.index)}]`,
  notation: () => "{list}[{index}]",
  menu: [{ name: "", group: "items", on: ["list"] }],
});
