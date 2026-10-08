// The edits of a value line (U-50..U-54, U-93) as pure functions of one slot's expression
// and its caret. The caret is at an input still to fill (an empty expression) or after a
// value. An entry whose block has a precedence binds by it, as E-05 states, within the
// innermost brackets; any other entry takes the last value. Reads slots and `precedence`.
import { newId } from "@/lang/id";
import type { Expr, NodeId } from "@/lang/types";
import { childSlots, isEmptyExpr, isExpr } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes";
import { isParseError, parse } from "@/python/parse";
import { PRECEDENCE, needsParens } from "@/python/precedence";
import { inputOrder } from "@/ui/chart/text";

type Bag = Record<string, unknown>;

/** Where an expression sits: under `parent` in `slot` (at `index` of a list), or the root. */
export type Position = { parent: NodeId | null; slot: string; index?: number };

export type Caret = {
  /** The expression the caret is at: an empty input to fill, or the value it stands after. */
  at: NodeId;
  /** Brackets typed and not yet closed, innermost last: the positions they hold. */
  groups: Position[];
};

export type Line = { root: Expr; caret: Caret };

/** A refused edit names its message key (`error.E_PARSE_CHAIN`). */
export type Edit = Line | { refused: "E_PARSE_CHAIN" };

export const empty = (): Expr => ({ id: newId(), kind: "empty" });

/** The line holding `root`, with the caret at its first input to fill, else after it. */
export function lineOf(root: Expr): Line {
  return { root, caret: { at: (firstEmpty(root) ?? root).id, groups: [] } };
}

// ---------------------------------------------------------------- the tree

type Found = { node: Expr; position: Position };

/** Every expression under `root` with its position, pre-order. */
function* walk(root: Expr): Generator<Found, void, void> {
  const visit = function* (node: Expr, position: Position): Generator<Found, void, void> {
    yield { node, position };
    for (const child of childSlots(node)) {
      const at: Position = { parent: node.id, slot: child.slot };
      if (child.index !== undefined) at.index = child.index;
      yield* visit(child.expr, at);
    }
  };
  yield* visit(root, { parent: null, slot: "" });
}

export function find(root: Expr, id: NodeId): Found | undefined {
  for (const found of walk(root)) if (found.node.id === id) return found;
  return undefined;
}

function samePosition(a: Position, b: Position): boolean {
  return a.parent === b.parent && a.slot === b.slot && a.index === b.index;
}

/** The expression at `position` under `root`. */
export function nodeAt(root: Expr, position: Position): Expr | undefined {
  if (position.parent === null) return root;
  const parent = find(root, position.parent)?.node;
  if (!parent) return undefined;
  const value = (parent as unknown as Bag)[position.slot];
  const item = position.index === undefined ? value : (value as unknown[])[position.index];
  return isExpr(item) ? item : undefined;
}

/** `root` with the expression `id` replaced by `next`; `root` itself is left unchanged. */
export function replace(root: Expr, id: NodeId, next: Expr): Expr {
  if (root.id === id) return next;
  const copy = structuredClone(root);
  const found = find(copy, id);
  if (!found || found.position.parent === null) return copy;
  const parent = find(copy, found.position.parent)?.node as unknown as Bag;
  const { slot, index } = found.position;
  if (index === undefined) parent[slot] = next;
  else (parent[slot] as unknown[])[index] = next;
  return copy;
}

/** The inputs of an operation in the order its template shows them. */
export function inputsOf(node: Expr): Expr[] {
  return inputOrder(node);
}

/** The first empty input under `node`, in the order the line shows them. */
export function firstEmpty(node: Expr): Expr | undefined {
  if (isEmptyExpr(node)) return node;
  for (const input of inputsOf(node)) {
    const found = firstEmpty(input);
    if (found) return found;
  }
  return undefined;
}

/** Where the caret stops, left to right: each value after its inputs, each empty input. */
export function stops(root: Expr): NodeId[] {
  const out: NodeId[] = [];
  const visit = (node: Expr) => {
    for (const input of inputsOf(node)) visit(input);
    out.push(node.id);
  };
  visit(root);
  return out;
}

const precedenceOf = (node: Expr): number | undefined => getNode(keyOf(node)).precedence?.(node);

/** Whether `node` is a comparison: an expression at the comparisons' precedence. */
function isComparison(node: Expr): boolean {
  return precedenceOf(node) === PRECEDENCE.compare;
}

// ---------------------------------------------------------------- edits

/** The caret at `node`: at its first empty input, else after it. */
function caretAt(line: Line, root: Expr, node: Expr): Line {
  return { root, caret: { ...line.caret, at: (firstEmpty(node) ?? node).id } };
}

/** Fills the input the caret is at with `value` (U-53). */
export function fill(line: Line, value: Expr): Line {
  const root = replace(line.root, line.caret.at, value);
  return caretAt(line, root, value);
}

/** Whether `found` sits where brackets typed and not yet closed begin. */
function inGroup(line: Line, found: Found): boolean {
  return line.caret.groups.some((group) => samePosition(group, found.position));
}

/**
 * Attaches `made` after the value at the caret (U-53): a block with a precedence takes as
 * its first input the largest value ending at the caret that binds at least as tightly,
 * within the innermost brackets; any other block takes the value at the caret.
 */
export function attach(line: Line, made: Expr): Edit {
  const own = precedenceOf(made);
  let found = find(line.root, line.caret.at);
  if (!found) return line;
  if (own !== undefined) {
    for (;;) {
      if (inGroup(line, found) || found.position.parent === null) break;
      const parent = find(line.root, found.position.parent);
      if (!parent) break;
      const parentInputs = inputsOf(parent.node);
      const last = parentInputs[parentInputs.length - 1];
      const level = precedenceOf(parent.node);
      if (last?.id !== found.node.id || level === undefined) break;
      if (needsParens(level, own, "left")) break;
      found = parent;
    }
    if (isComparison(made) && isComparison(found.node)) return { refused: "E_PARSE_CHAIN" };
    if (isComparison(made) && found.position.parent !== null) {
      const parent = find(line.root, found.position.parent)?.node;
      if (parent && isComparison(parent) && !inGroup(line, found)) {
        return { refused: "E_PARSE_CHAIN" };
      }
    }
  }
  const [first] = inputsOf(made);
  if (!first) return line;
  const placed = replace(made, first.id, found.node);
  const root = replace(line.root, found.node.id, placed);
  return caretAt(line, root, placed);
}

/**
 * An operation whose operator was just made to bind more tightly (`*` typed again is `**`):
 * its first input shrinks to the part of it that binds at least as tightly, as `attach` would
 * have chosen for the new operator, and the rest goes back around the operation.
 */
export function rebind(line: Line, id: NodeId): Line {
  const operation = find(line.root, id)?.node;
  const own = operation ? precedenceOf(operation) : undefined;
  const [first] = operation ? inputsOf(operation) : [];
  if (!operation || own === undefined || !first) return line;
  let left = first;
  for (;;) {
    const level = precedenceOf(left);
    const inputs = inputsOf(left);
    const last = inputs[inputs.length - 1];
    if (level === undefined || !last || !needsParens(level, own, "left")) break;
    left = last;
  }
  if (left.id === first.id) return line;
  const tighter = replace(operation, first.id, left);
  const outer = replace(first, left.id, tighter);
  return { ...line, root: replace(line.root, operation.id, outer) };
}

/** Replaces an operation's `op` (U-54); other slots stay. */
export function retag(line: Line, id: NodeId, preset: Record<string, unknown>): Line {
  const found = find(line.root, id);
  if (!found) return line;
  const next = { ...structuredClone(found.node), ...preset } as Expr;
  return { ...line, root: replace(line.root, id, next) };
}

/**
 * Backspace (U-54): an empty input removes the operator before it, keeping the operation's
 * first input; a number loses its last character; any other value leaves an empty input;
 * the words of an operation remove it and keep its first input.
 */
export function backspace(line: Line): Line {
  const found = find(line.root, line.caret.at);
  if (!found) return line;
  const node = found.node;
  if (isEmptyExpr(node)) {
    if (found.position.parent === null) return line;
    const parent = find(line.root, found.position.parent);
    if (!parent) return line;
    return unwrap(line, parent.node);
  }
  const raw = numberText(node);
  if (raw !== undefined && raw.length > 1) {
    const shorter = typeNumber(line, raw.slice(0, -1), node);
    if (shorter) return shorter;
  }
  if (inputsOf(node).length > 0) return unwrap(line, node);
  const hole = empty();
  return {
    ...line,
    root: replace(line.root, node.id, hole),
    caret: { ...line.caret, at: hole.id },
  };
}

/** An operation replaced by its first input, the caret after that input. */
function unwrap(line: Line, operation: Expr): Line {
  const [first] = inputsOf(operation);
  const kept = first ?? empty();
  const root = replace(line.root, operation.id, kept);
  return { ...line, root, caret: { ...line.caret, at: kept.id } };
}

let numberKey: string | undefined;

/** The text of a number as typed, when `node` is the block the parser makes of digits. */
export function numberText(node: Expr): string | undefined {
  if (numberKey === undefined) {
    const parsed = parse("0");
    numberKey = isParseError(parsed) ? "" : keyOf(parsed);
  }
  if (keyOf(node) !== numberKey) return undefined;
  const def = getNode(numberKey);
  const slot = def.slots.find((s) => s.role === "text");
  return slot ? def.text?.(node, slot.name) : undefined;
}

/** `raw` read as a number in place of `at`, or undefined when it is no number (`007`). */
function typeNumber(line: Line, raw: string, at: Expr): Line | undefined {
  const parsed = parse(raw);
  if (isParseError(parsed) || numberText(parsed) === undefined) return undefined;
  const number = { ...parsed, id: isEmptyExpr(at) ? parsed.id : at.id };
  const root = replace(line.root, at.id, number);
  return { ...line, root, caret: { ...line.caret, at: number.id } };
}

/** A digit or `.` typed (U-50): it starts a number at an empty input or extends the one there. */
export function digit(line: Line, ch: string): Line {
  const at = find(line.root, line.caret.at)?.node;
  if (!at) return line;
  if (isEmptyExpr(at)) return typeNumber(line, ch === "." ? "0." : ch, at) ?? line;
  const raw = numberText(at);
  if (raw === undefined) return line;
  return typeNumber(line, raw + ch, at) ?? line;
}

/** `-` at an empty input: the sign of what follows, the block the parser makes of `-x` (U-93). */
export function sign(line: Line): Line {
  const at = find(line.root, line.caret.at)?.node;
  const parsed = parse("-x");
  if (!at || !isEmptyExpr(at) || isParseError(parsed)) return line;
  const [operand] = inputsOf(parsed);
  if (!operand) return line;
  return fill(line, replace(parsed, operand.id, empty()));
}

/** `(` at an empty input opens brackets there (U-93). */
export function open(line: Line): Line {
  const found = find(line.root, line.caret.at);
  if (!found || !isEmptyExpr(found.node)) return line;
  return { ...line, caret: { ...line.caret, groups: [...line.caret.groups, found.position] } };
}

/** `)` closes the innermost brackets, the caret after what they hold. */
export function close(line: Line): Line {
  const group = line.caret.groups[line.caret.groups.length - 1];
  if (!group) return line;
  const held = nodeAt(line.root, group);
  const groups = line.caret.groups.slice(0, -1);
  return { ...line, caret: { at: held?.id ?? line.caret.at, groups } };
}

/** The caret moved to the next (`1`) or previous (`-1`) stop; `fields` stops at empty inputs only. */
export function move(line: Line, step: 1 | -1, fields = false): Line {
  const all = stops(line.root);
  const at = all.indexOf(line.caret.at);
  for (let i = at + step; i >= 0 && i < all.length; i += step) {
    const id = all[i];
    if (id === undefined) break;
    if (fields && !isEmptyExpr(find(line.root, id)?.node)) continue;
    // Brackets left behind by the caret close.
    return { ...line, caret: { at: id, groups: [] } };
  }
  return line;
}

/** The largest value ending at the caret, within the innermost brackets (what U-52 lists for). */
export function valueBefore(line: Line): Expr | undefined {
  let found = find(line.root, line.caret.at);
  if (!found || isEmptyExpr(found.node)) return undefined;
  for (;;) {
    if (inGroup(line, found) || found.position.parent === null) return found.node;
    const parent = find(line.root, found.position.parent);
    if (!parent) return found.node;
    const inputs = inputsOf(parent.node);
    if (
      inputs[inputs.length - 1]?.id !== found.node.id ||
      precedenceOf(parent.node) === undefined
    ) {
      return found.node;
    }
    found = parent;
  }
}

/** The operation whose input the caret is at, and that input, when the caret is inside one. */
export function inputAt(line: Line): { operation: Expr; input: Expr } | undefined {
  const found = find(line.root, line.caret.at);
  if (!found || found.position.parent === null) return undefined;
  const operation = find(line.root, found.position.parent)?.node;
  return operation ? { operation, input: found.node } : undefined;
}

/** The block made for an entry: its `create()` with the entry's preset slots. */
export function makeEntry(key: string, preset: Record<string, unknown> = {}): Expr {
  const made = getNode(key).create() as Expr;
  return { ...made, ...structuredClone(preset) } as Expr;
}
