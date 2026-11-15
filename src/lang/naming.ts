// The names that the application gives loop variables (`language.md`, Edits, Loop variables): each
// loop takes, by how deep it sits, the first of its names that no loop around it and no other
// variable of its routine has, and the uses of its variable inside it follow. A loop's variable is
// visible only inside its body (`language.md`, Scope, Visibility), so no read outside a loop needs
// a look. Registry-driven: a target slot's `names` and a block's `loop`, never a type.
import {
  createVariable,
  getBlockDef,
  isNamedSlot,
  registryKey,
  type NamedSlot,
} from "@/blocks/registry";
import {
  declarationsUnder,
  declaredBy,
  findVisibleLoop,
  isDefinitionName,
  isLoop,
  statementScopes,
} from "./scope";
import type { Name, NodeId, Program, Routine, Stmt } from "./types";
import {
  allStmts,
  bodyRegions,
  draftText,
  findVariableName,
  getRoutineDef,
  isExpr,
  programStmts,
  renameVariable,
  routineStmts,
  stmtExprs,
} from "./walk";

type Bag = Record<string, unknown>;

/** The slot of `stmt` whose variable the application names (`for`'s `var`), or undefined. */
function findNamedSlot(stmt: Stmt): NamedSlot | undefined {
  return getBlockDef(registryKey(stmt)).slots.find(isNamedSlot);
}

/**
 * The names of the variables of `routine` other than its loops': its parameters or inputs, and
 * each variable that an assignment declares where no loop's variable of the name is visible.
 */
function otherNames(program: Program, routine: Routine): Set<Name> {
  const def = getRoutineDef(program, routine);
  const names = new Set(def === "main" ? program.inputs.map((input) => input.name) : def.params);
  for (const { name, stmt } of declarationsUnder(routineStmts(program, def))) {
    if (!isLoop(stmt) && !findVisibleLoop(program, stmt.id, name)) names.add(name);
  }
  return names;
}

/**
 * The loop that each use of a loop's variable in `stmts` belongs to, by the use's expression id:
 * each read, and each assignment's target, where the variable is visible. A loop's own target
 * declares its variable, so it is no use.
 */
function useLoops(program: Program, stmts: Iterable<Stmt>): Map<NodeId, NodeId> {
  const owners = new Map<NodeId, NodeId>();
  for (const stmt of stmts) {
    const declarations = isLoop(stmt) ? declaredBy(stmt).map((d) => d.target) : [];
    for (const expr of stmtExprs(stmt)) {
      const name = findVariableName(expr);
      if (name === undefined || declarations.includes(expr)) continue;
      const loop = findVisibleLoop(program, stmt.id, name);
      if (loop) owners.set(expr.id, loop.id);
    }
  }
  return owners;
}

/**
 * The names that a loop's body reads from outside the loop, which the loop would hide if it took
 * one: each read in its body that neither its variable nor a variable of a loop inside it that
 * `naming` names owns. A loop's own target declares its variable, so it is no read.
 */
function outsideReads(
  loop: Stmt,
  owners: ReadonlyMap<NodeId, NodeId>,
  naming: ReadonlySet<Stmt>,
): Name[] {
  const inner = bodyRegions(loop).flatMap((region) => [...allStmts(region.stmts)]);
  const renamed = new Set([loop.id, ...inner.filter((stmt) => naming.has(stmt)).map((s) => s.id)]);
  return inner.flatMap((stmt) => {
    const declarations = isLoop(stmt) ? declaredBy(stmt).map((declared) => declared.target) : [];
    return [...stmtExprs(stmt)].flatMap((expr) => {
      const name = findVariableName(expr);
      const owner = owners.get(expr.id);
      const own = declarations.includes(expr) || (owner !== undefined && renamed.has(owner));
      return name === undefined || own ? [] : [name];
    });
  });
}

/** The names of the variables of the loops inside `loop` that `naming` doesn't name. */
function keptInsideNames(loop: Stmt, naming: ReadonlySet<Stmt>): Name[] {
  return bodyRegions(loop)
    .flatMap((region) => [...allStmts(region.stmts)])
    .filter((inner) => isLoop(inner) && !naming.has(inner))
    .flatMap((inner) => declaredBy(inner).map((declared) => declared.name));
}

/**
 * `program` with each loop among `stmts` whose variable the application names given the first of
 * its names that a variable can take and that no loop around it, no loop inside it that keeps its
 * name, no other variable of its routine, and no read in its body from outside it has, outermost
 * first, and each use of a renamed variable renamed with it. A loop keeps an item it stores into,
 * and its variable when no name is free. `program` itself when no name changes.
 */
export function nameLoops(program: Program, stmts: Iterable<Stmt>): Program {
  const naming = new Set([...stmts].filter((stmt) => findNamedSlot(stmt) !== undefined));
  if (naming.size === 0) return program;
  // A loop's variable is visible only inside its body, so its uses are all inside the loop.
  const owners = useLoops(program, new Set([...naming].flatMap((loop) => [...allStmts([loop])])));
  const given = new Map<NodeId, Name>();
  const loopNames = (loop: Stmt) => {
    const name = given.get(loop.id);
    return name === undefined ? declaredBy(loop).map((declared) => declared.name) : [name];
  };
  for (const scope of statementScopes(program)) {
    const slot = naming.has(scope.stmt) ? findNamedSlot(scope.stmt) : undefined;
    if (!slot) continue;
    const held = (scope.stmt as unknown as Bag)[slot.name];
    const name = isExpr(held) ? findVariableName(held) : undefined;
    if (name === undefined && draftText(held) === undefined) continue;
    const taken = new Set([
      ...scope.loops.flatMap(loopNames),
      ...keptInsideNames(scope.stmt, naming),
      ...otherNames(program, scope.routine),
      ...outsideReads(scope.stmt, owners, naming),
    ]);
    const free = slot.names.find((each) => !taken.has(each) && !isDefinitionName(program, each));
    if (free !== undefined && free !== name) given.set(scope.stmt.id, free);
  }
  if (given.size === 0) return program;
  const next = structuredClone(program);
  for (const stmt of programStmts(next)) {
    const name = given.get(stmt.id);
    const slot = name === undefined ? undefined : findNamedSlot(stmt);
    if (name !== undefined && slot) (stmt as unknown as Bag)[slot.name] = createVariable(name);
    for (const expr of stmtExprs(stmt)) {
      const owner = owners.get(expr.id);
      const renamed = owner === undefined ? undefined : given.get(owner);
      if (renamed !== undefined) renameVariable(expr, renamed);
    }
  }
  return next;
}

/** `program` with each loop's variable that still holds a draft named, as `migrate()` reads it. */
export function nameDraftLoops(program: Program): Program {
  return nameLoops(
    program,
    [...programStmts(program)].filter((stmt) => {
      const slot = findNamedSlot(stmt);
      return slot !== undefined && draftText((stmt as unknown as Bag)[slot.name]) !== undefined;
    }),
  );
}
