// What an empty expression slot holds. Never in the block menu;
// validate reports E_EMPTY_SLOT before anything runs.
import { newId } from "@/lang/id";
import type { Expr, Value } from "@/lang/types";
import type { Event } from "@/runtime/types";
import { defineExpr } from "./types";

/** A new empty expression slot's value, as every block's `create()` and the editor make one. */
export function emptyExpr(): Extract<Expr, { kind: "empty" }> {
  return { id: newId(), kind: "empty" };
}

export const empty = defineExpr<"empty">({
  key: "empty",
  category: "basic",
  hidden: true,
  slots: [],
  create: emptyExpr,
  run(block): Generator<Event, Value, void> {
    throw new Error(`empty slot ${block.id} cannot run`);
  },
  python: () => "...",
  notation: () => "…",
});
