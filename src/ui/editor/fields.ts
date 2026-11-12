// The fields of a statement's notation in the block editor: each value or target slot, and each
// item of a list of values, in the notation's reading order.
import { blockText, t } from "@/i18n/t";
import { draftValue } from "@/lang/drafts";
import type { Expr, NodeId, Stmt } from "@/lang/types";
import { draftText, isExpr } from "@/lang/walk";
import { draftOf, emptyDraft, getBlockDef, keyOf, findSlot, type Slot } from "@/blocks/registry";
import { unparse } from "@/python/emit";
import {
  generatedNotation,
  placeholderValue,
  notationTokens,
  slotHint,
  type NotationToken,
} from "@/ui/chart/text";

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
  const slot = findSlot(stmt, field.slot);
  return slot?.role === "target" ? slot : undefined;
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

/** A field's text on one line: a line break becomes a space (`language.md`, Captions). */
export function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ");
}

/**
 * The text a field shows for its value: a draft's text as typed, or the value as the emitter
 * writes it (`editor.md`, Value line).
 */
export function fieldText(value: Expr): string {
  return draftText(value) ?? unparse(value);
}

/**
 * The value that a field's text writes (`editor.md`, Value line): the value it parses as, which a
 * target's line keeps only when it is a target, or else the text as a draft. No text is an empty
 * slot.
 */
export function textValue(text: string, target: boolean): Expr {
  if (text === "") return emptyDraft();
  const read = draftValue(target ? "target" : "expr", text);
  return "value" in read && !Array.isArray(read.value) ? read.value : draftOf(text);
}

/** The word an optional slot's field shows while it has no text, the same in every locale. */
const OPTIONAL = "optional";

/**
 * What a field shows while it has no text: its slot's hint, or `optional` for an optional slot
 * (`editor.md`, Value line, Empty slots).
 */
export function fieldHint(stmt: Stmt, field: Field): string {
  const slot = findSlot(stmt, field.slot);
  return slot?.role === "expr" && slot.optional ? OPTIONAL : slotHint(stmt, field.slot);
}

/** The expression a value field holds. */
export function valueOf(stmt: Stmt, field: Field): Expr | undefined {
  const value = (stmt as unknown as Bag)[field.slot];
  const item =
    field.index === undefined ? value : Array.isArray(value) ? value[field.index] : undefined;
  return isExpr(item) ? item : undefined;
}

/**
 * The field that takes the keyboard when the editor opens (`editor.md`, Block editor): the slot
 * clicked on the chart node (the item that is the empty slot clicked, when one was), else the first
 * field that holds a draft, else none.
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
        return value !== undefined && draftText(value) !== undefined;
      }) ?? null
    );
  }
  const inSlot = fields.filter((field) => field.slot === slot);
  const holding =
    emptyId === null ? undefined : inSlot.find((field) => valueOf(stmt, field)?.id === emptyId);
  return holding ?? inSlot[0] ?? null;
}
