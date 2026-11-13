// The entries of the value list as the blocks declare them: each with its block, its
// label and help, and how it makes its expression. Reads `entries` and `create()`, never a type.
import { exprKind, type Kinds } from "@/lang/kinds";
import type { Expr } from "@/lang/types";
import { childSlots } from "@/lang/walk";
import { BLOCK_DEFS, getBlockDef, registryKey, type BlockDef } from "@/blocks/registry";
import type { ValueEntry, ValueGroup } from "@/blocks/types";
import { blockText } from "@/i18n/t";
import { isCall } from "@/ui/chart/text";

export type Entry = {
  /** `<key>` or `<key>.<name>`. */
  id: string;
  def: BlockDef;
  declared: ValueEntry;
  label: string;
  help: string;
  /** Its block is a call, typed where a value is expected as the chart writes it (`abs(x)`). */
  call: boolean;
};

const base = (def: BlockDef, declared: ValueEntry) =>
  declared.name === "" ? def.key : `${def.key}.${declared.name}`;

// The preset is copied, so no expression shares a value with the block definition.
const made = (def: BlockDef, declared: ValueEntry): Expr => ({
  ...(def.create() as Expr),
  ...structuredClone(declared.preset),
});

let cached: Entry[] | undefined;

/** Every entry of the registered block definitions, in registry order (the order of the value list). */
export function allEntries(): Entry[] {
  cached ??= [...BLOCK_DEFS.values()].flatMap((def) =>
    (def.entries ?? []).map((declared) => ({
      id: base(def, declared),
      def,
      declared,
      label: blockText(base(def, declared), "label"),
      help: blockText(base(def, declared), "help"),
      call: isCall(made(def, declared)),
    })),
  );
  return cached;
}

/**
 * The slot an expression takes a value into when it is chosen after one: its first `expr` slot or
 * `exprs` slot, in the order its block definition lists them.
 */
export function firstSlot(expr: Expr) {
  return getBlockDef(registryKey(expr)).slots.find(
    (slot) => slot.role === "expr" || slot.role === "exprs",
  );
}

/** Whether the entry is offered after a value, which it takes as the first expression it holds. */
export function takesValue(entry: Entry): boolean {
  return entry.declared.on !== undefined;
}

/** The entry's expression: its block's `create()` with the entry's preset. */
export function makeEntry(entry: Entry): Expr {
  return made(entry.def, entry.declared);
}

/**
 * The entry an expression was made from: its block's entry whose preset it holds, compared as
 * data (`Empty list` presets no item), and of those the one offered after the kind of the first
 * expression it holds (`Join with another list` for `+` after a list); `kinds` are the
 * variables' kinds.
 */
function findEntry(expr: Expr, kinds: Kinds): Entry | undefined {
  const bag = expr as unknown as Record<string, unknown>;
  const key = registryKey(expr);
  const held = allEntries().filter(
    (entry) =>
      entry.def.key === key &&
      Object.entries(entry.declared.preset ?? {}).every(
        ([slot, value]) => JSON.stringify(bag[slot]) === JSON.stringify(value),
      ),
  );
  const first = childSlots(expr)[0]?.expr;
  const kind = first ? exprKind(first, kinds) : undefined;
  return held.find((entry) => kind !== undefined && entry.declared.on?.includes(kind)) ?? held[0];
}

/** The label of what an expression is: its entry's, else its block's. */
export function exprLabel(expr: Expr, kinds: Kinds): string {
  return findEntry(expr, kinds)?.label ?? blockText(getBlockDef(registryKey(expr)).key, "label");
}

export const GROUPS: readonly ValueGroup[] = [
  "values",
  "conditions",
  "calculate",
  "items",
  "compare",
  "convert",
];
