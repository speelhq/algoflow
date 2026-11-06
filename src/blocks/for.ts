// The `for` block definition: bounds evaluated once, ints only; at each pass the value stored at
// its target's place, found again, and a `loop` event that carries the place.
import { newId } from "@/lang/id";
import type { Expr } from "@/lang/types";
import { typeName } from "@/runtime/values";
import { defineStmt, type Counted } from "./types";
import { emptyExpr } from "./empty";

const isZero = (expr: Expr) => expr.type === "num" && !expr.float && expr.value === 0;

/** The generated chart nodes in the order a `for` runs them, written in the notation. */
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
    { name: "var", role: "target", binds: true },
    { name: "start", role: "expr" },
    { name: "stop", role: "expr" },
    { name: "body", role: "body" },
  ],
  create: () => ({
    id: newId(),
    type: "for",
    var: emptyExpr(),
    start: { id: newId(), type: "num", value: 0, float: false, raw: "0" },
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
      // Python assigns its target at each pass, so the place is found again.
      const ref = yield* ctx.locate(block.var, block.id);
      ctx.save(ref, value);
      yield { type: "loop", nodeId: block.id, ref, value };
      const signal = yield* ctx.exec(block.body);
      if (signal?.type === "break") break;
      if (signal?.type === "return") return signal;
    }
    return undefined;
  },
  python: (block, ctx) => [
    `for ${ctx.expr(block.var)} in range(${isZero(block.start) ? "" : `${ctx.expr(block.start)}, `}${ctx.expr(block.stop)}):`,
    ctx.region(block.body),
  ],
  // Its init names it in the block menu and the editor.
  notation: () => COUNTED.init,
});
