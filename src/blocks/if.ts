// The `if` block: `if <cond>:` … `else:` (else omitted when empty; empty region → pass).
import { newId } from "@/lang/id";
import { decide } from "@/runtime/condition";
import { defineStmt } from "./types";
import { emptyExpr } from "./empty";

export const ifStmt = defineStmt<"if">({
  key: "if",
  category: "control",
  chart: { branch: { cond: "cond", yes: "then", no: "else" } },
  slots: [
    { name: "cond", role: "expr", required: true },
    { name: "then", role: "body" },
    { name: "else", role: "body" },
  ],
  create: () => ({
    id: newId(),
    kind: "if",
    cond: emptyExpr(),
    then: [],
    else: [],
  }),
  *run(block, ctx) {
    const yes = yield* decide(block.cond, ctx);
    return yield* ctx.exec(yes ? block.then : block.else);
  },
  python: (block, ctx) => [
    `if ${ctx.expr(block.cond)}:`,
    ctx.region(block.then),
    ...(block.else.length > 0 ? ["else:", ctx.region(block.else)] : []),
  ],
  notation: () => "{cond}",
});
