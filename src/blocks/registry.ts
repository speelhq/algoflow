// The only registry. The interpreter, the emitter, the parser, validation, the chart, the block
// menu, and the block editor all dispatch through `getBlockDef(keyOf(block))`.
import type { Block } from "@/lang/types";
import { assign } from "./assign";
import { binop } from "./binop";
import { bool } from "./bool";
import { breakStmt } from "./break";
import { call } from "./call";
import { abs } from "./call-abs";
import { floatCall } from "./call-float";
import { intCall } from "./call-int";
import { len } from "./call-len";
import { max } from "./call-max";
import { min } from "./call-min";
import { randomInt } from "./call-randint";
import { strCall } from "./call-str";
import { sum } from "./call-sum";
import type { Category } from "./categories";
import { continueStmt } from "./continue";
import { empty } from "./empty";
import { exprStmt } from "./expr";
import { forStmt } from "./for";
import { ifStmt } from "./if";
import { index } from "./index";
import { list } from "./list";
import { none } from "./none";
import { num } from "./num";
import { print } from "./print";
import { returnStmt } from "./return";
import { str } from "./str";
import { swap } from "./swap";
import { builtinKey, methodKey, type BlockDef } from "./types";
import { unop } from "./unop";
import { variable } from "./var";
import { whileStmt } from "./while";

const ALL: BlockDef[] = [
  // statements
  assign,
  ifStmt,
  forStmt,
  whileStmt,
  breakStmt,
  continueStmt,
  print,
  exprStmt,
  returnStmt,
  swap,
  // expressions, in the order of the value list's entries
  empty,
  num,
  variable,
  str,
  bool,
  none,
  list,
  unop,
  randomInt,
  // the items of a list before `Join with another list`, which `binop` declares
  index,
  len,
  sum,
  binop,
  abs,
  max,
  min,
  strCall,
  intCall,
  floatCall,
  call,
];

export const BLOCK_DEFS: ReadonlyMap<string, BlockDef> = new Map(ALL.map((def) => [def.key, def]));

export function hasBlockDef(key: string): boolean {
  return BLOCK_DEFS.has(key);
}

export function getBlockDef(key: string): BlockDef {
  const def = BLOCK_DEFS.get(key);
  if (!def) throw new Error(`unknown block definition "${key}"`);
  return def;
}

/** Registry key of a block: its kind, or `call:<fn>` / `method:<name>` for builtins. */
export function keyOf(block: Block): string {
  if (block.kind === "call")
    return BLOCK_DEFS.has(builtinKey(block.fn)) ? builtinKey(block.fn) : "call";
  if (block.kind === "method") return methodKey(block.name);
  return block.kind;
}

/** Block menu entries of one category, in registration order. */
export function menuBlockDefs(category: Category): BlockDef[] {
  return ALL.filter((def) => def.category === category && !def.hidden);
}

export { emptyExpr } from "./empty";
export { builtinKey, builtinOf, methodKey } from "./types";
export type { EmitContext, BlockDef, Param, PyLine, RunContext, Signal, Slot } from "./types";
