// The entries of the value list as the blocks declare them: each with its block, its
// label and help, and how it makes its expression. Reads `menu` and `create()`, never a kind.
import { exprKind, type Kinds } from "@/lang/kinds";
import type { Expr } from "@/lang/types";
import { childSlots } from "@/lang/walk";
import { BLOCKS, getBlock, keyOf, type BlockDef } from "@/blocks/registry";
import type { MenuEntry, MenuGroup } from "@/blocks/types";
import { blockText } from "@/i18n/t";
import { isCall } from "@/ui/chart/text";

export type Entry = {
  /** `<key>` or `<key>.<name>`. */
  id: string;
  def: BlockDef;
  menu: MenuEntry;
  label: string;
  help: string;
  /** Its block is a call, typed where a value is expected as the chart writes it (`abs(x)`). */
  call: boolean;
};

const base = (def: BlockDef, menu: MenuEntry) =>
  menu.name === "" ? def.key : `${def.key}.${menu.name}`;

// The preset is copied, so no expression shares a value with the menu.
const made = (def: BlockDef, menu: MenuEntry): Expr => ({
  ...(def.create() as Expr),
  ...structuredClone(menu.preset),
});

let cached: Entry[] | undefined;

/** Every entry of the registered blocks, in registry order (the order of the value list). */
export function allEntries(): Entry[] {
  cached ??= [...BLOCKS.values()].flatMap((def) =>
    (def.menu ?? []).map((menu) => ({
      id: base(def, menu),
      def,
      menu,
      label: blockText(base(def, menu), "label"),
      help: blockText(base(def, menu), "help"),
      call: isCall(made(def, menu)),
    })),
  );
  return cached;
}

/** Whether the entry is offered after a value, which it takes as its first input. */
export function takesValue(entry: Entry): boolean {
  return entry.menu.on !== undefined;
}

/** The entry's expression: its block's `create()` with the entry's preset. */
export function makeEntry(entry: Entry): Expr {
  return made(entry.def, entry.menu);
}

/**
 * The entry an expression was made from: its block's entry whose preset it holds, compared as
 * data (`Empty list` presets no item), and of those the one offered after the kind of its first
 * input (`Join with another list` for `+` after a list); `kinds` are the variables' kinds.
 */
export function entryOf(expr: Expr, kinds: Kinds): Entry | undefined {
  const bag = expr as unknown as Record<string, unknown>;
  const key = keyOf(expr);
  const held = allEntries().filter(
    (entry) =>
      entry.def.key === key &&
      Object.entries(entry.menu.preset ?? {}).every(
        ([slot, value]) => JSON.stringify(bag[slot]) === JSON.stringify(value),
      ),
  );
  const first = childSlots(expr)[0]?.expr;
  const kind = first ? exprKind(first, kinds) : undefined;
  return held.find((entry) => kind !== undefined && entry.menu.on?.includes(kind)) ?? held[0];
}

/** The label of what an expression is: its entry's, else its block's. */
export function labelOf(expr: Expr, kinds: Kinds): string {
  return entryOf(expr, kinds)?.label ?? blockText(getBlock(keyOf(expr)).key, "label");
}

export const GROUPS: readonly MenuGroup[] = [
  "values",
  "conditions",
  "calculate",
  "items",
  "compare",
  "convert",
];
