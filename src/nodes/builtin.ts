// Shared shape of the builtin call blocks (03-nodes "Builtin calls"): key `call:<name>`,
// one `args` slot, positional parameters, exact arity (L-28).
import { newId } from "@/lang/id";
import type { Expr, Value } from "@/lang/types";
import { defineExpr, type NodeDef, type RunContext } from "./types";
import type { Category } from "./categories";

export type BuiltinDef = {
  name: string;
  category: Category;
  params: string[];
  /** Emitted callee, e.g. `random.randint`; defaults to `name`. */
  python?: string;
  aliases?: string[];
  imports?: "math" | "random";
  evaluate(args: Value[], node: Extract<Expr, { kind: "call" }>, ctx: RunContext): Value;
};

export function defineBuiltin(def: BuiltinDef): NodeDef {
  const callee = def.python ?? def.name;
  return defineExpr<"call">({
    key: `call:${def.name}`,
    category: def.category,
    slots: [{ name: "args", role: "exprs", required: true }],
    params: def.params,
    callee: (node) => ({
      name: def.name,
      argc: node.kind === "call" ? node.args.length : 0,
      family: "builtin",
    }),
    ...(def.aliases ? { aliases: def.aliases } : {}),
    ...(def.imports ? { imports: def.imports } : {}),
    create: () => ({
      id: newId(),
      kind: "call",
      fn: def.name,
      args: def.params.map(() => ({ id: newId(), kind: "empty" })),
    }),
    *run(node, ctx) {
      if (node.args.length !== def.params.length) {
        ctx.fail(node.id, "E_ARITY", {
          name: def.name,
          expected: def.params.length,
          got: node.args.length,
        });
      }
      const values: Value[] = [];
      for (const arg of node.args) values.push(yield* ctx.eval(arg));
      return def.evaluate(values, node, ctx);
    },
    python: (node, ctx) => `${callee}(${node.args.map((arg) => ctx.expr(arg)).join(", ")})`,
  });
}
