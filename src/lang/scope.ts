// What the editor asks of a program's structure: the names visible at a statement,
// and whether a place lies inside a loop or a function.
// Registry-driven: slots, `loop`, and regions, never a kind.
import { getBlock, keyOf } from "@/blocks/registry";
import type { Expr, Id, NodeId, Place, Program, Stmt } from "./types";
import { childSlots, isExpr, regionsOf, variableOf } from "./walk";

type Bag = Record<string, unknown>;

export type Declared = { name: Id; role: "id" | "target" };

/**
 * The variables a statement's binding target slots hold (`x` of `x = …`): each is declared
 * there, not read (`language.md`, Scope).
 */
export function boundVariables(stmt: Stmt): Expr[] {
  const bag = stmt as unknown as Bag;
  return getBlock(keyOf(stmt))
    .slots.filter((slot) => slot.role === "target" && slot.binds)
    .map((slot) => bag[slot.name])
    .filter((value): value is Expr => isExpr(value) && variableOf(value) !== undefined);
}

/** Names a statement assigns in its own region: its bound variables and its loop variables. */
export function declaredBy(stmt: Stmt): Declared[] {
  const bag = stmt as unknown as Bag;
  const names: Declared[] = [];
  for (const slot of getBlock(keyOf(stmt)).slots) {
    const value = bag[slot.name];
    if (slot.role === "id" && typeof value === "string" && value !== "") {
      names.push({ name: value, role: "id" });
    }
  }
  for (const variable of boundVariables(stmt)) {
    const name = variableOf(variable);
    if (name) names.push({ name, role: "target" });
  }
  return names;
}

/** The expression a statement with a binding target assigns: its expression slot (`x = <value>`). */
export function assignedValue(stmt: Stmt): Expr | undefined {
  const { slots } = getBlock(keyOf(stmt));
  if (!slots.some((slot) => slot.role === "target" && slot.binds)) return undefined;
  const slot = slots.find((candidate) => candidate.role === "expr");
  return childSlots(stmt).find((child) => child.slot === slot?.name)?.expr;
}

/** `names` with `latest` moved to the front, in their order. */
function bump(names: Id[], latest: Id[]): Id[] {
  return [...latest, ...names.filter((name) => !latest.includes(name))];
}

/**
 * The names visible to the slots of statement `id`, the most recently assigned first:
 * what was assigned before it in its region and the regions around it, the loop variables
 * of the loops around it, and the inputs or parameters. Undefined for an unknown id.
 */
export function visibleAt(program: Program, id: NodeId): Id[] | undefined {
  const walk = (stmts: Stmt[], visible: Id[]): Id[] | undefined => {
    let names = visible;
    for (const stmt of stmts) {
      if (stmt.id === id) return names;
      const own = declaredBy(stmt).map((declared) => declared.name);
      for (const region of regionsOf(stmt)) {
        const found = walk(region.stmts, bump(names, own));
        if (found) return found;
      }
      names = bump(names, own);
    }
    return undefined;
  };
  for (const fn of program.functions) {
    const found = walk(fn.body, fn.params.toReversed());
    if (found) return found;
  }
  return walk(program.main, program.inputs.map((input) => input.name).toReversed());
}

/** The statement whose region holds each statement; a top-level statement maps to its chart. */
function parents(program: Program): Map<NodeId, NodeId | "main"> {
  const map = new Map<NodeId, NodeId | "main">();
  const walk = (stmts: Stmt[], parent: NodeId | "main") => {
    for (const stmt of stmts) {
      map.set(stmt.id, parent);
      for (const region of regionsOf(stmt)) walk(region.stmts, stmt.id);
    }
  };
  walk(program.main, "main");
  for (const fn of program.functions) walk(fn.body, fn.id);
  return map;
}

/** Whether a statement at `place` would be inside a loop body and inside a function. */
export function placeContext(program: Program, place: Place): { loop: boolean; fn: boolean } {
  const up = parents(program);
  const functions = new Set(program.functions.map((fn) => fn.id));
  const stmts = new Map<NodeId, Stmt>();
  const index = (list: Stmt[]) => {
    for (const stmt of list) {
      stmts.set(stmt.id, stmt);
      for (const region of regionsOf(stmt)) index(region.stmts);
    }
  };
  index(program.main);
  for (const fn of program.functions) index(fn.body);

  let loop = false;
  let at: NodeId | "main" | undefined = place.parent;
  while (at !== undefined && at !== "main" && !functions.has(at)) {
    const stmt = stmts.get(at);
    if (stmt && getBlock(keyOf(stmt)).loop) loop = true;
    at = up.get(at);
  }
  return { loop, fn: at !== undefined && at !== "main" };
}
