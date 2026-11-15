// The `for` block definition: bounds evaluated once, ints only; at each pass the value stored at
// its target's place, found again, and a `loop` event that carries the place. The application
// names its variable (`blocks.md`, Slots).
import { createNodeId } from "@/lang/id";
import type { Expr, Name } from "@/lang/types";
import { typeError } from "@/runtime/access";
import { defineStmt, type Counted } from "./types";
import { createEmptyDraft } from "./draft";
import { createVariable } from "./var";

const isZero = (expr: Expr) => expr.type === "num" && !expr.float && expr.value === 0;

/** The names of a `for`'s variable: `i`, `j`, `k`, and the letters after `k`. */
const NAMES: readonly [Name, ...Name[]] = [
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
];

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
    { name: "var", role: "target", hint: "variable", binds: true, names: NAMES },
    { name: "start", role: "expr", hint: "start" },
    { name: "stop", role: "expr", hint: "stop" },
    { name: "body", role: "body" },
  ],
  create: () => ({
    id: createNodeId(),
    type: "for",
    var: createVariable(NAMES[0]),
    start: { id: createNodeId(), type: "num", value: 0, float: false, raw: "0" },
    stop: createEmptyDraft(),
    body: [],
  }),
  *run(block, ctx) {
    const start = yield* ctx.eval(block.start);
    const stop = yield* ctx.eval(block.stop);
    if (start.t !== "int" || stop.t !== "int") return typeError(block.id, start, stop, ctx);
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
