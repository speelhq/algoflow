// The fields of a statement's notation in the block editor: each value or target slot, and each
// item of a list of values, in the notation's reading order.
import { blockText, t } from "@/i18n/t";
import type { Expr, NodeId, Stmt } from "@/lang/types";
import { holdsEmptySlot, isExpr } from "@/lang/walk";
import { getBlockDef, keyOf, type Slot } from "@/blocks/registry";
import {
  generatedNotation,
  placeholderValue,
  SEPARATOR,
  notationTokens,
  type NotationToken,
} from "@/ui/chart/text";
import { find } from "./line";

/** One editable slot of the notation: a value or a target, or an item of a list of values. */
export type Field = { slot: string; index?: number };

export const fieldKey = (field: Field) => `${field.slot}:${field.index ?? ""}`;

type Bag = Record<string, unknown>;

export const sameField = (a: Field | null, b: Field | null) =>
  a !== null && b !== null && fieldKey(a) === fieldKey(b);

/** The target slot a field edits, which its line keeps a target in (`editor.md`, Targets). */
export function targetSlot(
  stmt: Stmt,
  field: Field,
): Extract<Slot, { role: "target" }> | undefined {
  const slot = getBlockDef(keyOf(stmt)).slots.find((each) => each.name === field.slot);
  return slot?.role === "target" ? slot : undefined;
}

/**
 * The words the notation writes right after a field (`)` after the last value of `print(…)`),
 * which a key that begins them, typed after the field's value, moves on from (`editor.md`,
 * Backspace and keys).
 */
export function wordsAfter(stmt: Stmt, field: Field): string {
  // After an item of a list of values other than its last, the notation writes their separator.
  const items = (stmt as unknown as Bag)[field.slot];
  if (field.index !== undefined && Array.isArray(items) && field.index < items.length - 1) {
    return SEPARATOR.trim();
  }
  const tokens = editedLines(stmt)
    .flat()
    .map(({ token }) => token);
  const at = tokens.findIndex(
    (token) => "placeholder" in token && token.placeholder === field.slot,
  );
  const next = tokens[at + 1];
  return at >= 0 && next && "text" in next ? next.text.trim() : "";
}

/**
 * The lines the editor shows, each as its tokens: a counted loop's init and check (`i ← 1`,
 * `i < n + 1?`), else the block's notation. `again` marks a slot written before, which is drawn
 * as its value rather than as a field.
 */
export function editedLines(stmt: Stmt): { token: NotationToken; again: boolean }[][] {
  const init = generatedNotation(stmt, "init");
  const check = generatedNotation(stmt, "check");
  const notations =
    init !== undefined && check !== undefined
      ? [init, check]
      : [getBlockDef(keyOf(stmt)).notation(stmt)];
  const seen = new Set<string>();
  return notations.map((notation) =>
    notationTokens(notation).map((token) => {
      const again = "placeholder" in token && seen.has(token.placeholder);
      if ("placeholder" in token) seen.add(token.placeholder);
      return { token, again };
    }),
  );
}

/** The fields of the notation, in its reading order. */
export function fieldsOf(stmt: Stmt): Field[] {
  const out: Field[] = [];
  for (const { token, again } of editedLines(stmt).flat()) {
    if ("text" in token || again) continue;
    const held = placeholderValue(stmt, token.placeholder);
    const slot = token.placeholder;
    if (held?.role === "expr" && held.expr) out.push({ slot });
    else if (held?.role === "exprs") held.items.forEach((_, index) => out.push({ slot, index }));
  }
  return out;
}

/** A field's accessible name: the block's label and the slot's name (`Set variable, value`). */
export function fieldLabel(stmt: Stmt, field: Field): string {
  const { key } = getBlockDef(keyOf(stmt));
  return t("editor.fieldName", {
    label: blockText(key, "label"),
    slot: blockText(key, `slot.${field.slot}`),
  });
}

/** The expression a value field holds. */
export function valueOf(stmt: Stmt, field: Field): Expr | undefined {
  const value = (stmt as unknown as Bag)[field.slot];
  const item =
    field.index === undefined ? value : Array.isArray(value) ? value[field.index] : undefined;
  return isExpr(item) ? item : undefined;
}

/**
 * The field that takes the keyboard when the editor opens: the slot clicked on the chart node (the
 * item holding the empty slot clicked, when one was), else the first field that holds an empty
 * slot, else none.
 */
export function startField(
  stmt: Stmt,
  fields: readonly Field[],
  clicked: { slot: string | null; emptyId: NodeId | null },
): Field | null {
  const { slot, emptyId } = clicked;
  if (slot === null) {
    return (
      fields.find((field) => {
        const value = valueOf(stmt, field);
        return value !== undefined && holdsEmptySlot(value);
      }) ?? null
    );
  }
  const inSlot = fields.filter((field) => field.slot === slot);
  const holding =
    emptyId === null
      ? undefined
      : inSlot.find((field) => {
          const value = valueOf(stmt, field);
          return value !== undefined && find(value, emptyId) !== undefined;
        });
  return holding ?? inSlot[0] ?? null;
}
