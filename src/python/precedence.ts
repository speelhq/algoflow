// E-05: precedence low → high and the parenthesis rule. No third-party imports (P-01).
import type { BinOp } from "@/lang/types";

export const PRECEDENCE = {
  or: 1,
  and: 2,
  not: 3,
  compare: 4,
  additive: 5,
  multiplicative: 6,
  unary: 7,
  power: 8,
  atom: 9,
} as const;

export type Associativity = "left" | "right" | "none";

const BINOP: Record<BinOp, { precedence: number; associativity: Associativity }> = {
  or: { precedence: PRECEDENCE.or, associativity: "left" },
  and: { precedence: PRECEDENCE.and, associativity: "left" },
  "==": { precedence: PRECEDENCE.compare, associativity: "none" },
  "!=": { precedence: PRECEDENCE.compare, associativity: "none" },
  "<": { precedence: PRECEDENCE.compare, associativity: "none" },
  "<=": { precedence: PRECEDENCE.compare, associativity: "none" },
  ">": { precedence: PRECEDENCE.compare, associativity: "none" },
  ">=": { precedence: PRECEDENCE.compare, associativity: "none" },
  in: { precedence: PRECEDENCE.compare, associativity: "none" },
  "+": { precedence: PRECEDENCE.additive, associativity: "left" },
  "-": { precedence: PRECEDENCE.additive, associativity: "left" },
  "*": { precedence: PRECEDENCE.multiplicative, associativity: "left" },
  "/": { precedence: PRECEDENCE.multiplicative, associativity: "left" },
  "//": { precedence: PRECEDENCE.multiplicative, associativity: "left" },
  "%": { precedence: PRECEDENCE.multiplicative, associativity: "left" },
  "**": { precedence: PRECEDENCE.power, associativity: "right" },
};

export function binopPrecedence(op: BinOp): number {
  return BINOP[op].precedence;
}

export function binopAssociativity(op: BinOp): Associativity {
  return BINOP[op].associativity;
}

export function isComparison(op: BinOp): boolean {
  return BINOP[op].precedence === PRECEDENCE.compare;
}

/**
 * E-05: parentheses when the child binds looser than the parent, or equally on
 * the right of a left-associative operator (or the left of a right-associative
 * one). Comparisons are non-associative: equal precedence needs them on either side.
 */
export function needsParens(
  child: number,
  parent: number,
  side: "left" | "right",
  associativity: Associativity,
): boolean {
  if (child < parent) return true;
  if (child > parent) return false;
  if (associativity === "none") return true;
  return associativity === "left" ? side === "right" : side === "left";
}
