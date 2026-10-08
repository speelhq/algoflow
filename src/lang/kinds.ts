// What is known of a value before the program runs (L-59): an expression's kind comes from
// its block's `kind`, a variable's from its input's value or its first assignment.
// Registry-driven: slot roles and `kind`, never a block's key.
import { getNode, keyOf } from "@/nodes";
import { declaredBy } from "./scope";
import type { Data, Expr, Id, Kind, NodeId, Program, Stmt } from "./types";
import { childSlots, isExpr, regionsOf } from "./walk";

/** The kind of an input's value. */
export function dataKind(data: Data): Kind {
  if (typeof data === "number") return "number";
  if (typeof data === "string") return "text";
  if (typeof data === "boolean") return "truefalse";
  if (data === null) return "none";
  if (Array.isArray(data)) return "list";
  if ("$float" in data) return "number";
  return "$cls" in data ? "object" : "dict";
}

/** The name an expression reads when it is a bare name: its block's one slot is an `id` slot. */
export function variableName(expr: Expr): Id | undefined {
  const slots = getNode(keyOf(expr)).slots;
  if (slots.length !== 1 || slots[0]?.role !== "id") return undefined;
  const name = (expr as unknown as Record<string, unknown>)[slots[0].name];
  return typeof name === "string" ? name : undefined;
}

/** The kind of `expr`, given the kinds of the variables; undefined when it cannot be told. */
export function kindOf(expr: Expr, vars: ReadonlyMap<Id, Kind>): Kind | undefined {
  const name = variableName(expr);
  if (name !== undefined) return vars.get(name);
  return getNode(keyOf(expr)).kind?.(expr, (child) => kindOf(child, vars));
}

/**
 * Records the kinds of the names `stmts` assign, in program order, the first assignment of
 * each name winning: a target takes its value's kind, a loop variable the kind its block
 * declares (a counted `for`'s is a number), else none.
 */
function assignKinds(stmts: Stmt[], kinds: Map<Id, Kind>): void {
  for (const stmt of stmts) {
    const targets = new Set(
      getNode(keyOf(stmt))
        .slots.filter((slot) => slot.role === "target")
        .map((slot) => slot.name),
    );
    const first = childSlots(stmt).find((slot) => !targets.has(slot.slot));
    for (const { name, role } of declaredBy(stmt)) {
      if (kinds.has(name)) continue;
      const kind =
        role === "target"
          ? isExpr(first?.expr)
            ? kindOf(first.expr, kinds)
            : undefined
          : getNode(keyOf(stmt)).declares;
      if (kind) kinds.set(name, kind);
    }
    for (const region of regionsOf(stmt)) assignKinds(region.stmts, kinds);
  }
}

const memo = new WeakMap<Program, Map<NodeId | "main", Map<Id, Kind>>>();

/** The kinds of the variables of `main` (with the inputs) or of one function (L-59). */
export function variableKinds(program: Program, chart: NodeId | "main" = "main"): Map<Id, Kind> {
  let charts = memo.get(program);
  if (!charts) {
    charts = new Map();
    memo.set(program, charts);
  }
  const known = charts.get(chart);
  if (known) return known;
  const kinds = new Map<Id, Kind>();
  if (chart === "main") {
    for (const input of program.inputs) kinds.set(input.name, dataKind(input.value));
    assignKinds(program.main, kinds);
  } else {
    const fn = program.functions.find((f) => f.id === chart);
    if (fn) assignKinds(fn.body, kinds);
  }
  charts.set(chart, kinds);
  return kinds;
}
