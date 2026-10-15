// The `swap` block: `<a>, <b> = <b>, <a>`, run in Python's order, each `write` carrying the place
// its value was read from, by which the driver shows an exchange as one step.
import { newId } from "@/lang/id";
import { defineStmt } from "./types";
import { emptyExpr } from "./empty";

export const swap = defineStmt<"swap">({
  key: "swap",
  category: "list",
  slots: [
    { name: "a", role: "target", required: true },
    { name: "b", role: "target", required: true },
  ],
  create: () => ({ id: newId(), kind: "swap", a: emptyExpr(), b: emptyExpr() }),
  *run(node, ctx) {
    // Python reads `b` then `a`, then finds `a` again and writes it, then `b`.
    const second = yield* ctx.read(node.b, node.id);
    const first = yield* ctx.read(node.a, node.id);
    for (const [target, read] of [
      [node.a, second],
      [node.b, first],
    ] as const) {
      const ref = yield* ctx.locate(target, node.id);
      ctx.save(ref, read.value);
      yield { type: "write", nodeId: node.id, ref, value: read.value, from: read.ref };
    }
    return undefined;
  },
  python: (node, ctx) => {
    const [a, b] = [ctx.expr(node.a), ctx.expr(node.b)];
    return [`${a}, ${b} = ${b}, ${a}`];
  },
  notation: () => "swap({a}, {b})",
});
