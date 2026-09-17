// 03-nodes `for`: L-25 bounds evaluated once, int only; R-07 loop event per iteration.
import { newId } from "@/lang/id";
import type { Expr } from "@/lang/types";
import { typeName } from "@/runtime/values";
import { defineStmt } from "./types";

const isZero = (expr: Expr) => expr.kind === "num" && !expr.float && expr.value === 0;

export const forStmt = defineStmt<"for">({
  key: "for",
  category: "control",
  loop: true,
  chart: { counted: "body" },
  slots: [
    { name: "var", role: "id", required: true },
    { name: "start", role: "expr", required: true },
    { name: "stop", role: "expr", required: true },
    { name: "body", role: "body" },
  ],
  create: () => ({
    id: newId(),
    kind: "for",
    var: "",
    start: { id: newId(), kind: "num", value: 0, float: false, raw: "0" },
    stop: { id: newId(), kind: "empty" },
    body: [],
  }),
  *run(node, ctx) {
    const start = yield* ctx.eval(node.start);
    const stop = yield* ctx.eval(node.stop);
    if (start.t !== "int" || stop.t !== "int") {
      return ctx.fail(node.id, "E_TYPE", {
        left: typeName(start, ctx.heap),
        right: typeName(stop, ctx.heap),
      });
    }
    for (let i = start.v; i < stop.v; i += 1) {
      const value = { t: "int", v: i } as const;
      ctx.set(node.var, value);
      yield { type: "loop", nodeId: node.id, var: node.var, value };
      const signal = yield* ctx.exec(node.body);
      if (signal?.kind === "break") break;
      if (signal?.kind === "return") return signal;
    }
    return undefined;
  },
  python: (node, ctx) => [
    `for ${node.var} in range(${isZero(node.start) ? "" : `${ctx.expr(node.start)}, `}${ctx.expr(node.stop)}):`,
    ctx.block(node.body),
  ],
});
