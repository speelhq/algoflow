// N-01: the only registry. Interpreter, emitter, parser, validator, palette,
// and properties all dispatch through `getNode(keyOf(node))`.
import type { Node } from "@/lang/types";
import { assign } from "./assign";
import { binop } from "./binop";
import { bool } from "./bool";
import type { Category } from "./categories";
import { empty } from "./empty";
import { none } from "./none";
import { num } from "./num";
import { str } from "./str";
import type { NodeDef } from "./types";
import { unop } from "./unop";
import { variable } from "./var";

const ALL: NodeDef[] = [
  // statements
  assign,
  // expressions
  empty,
  num,
  str,
  bool,
  none,
  variable,
  binop,
  unop,
];

export const NODES: ReadonlyMap<string, NodeDef> = new Map(ALL.map((def) => [def.key, def]));

export function hasNode(key: string): boolean {
  return NODES.has(key);
}

export function getNode(key: string): NodeDef {
  const def = NODES.get(key);
  if (!def) throw new Error(`unknown node "${key}"`);
  return def;
}

/** Registry key of an AST node: its kind, or `call:<fn>` / `method:<name>` for builtins. */
export function keyOf(node: Node): string {
  if (node.kind === "call") return NODES.has(`call:${node.fn}`) ? `call:${node.fn}` : "call";
  if (node.kind === "method") return `method:${node.name}`;
  return node.kind;
}

/** U-10: palette entries of one category, in registration order. */
export function paletteNodes(category: Category): NodeDef[] {
  return ALL.filter((def) => def.category === category && !def.hidden);
}

export type { EmitContext, NodeDef, PyLine, RunContext, Signal, Slot } from "./types";
