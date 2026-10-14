// The `assign` block: `<target> = <value>` and its `write` event; a target may be an
// item or an entry.
import { newId } from "@/lang/id";
import { asDict, dictKeyOf, itemAt } from "@/runtime/access";
import { defineStmt } from "./types";
import { emptyExpr } from "./empty";

export const assign = defineStmt<"assign">({
  key: "assign",
  category: "basic",
  slots: [
    { name: "target", role: "target", required: true },
    { name: "value", role: "expr", required: true },
  ],
  create: () => ({
    id: newId(),
    kind: "assign",
    target: { kind: "var", name: "" },
    value: emptyExpr(),
  }),
  *run(node, ctx) {
    const value = yield* ctx.eval(node.value);
    const target = node.target;
    switch (target.kind) {
      case "var":
        ctx.set(target.name, value);
        yield { type: "write", nodeId: node.id, ref: { var: target.name }, value };
        return undefined;
      case "index": {
        const { ref, items, at } = yield* itemAt(target.list, target.index, node.id, ctx);
        items[at] = value;
        yield { type: "write", nodeId: node.id, ref: { heap: ref, index: at }, value };
        return undefined;
      }
      case "key": {
        const dictValue = yield* ctx.eval(target.dict);
        const key = yield* ctx.eval(target.key);
        const dict = asDict(dictValue, node.id, ctx, key);
        const encoded = dictKeyOf(key, node.id, ctx);
        dict.entries.set(encoded, value);
        yield { type: "write", nodeId: node.id, ref: { heap: dict.ref, key: encoded }, value };
        return undefined;
      }
    }
  },
  python: (node, ctx) => [`${ctx.target(node.target)} = ${ctx.expr(node.value)}`],
  // The first value and every later one alike: Python has no form of its own for the first.
  notation: () => "{target} ← {value}",
});
