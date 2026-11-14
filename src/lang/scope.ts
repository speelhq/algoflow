// Where each statement sits and what the scope rules give it (`language.md`, Scope, Visibility;
// Declaring a name before a compound statement), read from a program's structure: the variables
// each statement declares, the variables visible at each statement and what declares them, and
// whether a loop or a function holds a statement or a place.
// Registry-driven: slots, `loop`, and regions, never a type.
import { getBlockDef, registryKey } from "@/blocks/registry";
import type { Expr, Name, NodeId, Place, Program, RegionParent, Routine, Stmt } from "./types";
import { bodyRegions, findRoutineDef, findVariableName, isExpr } from "./walk";

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
  for (const slot of getBlockDef(registryKey(stmt)).slots) {
    if (slot.role !== "target" || !slot.binds) continue;
    const target = bag[slot.name];
    const name = isExpr(target) ? findVariableName(target) : undefined;
    if (!isExpr(target) || name === undefined) continue;
    const stored = slot.stores === undefined ? undefined : bag[slot.stores];
    declared.push({ name, target, stores: isExpr(stored) ? stored : undefined });
  }
  return declared;
}

/**
 * A variable visible at a statement, with what declares it: a statement's binding target, by the
 * statement's id; a function's parameter, by the function's id; or an input, by `main`.
 */
export type Visible = { name: Name; declarer: RegionParent };

/**
 * The variables visible at a statement, the most recently declared first, a name declared again
 * listed again. The statements after it share its tail, so the scopes of a program take room in
 * proportion to its declarations rather than to its statements times its declarations.
 */
export type VisibleList = { first: Visible; rest: VisibleList } | undefined;

/** Each variable of `list`, the most recently declared first. */
export function* eachVisible(list: VisibleList): Generator<Visible, void, void> {
  for (let at = list; at; at = at.rest) yield at.first;
}

/** Whether a variable named `name` is in `list`. */
export function isVisible(list: VisibleList, name: Name): boolean {
  for (const each of eachVisible(list)) if (each.name === name) return true;
  return false;
}

/**
 * Where a statement sits and what the scope rules give its slots (`language.md`, Scope): its
 * routine, whether a loop's body holds it at any depth, the variables visible there, and each name
 * first declared inside an earlier compound statement around it, with that statement, which
 * `E_DECLARE_FIRST` names when no visible variable has the name.
 */
export type StatementScope = {
  stmt: Stmt;
  routine: Routine;
  inLoop: boolean;
  visible: VisibleList;
  declaredInside: ReadonlyMap<Name, NodeId>;
};

/** Whether a loop's body holds the regions of `holder`, which a loop's body holds when `inLoop`. */
function isRegionInLoop(holder: Stmt, inLoop: boolean): boolean {
  return inLoop || getBlockDef(registryKey(holder)).loop === true;
}

/**
 * Sets the scope of each statement of one region and of the regions inside it, from what holds on
 * entry (`around`), and returns the names first declared anywhere inside the region that weren't
 * visible on entry, so the region around it can name its compound statement for them.
 */
function walkScopes(
  stmts: readonly Stmt[],
  around: Omit<StatementScope, "stmt">,
  out: StatementScope[],
): Set<Name> {
  let { visible, declaredInside } = around;
  const declared = new Set<Name>();
  for (const stmt of stmts) {
    out.push({ ...around, stmt, visible, declaredInside });
    for (const { name } of declaredBy(stmt)) {
      if (!isVisible(visible, name)) declared.add(name);
      visible = { first: { name, declarer: stmt.id }, rest: visible };
    }
    const inLoop = isRegionInLoop(stmt, around.inLoop);
    for (const region of bodyRegions(stmt)) {
      const inside = { ...around, inLoop, visible, declaredInside };
      for (const name of walkScopes(region.stmts, inside, out)) {
        if (isVisible(visible, name)) continue;
        declared.add(name);
        if (!declaredInside.has(name)) declaredInside = new Map(declaredInside).set(name, stmt.id);
      }
    }
  }
  return declared;
}

/** A list of `declared`, the last first, each declared by `declarer`. */
function createVisibleList(declared: readonly Name[], declarer: RegionParent): VisibleList {
  let list: VisibleList = undefined;
  for (const name of declared) list = { first: { name, declarer }, rest: list };
  return list;
}

const scopesMemo = new WeakMap<Program, readonly StatementScope[]>();

/**
 * Every statement of the program with its scope, in one walk per Program, in program order: the
 * functions' statements first, then `main`'s, each statement before those of its regions. A
 * function sees its parameters and its body, and `main` its inputs and its statements
 * (`language.md`, Scope, Visibility). A statement held in two places has a scope for each.
 */
export function statementScopes(program: Program): readonly StatementScope[] {
  let scopes = scopesMemo.get(program);
  if (!scopes) {
    const made: StatementScope[] = [];
    /** Walks a routine's statements, which see `declared`, each declared by `routine`. */
    const walkRoutine = (stmts: Stmt[], routine: Routine, declared: readonly Name[]) => {
      const visible = createVisibleList(declared, routine);
      walkScopes(stmts, { routine, inLoop: false, visible, declaredInside: new Map() }, made);
    };
    for (const fn of program.functions) walkRoutine(fn.body, fn.id, fn.params);
    walkRoutine(
      program.main,
      "main",
      program.inputs.map((input) => input.name),
    );
    scopes = made;
    scopesMemo.set(program, scopes);
  }
  return scopes;
}

/** The scope of the statement with node id `id`, or undefined when the program holds none. */
function findScope(program: Program, id: NodeId): StatementScope | undefined {
  return statementScopes(program).find((scope) => scope.stmt.id === id);
}

/**
 * The names visible to the slots of statement `id`, the most recently declared first: what was
 * declared before it in its region and the regions around it, the loop variables of the loops
 * around it, and the inputs or parameters. Undefined for an unknown id.
 */
export function findVisibleNames(program: Program, id: NodeId): Name[] | undefined {
  const scope = findScope(program, id);
  return scope && [...new Set([...eachVisible(scope.visible)].map((each) => each.name))];
}

/** The statement whose region holds each statement; a top-level statement maps to its routine. */
function parents(program: Program): Map<NodeId, RegionParent> {
  const map = new Map<NodeId, RegionParent>();
  const walk = (stmts: Stmt[], parent: RegionParent) => {
    for (const stmt of stmts) {
      map.set(stmt.id, parent);
      for (const region of bodyRegions(stmt)) walk(region.stmts, stmt.id);
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
      for (const region of bodyRegions(stmt)) index(region.stmts);
    }
  };
  index(program.main);
  for (const fn of program.functions) index(fn.body);

  let loop = false;
  let at: RegionParent | undefined = place.parent;
  while (at !== undefined && findRoutineDef(program, at) === undefined) {
    const stmt = stmts.get(at);
    if (stmt && getBlockDef(registryKey(stmt)).loop) loop = true;
    at = up.get(at);
  }
  return { loop, fn: at !== undefined && at !== "main" };
}
