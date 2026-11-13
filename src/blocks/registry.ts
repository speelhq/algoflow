// The only registry. The interpreter, the emitter, the parser, validation, the chart, the block
// menu, and the block editor all dispatch through `getBlockDef(registryKey(block))`.
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
import { draft } from "./draft";
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
import { builtinKey, methodKey, type BlockDef, type Slot } from "./types";
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
  draft,
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

/** Registry key of a block: its type, or `call:<fn>` / `method:<name>` for builtins. */
export function registryKey(block: Block): string {
  if (block.type === "call")
    return BLOCK_DEFS.has(builtinKey(block.fn)) ? builtinKey(block.fn) : "call";
  if (block.type === "method") return methodKey(block.name);
  return block.type;
}

/** The slot `name` that `block`'s definition declares, if it declares one. */
export function findSlot(block: Block, name: string): Slot | undefined {
  return getBlockDef(registryKey(block)).slots.find((slot) => slot.name === name);
}

/** A block's notation (`blocks.md`, Notation). */
export function blockNotation(block: Block): string {
  return getBlockDef(registryKey(block)).notation(block);
}

/** Block menu entries of one category, in registration order. */
export function menuBlockDefs(category: Category): BlockDef[] {
  return ALL.filter((def) => def.category === category && !def.hidden);
}

export { createDraft, createEmptyDraft } from "./draft";
export { builtinKey, findBuiltinName, methodKey } from "./types";
export type { EmitContext, BlockDef, Param, PyLine, RunContext, Signal, Slot } from "./types";
