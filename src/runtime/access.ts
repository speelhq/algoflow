// Element access shared by the blocks that read or write
// list items and dict entries.
import { dictKey } from "@/lang/data";
import type { Expr, HeapId, NodeId, Value } from "@/lang/types";
import type { RunContext } from "@/nodes/types";
import type { Event } from "./types";
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

/**
 * An item of a list as Python finds it, the list evaluated before the position: the list's ref,
 * its items, and the position checked (`E_TYPE`, `E_INDEX`).
 */
export function* itemAt(
  list: Expr,
  position: Expr,
  nodeId: NodeId,
  ctx: RunContext,
): Generator<Event, { ref: HeapId; items: Value[]; at: number }, void> {
  const value = yield* ctx.eval(list);
  const index = yield* ctx.eval(position);
  const { ref, items } = asList(value, nodeId, ctx, index);
  return { ref, items, at: listIndex(items, index, nodeId, ctx) };
}

export function asDict(
  dict: Value,
  nodeId: NodeId,
  ctx: RunContext,
  other: Value,
): { ref: HeapId; entries: Map<string, Value> } {
  if (dict.t !== "dict") {
    return ctx.fail(nodeId, "E_TYPE", {
      left: typeName(dict),
      right: typeName(other),
    });
  }
  const entry = entryOf(ctx.heap, dict.ref);
  if (entry.kind !== "dict") throw new Error("dict ref is not a dict");
  return { ref: dict.ref, entries: entry.entries };
}

/** Keys are int or str. */
export function dictKeyOf(key: Value, nodeId: NodeId, ctx: RunContext): string {
  const encoded = dictKey(key);
  if (encoded === undefined) {
    return ctx.fail(nodeId, "E_TYPE", { left: "dict", right: typeName(key) });
  }
  return encoded;
}
