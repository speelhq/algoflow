// What the editor asks of a program's structure: the names visible at a statement,
// and whether a place lies inside a loop or a function.
// Registry-driven: slots, `loop`, and regions, never a type.
import { getBlockDef, keyOf } from "@/blocks/registry";
import type { Expr, Name, NodeId, Place, Program, RegionParent, Stmt } from "./types";
import { findRoutine, isExpr, regionsOf, variableOf } from "./walk";

type Bag = Record<string, unknown>;

/**
 * A variable that a statement's binding target slot declares, with the expression whose value
 * the slot stores (`stores`): `x` and `<value>` of `x = <value>`. A loop's has none, because its
 * passes give the value (`blocks.md`, Slots).
 */
export type Declared = { name: Name; target: Expr; stores: Expr | undefined };

/**
 * The variables a statement's binding target slots hold (`x` of `x = …`, `i` of `for i in …`):
 * each is declared there, not read (`language.md`, Scope).
 */
export function declaredBy(stmt: Stmt): Declared[] {
  const bag = stmt as unknown as Bag;
  const declared: Declared[] = [];
  for (const slot of getBlockDef(keyOf(stmt)).slots) {
    if (slot.role !== "target" || !slot.binds) continue;
    const target = bag[slot.name];
    const name = isExpr(target) ? variableOf(target) : undefined;
    if (!isExpr(target) || name === undefined) continue;
    const stored = slot.stores === undefined ? undefined : bag[slot.stores];
    declared.push({ name, target, stores: isExpr(stored) ? stored : undefined });
  }
  return declared;
}

/** `names` with `latest` moved to the front, in their order. */
function bump(names: Name[], latest: Name[]): Name[] {
  return [...latest, ...names.filter((name) => !latest.includes(name))];
}

/**
 * The names visible to the slots of statement `id`, the most recently assigned first:
 * what was assigned before it in its region and the regions around it, the loop variables
 * of the loops around it, and the inputs or parameters. Undefined for an unknown id.
 */
export function visibleAt(program: Program, id: NodeId): Name[] | undefined {
  const walk = (stmts: Stmt[], visible: Name[]): Name[] | undefined => {
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

/** The statement whose region holds each statement; a top-level statement maps to its routine. */
function parents(program: Program): Map<NodeId, RegionParent> {
  const map = new Map<NodeId, RegionParent>();
  const walk = (stmts: Stmt[], parent: RegionParent) => {
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
  let at: RegionParent | undefined = place.parent;
  while (at !== undefined && findRoutine(program, at) === undefined) {
    const stmt = stmts.get(at);
    if (stmt && getBlockDef(keyOf(stmt)).loop) loop = true;
    at = up.get(at);
  }
  return { loop, fn: at !== undefined && at !== "main" };
}
