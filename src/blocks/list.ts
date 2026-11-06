// The `list` block definition: `[a, b]`, its items evaluated in order into a new list on the heap.
import { alloc } from "@/lang/data";
import { newId } from "@/lang/id";
import type { Value } from "@/lang/types";
import { defineExpr } from "./types";

const empty = () => ({ id: newId(), type: "list" as const, items: [] });

export const list = defineExpr<"list">({
  key: "list",
  category: "list",
  slots: [{ name: "items", role: "exprs" }],
  create: empty,
  zeroLike: empty,
  *run(block, ctx) {
    const items: Value[] = [];
    for (const item of block.items) items.push(yield* ctx.eval(item));
    return { t: "list", ref: alloc(ctx.heap, { type: "list", items }) };
  },
  python: (block, ctx) => `[${block.items.map((item) => ctx.expr(item)).join(", ")}]`,
  notation: () => "[{items}]",
  yields: () => "list",
  // `Empty list` names only a list with no item, which `[` then `]` types; one with items is
  // named `List`.
  entries: [{ name: "empty", group: "values", typed: "[]", preset: { items: [] } }],
});
