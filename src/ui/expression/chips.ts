// Edits on one chip, addressed by the expression's id: replace it, empty it, or unwrap an
// operator to its left operand. What an operator is comes from what the parser makes of `a + b`.
import { setExpr } from "@/lang/edit";
import { newId } from "@/lang/id";
import { siteOf } from "@/lang/scope";
import type { Expr, NodeId, Program } from "@/lang/types";
import { childSlots } from "@/lang/walk";
import { keyOf } from "@/nodes";
import { isParseError, parse } from "@/python/parse";

/** The program with expression `id` replaced by `expr`. */
export function replaceChip(program: Program, id: NodeId, expr: Expr): Program {
  const site = siteOf(program, id);
  if (!site) return program;
  return setExpr(program, site.owner, site.slot, expr, site.index);
}

/** The chip's `Delete`: an empty slot in its place. */
export function emptyChip(program: Program, id: NodeId): Program {
  return replaceChip(program, id, { id: newId(), kind: "empty" });
}

let operatorKey: string | undefined;

/** Whether `expr` is the operator block, the one the parser makes of `a + b`. */
export function isOperator(expr: Expr): boolean {
  if (operatorKey === undefined) {
    const parsed = parse("a + b");
    operatorKey = isParseError(parsed) ? "" : keyOf(parsed);
  }
  return keyOf(expr) === operatorKey;
}

/** The chip's `Unwrap`: an operator replaced by its left operand. */
export function unwrapChip(program: Program, expr: Expr): Program {
  const [left] = childSlots(expr);
  return left && isOperator(expr) ? replaceChip(program, expr.id, left.expr) : program;
}
