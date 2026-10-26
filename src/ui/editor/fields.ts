// The fields of a statement's notation in the block editor: each name slot, each value or target
// slot, and each item of a list of values, in the notation's reading order.
import { blockText, t } from "@/i18n/t";
import type { Expr, NodeId, Stmt } from "@/lang/types";
import { allExprs, isEmptyExpr, isExpr } from "@/lang/walk";
import { getBlockDef, keyOf, type Slot } from "@/blocks/registry";
import {
  generatedNotation,
  placeholderValue,
  SEPARATOR,
  templatePieces,
  type Piece,
} from "@/ui/chart/text";
import { find } from "./line";

/** One editable slot of the notation: a name, a value or a target, or an item of a list of values. */
export type Field = { slot: string; role: "name" | "expr"; index?: number };

export const fieldKey = (field: Field) => `${field.slot}:${field.index ?? ""}`;

type Bag = Record<string, unknown>;

export const sameField = (a: Field | null, b: Field | null) =>
  a !== null && b !== null && fieldKey(a) === fieldKey(b);

/** The name in a `name` slot. */
export function nameOf(stmt: Stmt, slot: string): string | undefined {
  const value = (stmt as unknown as Bag)[slot];
  return typeof value === "string" ? value : undefined;
}

/** The target slot a field edits, which its line keeps a target in (`editor.md`, Targets). */
export function targetSlot(stmt: Stmt, field: Field): Slot | undefined {
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
  const pieces = editedLines(stmt)
    .flat()
    .map(({ piece }) => piece);
  const at = pieces.findIndex((piece) => "name" in piece && piece.name === field.slot);
  const next = pieces[at + 1];
  return at >= 0 && next && "words" in next ? next.words.trim() : "";
}

/**
 * The lines the editor shows, each as its pieces: a counted loop's init and check (`i ← 1`,
 * `i < n + 1?`), else the block's notation. `again` marks a slot written before, which is drawn
 * as its value rather than as a field.
 */
export function editedLines(stmt: Stmt): { piece: Piece; again: boolean }[][] {
  const init = generatedNotation(stmt, "init");
  const check = generatedNotation(stmt, "check");
  const notations =
    init !== undefined && check !== undefined
      ? [init, check]
      : [getBlockDef(keyOf(stmt)).notation(stmt)];
  const seen = new Set<string>();
  return notations.map((notation) =>
    templatePieces(notation).map((piece) => {
      const again = "name" in piece && seen.has(piece.name);
      if ("name" in piece) seen.add(piece.name);
      return { piece, again };
    }),
  );
}

/** The fields of the notation, in its reading order. */
export function fieldsOf(stmt: Stmt): Field[] {
  const out: Field[] = [];
  for (const { piece, again } of editedLines(stmt).flat()) {
    if ("words" in piece || again) continue;
    const held = placeholderValue(stmt, piece.name);
    const slot = piece.name;
    if (held?.role === "name") out.push({ slot, role: "name" });
    else if (held?.role === "expr" && held.expr) out.push({ slot, role: "expr" });
    else if (held?.role === "exprs") {
      held.items.forEach((_, index) => out.push({ slot, role: "expr", index }));
    }
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

/** Whether a field still has something to fill: an empty name or an input at any depth. */
function toFill(stmt: Stmt, field: Field): boolean {
  if (field.role === "name") return nameOf(stmt, field.slot) === "";
  const value = valueOf(stmt, field);
  return value !== undefined && [...allExprs(value)].some(isEmptyExpr);
}

/**
 * The field that takes the keyboard when the editor opens: the slot clicked on the chart node (the
 * item holding the input clicked, when one was), else the first field still to fill, else none.
 */
export function startField(
  stmt: Stmt,
  fields: readonly Field[],
  clicked: { slot: string | null; hole: NodeId | null },
): Field | null {
  const { slot, hole } = clicked;
  if (slot === null) return fields.find((field) => toFill(stmt, field)) ?? null;
  const inSlot = fields.filter((field) => field.slot === slot);
  const holding =
    hole === null
      ? undefined
      : inSlot.find((field) => {
          const value = valueOf(stmt, field);
          return value !== undefined && find(value, hole) !== undefined;
        });
  return holding ?? inSlot[0] ?? null;
}
