// What the value list and the name list know of a value before the program runs: an
// expression's kind from its block's `kind`, and a variable's from its input's declared kind,
// else the value of its first assignment, else the kind its loop block declares. Registry-driven.
import { getBlockDef, keyOf } from "@/blocks/registry";
import { isFloatData } from "./data";
import { assignedValue, declaredBy } from "./scope";
import type { Data, Expr, Name, Kind, NodeId, Program, Stmt } from "./types";
import { allStmts, variableOf } from "./walk";

/** The kind of a value written as Data. */
export function dataKind(data: Data): Kind {
  if (typeof data === "number") return "number";
  if (typeof data === "string") return "text";
  if (typeof data === "boolean") return "truefalse";
  if (data === null) return "none";
  if (Array.isArray(data)) return "list";
  return isFloatData(data) ? "number" : "dict";
}

export type Kinds = ReadonlyMap<Name, Kind>;

/** The kind of `expr`, its variables' kinds being `variables`; undefined when it cannot be told. */
export function exprKind(expr: Expr, variables: Kinds): Kind | undefined {
  const name = variableOf(expr);
  if (name !== undefined) return variables.get(name);
  return getBlockDef(keyOf(expr)).kind?.(expr, (inner) => exprKind(inner, variables));
}

/** `main`, or the function whose body holds statement `id`. */
export function routineOf(program: Program, id: NodeId): "main" | NodeId {
  for (const fn of program.functions) {
    for (const stmt of allStmts(fn.body)) if (stmt.id === id) return fn.id;
  }
  return "main";
}

type Scope = { kinds: Map<Name, Kind>; setters: Map<Name, Stmt> };

const memo = new WeakMap<Program, Map<string, Scope>>();

function scope(program: Program, routine: "main" | NodeId): Scope {
  let routines = memo.get(program);
  if (!routines) {
    routines = new Map();
    memo.set(program, routines);
  }
  const known = routines.get(routine);
  if (known) return known;
  const fn = program.functions.find((candidate) => candidate.id === routine);
  const kinds = new Map<Name, Kind>();
  const setters = new Map<Name, Stmt>();
  const assigned = new Set<Name>();
  if (!fn) {
    for (const input of program.inputs) {
      kinds.set(input.name, input.kind);
      assigned.add(input.name);
    }
  }
  for (const stmt of allStmts(fn ? fn.body : program.main)) {
    const def = getBlockDef(keyOf(stmt));
    for (const { name, role } of declaredBy(stmt)) {
      if (!setters.has(name)) setters.set(name, stmt);
      if (role === "name") {
        // A loop's kind holds until an assignment says otherwise.
        if (!assigned.has(name) && !kinds.has(name) && def.declares) kinds.set(name, def.declares);
        continue;
      }
      if (assigned.has(name)) continue;
      assigned.add(name);
      const value = assignedValue(stmt);
      const kind = value ? exprKind(value, kinds) : undefined;
      if (kind) kinds.set(name, kind);
    }
  }
  const made = { kinds, setters };
  routines.set(routine, made);
  return made;
}

/** The kinds of the variables of `main` or of one function, by its id. */
export function variableKinds(program: Program, routine: "main" | NodeId): Kinds {
  return scope(program, routine).kinds;
}

/** The statement that first sets each variable of `main` or of one function. */
export function firstSetters(program: Program, routine: "main" | NodeId): ReadonlyMap<Name, Stmt> {
  return scope(program, routine).setters;
}
