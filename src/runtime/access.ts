// Element access shared by the blocks that read or write list items.
import type { HeapId, NodeId, Value } from "@/lang/types";
import type { RunContext } from "@/blocks/types";
import { entryOf, typeName } from "./values";

/** `E_TYPE` with the operand type names. */
export function typeError(nodeId: NodeId, left: Value, right: Value, ctx: RunContext): never {
  return ctx.fail(nodeId, "E_TYPE", {
    left: typeName(left),
    right: typeName(right),
  });
}

export function asList(
  list: Value,
  nodeId: NodeId,
  ctx: RunContext,
  other: Value,
): { ref: HeapId; items: Value[] } {
  if (list.t !== "list") {
    return ctx.fail(nodeId, "E_TYPE", {
      left: typeName(list),
      right: typeName(other),
    });
  }
  const entry = entryOf(ctx.heap, list.ref);
  if (entry.kind !== "list") throw new Error("list ref is not a list");
  return { ref: list.ref, items: entry.items };
}

/** An int index, negative from the end; out of range → E_INDEX. */
export function listIndex(items: Value[], index: Value, nodeId: NodeId, ctx: RunContext): number {
  if (index.t !== "int") {
    return ctx.fail(nodeId, "E_TYPE", { left: "list", right: typeName(index) });
  }
  const i = index.v < 0 ? items.length + index.v : index.v;
  if (i < 0 || i >= items.length) {
    return ctx.fail(nodeId, "E_INDEX", { index: index.v, length: items.length });
  }
  return i;
}
