// A place in the state, as a `Ref`: the value there, its write, and whether two refs name one
// place. Read and written by the ref's variant, not by the block that found it.
import type { Heap, Id, Value } from "@/lang/types";
import type { Ref } from "./types";
import { entryOf } from "./values";

/** The value at `ref`, a variable read in `vars`; undefined when the place holds none. */
export function valueAt(ref: Ref, vars: ReadonlyMap<Id, Value>, heap: Heap): Value | undefined {
  if ("var" in ref) return vars.get(ref.var);
  const entry = heap.get(ref.heap);
  if ("index" in ref) return entry?.kind === "list" ? entry.items[ref.index] : undefined;
  return entry?.kind === "dict" ? entry.entries.get(ref.key) : undefined;
}

/** Writes `value` at `ref`, a variable in `vars`. */
export function setValueAt(ref: Ref, value: Value, vars: Map<Id, Value>, heap: Heap): void {
  if ("var" in ref) {
    vars.set(ref.var, value);
    return;
  }
  const entry = entryOf(heap, ref.heap);
  if ("index" in ref && entry.kind === "list") entry.items[ref.index] = value;
  else if ("key" in ref && entry.kind === "dict") entry.entries.set(ref.key, value);
  else throw new Error(`ref does not fit heap entry ${ref.heap}`);
}

export function sameRef(a: Ref, b: Ref): boolean {
  if ("var" in a || "var" in b) return "var" in a && "var" in b && a.var === b.var;
  if (a.heap !== b.heap) return false;
  if ("index" in a) return "index" in b && a.index === b.index;
  return "key" in b && a.key === b.key;
}
