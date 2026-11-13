// Pure edit functions. Each returns a new Program and keeps
// every NodeId unique. Statements are addressed by id or by Place.
import { getBlockDef, registryKey, findSlot } from "@/blocks/registry";
import { createNodeId } from "./id";
import { declaredBy } from "./scope";
import type { Expr, FunctionDef, Name, NodeId, Place, Program, Stmt } from "./types";
import {
  allExprs,
  isExpr,
  allStmts,
  childSlots,
  idsUnder,
  programIds,
  findRoutineDef,
  programStmts,
  routineStmts,
  bodyRegions,
} from "./walk";

type Bag = Record<string, unknown>;

export class EditError extends Error {}

function clone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------- ids

/** Gives every block under `stmt` a fresh id (in place). */
function reIdStmt(stmt: Stmt): void {
  stmt.id = createNodeId();
  for (const { expr } of childSlots(stmt)) reIdExpr(expr);
  for (const region of bodyRegions(stmt)) for (const child of region.stmts) reIdStmt(child);
}

function reIdExpr(expr: Expr): void {
  expr.id = createNodeId();
  for (const { expr: child } of childSlots(expr)) reIdExpr(child);
}

/** The program's ids, less those of `replaced`, which what takes their place may keep. */
function takenIds(program: Program, replaced: readonly Expr[]): Set<NodeId> {
  const taken = new Set(programIds(program));
  for (const root of replaced) for (const e of allExprs(root)) taken.delete(e.id);
  return taken;
}

/** Whether a block entering the program, holding `ids`, reuses one of the `taken` ids. */
function reuses(ids: Iterable<NodeId>, taken: ReadonlySet<NodeId>): boolean {
  for (const id of ids) if (taken.has(id)) return true;
  return false;
}

/** A statement entering the program must not reuse an existing id. */
function cloneWithUniqueIds(stmt: Stmt, program: Program): Stmt {
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

/** Expressions entering the program; ids of `replaced`, which they take the place of, may stay. */
function cloneExprsWithUniqueIds(
  exprs: readonly Expr[],
  program: Program,
  replaced: readonly Expr[],
): Expr[] {
  const taken = takenIds(program, replaced);
  return exprs.map((expr) => {
    const copy = clone(expr);
    claim(copy, taken);
    return copy;
  });
}

// ---------------------------------------------------------------- finding

export type StmtAt = { stmt: Stmt; region: Stmt[]; index: number };

function* regions(program: Program): Generator<Stmt[], void, void> {
  yield program.main;
  for (const fn of program.functions) yield fn.body;
  for (const stmt of programStmts(program))
    for (const region of bodyRegions(stmt)) yield region.stmts;
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
  const def = findRoutineDef(program, place.parent);
  if (def) return routineStmts(program, def);
  const found = findStmt(program, place.parent);
  return found && bodyRegions(found.stmt).find((r) => r.slot === place.slot)?.stmts;
}

function getRegion(program: Program, place: Place): Stmt[] {
  const region = findRegion(program, place);
  if (!region) throw new EditError(`no region ${place.slot} of ${place.parent}`);
  return region;
}

/** The statement or expression block with this id; throws when the program has none. */
function getBlock(program: Program, id: NodeId): Stmt | Expr {
  for (const stmt of programStmts(program)) {
    if (stmt.id === id) return stmt;
    for (const { expr } of childSlots(stmt)) {
      for (const e of allExprs(expr)) if (e.id === id) return e;
    }
  }
  throw new EditError(`no block ${id}`);
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
  region.splice(index, 0, cloneWithUniqueIds(stmt, next));
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

/**
 * Sets an expression or target slot to `value`, or an `exprs` slot to its items as a whole, because
 * a field edits the slot as one text (`language.md`, Edits, Statement positions). The ids of the
 * value replaced may stay.
 */
export function setExpr(program: Program, id: NodeId, slot: string, value: Expr | Expr[]): Program {
  const next = clone(program);
  const block = getBlock(next, id);
  const role = findSlot(block, slot)?.role;
  const bag = block as unknown as Bag;
  const held = bag[slot];
  if ((role === "expr" || role === "target") && !Array.isArray(value)) {
    [bag[slot]] = cloneExprsWithUniqueIds([value], next, isExpr(held) ? [held] : []);
  } else if (role === "exprs" && Array.isArray(value)) {
    bag[slot] = cloneExprsWithUniqueIds(
      value,
      next,
      Array.isArray(held) ? held.filter(isExpr) : [],
    );
  } else {
    throw new EditError(
      `block ${id} has no ${Array.isArray(value) ? "exprs" : "expression"} slot ${slot}`,
    );
  }
  return next;
}

// ---------------------------------------------------------------- names

/** A caption as stored: each run of spaces and line breaks one space, trimmed. */
export function normalizeCaption(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Stores `caption` on `stmt` as `language.md`, Captions, states: trimmed, each run of spaces one
 * space, and absent when no text is left.
 */
export function storeCaption(stmt: { caption?: string }, caption: string): void {
  const stored = normalizeCaption(caption);
  if (stored === "") delete stmt.caption;
  else stmt.caption = stored;
}

/** Captions statement `id`, or removes its caption when `caption` holds no text. */
export function setCaption(program: Program, id: NodeId, caption: string): Program {
  const next = clone(program);
  storeCaption(getStmt(next, id).stmt, caption);
  return next;
}

/** Renames a variable or function everywhere it occurs (`name` slots and declarations). */
export function renameName(program: Program, from: Name, to: Name): Program {
  const next = clone(program);
  const swap = (name: string) => (name === from ? to : name);
  for (const input of next.inputs) input.name = swap(input.name);
  for (const fn of next.functions) {
    fn.name = swap(fn.name);
    fn.params = fn.params.map(swap);
  }
  const renameIdSlots = (block: Stmt | Expr) => {
    const bag = block as unknown as Bag;
    for (const slot of getBlockDef(registryKey(block)).slots) {
      if (slot.role === "name" && typeof bag[slot.name] === "string") {
        bag[slot.name] = swap(bag[slot.name] as string);
      }
    }
  };
  for (const stmt of programStmts(next)) {
    renameIdSlots(stmt);
    for (const { expr: root } of childSlots(stmt))
      for (const expr of allExprs(root)) renameIdSlots(expr);
  }
  return next;
}

// ---------------------------------------------------------------- functions

export function addFunction(program: Program, name: Name, params: Name[] = []): Program {
  const next = clone(program);
  const fn: FunctionDef = { id: createNodeId(), name, params: [...params], body: [] };
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
export function setParams(program: Program, id: NodeId, params: Name[]): Program {
  const next = clone(program);
  const fn = next.functions.find((f) => f.id === id);
  if (!fn) throw new EditError(`no function ${id}`);
  fn.params = [...params];
  return next;
}

// ---------------------------------------------------------------- the E_DECLARE_FIRST fix

/** The zero-like literal of the first value assigned to `name` inside `stmts`, else None. */
function createDefault(stmts: Stmt[], name: Name): Expr {
  const value = [...allStmts(stmts)]
    .flatMap((stmt) => declaredBy(stmt))
    .find((declared) => declared.name === name && declared.stores !== undefined)?.stores;
  const zero = value && getBlockDef(registryKey(value)).createZero?.(value);
  return zero ?? (getBlockDef("none").create() as Expr);
}

/** Inserts `name = <default>` immediately before the compound statement `compound`. */
export function hoistAssign(program: Program, compound: NodeId, name: Name): Program {
  const next = clone(program);
  const { stmt, region, index } = getStmt(next, compound);
  const inner = bodyRegions(stmt).flatMap((r) => r.stmts);
  const assign: Stmt = {
    id: createNodeId(),
    type: "assign",
    target: { id: createNodeId(), type: "var", name },
    value: createDefault(inner, name),
  };
  region.splice(index, 0, assign);
  return next;
}
