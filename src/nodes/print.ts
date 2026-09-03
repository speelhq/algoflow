// 03-nodes `print`: L-29 joins `str()` forms with one space; R-03 print event then the effect.
import { newId } from "@/lang/id";
import type { Value } from "@/lang/types";
import { str } from "@/runtime/values";
import { defineStmt } from "./types";

export const print = defineStmt<"print">({
  key: "print",
  category: "basic",
  slots: [{ name: "args", role: "exprs" }],
  create: () => ({ id: newId(), kind: "print", args: [{ id: newId(), kind: "empty" }] }),
  *run(node, ctx) {
    const values: Value[] = [];
    for (const arg of node.args) values.push(yield* ctx.eval(arg));
    const text = values.map((value) => str(value, ctx.heap)).join(" ");
    yield { type: "print", nodeId: node.id, text };
    ctx.print(text);
    return undefined;
  },
  python: (node, ctx) => [`print(${node.args.map((arg) => ctx.expr(arg)).join(", ")})`],
});
