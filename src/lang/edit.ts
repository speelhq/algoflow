// L-50, L-51, L-54: pure edit functions. Each returns a new Program and keeps
// every NodeId unique. Statements are addressed by id or by Place.
import { getNode, keyOf } from "@/nodes";
import { newId } from "./id";
import type {
  ClassDef,
  Expr,
  Field,
  FunctionDef,
  Id,
  NodeId,
  Place,
  Program,
  Stmt,
  Target,
} from "./types";
import { allExprs, allStmts, childSlots, regionsOf } from "./walk";

type Bag = Record<string, unknown>;

export class EditError extends Error {}

function clone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------- ids

function collectIds(program: Program): Set<NodeId> {
  const ids = new Set<NodeId>();
  for (const cls of program.classes) ids.add(cls.id);
  for (const fn of program.functions) {
    ids.add(fn.id);
    for (const stmt of allStmts(fn.body)) addStmtIds(stmt, ids);
  }
  for (const stmt of allStmts(program.main)) addStmtIds(stmt, ids);
  return ids;
}

function addStmtIds(stmt: Stmt, ids: Set<NodeId>): void {
  ids.add(stmt.id);
  for (const { expr } of childSlots(stmt)) for (const e of allExprs(expr)) ids.add(e.id);
}

function stmtIds(stmt: Stmt): NodeId[] {
  const ids: NodeId[] = [];
  for (const s of allStmts([stmt])) {
    ids.push(s.id);
    for (const { expr } of childSlots(s)) for (const e of allExprs(expr)) ids.push(e.id);
  }
  return ids;
}

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

/** L-51: a statement entering the program must not reuse an existing id. */
function fresh(stmt: Stmt, program: Program): Stmt {
  const copy = clone(stmt);
  const existing = collectIds(program);
  if (stmtIds(copy).some((id) => existing.has(id))) reIdStmt(copy);
  return copy;
}

function freshExpr(expr: Expr, program: Program): Expr {
  const copy = clone(expr);
  const existing = collectIds(program);
  if ([...allExprs(copy)].some((e) => existing.has(e.id))) reIdExpr(copy);
  return copy;
}

// ---------------------------------------------------------------- locating

export type Located = { stmt: Stmt; region: Stmt[]; index: number; place: Place };

function* regionsIn(
  program: Program,
): Generator<{ stmts: Stmt[]; parent: Place["parent"]; slot: Place["slot"] }> {
  yield { stmts: program.main, parent: "main", slot: "main" };
  for (const fn of program.functions) yield { stmts: fn.body, parent: fn.id, slot: "body" };
  for (const fn of program.functions) yield* nestedRegions(fn.body);
  yield* nestedRegions(program.main);
}

function* nestedRegions(
  stmts: Stmt[],
): Generator<{ stmts: Stmt[]; parent: Place["parent"]; slot: Place["slot"] }> {
  for (const stmt of stmts) {
    for (const region of regionsOf(stmt)) {
      yield { stmts: region.stmts, parent: stmt.id, slot: region.slot as Place["slot"] };
      yield* nestedRegions(region.stmts);
    }
  }
}

export function locateStmt(program: Program, id: NodeId): Located | undefined {
  for (const region of regionsIn(program)) {
    const index = region.stmts.findIndex((stmt) => stmt.id === id);
    if (index >= 0) {
      const stmt = region.stmts[index];
      if (stmt)
        return {
          stmt,
          region: region.stmts,
          index,
          place: { parent: region.parent, slot: region.slot, index },
        };
    }
  }
  return undefined;
}

function regionAt(program: Program, place: Place): Stmt[] {
  if (place.parent === "main") return program.main;
  const fn = program.functions.find((f) => f.id === place.parent);
  if (fn) return fn.body;
  const located = locateStmt(program, place.parent);
  if (!located) throw new EditError(`no statement ${place.parent}`);
  const region = regionsOf(located.stmt).find((r) => r.slot === place.slot);
  if (!region) throw new EditError(`statement ${place.parent} has no region ${place.slot}`);
  return region.stmts;
}

/** Finds a statement or expression node by id together with its containing statement. */
export function locateNode(
  program: Program,
  id: NodeId,
): { node: Stmt | Expr; stmt: Stmt } | undefined {
  for (const region of regionsIn(program)) {
    for (const stmt of region.stmts) {
      if (stmt.id === id) return { node: stmt, stmt };
      for (const { expr } of childSlots(stmt)) {
        for (const e of allExprs(expr)) if (e.id === id) return { node: e, stmt };
      }
    }
  }
  return undefined;
}

function mustLocate(program: Program, id: NodeId): Located {
  const located = locateStmt(program, id);
  if (!located) throw new EditError(`no statement ${id}`);
  return located;
}

// ---------------------------------------------------------------- statements

export function insertStmt(program: Program, stmt: Stmt, place: Place): Program {
  const next = clone(program);
  const region = regionAt(next, place);
  const index = Math.max(0, Math.min(place.index, region.length));
  region.splice(index, 0, fresh(stmt, next));
  return next;
}

export function removeStmt(program: Program, id: NodeId): Program {
  const next = clone(program);
  const { region, index } = mustLocate(next, id);
  region.splice(index, 1);
  return next;
}

/** Moves a statement; `place.index` counts positions in the target region after the removal. */
export function moveStmt(program: Program, id: NodeId, place: Place): Program {
  const next = clone(program);
  const { stmt, region, index } = mustLocate(next, id);
  region.splice(index, 1);
  const target = regionAt(next, place);
  target.splice(Math.max(0, Math.min(place.index, target.length)), 0, stmt);
  return next;
}

export function duplicateStmt(program: Program, id: NodeId): Program {
  const next = clone(program);
  const { stmt, region, index } = mustLocate(next, id);
  const copy = clone(stmt);
  reIdStmt(copy);
  region.splice(index + 1, 0, copy);
  return next;
}

// ---------------------------------------------------------------- slots

/** Sets a non-expression slot (`id`, `text`, or `target`) of a statement or expression. */
export function setSlot(
  program: Program,
  id: NodeId,
  slot: string,
  value: string | Target,
): Program {
  const next = clone(program);
  const located = locateNode(next, id);
  if (!located) throw new EditError(`no node ${id}`);
  const def = getNode(keyOf(located.node));
  const spec = def.slots.find((s) => s.name === slot);
  if (!spec || spec.role === "expr" || spec.role === "exprs" || spec.role === "body") {
    throw new EditError(`node ${id} has no settable slot ${slot}`);
  }
  (located.node as unknown as Bag)[slot] = typeof value === "string" ? value : clone(value);
  return next;
}

/** Sets an expression slot; for `exprs` slots `index` selects the item (appending when past the end). */
export function setExpr(
  program: Program,
  id: NodeId,
  slot: string,
  expr: Expr,
  index?: number,
): Program {
  const next = clone(program);
  const located = locateNode(next, id);
  if (!located) throw new EditError(`no node ${id}`);
  const def = getNode(keyOf(located.node));
  const spec = def.slots.find((s) => s.name === slot);
  const bag = located.node as unknown as Bag;
  const value = freshExpr(expr, next);
  if (spec?.role === "expr") {
    bag[slot] = value;
  } else if (spec?.role === "exprs") {
    const items = (bag[slot] as Expr[] | undefined) ?? [];
    const at = index === undefined ? items.length : Math.max(0, Math.min(index, items.length));
    items.splice(at, at < items.length ? 1 : 0, value);
    bag[slot] = items;
  } else if (spec?.role === "target") {
    // A target of kind index/key/field holds expressions in fixed fields.
    const target = bag[slot] as Bag;
    if (index === undefined || typeof target !== "object")
      throw new EditError(`target slot needs a field name index`);
    target[String(index)] = value;
  } else {
    throw new EditError(`node ${id} has no expression slot ${slot}`);
  }
  return next;
}

// ---------------------------------------------------------------- names

/** Renames a variable, function, or class everywhere it occurs. */
export function renameName(program: Program, from: Id, to: Id): Program {
  const next = clone(program);
  const swap = (name: string) => (name === from ? to : name);
  for (const input of next.inputs) input.name = swap(input.name);
  for (const fn of next.functions) {
    fn.name = swap(fn.name);
    fn.params = fn.params.map(swap);
  }
  for (const cls of next.classes) cls.name = swap(cls.name);
  const stmts = [...next.functions.flatMap((fn) => [...allStmts(fn.body)]), ...allStmts(next.main)];
  for (const stmt of stmts) {
    const def = getNode(keyOf(stmt));
    const bag = stmt as unknown as Bag;
    for (const slot of def.slots) {
      if (slot.role === "id" && typeof bag[slot.name] === "string")
        bag[slot.name] = swap(bag[slot.name] as string);
      if (slot.role === "target") {
        const target = bag[slot.name] as Target;
        if (target.kind === "var") target.name = swap(target.name);
      }
    }
    for (const { expr: root } of childSlots(stmt)) {
      for (const expr of allExprs(root)) {
        const exprBag = expr as unknown as Bag;
        for (const slot of getNode(keyOf(expr)).slots) {
          if (slot.role === "id" && typeof exprBag[slot.name] === "string") {
            exprBag[slot.name] = swap(exprBag[slot.name] as string);
          }
        }
      }
    }
  }
  return next;
}

// ---------------------------------------------------------------- functions and classes

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

export function addClass(program: Program, name: Id): Program {
  const next = clone(program);
  const cls: ClassDef = { id: newId(), name, fields: [] };
  next.classes.push(cls);
  return next;
}

export function removeClass(program: Program, id: NodeId): Program {
  const next = clone(program);
  const index = next.classes.findIndex((cls) => cls.id === id);
  if (index < 0) throw new EditError(`no class ${id}`);
  next.classes.splice(index, 1);
  return next;
}

/** N-06: replaces the ordered field table of a class. */
export function setFields(program: Program, id: NodeId, fields: Field[]): Program {
  const next = clone(program);
  const cls = next.classes.find((c) => c.id === id);
  if (!cls) throw new EditError(`no class ${id}`);
  cls.fields = clone(fields);
  return next;
}

// ---------------------------------------------------------------- L-41 fix

/** The literal of the same type as the first value assigned to `name` inside `stmts`, else None. */
function defaultFor(stmts: Stmt[], name: Id): Expr {
  for (const stmt of allStmts(stmts)) {
    if (stmt.kind !== "assign" || stmt.target.kind !== "var" || stmt.target.name !== name) continue;
    const value = stmt.value;
    switch (value.kind) {
      case "num":
        return value.float
          ? { id: newId(), kind: "num", value: 0, float: true, raw: "0.0" }
          : { id: newId(), kind: "num", value: 0, float: false, raw: "0" };
      case "str":
        return { id: newId(), kind: "str", value: "" };
      case "bool":
        return { id: newId(), kind: "bool", value: false };
      case "list":
        return { id: newId(), kind: "list", items: [] };
      case "dict":
        return { id: newId(), kind: "dict", entries: [] };
      default:
        return { id: newId(), kind: "none" };
    }
  }
  return { id: newId(), kind: "none" };
}

/** Inserts `name = <default>` immediately before the frame `frameId`. */
export function hoistAssign(program: Program, frameId: NodeId, name: Id): Program {
  const next = clone(program);
  const { stmt, region, index } = mustLocate(next, frameId);
  const inner = regionsOf(stmt).flatMap((r) => r.stmts);
  const assign: Stmt = {
    id: newId(),
    kind: "assign",
    target: { kind: "var", name },
    value: defaultFor(inner, name),
  };
  region.splice(index, 0, assign);
  return next;
}
