// BlockDef plus the runner and emitter contracts that block definitions implement.
import type {
  Expr,
  ExprKind,
  Heap,
  Name,
  Kind,
  NodeId,
  Program,
  Stmt,
  StmtKind,
  Value,
} from "@/lang/types";
import type { Event, Ref, RuntimeCode } from "@/runtime/types";
import type { Category } from "./categories";

export type SlotRole = "expr" | "exprs" | "name" | "body" | "target" | "text";

/** What a call-like expression invokes; `builtin` and `method` arity comes from `params`. */
export type Callee = {
  name: Name;
  argc: number;
  family: "builtin" | "function" | "method";
};

/** A stored literal field its block would not write, and why. */
export type FieldFault = { field: string; message: string };

const BUILTIN = "call:";
const METHOD = "method:";

/** The registry key of the builtin `name`: `call:<name>`. */
export function builtinKey(name: string): string {
  return `${BUILTIN}${name}`;
}

/** The builtin a registry key names, or undefined for a key of another block. */
export function builtinOf(key: string): string | undefined {
  return key.startsWith(BUILTIN) ? key.slice(BUILTIN.length) : undefined;
}

/** The registry key of the method `name`: `method:<name>`. */
export function methodKey(name: string): string {
  return `${METHOD}${name}`;
}

/** A builtin's or method's parameter, `name` as its notation writes it. */
export type Param = { name: string; optional?: true };

/**
 * The argument count `params` expect when `got` is not one they take: the fewest when too few,
 * the most when too many; undefined when `got` fits.
 */
export function expectedArgs(params: readonly Param[], got: number): number | undefined {
  const fewest = params.filter((param) => !param.optional).length;
  if (got < fewest) return fewest;
  if (got > params.length) return params.length;
  return undefined;
}

export type Slot = {
  name: string;
  role: SlotRole;
  required?: boolean;
  /** Its input binds as an atom: an operation there is parenthesized (the list of an item). */
  atom?: true;
  /** A `target` slot that declares the variable its target is (`assign`'s). */
  binds?: true;
};

/** The groups of the value list, in its order. */
export type MenuGroup = "values" | "conditions" | "calculate" | "items" | "compare" | "convert";

/** One entry of the value list. */
export type MenuEntry = {
  /** `""` for the block's own label and help, else `block.<key>.<name>.label` / `.help`. */
  name: string;
  group: MenuGroup;
  /** Offered after a value of these kinds, which it takes as its first input. */
  on?: readonly Kind[];
  /** Slot values set on the block's `create()` (binop `op`). */
  preset?: Record<string, unknown>;
  /** Shown before the name in the list (`×`). */
  symbol?: string;
  /** What typed in a value line inserts it. */
  keys?: string;
};

// ---------------------------------------------------------------- runner

export type Signal =
  | undefined
  | { kind: "break" }
  | { kind: "continue" }
  | { kind: "return"; value: Value };

export type RunContext = {
  program: Program;
  heap: Heap;
  eval(expr: Expr): Generator<Event, Value, void>;
  exec(body: Stmt[]): Generator<Event, Signal, void>;
  /** The place of `target`, found by its block's `locate`; its errors carry `at`. */
  locate(target: Expr, at: NodeId): Generator<Event, Ref, void>;
  /**
   * Locates `target` and reads its value (`E_UNDEFINED` at `at` for a variable never assigned),
   * with a `read` of the target for a place that is no variable.
   */
  read(target: Expr, at: NodeId): Generator<Event, { ref: Ref; value: Value }, void>;
  save(ref: Ref, value: Value): void;
  /** Locates `target`, saves `value` there, and emits its `write`, which carries `at`. */
  store(target: Expr, value: Value, at: NodeId): Generator<Event, void, void>;
  call(fn: Name, args: Value[], nodeId: NodeId): Generator<Event, Value, void>;
  fail(nodeId: NodeId, code: RuntimeCode, params?: Record<string, string | number>): never;
  /** `E_VALUE`: the operation of `block` does not take a value of this type. */
  valueError(block: Expr, value: Value): never;
  /** `E_NUMBER_TEXT`: the operation of `block` cannot read this text as its number. */
  textError(block: Expr, text: string): never;
  random: { int(a: number, b: number): number };
  print(line: string): void;
};

export type StmtRunner = (block: Stmt, ctx: RunContext) => Generator<Event, Signal, void>;
export type ExprRunner = (block: Expr, ctx: RunContext) => Generator<Event, Value, void>;

// ---------------------------------------------------------------- emitter

export type PyLine = string | { region: Stmt[] };
export type Side = "left" | "right";
export type EmitContext = {
  expr(expr: Expr): string;
  /** `expr` wrapped in parentheses when the operator table requires it under a parent of `precedence`. */
  operand(expr: Expr, precedence: number, side: Side): string;
  /** The input in slot `name` of `block`, parenthesized as an atom where the slot declares one. */
  slot(block: Stmt | Expr, name: string): string;
  region(stmts: Stmt[]): PyLine;
};

// ---------------------------------------------------------------- chart shape

/**
 * How the chart draws a block: the slot of the condition its diamond asks and its body regions
 * by slot name (a branch, a checked loop, a counted loop with the texts of its generated nodes),
 * or where its edge jumps to (out of the innermost loop, or into its next pass).
 */
export type ChartShape =
  | { branch: { cond: string; yes: string; no: string } }
  | { check: { cond: string; body: string } }
  | { counted: Counted }
  | { jump: "exit" | "next" };

/** A counted loop's body slot, and the texts of its generated nodes with `{slot}` placeholders. */
export type Counted = { body: string; init: string; check: string; update: string };

/** A counted loop's generated nodes. */
export type Generated = "init" | "check" | "update";

// ---------------------------------------------------------------- BlockDef

export type BlockDef = {
  key: string;
  shape: "stmt" | "expr";
  category: Category;
  slots: Slot[];
  /** Builtin and method parameters in order (`expectedArgs`); notation placeholders name them. */
  params?: Param[];
  /** Emitter aliases accepted by the parser, e.g. "random.randint". */
  aliases?: string[];
  imports?: "random";
  /** Precedence of this expression; undefined = atom. */
  precedence?: (block: Expr) => number;
  /** Not in the block menu (`empty`, `expr`). */
  hidden?: boolean;
  /** For literal blocks: the zero-like literal of the same type. */
  zeroLike?(block: Expr): Expr;
  /** For call-like expressions: what is called and with how many arguments. */
  callee?(block: Expr): Callee;
  /** Its body regions are loop bodies (`break` / `continue` allowed inside). */
  loop?: boolean;
  /** Where the statement may appear: inside a loop, or inside a function (validation). */
  requires?: "loop" | "function";
  create(): Stmt | Expr;
  run: StmtRunner | ExprRunner;
  python(block: Stmt | Expr, ctx: EmitContext): PyLine[] | string;
  /** The block's notation with `{slot}` placeholders, the same in every locale (Notation). */
  notation(block: Stmt | Expr): string;
  /**
   * Which of a stored block's literal fields no edit could have written (an operator, a number's
   * text), and why; undefined when its block would make them.
   */
  fieldsError?(fields: Readonly<Record<string, unknown>>): FieldFault | undefined;
  /** The notation's text of a `text` slot; default `String(block[slot])`. */
  text?(block: Stmt | Expr, slot: string): string;
  /** How the chart draws the block's regions; absent = a box with the notation. */
  chart?: ChartShape;
  /** The kind of the expression, given the kinds of the expressions inside it. */
  kind?: (block: Expr, kindOf: (expr: Expr) => Kind | undefined) => Kind | undefined;
  /** The kind of the variable its `name` slot names. */
  declares?: Kind;
  /** The entries of the value list. */
  menu?: readonly MenuEntry[];
  /**
   * A target's place: evaluates the target's expressions, the container before its position, and
   * gives the place, its errors at `at`. A block with `locate` is a target.
   */
  locate?(block: Expr, ctx: RunContext, at: NodeId): Generator<Event, Ref, void>;
};

type StmtOf<K extends StmtKind> = Extract<Stmt, { kind: K }>;
type ExprOf<K extends ExprKind> = Extract<Expr, { kind: K }>;

type Generic = "shape" | "create" | "run" | "python" | "notation" | "text" | "kind" | "locate";

type StmtDef<K extends StmtKind> = Omit<BlockDef, Generic> & {
  create(): StmtOf<K>;
  run(block: StmtOf<K>, ctx: RunContext): Generator<Event, Signal, void>;
  python(block: StmtOf<K>, ctx: EmitContext): PyLine[];
  notation(block: StmtOf<K>): string;
  text?(block: StmtOf<K>, slot: string): string;
};

type ExprDef<K extends ExprKind> = Omit<BlockDef, Generic> & {
  create(): ExprOf<K>;
  run(block: ExprOf<K>, ctx: RunContext): Generator<Event, Value, void>;
  python(block: ExprOf<K>, ctx: EmitContext): string;
  notation(block: ExprOf<K>): string;
  text?(block: ExprOf<K>, slot: string): string;
  kind?(block: ExprOf<K>, kindOf: (expr: Expr) => Kind | undefined): Kind | undefined;
  locate?(block: ExprOf<K>, ctx: RunContext, at: NodeId): Generator<Event, Ref, void>;
};

export function defineStmt<K extends StmtKind>(def: StmtDef<K>): BlockDef {
  return { shape: "stmt", ...def } as unknown as BlockDef;
}

export function defineExpr<K extends ExprKind>(def: ExprDef<K>): BlockDef {
  return { shape: "expr", ...def } as unknown as BlockDef;
}
