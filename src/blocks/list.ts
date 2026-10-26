// The `list` block definition: `[a, b]`, its items evaluated in order into a new list on the heap.
import { alloc } from "@/lang/data";
import { newId } from "@/lang/id";
import type { Value } from "@/lang/types";
import { defineExpr } from "./types";

const empty = () => ({ id: newId(), kind: "list" as const, items: [] });

export const list = defineExpr<"list">({
  key: "list",
  category: "list",
  // A list with no item is a value of its own (`Empty list`), so its items are not required.
  slots: [{ name: "items", role: "exprs" }],
  create: empty,
  zeroLike: empty,
  *run(block, ctx) {
    const items: Value[] = [];
    for (const item of block.items) items.push(yield* ctx.eval(item));
    return { t: "list", ref: alloc(ctx.heap, { kind: "list", items }) };
  },
  python: (block, ctx) => `[${block.items.map((item) => ctx.expr(item)).join(", ")}]`,
  notation: () => "[{items}]",
  kind: () => "list",
  // `Empty list` names only a list with no item; one with items is named `List`.
  menu: [{ name: "empty", group: "values", keys: "[", preset: { items: [] } }],
});
