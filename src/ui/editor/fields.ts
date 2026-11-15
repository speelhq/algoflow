// The fields of a statement's notation in the block editor: each value, target, or values slot,
// edited as one text, in the notation's reading order.
import { blockText, t } from "@/i18n/t";
import { parseSlotText } from "@/lang/drafts";
import type { Expr, Stmt } from "@/lang/types";
import { draftText, isExpr, type ExprRole } from "@/lang/walk";
import {
  createDraft,
  createEmptyDraft,
  getBlockDef,
  isNamedSlot,
  registryKey,
  findSlot,
  type Slot,
  blockNotation,
} from "@/blocks/registry";
import { unparse } from "@/python/emit";
import {
  generatedNotation,
  notationTokens,
  SEPARATOR,
  slotHint,
  type NotationToken,
} from "@/ui/chart/text";

/**
 * One field of the lines: a slot of a statement, edited as one text (`editor.md`, Block editor),
 * whose role says how its text is read; `optional` as its slot declares it, which then holds no
 * value while the field has no text.
 */
export type Field = { slot: string; role: ExprRole; optional?: true };

/** What a field holds: a value or a target, or the items of an `exprs` slot. */
export type FieldValue = Expr | Expr[];

type Bag = Record<string, unknown>;

export const isSameField = (a: Field | null, b: Field | null) =>
  a !== null && b !== null && a.slot === b.slot;

/**
 * The field `step` on from `field` in the notation's reading order, which Tab and Shift+Tab move
 * to (`editor.md`, Block editor), or undefined past either end.
 */
export function fieldBeside(
  fields: readonly Field[],
  field: Field,
  step: 1 | -1,
): Field | undefined {
  const at = fields.findIndex((each) => isSameField(each, field));
  return at < 0 ? undefined : fields[at + step];
}

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
 * `i < n + 1?`), else the block's notation. `drawn` marks a slot drawn as its value rather than
 * as a field: one whose variable the application names (`editor.md`, Block editor).
 */
export function editedLines(stmt: Stmt): { token: NotationToken; drawn: boolean }[][] {
  const init = generatedNotation(stmt, "init");
  const check = generatedNotation(stmt, "check");
  const notations =
    init !== undefined && check !== undefined ? [init, check] : [blockNotation(stmt)];
  return notations.map((notation) =>
    notationTokens(notation).map((token) => {
      const slot = "placeholder" in token ? findSlot(stmt, token.placeholder) : undefined;
      return { token, drawn: slot !== undefined && isNamedSlot(slot) };
    }),
  );
}

/**
 * The fields of the lines, in their reading order, an optional slot's whether it holds a value or
 * not (`editor.md`, Block editor).
 */
export function stmtFields(stmt: Stmt): Field[] {
  const out: Field[] = [];
  for (const { token, drawn } of editedLines(stmt).flat()) {
    if ("text" in token || drawn) continue;
    const slot = findSlot(stmt, token.placeholder);
    if (slot?.role === "expr" && slot.optional)
      out.push({ slot: slot.name, role: "expr", optional: true });
    else if (slot?.role === "expr" || slot?.role === "target" || slot?.role === "exprs") {
      out.push({ slot: slot.name, role: slot.role });
    }
  }
  return out;
}

/** A field's accessible name: the block's label and the slot's name (`Set variable, value`). */
export function fieldLabel(stmt: Stmt, field: Field): string {
  const { key } = getBlockDef(registryKey(stmt));
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
 * writes it, an `exprs` slot's items separated by commas, and no text for an optional slot's no
 * value (`editor.md`, Value line).
 */
export function fieldText(value: FieldValue | null): string {
  if (value === null) return "";
  if (Array.isArray(value)) return value.map(fieldText).join(SEPARATOR);
  return draftText(value) ?? unparse(value);
}

/** The draft a field holds: its value, or the only item of an `exprs` slot, when it is one. */
export function fieldDraft(value: FieldValue | null): Expr | undefined {
  if (value === null) return undefined;
  return (Array.isArray(value) ? value : [value]).find((each) => draftText(each) !== undefined);
}

/**
 * The value that a field's text writes in a slot of `role` (`editor.md`, Value line): the value it
 * parses as, which a target's line keeps only when it is a target, or else the text as a draft. An
 * `exprs` slot's text parses as values separated by commas, and it holds the draft as its only
 * item (`language.md`, Expressions, Drafts). No text is an empty slot, or no item.
 */
export function parseFieldText(text: string, role: "exprs"): Expr[];
export function parseFieldText(text: string, role: "expr" | "target"): Expr;
export function parseFieldText(text: string, role: ExprRole): FieldValue;
export function parseFieldText(text: string, role: ExprRole): FieldValue {
  const read = parseSlotText(role, text);
  if (role === "exprs") {
    return "value" in read && Array.isArray(read.value) ? read.value : [createDraft(text)];
  }
  if (text === "") return createEmptyDraft();
  return "value" in read && !Array.isArray(read.value) ? read.value : createDraft(text);
}

/**
 * The value that a field's text writes (`parseFieldText`), or null, no value, for an optional
 * slot's field with no text (`editor.md`, Block editor).
 */
export function parseFieldValue(text: string, field: Field): FieldValue | null {
  return field.optional && text === "" ? null : parseFieldText(text, field.role);
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

/** What a field holds, or undefined while an optional slot holds no value. */
export function findFieldValue(stmt: Stmt, field: Field): FieldValue | undefined {
  const value = (stmt as unknown as Bag)[field.slot];
  if (field.role === "exprs") return Array.isArray(value) ? value.filter(isExpr) : undefined;
  return isExpr(value) ? value : undefined;
}

/**
 * The field that takes the keyboard when the editor opens (`editor.md`, Block editor): the slot
 * clicked on the chart node; else the first field that holds a draft; else, in a block that the
 * block menu has just inserted, its first field; else none.
 */
export function startField(
  stmt: Stmt,
  fields: readonly Field[],
  clicked: string | null,
  inserted: boolean,
): Field | null {
  if (clicked !== null) return fields.find((field) => field.slot === clicked) ?? null;
  const draft = fields.find((field) => {
    const value = findFieldValue(stmt, field);
    return value !== undefined && fieldDraft(value) !== undefined;
  });
  return draft ?? (inserted ? (fields[0] ?? null) : null);
}
