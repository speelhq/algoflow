// Pure edit functions. Each returns a new Program and keeps
// every NodeId unique. Statements are addressed by id or by Place.
import { getBlock, keyOf } from "@/blocks/registry";
import { newId } from "./id";
import { assignedValue, declaredBy } from "./scope";
import type { Expr, FunctionDef, Id, NodeId, Place, Program, Stmt } from "./types";
import {
  allExprs,
  isExpr,
  allStmts,
  childSlots,
  idsUnder,
  programIds,
  programStmts,
  regionsOf,
} from "./walk";

type Bag = Record<string, unknown>;

export class EditError extends Error {}

function clone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------- ids

/** Gives every node under `stmt` a fresh id (in place). */
function reIdStmt(stmt: Stmt): void {
  stmt.id = newId();
  for (const { expr } of childSlots(stmt)) reIdExpr(expr);
  for (const region of regionsOf(stmt)) for (const child of region.stmts) reIdStmt(child);
}

function reIdExpr(expr: Expr): void {
  expr.id = newId();
  for (const { expr: child } of childSlots(expr)) reIdExpr(child);
}

/** The program's ids, less those of `replaced`, which what takes their place may keep. */
function takenIds(program: Program, replaced: readonly Expr[]): Set<NodeId> {
  const taken = new Set(programIds(program));
  for (const root of replaced) for (const e of allExprs(root)) taken.delete(e.id);
  return taken;
}

/** Whether a node entering the program, holding `ids`, reuses one of the `taken` ids. */
function reuses(ids: Iterable<NodeId>, taken: ReadonlySet<NodeId>): boolean {
  for (const id of ids) if (taken.has(id)) return true;
  return false;
}

/** A statement entering the program must not reuse an existing id. */
function fresh(stmt: Stmt, program: Program): Stmt {
  const copy = clone(stmt);
  if (reuses(idsUnder([copy]), takenIds(program, []))) reIdStmt(copy);
  return copy;
}

/** Gives `expr` fresh ids (in place) when one of its ids is taken; its ids are then taken. */
function claim(expr: Expr, taken: Set<NodeId>): void {
  const ids = () => [...allExprs(expr)].map((e) => e.id);
  if (reuses(ids(), taken)) reIdExpr(expr);
  for (const id of ids()) taken.add(id);
}

/** An expression entering the program; ids of `replaced`, which it takes the place of, may stay. */
function freshExpr(expr: Expr, program: Program, replaced?: Expr): Expr {
  const copy = clone(expr);
  claim(copy, takenIds(program, replaced ? [replaced] : []));
  return copy;
}

// ---------------------------------------------------------------- finding

export type StmtAt = { stmt: Stmt; region: Stmt[]; index: number };

function* regions(program: Program): Generator<Stmt[], void, void> {
  yield program.main;
  for (const fn of program.functions) yield fn.body;
  for (const { stmt } of programStmts(program))
    for (const region of regionsOf(stmt)) yield region.stmts;
}

export function findStmt(program: Program, id: NodeId): StmtAt | undefined {
  for (const region of regions(program)) {
    const index = region.findIndex((stmt) => stmt.id === id);
    const stmt = region[index];
    if (stmt) return { stmt, region, index };
  }
  return undefined;
}

/** The region a place names, or undefined when the program has none there. */
export function findRegion(program: Program, place: Place): Stmt[] | undefined {
  if (place.parent === "main") return program.main;
  const fn = program.functions.find((f) => f.id === place.parent);
  if (fn) return fn.body;
  const found = findStmt(program, place.parent);
  return found && regionsOf(found.stmt).find((r) => r.slot === place.slot)?.stmts;
}

function getRegion(program: Program, place: Place): Stmt[] {
  const region = findRegion(program, place);
  if (!region) throw new EditError(`no region ${place.slot} of ${place.parent}`);
  return region;
}

/** The statement or expression node with this id; throws when the program has none. */
function getNode(program: Program, id: NodeId): Stmt | Expr {
  for (const { stmt } of programStmts(program)) {
    if (stmt.id === id) return stmt;
    for (const { expr } of childSlots(stmt)) {
      for (const e of allExprs(expr)) if (e.id === id) return e;
    }
  }
  throw new EditError(`no node ${id}`);
}

function getStmt(program: Program, id: NodeId): StmtAt {
  const found = findStmt(program, id);
  if (!found) throw new EditError(`no statement ${id}`);
  return found;
}

// ---------------------------------------------------------------- statements

export function insertStmt(program: Program, stmt: Stmt, place: Place): Program {
  const next = clone(program);
  const region = getRegion(next, place);
  const index = Math.max(0, Math.min(place.index, region.length));
  region.splice(index, 0, fresh(stmt, next));
  return next;
}

export function removeStmt(program: Program, id: NodeId): Program {
  const next = clone(program);
  const { region, index } = getStmt(next, id);
  region.splice(index, 1);
  return next;
}

/** Moves a statement; `place.index` counts positions in the target region after the removal. */
export function moveStmt(program: Program, id: NodeId, place: Place): Program {
  const next = clone(program);
  const { stmt, region, index } = getStmt(next, id);
  region.splice(index, 1);
  const target = getRegion(next, place);
  target.splice(Math.max(0, Math.min(place.index, target.length)), 0, stmt);
  return next;
}

export function duplicateStmt(program: Program, id: NodeId): Program {
  const next = clone(program);
  const { stmt, region, index } = getStmt(next, id);
  const copy = clone(stmt);
  reIdStmt(copy);
  region.splice(index + 1, 0, copy);
  return next;
}

// ---------------------------------------------------------------- slots

/** Sets a name or literal slot (`id` or `text`) of a statement or expression. */
export function setSlot(program: Program, id: NodeId, slot: string, value: string): Program {
  const next = clone(program);
  const node = getNode(next, id);
  const spec = getBlock(keyOf(node)).slots.find((s) => s.name === slot);
  if (spec?.role !== "id" && spec?.role !== "text") {
    throw new EditError(`node ${id} has no settable slot ${slot}`);
  }
  (node as unknown as Bag)[slot] = value;
  return next;
}

/**
 * Sets an expression or target slot. For `exprs` slots `index` selects the item (appending
 * past the end).
 */
export function setExpr(
  program: Program,
  id: NodeId,
  slot: string,
  expr: Expr,
  index?: number,
): Program {
  const next = clone(program);
  const node = getNode(next, id);
  const spec = getBlock(keyOf(node)).slots.find((s) => s.name === slot);
  const bag = node as unknown as Bag;
  const old = (value: unknown) => (isExpr(value) ? value : undefined);
  if (spec?.role === "expr" || spec?.role === "target") {
    bag[slot] = freshExpr(expr, next, old(bag[slot]));
  } else if (spec?.role === "exprs") {
    const items = (bag[slot] as Expr[] | undefined) ?? [];
    const at = index === undefined ? items.length : Math.max(0, Math.min(index, items.length));
    items.splice(at, at < items.length ? 1 : 0, freshExpr(expr, next, old(items[at])));
    bag[slot] = items;
  } else {
    throw new EditError(`node ${id} has no expression slot ${slot}`);
  }
  return next;
}

/** Inserts `expr` as item `index` of an `exprs` slot; the items from `index` on move one on. */
export function insertItem(
  program: Program,
  id: NodeId,
  slot: string,
  index: number,
  expr: Expr,
): Program {
  const next = clone(program);
  const node = getNode(next, id);
  const spec = getBlock(keyOf(node)).slots.find((s) => s.name === slot);
  const items = (node as unknown as Bag)[slot];
  if (spec?.role !== "exprs" || !Array.isArray(items) || index < 0 || index > items.length) {
    throw new EditError(`node ${id} has no place ${index} in ${slot}`);
  }
  items.splice(index, 0, freshExpr(expr, next));
  return next;
}

/** Removes item `index` of an `exprs` slot. */
export function removeItem(program: Program, id: NodeId, slot: string, index: number): Program {
  const next = clone(program);
  const node = getNode(next, id);
  const spec = getBlock(keyOf(node)).slots.find((s) => s.name === slot);
  const items = (node as unknown as Bag)[slot];
  if (spec?.role !== "exprs" || !Array.isArray(items) || index < 0 || index >= items.length) {
    throw new EditError(`node ${id} has no item ${index} in ${slot}`);
  }
  items.splice(index, 1);
  return next;
}

// ---------------------------------------------------------------- names

/** A node's name as stored: each run of spaces and line breaks one space, trimmed. */
export function stmtName(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Names statement `id`, or removes its name when `name` holds no text. */
export function setStmtName(program: Program, id: NodeId, name: string): Program {
  const next = clone(program);
  const { stmt } = getStmt(next, id);
  const stored = stmtName(name);
  if (stored === "") delete stmt.name;
  else stmt.name = stored;
  return next;
}

/** Renames a variable or function everywhere it occurs (`id` slots and declarations). */
export function renameName(program: Program, from: Id, to: Id): Program {
  const next = clone(program);
  const swap = (name: string) => (name === from ? to : name);
  for (const input of next.inputs) input.name = swap(input.name);
  for (const fn of next.functions) {
    fn.name = swap(fn.name);
    fn.params = fn.params.map(swap);
  }
  const renameIdSlots = (node: Stmt | Expr) => {
    const bag = node as unknown as Bag;
    for (const slot of getBlock(keyOf(node)).slots) {
      if (slot.role === "id" && typeof bag[slot.name] === "string") {
        bag[slot.name] = swap(bag[slot.name] as string);
      }
    }
  };
  for (const { stmt } of programStmts(next)) {
    renameIdSlots(stmt);
    for (const { expr: root } of childSlots(stmt))
      for (const expr of allExprs(root)) renameIdSlots(expr);
  }
  return next;
}

// ---------------------------------------------------------------- functions

export function addFunction(program: Program, name: Id, params: Id[] = []): Program {
  const next = clone(program);
  const fn: FunctionDef = { id: newId(), name, params: [...params], body: [] };
  next.functions.push(fn);
  return next;
}

export function removeFunction(program: Program, id: NodeId): Program {
  const next = clone(program);
  const index = next.functions.findIndex((fn) => fn.id === id);
  if (index < 0) throw new EditError(`no function ${id}`);
  next.functions.splice(index, 1);
  return next;
}

/** Replaces the ordered parameters of a function. */
export function setParams(program: Program, id: NodeId, params: Id[]): Program {
  const next = clone(program);
  const fn = next.functions.find((f) => f.id === id);
  if (!fn) throw new EditError(`no function ${id}`);
  fn.params = [...params];
  return next;
}

// ---------------------------------------------------------------- the E_DECLARE_FIRST fix

/** The zero-like literal of the first value assigned to `name` inside `stmts`, else None. */
function defaultFor(stmts: Stmt[], name: Id): Expr {
  const none = (): Expr => ({ id: newId(), kind: "none" });
  for (const stmt of allStmts(stmts)) {
    if (!declaredBy(stmt).some((declared) => declared.role === "target" && declared.name === name))
      continue;
    const value = assignedValue(stmt);
    return (value && getBlock(keyOf(value)).zeroLike?.(value)) ?? none();
  }
  return none();
}

/** Inserts `name = <default>` immediately before the frame `frameId`. */
export function hoistAssign(program: Program, frameId: NodeId, name: Id): Program {
  const next = clone(program);
  const { stmt, region, index } = getStmt(next, frameId);
  const inner = regionsOf(stmt).flatMap((r) => r.stmts);
  const assign: Stmt = {
    id: newId(),
    kind: "assign",
    target: { id: newId(), kind: "var", name },
    value: defaultFor(inner, name),
  };
  region.splice(index, 0, assign);
  return next;
}
