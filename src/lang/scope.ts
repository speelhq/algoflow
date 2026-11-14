// Where each statement sits and what the scope rules give it (`language.md`, Scope, Visibility;
// Declaring a name before a compound statement), read from a program's structure: the variables
// each statement declares, the variables visible at each statement and what declares them, and
// whether a loop or a function holds a statement or a place.
// Registry-driven: slots, `loop`, and regions, never a type.
import { getBlockDef, registryKey } from "@/blocks/registry";
import type {
  Block,
  Expr,
  Name,
  NodeId,
  Place,
  Program,
  RegionParent,
  Routine,
  Stmt,
} from "./types";
import { allStmts, bodyRegions, findRoutineDef, findVariableName, isExpr, stmtExprs } from "./walk";

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

/** A variable that a statement declares, with that statement. */
export type Declaration = Declared & { stmt: Stmt };

/**
 * Every variable that the statements under `stmts` declare, at any depth, in program order: a
 * routine's when `stmts` are its statements.
 */
export function declarationsUnder(stmts: readonly Stmt[]): Declaration[] {
  return [...allStmts(stmts)].flatMap((stmt) =>
    declaredBy(stmt).map((declared) => ({ ...declared, stmt })),
  );
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

/** Where a node stands: its owner (`chart.md`, Shapes) and the routine that holds it. */
type Standing = { owner: NodeId; routine: Routine };
type NodeIndex = {
  blocks: Map<NodeId, Block>;
  standings: Map<NodeId, Standing>;
  scopes: Map<NodeId, StatementScope>;
};

const indexes = new WeakMap<Program, NodeIndex>();

/**
 * Every block and function of the program by id, and every statement's scope, read from the
 * statements' scopes once per Program, so a statement's routine is recorded in one walk: a
 * function owns itself and is its own routine, a statement owns itself, and an expression's owner
 * is its statement. A statement held in two places (`E_DUPLICATE_ID`) is indexed by its last.
 */
function nodeIndex(program: Program): NodeIndex {
  let index = indexes.get(program);
  if (!index) {
    const blocks = new Map<NodeId, Block>();
    const standings = new Map<NodeId, Standing>();
    const scopes = new Map<NodeId, StatementScope>();
    for (const fn of program.functions) standings.set(fn.id, { owner: fn.id, routine: fn.id });
    for (const scope of statementScopes(program)) {
      const { stmt, routine } = scope;
      blocks.set(stmt.id, stmt);
      scopes.set(stmt.id, scope);
      standings.set(stmt.id, { owner: stmt.id, routine });
      for (const expr of stmtExprs(stmt)) {
        blocks.set(expr.id, expr);
        standings.set(expr.id, { owner: stmt.id, routine });
      }
    }
    index = { blocks, standings, scopes };
    indexes.set(program, index);
  }
  return index;
}

/** Where node `id` stands; throws for a node id the program doesn't hold. */
function getStanding(program: Program, id: NodeId): Standing {
  const standing = nodeIndex(program).standings.get(id);
  if (!standing) throw new Error(`no node ${id}`);
  return standing;
}

/** Every statement and expression of the program by id. */
export function blocksById(program: Program): Map<NodeId, Block> {
  return nodeIndex(program).blocks;
}

/**
 * The owner of node `id`, the statement or function that stands for it on a chart (`chart.md`,
 * Shapes). Throws for a node id the program doesn't hold.
 */
export function getOwner(program: Program, id: NodeId): NodeId {
  return getStanding(program, id).owner;
}

/**
 * The routine that holds node `id`: a function holds itself and every node of its body, and
 * `main` every node of its own. Throws for a node id the program doesn't hold.
 */
export function getHoldingRoutine(program: Program, id: NodeId): Routine {
  return getStanding(program, id).routine;
}

/** Whether node `id` is a statement of the program, a block that owns itself. */
export function isStatement(program: Program, id: NodeId): boolean {
  const { blocks, standings } = nodeIndex(program);
  return blocks.has(id) && standings.get(id)?.owner === id;
}

/** The scope of the statement with node id `id`, or undefined when the program holds none. */
function findScope(program: Program, id: NodeId): StatementScope | undefined {
  return nodeIndex(program).scopes.get(id);
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

/**
 * Whether a statement at `place` would be inside a loop body and inside a function: inside one
 * when its region is a loop's body or lies inside one, and inside a function when its routine is
 * one. A place whose parent the program doesn't hold is inside neither.
 */
export function placeContext(program: Program, place: Place): { loop: boolean; fn: boolean } {
  if (findRoutineDef(program, place.parent) !== undefined) {
    return { loop: false, fn: place.parent !== "main" };
  }
  const parent = findScope(program, place.parent);
  if (!parent) return { loop: false, fn: false };
  return { loop: isRegionInLoop(parent.stmt, parent.inLoop), fn: parent.routine !== "main" };
}
