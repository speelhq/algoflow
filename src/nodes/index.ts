// The `index` block: `nums[i]`, one item of a list found by its position, and its `read` event.
import { newId } from "@/lang/id";
import { itemAt } from "@/runtime/access";
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
    const { ref, items, at } = yield* itemAt(node.list, node.index, node.id, ctx);
    yield { type: "read", nodeId: node.id, refs: [{ heap: ref, index: at }] };
    return items[at] ?? { t: "none" };
  },
  python: (node, ctx) => `${ctx.slot(node, "list")}[${ctx.slot(node, "index")}]`,
  notation: () => "{list}[{index}]",
  menu: [{ name: "", group: "items", on: ["list"], keys: "[" }],
});
