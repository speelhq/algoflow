// What the value list and the name list know of a value before the program runs: an
// expression's kind from its block's `yields`, and a variable's from its input's declared kind,
// else the value its first assignment stores, else the kind its loop block declares.
// Registry-driven.
import { getBlockDef, registryKey } from "@/blocks/registry";
import { isFloatData } from "./data";
import { declaredBy } from "./scope";
import type { Data, Expr, Name, Kind, Program, Routine, Stmt } from "./types";
import { allStmts, getRoutineDef, routineStmts, findVariableName } from "./walk";

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
  const name = findVariableName(expr);
  if (name !== undefined) return variables.get(name);
  return getBlockDef(registryKey(expr)).yields?.(expr, (inner) => exprKind(inner, variables));
}

/**
 * What a routine's variables are known to hold: each one's kind, and the statement that first sets
 * it.
 */
type RoutineKinds = { kinds: Map<Name, Kind>; setters: Map<Name, Stmt> };

const memo = new WeakMap<Program, Map<string, RoutineKinds>>();

function routineKinds(program: Program, routine: Routine): RoutineKinds {
  let routines = memo.get(program);
  if (!routines) {
    routines = new Map();
    memo.set(program, routines);
  }
  const known = routines.get(routine);
  if (known) return known;
  const routineDef = getRoutineDef(program, routine);
  const kinds = new Map<Name, Kind>();
  const setters = new Map<Name, Stmt>();
  const assigned = new Set<Name>();
  if (routineDef === "main") {
    for (const input of program.inputs) {
      kinds.set(input.name, input.kind);
      assigned.add(input.name);
    }
  }
  for (const stmt of allStmts(routineStmts(program, routineDef))) {
    const def = getBlockDef(registryKey(stmt));
    for (const { name, stores } of declaredBy(stmt)) {
      if (!setters.has(name)) setters.set(name, stmt);
      if (stores === undefined) {
        // A loop's kind holds until an assignment says otherwise.
        if (!assigned.has(name) && !kinds.has(name) && def.declares) kinds.set(name, def.declares);
        continue;
      }
      if (assigned.has(name)) continue;
      assigned.add(name);
      const kind = exprKind(stores, kinds);
      if (kind) kinds.set(name, kind);
    }
  }
  const made = { kinds, setters };
  routines.set(routine, made);
  return made;
}

/** The kinds of the variables of `main` or of one function, by its id. */
export function variableKinds(program: Program, routine: Routine): Kinds {
  return routineKinds(program, routine).kinds;
}

/** The statement that first sets each variable of `main` or of one function. */
export function firstSetters(program: Program, routine: Routine): ReadonlyMap<Name, Stmt> {
  return routineKinds(program, routine).setters;
}
