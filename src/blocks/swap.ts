// The `swap` block definition: `<a>, <b> = <b>, <a>`, run in Python's order, each `write` carrying the place
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
  *run(block, ctx) {
    // Python reads `b` then `a`, then finds `a` again and writes it, then `b`.
    const second = yield* ctx.read(block.b, block.id);
    const first = yield* ctx.read(block.a, block.id);
    for (const [target, read] of [
      [block.a, second],
      [block.b, first],
    ] as const) {
      const ref = yield* ctx.locate(target, block.id);
      ctx.save(ref, read.value);
      yield { type: "write", nodeId: block.id, ref, value: read.value, from: read.ref };
    }
    return undefined;
  },
  python: (block, ctx) => {
    const [a, b] = [ctx.expr(block.a), ctx.expr(block.b)];
    return [`${a}, ${b} = ${b}, ${a}`];
  },
  notation: () => "swap({a}, {b})",
});
