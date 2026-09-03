// L-09: the placeholder in an unfilled required slot. Never in the palette;
// validate reports E_EMPTY_SLOT before anything runs.
import { newId } from "@/lang/id";
import type { Value } from "@/lang/types";
import type { Event } from "@/runtime/types";
import { defineExpr } from "./types";

export const empty = defineExpr<"empty">({
  key: "empty",
  category: "basic",
  hidden: true,
  slots: [],
  create: () => ({ id: newId(), kind: "empty" }),
  run(node): Generator<Event, Value, void> {
    throw new Error(`empty slot ${node.id} cannot run`);
  },
  python: () => "...",
});
