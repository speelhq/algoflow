// Shared shape of the builtin call blocks (nodes.md "Builtin calls"): key `call:<name>`,
// one `args` slot, positional parameters, the argument counts of `expectedArgs`, and the
// name Python gives it, which the notation writes and a value line takes as its keys; one of
// a module is called through the module in Python (`random.randint`) and imports it.
import { newId } from "@/lang/id";
import type { Expr, Kind, Value } from "@/lang/types";
import {
  builtinKey,
  defineExpr,
  expectedArgs,
  type MenuEntry,
  type NodeDef,
  type Param,
  type RunContext,
} from "./types";
import type { Category } from "./categories";
import { emptyExpr } from "./empty";

export type BuiltinDef = {
  name: string;
  category: Category;
  params: Param[];
  /** The module Python calls it through (`random.randint`), which the emitted file imports. */
  module?: "random";
  /** The call's kind, given its arguments. */
  kind?: (args: Expr[], kindOf: (expr: Expr) => Kind | undefined) => Kind | undefined;
  menu?: readonly MenuEntry[];
  evaluate(args: Value[], node: Extract<Expr, { kind: "call" }>, ctx: RunContext): Value;
};

export function defineBuiltin(def: BuiltinDef): NodeDef {
  const callee = def.module ? `${def.module}.${def.name}` : def.name;
  return defineExpr<"call">({
    key: builtinKey(def.name),
    category: def.category,
    slots: [{ name: "args", role: "exprs", required: true }],
    params: def.params,
    callee: (node) => ({
      name: def.name,
      argc: node.kind === "call" ? node.args.length : 0,
      family: "builtin",
    }),
    ...(def.module ? { aliases: [callee], imports: def.module } : {}),
    ...(def.menu ? { menu: def.menu.map((entry) => ({ ...entry, keys: def.name })) } : {}),
    ...(def.kind ? { kind: (node, kindOf) => def.kind?.(node.args, kindOf) } : {}),
    create: () => ({
      id: newId(),
      kind: "call",
      fn: def.name,
      args: def.params.filter((param) => !param.optional).map(() => emptyExpr()),
    }),
    *run(node, ctx) {
      // Validation reports a wrong count before any run, as it does for a program function.
      const expected = expectedArgs(def.params, node.args.length);
      if (expected !== undefined)
        throw new Error(`${def.name} takes ${expected} arguments, given ${node.args.length}`);
      const values: Value[] = [];
      for (const arg of node.args) values.push(yield* ctx.eval(arg));
      return def.evaluate(values, node, ctx);
    },
    python: (node, ctx) => `${callee}(${node.args.map((arg) => ctx.expr(arg)).join(", ")})`,
    notation: (node) => {
      // An optional parameter is written only when its argument is given.
      const given = def.params.filter((param, i) => !param.optional || i < node.args.length);
      return `${def.name}(${given.map((param) => `{${param.name}}`).join(", ")})`;
    },
  });
}
