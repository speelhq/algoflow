// E-05: the one operator table the parser and the emitter share. No third-party imports (P-01).
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

/** Every binary operator with its level, in the order the grammar lists them. */
const BINOP: Record<BinOp, number> = {
  or: PRECEDENCE.or,
  and: PRECEDENCE.and,
  "==": PRECEDENCE.compare,
  "!=": PRECEDENCE.compare,
  "<": PRECEDENCE.compare,
  "<=": PRECEDENCE.compare,
  ">": PRECEDENCE.compare,
  ">=": PRECEDENCE.compare,
  in: PRECEDENCE.compare,
  "+": PRECEDENCE.additive,
  "-": PRECEDENCE.additive,
  "*": PRECEDENCE.multiplicative,
  "/": PRECEDENCE.multiplicative,
  "//": PRECEDENCE.multiplicative,
  "%": PRECEDENCE.multiplicative,
  "**": PRECEDENCE.power,
};

/** Associativity is a property of the level: `**` is right-associative, comparisons chain nowhere. */
const ASSOCIATIVITY: Partial<Record<number, Associativity>> = {
  [PRECEDENCE.power]: "right",
  [PRECEDENCE.compare]: "none",
};

export const BINOPS = Object.keys(BINOP) as BinOp[];

export function binopPrecedence(op: BinOp): number {
  return BINOP[op];
}

export function binopsAt(level: number): BinOp[] {
  return BINOPS.filter((op) => BINOP[op] === level);
}

export function isBinOp(text: string): text is BinOp {
  return Object.hasOwn(BINOP, text);
}

export function isComparison(op: BinOp): boolean {
  return BINOP[op] === PRECEDENCE.compare;
}

export function levelAssociativity(level: number): Associativity {
  return ASSOCIATIVITY[level] ?? "left";
}

/**
 * E-05: parentheses when the child binds looser than the parent, or equally on
 * the right of a left-associative operator (or the left of a right-associative
 * one). Comparisons are non-associative: equal precedence needs them on either side.
 */
export function needsParens(child: number, parent: number, side: "left" | "right"): boolean {
  if (child < parent) return true;
  if (child > parent) return false;
  const associativity = levelAssociativity(parent);
  if (associativity === "none") return true;
  return associativity === "left" ? side === "right" : side === "left";
}
