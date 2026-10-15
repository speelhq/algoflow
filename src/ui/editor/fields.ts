// The fields of a statement's notation in the node editor: each name slot, each value slot, and
// each item of a list of values, in the notation's reading order; a target holding an item is
// its list's name and a value for each of its other parts.
import { nodeText, t } from "@/i18n/t";
import { setExpr, setSlot } from "@/lang/edit";
import type { Expr, Id, Kind, NodeId, Program, Stmt } from "@/lang/types";
import { allExprs, childSlots, isEmptyExpr, isExpr, isTarget, variableOf } from "@/lang/walk";
import { getNode, keyOf, NODES } from "@/nodes/registry";
import {
  generatedNotation,
  notationOf,
  placeholderValue,
  SEPARATOR,
  templatePieces,
  type Piece,
} from "@/ui/chart/text";
import { find, variableExpr } from "./line";

/**
 * One editable slot of the notation: a name, a value, an item of a list of values, or a part of
 * a target holding an item (`part`, the position of `nums[i]`).
 */
export type Field = { slot: string; role: "id" | "target" | "expr"; index?: number; part?: string };

export const fieldKey = (field: Field) => `${field.slot}:${field.index ?? ""}:${field.part ?? ""}`;

type Bag = Record<string, unknown>;

/** A form of a target other than a variable, by its block's key: an item (`nums[…]`), a key. */
export type Form = string;

/** The blocks of a target; `formsFor` keeps those offered after a variable's value. */
const FORMS: readonly Form[] = [...NODES.values()]
  .filter((def) => def.store !== undefined)
  .map((def) => def.key);

/**
 * The forms a target can take for a variable of `kind` (`editor.md`, Name fields): those whose
 * block is registered and whose entry is offered after a value of that kind; none when the kind
 * cannot be told.
 */
export function formsFor(kind: Kind | undefined): Form[] {
  if (kind === undefined) return [];
  return FORMS.filter((form) =>
    (getNode(form).menu ?? []).some((entry) => entry.on?.includes(kind)),
  );
}

/** The form among `forms` whose entry a key inserts after a value (`[` for an item). */
export function formOfKey(forms: readonly Form[], key: string): Form | undefined {
  return forms.find((form) =>
    (getNode(form).menu ?? []).some((entry) => entry.on !== undefined && entry.keys === key),
  );
}

/** A target of `form` holding the variable `name`, its other parts still to fill. */
export function formTarget(form: Form, name: Id): Expr {
  const variable = variableExpr(name);
  const made = getNode(form).create() as Expr;
  const [held] = childSlots(made);
  if (!variable || !held) throw new Error(`${name} is no variable of a ${form}`);
  return { ...made, [held.slot]: variable };
}

/** Whether a target is edited as a name alone: a variable, or still to fill. */
export function isNamed(target: Expr): boolean {
  return isEmptyExpr(target) || variableOf(target) !== undefined;
}

/**
 * The part of a target holding an item that names its variable (`list` of `nums[i]`), when the
 * target can be edited: it is a target and that part is a variable.
 */
export function namePart(target: Expr): string | undefined {
  if (isNamed(target) || !isTarget(target)) return undefined;
  const [held] = childSlots(target);
  return held && variableOf(held.expr) !== undefined ? held.slot : undefined;
}

/**
 * The pieces an editable target holding an item is edited as: its notation (`{list}[{index}]`),
 * its `namePart` the name field; none for any other target.
 */
export function targetPieces(target: Expr): Piece[] {
  return namePart(target) === undefined ? [] : templatePieces(notationOf(target));
}

/** The variable a target names: itself, none yet (`""`), or the variable its `namePart` holds. */
function targetName(target: Expr): string | undefined {
  if (isEmptyExpr(target)) return "";
  const own = variableOf(target);
  if (own !== undefined) return own;
  const [held] = childSlots(target);
  return namePart(target) !== undefined && held ? variableOf(held.expr) : undefined;
}

/** The value fields of an editable target holding an item: its parts other than `namePart`. */
function targetParts(target: Expr): string[] {
  const name = namePart(target);
  if (name === undefined) return [];
  return childSlots(target)
    .map((child) => child.slot)
    .filter((part) => part !== name);
}

export const sameField = (a: Field | null, b: Field | null) =>
  a !== null && b !== null && fieldKey(a) === fieldKey(b);

/** The name in an `id` slot, or the variable a `target` slot names (`nums` of `nums[i]`). */
export function nameOf(stmt: Stmt, slot: string): string | undefined {
  const value = (stmt as unknown as Bag)[slot];
  if (typeof value === "string") return value;
  return isExpr(value) ? targetName(value) : undefined;
}

/** The target `slot` of `stmt` holds, if it is a target slot. */
function targetIn(stmt: Stmt, slot: string): Expr | undefined {
  const role = getNode(keyOf(stmt)).slots.find((s) => s.name === slot)?.role;
  const value = (stmt as unknown as Bag)[slot];
  return role === "target" && isExpr(value) ? value : undefined;
}

/** The form an editable target in `slot` of `stmt` holds, if it holds one. */
export function formIn(stmt: Stmt, slot: string): Form | undefined {
  const target = targetIn(stmt, slot);
  return target && namePart(target) !== undefined ? keyOf(target) : undefined;
}

/** The program with the variable `name` as the target `slot` of `stmt`. */
function setTargetName(program: Program, stmt: Stmt, slot: string, name: string): Program {
  const variable = variableExpr(name);
  if (!variable) throw new Error(`${name} is no variable`);
  return setExpr(program, stmt.id, slot, variable);
}

/** The program with `name` in the name slot `slot` of `stmt`: a target becomes that variable. */
export function setName(program: Program, stmt: Stmt, slot: string, name: string): Program {
  return targetIn(stmt, slot)
    ? setTargetName(program, stmt, slot, name)
    : setSlot(program, stmt.id, slot, name);
}

/** The program with the target `slot` of `stmt` set back to the variable its form holds. */
export function setVariable(program: Program, stmt: Stmt, slot: string): Program {
  const name = nameOf(stmt, slot);
  return name === undefined || name === "" ? program : setTargetName(program, stmt, slot, name);
}

/**
 * The program with `form` of the variable `name` in the target `slot` of `stmt`; a target that
 * already holds that form has its variable replaced and keeps its other parts.
 */
export function setForm(program: Program, stmt: Stmt, slot: string, form: Form, name: Id): Program {
  const target = targetIn(stmt, slot);
  const part = target && keyOf(target) === form ? namePart(target) : undefined;
  const variable = variableExpr(name);
  if (target && part !== undefined && variable) return setExpr(program, target.id, part, variable);
  return setExpr(program, stmt.id, slot, formTarget(form, name));
}

/** The first part of a target holding a form, as a field: where the keyboard goes once it is set. */
export function firstPart(stmt: Stmt, slot: string): Field | undefined {
  return fieldsOf(stmt).find((field) => field.slot === slot && field.part !== undefined);
}

/**
 * The words the notation writes right after a field (`]` after an item's position), which a key
 * that begins them, typed after the field's value, moves on from (`editor.md`, Backspace and
 * keys).
 */
export function wordsAfter(stmt: Stmt, field: Field): string {
  // After an item of a list of values other than its last, the notation writes their separator.
  const items = (stmt as unknown as Bag)[field.slot];
  if (field.index !== undefined && Array.isArray(items) && field.index < items.length - 1) {
    return SEPARATOR.trim();
  }
  const target = field.part === undefined ? undefined : targetIn(stmt, field.slot);
  const pieces = target
    ? targetPieces(target)
    : editedLines(stmt)
        .flat()
        .map(({ piece }) => piece);
  const name = field.part ?? field.slot;
  const at = pieces.findIndex((piece) => "name" in piece && piece.name === name);
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
      : [getNode(keyOf(stmt)).notation(stmt)];
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
    if ((held?.role === "id" || held?.role === "target") && nameOf(stmt, slot) !== undefined) {
      out.push({ slot, role: held.role });
    }
    if (held?.role === "target" && held.target) {
      for (const part of targetParts(held.target)) out.push({ slot, role: "expr", part });
    } else if (held?.role === "expr" && held.expr) out.push({ slot, role: "expr" });
    else if (held?.role === "exprs") {
      held.items.forEach((_, index) => out.push({ slot, role: "expr", index }));
    }
  }
  return out;
}

/**
 * A field's accessible name: the block's label and the slot's name (`Set variable, value`); a
 * part of a target holding an item is named by that item's label instead of the slot's.
 */
export function fieldLabel(stmt: Stmt, field: Field): string {
  const { key } = getNode(keyOf(stmt));
  const held = (stmt as unknown as Bag)[field.slot];
  return t("editor.fieldName", {
    label: nodeText(key, "label"),
    slot:
      field.part !== undefined && isExpr(held)
        ? nodeText(keyOf(held), "label")
        : nodeText(key, `slot.${field.slot}`),
  });
}

/** The expression a value field holds. */
export function valueOf(stmt: Stmt, field: Field): Expr | undefined {
  // A name field holds no value, though a target slot holds an expression.
  if (field.role !== "expr") return undefined;
  const value = (stmt as unknown as Bag)[field.slot];
  const item =
    field.part !== undefined
      ? (value as Bag | undefined)?.[field.part]
      : field.index === undefined
        ? value
        : Array.isArray(value)
          ? value[field.index]
          : undefined;
  return isExpr(item) ? item : undefined;
}

/**
 * Where `setExpr` writes a value field: the node and its slot, the target in the field's slot for
 * a part of that target.
 */
export function fieldPlace(stmt: Stmt, field: Field): { id: NodeId; slot: string } {
  const target = field.part === undefined ? undefined : targetIn(stmt, field.slot);
  return target && field.part !== undefined
    ? { id: target.id, slot: field.part }
    : { id: stmt.id, slot: field.slot };
}

/** Whether a field still has something to fill: an empty name or an input at any depth. */
function toFill(stmt: Stmt, field: Field): boolean {
  if (field.role === "id" || field.role === "target") return nameOf(stmt, field.slot) === "";
  const value = valueOf(stmt, field);
  return value !== undefined && [...allExprs(value)].some(isEmptyExpr);
}

/**
 * The field that takes the keyboard when the editor opens: the slot clicked on the node (the
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
