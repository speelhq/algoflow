// The `for` block: bounds evaluated once, ints only; a `loop` event per iteration.
import { newId } from "@/lang/id";
import type { Expr } from "@/lang/types";
import { typeName } from "@/runtime/values";
import { defineStmt, type Counted } from "./types";
import { emptyExpr } from "./empty";

const isZero = (expr: Expr) => expr.kind === "num" && !expr.float && expr.value === 0;

/** The generated nodes in the order a `for` runs them, written in the notation. */
const COUNTED: Counted = {
  body: "body",
  init: "{var} ← {start}",
  check: "{var} < {stop}",
  update: "{var} ← {var} + 1",
};

export const forStmt = defineStmt<"for">({
  key: "for",
  category: "control",
  loop: true,
  chart: { counted: COUNTED },
  declares: "number",
  slots: [
    { name: "var", role: "name", required: true },
    { name: "start", role: "expr", required: true },
    { name: "stop", role: "expr", required: true },
    { name: "body", role: "body" },
  ],
  create: () => ({
    id: newId(),
    kind: "for",
    var: "",
    start: { id: newId(), kind: "num", value: 0, float: false, raw: "0" },
    stop: emptyExpr(),
    body: [],
  }),
  *run(block, ctx) {
    const start = yield* ctx.eval(block.start);
    const stop = yield* ctx.eval(block.stop);
    if (start.t !== "int" || stop.t !== "int") {
      return ctx.fail(block.id, "E_TYPE", {
        left: typeName(start),
        right: typeName(stop),
      });
    }
    for (let i = start.v; i < stop.v; i += 1) {
      const value = { t: "int", v: i } as const;
      ctx.save({ var: block.var }, value);
      yield { type: "loop", nodeId: block.id, var: block.var, value };
      const signal = yield* ctx.exec(block.body);
      if (signal?.kind === "break") break;
      if (signal?.kind === "return") return signal;
    }
    return undefined;
  },
  python: (block, ctx) => [
    `for ${block.var} in range(${isZero(block.start) ? "" : `${ctx.expr(block.start)}, `}${ctx.expr(block.stop)}):`,
    ctx.region(block.body),
  ],
  // Its init names it in the block menu and the editor.
  notation: () => COUNTED.init,
});
