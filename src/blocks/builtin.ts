// Shared shape of the builtin call blocks (blocks.md "Builtin calls"): key `call:<name>`,
// one `args` slot, positional parameters, the argument counts of `expectedArgs`, and the
// name Python gives it, which the notation writes and a value line takes as its keys; one of
// a module is called through the module in Python (`random.randint`) and imports it.
import { newId } from "@/lang/id";
import type { Expr, Kind, Value } from "@/lang/types";
import {
  builtinKey,
  defineExpr,
  expectedArgs,
  type ValueEntry,
  type BlockDef,
  type Param,
  type RunContext,
} from "./types";
import type { Category } from "./categories";
import { emptyDraft } from "./draft";

export type BuiltinDef = {
  name: string;
  category: Category;
  params: Param[];
  /** The module Python calls it through (`random.randint`), which the emitted file imports. */
  module?: "random";
  /** The call's kind, given its arguments. */
  yields?: (args: Expr[], findKind: (expr: Expr) => Kind | undefined) => Kind | undefined;
  entries?: readonly ValueEntry[];
  evaluate(args: Value[], block: Extract<Expr, { type: "call" }>, ctx: RunContext): Value;
};

export function defineBuiltin(def: BuiltinDef): BlockDef {
  const callee = def.module ? `${def.module}.${def.name}` : def.name;
  return defineExpr<"call">({
    key: builtinKey(def.name),
    category: def.category,
    slots: [{ name: "args", role: "exprs" }],
    params: def.params,
    callee: (block) => ({
      name: def.name,
      argc: block.type === "call" ? block.args.length : 0,
      family: "builtin",
    }),
    ...(def.module ? { aliases: [callee], imports: def.module } : {}),
    ...(def.entries
      ? { entries: def.entries.map((entry) => ({ ...entry, typed: def.name })) }
      : {}),
    ...(def.yields ? { yields: (block, findKind) => def.yields?.(block.args, findKind) } : {}),
    create: () => ({
      id: newId(),
      type: "call",
      fn: def.name,
      args: def.params.filter((param) => !param.optional).map(() => emptyDraft()),
    }),
    *run(block, ctx) {
      // Validation reports a wrong count before any run, as it does for a program function.
      const expected = expectedArgs(def.params, block.args.length);
      if (expected !== undefined)
        throw new Error(`${def.name} takes ${expected} arguments, given ${block.args.length}`);
      const values: Value[] = [];
      for (const arg of block.args) values.push(yield* ctx.eval(arg));
      return def.evaluate(values, block, ctx);
    },
    python: (block, ctx) => `${callee}(${block.args.map((arg) => ctx.expr(arg)).join(", ")})`,
    notation: (block) => {
      // An optional parameter is written only when its argument is given.
      const given = def.params.filter((param, i) => !param.optional || i < block.args.length);
      return `${def.name}(${given.map((param) => `{${param.name}}`).join(", ")})`;
    },
  });
}
