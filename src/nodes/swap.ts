// The `swap` block: `<list>[<i>], <list>[<j>] = <list>[<j>], <list>[<i>]`, the exchange of two
// items of a list, and its `swap` event.
import { newId } from "@/lang/id";
import { itemAt } from "@/runtime/access";
import type { Event } from "@/runtime/types";
import { defineStmt } from "./types";
import { emptyExpr } from "./empty";

export const swap = defineStmt<"swap">({
  key: "swap",
  category: "list",
  slots: [
    { name: "list", role: "expr", required: true, atom: true },
    { name: "i", role: "expr", required: true },
    { name: "j", role: "expr", required: true },
  ],
  create: () => ({ id: newId(), kind: "swap", list: emptyExpr(), i: emptyExpr(), j: emptyExpr() }),
  *run(node, ctx): Generator<Event, undefined, void> {
    // As the Python line: the item at `j`, then the one at `i`, is read when found; then they are
    // written at `i` and at `j`, each place found again.
    const atJ = yield* itemAt(node.list, node.j, node.id, ctx);
    const fromJ = atJ.items[atJ.at] ?? { t: "none" };
    const atI = yield* itemAt(node.list, node.i, node.id, ctx);
    const fromI = atI.items[atI.at] ?? { t: "none" };
    const a = yield* itemAt(node.list, node.i, node.id, ctx);
    a.items[a.at] = fromJ;
    const b = yield* itemAt(node.list, node.j, node.id, ctx);
    b.items[b.at] = fromI;
    yield {
      type: "swap",
      nodeId: node.id,
      a: { heap: a.ref, index: a.at },
      b: { heap: b.ref, index: b.at },
    };
    return undefined;
  },
  python: (node, ctx) => {
    const list = ctx.slot(node, "list");
    const [i, j] = [ctx.slot(node, "i"), ctx.slot(node, "j")];
    return [`${list}[${i}], ${list}[${j}] = ${list}[${j}], ${list}[${i}]`];
  },
  // A call of its own, which names the two items it exchanges (`nodes.md`, Node text).
  notation: () => "swap({list}[{i}], {list}[{j}])",
});
