// Traversal driven by each block's slots, so no module lists block types.
import { getBlockDef, keyOf } from "@/blocks/registry";
import type { Expr, Block, FunctionDef, NodeId, Program, Routine, Stmt } from "./types";

type Bag = Record<string, unknown>;

export function isExpr(value: unknown): value is Expr {
  return typeof value === "object" && value !== null && "type" in value && "id" in value;
}

/** A draft's text (`language.md`, Expressions, Drafts); undefined for any other value. */
export function draftText(value: unknown): string | undefined {
  return isExpr(value) && value.type === "draft" ? value.text : undefined;
}

/** Whether a value is an empty slot: a draft with no text. */
export function isEmptyExpr(value: unknown): boolean {
  return draftText(value) === "";
}

/** Whether an expression names where a value is stored: its block declares `locate`. */
export function isTarget(expr: Expr): boolean {
  return getBlockDef(keyOf(expr)).locate !== undefined;
}

/**
 * The name an expression reads, when it is a variable: the block whose one slot is a name.
 * Read from the block's slots, so no module names the variable block.
 */
export function variableOf(expr: Expr): string | undefined {
  const { slots } = getBlockDef(keyOf(expr));
  const [slot] = slots;
  if (slots.length !== 1 || slot?.role !== "name") return undefined;
  const name = (expr as unknown as Bag)[slot.name];
  return typeof name === "string" ? name : undefined;
}

/**
 * The argument a builtin's or method's parameter `name` takes, and its position among the
 * arguments; undefined when the block has no such parameter or that argument is not passed.
 */
export function paramArg(block: Block, name: string): { arg: Expr; index: number } | undefined {
  const index = getBlockDef(keyOf(block)).params?.findIndex((param) => param.name === name) ?? -1;
  const args = (block as unknown as Bag).args;
  const arg: unknown = index >= 0 && Array.isArray(args) ? args[index] : undefined;
  return isExpr(arg) ? { arg, index } : undefined;
}

export type SlotExpr = { slot: string; expr: Expr; index?: number };

/** The roles of the slots that hold an expression. */
export type ExprRole = "expr" | "target" | "exprs";

/** Direct expression children with the slot each sits in, and its role; a target is one too. */
export function childSlots(block: Block): Array<SlotExpr & { role: ExprRole }> {
  const def = getBlockDef(keyOf(block));
  const bag = block as unknown as Bag;
  const out: Array<SlotExpr & { role: ExprRole }> = [];
  for (const slot of def.slots) {
    const value = bag[slot.name];
    if ((slot.role === "expr" || slot.role === "target") && isExpr(value)) {
      out.push({ slot: slot.name, role: slot.role, expr: value });
    } else if (slot.role === "exprs" && Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isExpr(item)) out.push({ slot: slot.name, role: slot.role, expr: item, index });
      });
    }
  }
  return out;
}

/**
 * A statement's slot or item that holds a draft (`language.md`, Expressions, Drafts), with the
 * draft's text.
 */
export type DraftSlot = SlotExpr & { role: ExprRole; text: string };

/**
 * The drafts of a statement, in slot order: each slot or item that holds one. Only a statement's
 * slot holds a draft.
 */
export function draftSlots(stmt: Stmt): DraftSlot[] {
  return childSlots(stmt).flatMap((held) => {
    const text = draftText(held.expr);
    return text === undefined ? [] : [{ ...held, text }];
  });
}

/** Direct expression children of a statement or expression, in slot order. */
function childExprs(block: Block): Expr[] {
  return childSlots(block).map((entry) => entry.expr);
}

/** Body regions of a statement, in slot order (empty for simple statements). */
export function regionsOf(stmt: Stmt): Array<{ slot: string; stmts: Stmt[] }> {
  const def = getBlockDef(keyOf(stmt));
  const bag = stmt as unknown as Bag;
  const out: Array<{ slot: string; stmts: Stmt[] }> = [];
  for (const slot of def.slots) {
    const value = bag[slot.name];
    if (slot.role === "body" && Array.isArray(value)) {
      out.push({ slot: slot.name, stmts: value as Stmt[] });
    }
  }
  return out;
}

/** Every statement under `stmts`, pre-order. */
export function* allStmts(stmts: Stmt[]): Generator<Stmt, void, void> {
  for (const stmt of stmts) {
    yield stmt;
    for (const region of regionsOf(stmt)) yield* allStmts(region.stmts);
  }
}

/** `expr` and every expression under it, pre-order. */
export function* allExprs(expr: Expr): Generator<Expr, void, void> {
  yield expr;
  for (const child of childExprs(expr)) yield* allExprs(child);
}

/** Every expression of a statement (not its regions). */
export function* stmtExprs(stmt: Stmt): Generator<Expr, void, void> {
  for (const child of childExprs(stmt)) yield* allExprs(child);
}

/** Every NodeId under `stmts`: statements and their expressions, pre-order. */
export function* idsUnder(stmts: Stmt[]): Generator<NodeId, void, void> {
  for (const stmt of allStmts(stmts)) {
    yield stmt.id;
    for (const expr of stmtExprs(stmt)) yield expr.id;
  }
}

/** The function that `routine` names, or "main"; undefined for a routine that names no function. */
export function findRoutine(program: Program, routine: Routine): FunctionDef | "main" | undefined {
  if (routine === "main") return "main";
  return program.functions.find((fn) => fn.id === routine);
}

/** The function that `routine` names, or "main"; throws for a routine that names no function. */
export function getRoutine(program: Program, routine: Routine): FunctionDef | "main" {
  const found = findRoutine(program, routine);
  if (found === undefined) throw new Error(`no function ${routine}`);
  return found;
}

/** The statements of a routine: `main`'s, or a function's body. */
export function routineStmts(program: Program, routine: FunctionDef | "main"): Stmt[] {
  return routine === "main" ? program.main : routine.body;
}

/** Every statement in the program: the functions' first, then `main`'s, each pre-order. */
export function* programStmts(program: Program): Generator<Stmt, void, void> {
  for (const fn of program.functions) yield* allStmts(fn.body);
  yield* allStmts(program.main);
}

export function* programExprs(program: Program): Generator<Expr, void, void> {
  for (const stmt of programStmts(program)) yield* stmtExprs(stmt);
}

/**
 * The condition a diamond asks: the slot its block's `branch` or `checked` names, and what it
 * holds.
 */
export function conditionOf(block: Block): SlotExpr | undefined {
  const chart = getBlockDef(keyOf(block)).chart;
  if (!chart || !("branch" in chart || "checked" in chart)) return undefined;
  const slot = "branch" in chart ? chart.branch.cond : chart.checked.cond;
  const value = (block as unknown as Bag)[slot];
  return isExpr(value) ? { slot, expr: value } : undefined;
}

const conditions = new WeakMap<Program, Map<NodeId, NodeId>>();

/** Each diamond's condition by id, with the statement whose diamond asks it; one pass per Program. */
export function diamondConditions(program: Program): Map<NodeId, NodeId> {
  let found = conditions.get(program);
  if (!found) {
    found = new Map();
    for (const stmt of programStmts(program)) {
      const condition = conditionOf(stmt);
      if (condition) found.set(condition.expr.id, stmt.id);
    }
    conditions.set(program, found);
  }
  return found;
}

/**
 * For each statement with body regions, the ids of every statement inside them,
 * at any depth. A loop's `loop` event clears the marks of these statements.
 */
export function bodyStmts(program: Program): Map<NodeId, NodeId[]> {
  const bodies = new Map<NodeId, NodeId[]>();
  for (const stmt of programStmts(program)) {
    const regions = regionsOf(stmt);
    if (regions.length === 0) continue;
    const ids: NodeId[] = [];
    for (const region of regions) for (const inner of allStmts(region.stmts)) ids.push(inner.id);
    bodies.set(stmt.id, ids);
  }
  return bodies;
}

/** Where a node stands: its owner (`chart.md`, Shapes) and the routine that holds it. */
type Standing = { owner: NodeId; routine: Routine };
type NodeIndex = { blocks: Map<NodeId, Block>; standings: Map<NodeId, Standing> };

const indexes = new WeakMap<Program, NodeIndex>();

/**
 * Every block and function of the program by id, in one pass per Program object: a function owns
 * itself and is its own routine, a statement owns itself, and an expression's owner is its
 * statement.
 */
function nodeIndex(program: Program): NodeIndex {
  let index = indexes.get(program);
  if (!index) {
    const blocks = new Map<NodeId, Block>();
    const standings = new Map<NodeId, Standing>();
    const add = (stmts: Stmt[], routine: Routine) => {
      for (const stmt of allStmts(stmts)) {
        blocks.set(stmt.id, stmt);
        standings.set(stmt.id, { owner: stmt.id, routine });
        for (const expr of stmtExprs(stmt)) {
          blocks.set(expr.id, expr);
          standings.set(expr.id, { owner: stmt.id, routine });
        }
      }
    };
    for (const fn of program.functions) {
      standings.set(fn.id, { owner: fn.id, routine: fn.id });
      add(fn.body, fn.id);
    }
    add(program.main, "main");
    index = { blocks, standings };
    indexes.set(program, index);
  }
  return index;
}

/** Where node `id` stands; throws for a node id the program doesn't hold. */
function standingOf(program: Program, id: NodeId): Standing {
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
export function ownerOf(program: Program, id: NodeId): NodeId {
  return standingOf(program, id).owner;
}

/**
 * The routine that holds node `id`: a function holds itself and every node of its body, and
 * `main` every node of its own. Throws for a node id the program doesn't hold.
 */
export function routineOf(program: Program, id: NodeId): Routine {
  return standingOf(program, id).routine;
}

/** Whether node `id` is a statement of the program, a block that owns itself. */
export function isStatement(program: Program, id: NodeId): boolean {
  const { blocks, standings } = nodeIndex(program);
  return blocks.has(id) && standings.get(id)?.owner === id;
}

/** Every NodeId in the program: functions, statements, expressions. */
export function* programIds(program: Program): Generator<NodeId, void, void> {
  for (const fn of program.functions) {
    yield fn.id;
    yield* idsUnder(fn.body);
  }
  yield* idsUnder(program.main);
}
