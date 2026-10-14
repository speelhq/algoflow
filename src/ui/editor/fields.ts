// The fields of a statement's notation in the node editor: each name slot, each value slot, and
// each item of a list of values, in the notation's reading order; a target holding an item is
// its list's name and a value for each of its other parts.
import { nodeText, t } from "@/i18n/t";
import { setSlot } from "@/lang/edit";
import type { Expr, Id, IndexTarget, NodeId, Program, Stmt, Target } from "@/lang/types";
import { allExprs, isEmptyExpr, isExpr, TARGET_PARTS, targetExprs, variableOf } from "@/lang/walk";
import { emptyExpr, getNode, hasNode, keyOf } from "@/nodes/registry";
import {
  generatedNotation,
  notationOf,
  placeholderValue,
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

/** The item form of a target, `<list>[…] ← …` (`editor.md`, Name fields). */
export const ITEM = "index" satisfies Target["kind"];

type Bag = Record<string, unknown>;

/** A target holding an item of the list variable `list`, its position still to fill. */
export function itemTarget(list: Id): Target {
  const variable = variableExpr(list);
  if (!variable) throw new Error(`${list} is no variable`);
  return { kind: ITEM, list: variable, index: emptyExpr() };
}

/**
 * The part of a target holding an item that names its variable (`list` of `nums[i]`), when the
 * target can be edited: its block is registered and that part is a variable.
 */
export function namePart(target: Target): string | undefined {
  if (target.kind === "var" || !hasNode(target.kind)) return undefined;
  const [part] = TARGET_PARTS[target.kind].exprs;
  const [held] = targetExprs(target);
  return held && variableOf(held) !== undefined ? part : undefined;
}

/**
 * The pieces an editable target holding an item is edited as: the notation of the expression of
 * its shape (`{list}[{index}]`), its `namePart` the name field; none for any other target.
 */
export function targetPieces(target: Target): Piece[] {
  if (target.kind === "var" || namePart(target) === undefined) return [];
  return templatePieces(notationOf({ id: "", ...target }));
}

/** The variable a target names: itself, or the variable its `namePart` holds. */
function targetName(target: Target): string | undefined {
  if (target.kind === "var") return target.name;
  const [held] = targetExprs(target);
  return namePart(target) !== undefined && held ? variableOf(held) : undefined;
}

/** The value fields of an editable target holding an item: its parts other than `namePart`. */
function targetParts(target: Target): string[] {
  const name = namePart(target);
  return name === undefined ? [] : TARGET_PARTS[target.kind].exprs.filter((part) => part !== name);
}

export const sameField = (a: Field | null, b: Field | null) =>
  a !== null && b !== null && fieldKey(a) === fieldKey(b);

/** The name in an `id` slot, or the variable a `target` slot names (`nums` of `nums[i]`). */
export function nameOf(stmt: Stmt, slot: string): string | undefined {
  const value = (stmt as unknown as Bag)[slot];
  if (typeof value === "string") return value;
  const target = value as Target | undefined;
  return target ? targetName(target) : undefined;
}

/** The program with `name` in the name slot `slot` of `stmt`. */
export function setName(program: Program, stmt: Stmt, slot: string, name: string): Program {
  const role = getNode(keyOf(stmt)).slots.find((s) => s.name === slot)?.role;
  return setSlot(program, stmt.id, slot, role === "target" ? { kind: "var", name } : name);
}

/**
 * The program with an item of the list variable `list` in the target slot `slot` of `stmt`; one
 * that already holds an item of that list keeps its position.
 */
export function setItem(program: Program, stmt: Stmt, slot: string, list: Id): Program {
  const held = (stmt as unknown as Bag)[slot] as Target | undefined;
  if (held?.kind === ITEM && nameOf(stmt, slot) === list) return program;
  return setSlot(program, stmt.id, slot, itemTarget(list));
}

/** The field of an item's position in the target slot `slot`. */
export function itemField(slot: string): Field {
  return { slot, role: "expr", part: "index" satisfies keyof IndexTarget };
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
  const held = (stmt as unknown as Bag)[field.slot] as Target | undefined;
  return t("editor.fieldName", {
    label: nodeText(key, "label"),
    slot:
      field.part !== undefined && held
        ? nodeText(held.kind, "label")
        : nodeText(key, `slot.${field.slot}`),
  });
}

/** The expression a value field holds. */
export function valueOf(stmt: Stmt, field: Field): Expr | undefined {
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

/** Where `setExpr` writes a value field: its slot, or the part of the target in it. */
export function fieldPath(field: Field): string {
  return field.part === undefined ? field.slot : `${field.slot}.${field.part}`;
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
