// N-01 NodeDef plus the runner (R-13/R-14) and emitter (E-08) contracts blocks implement.
import type {
  Expr,
  ExprKind,
  Heap,
  Id,
  NodeId,
  Program,
  Stmt,
  StmtKind,
  Target,
  Value,
} from "@/lang/types";
import type { Event, RuntimeCode } from "@/runtime/types";
import type { Category } from "./categories";

export type SlotRole = "expr" | "exprs" | "id" | "body" | "target" | "text";

/** What a call-like expression invokes; `builtin` and `method` arity comes from `params`. */
export type Callee = {
  name: Id;
  argc: number;
  family: "builtin" | "function" | "class" | "method";
};
export type Slot = { name: string; role: SlotRole; required?: boolean };

// ---------------------------------------------------------------- runner (R-13)

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
  get(name: Id, nodeId: NodeId): Value;
  set(name: Id, value: Value): void;
  call(fn: Id, args: Value[], nodeId: NodeId): Generator<Event, Value, void>;
  fail(nodeId: NodeId, code: RuntimeCode, params?: Record<string, string | number>): never;
  random: { int(a: number, b: number): number; float(a: number, b: number): number };
  print(line: string): void;
};

export type StmtRunner = (node: Stmt, ctx: RunContext) => Generator<Event, Signal, void>;
export type ExprRunner = (node: Expr, ctx: RunContext) => Generator<Event, Value, void>;

// ---------------------------------------------------------------- emitter (E-08)

export type PyLine = string | { block: Stmt[] };
export type Side = "left" | "right";
export type EmitContext = {
  expr(expr: Expr): string;
  /** `expr` wrapped in parentheses when E-05 requires it under a parent of `precedence`. */
  operand(expr: Expr, precedence: number, side: Side): string;
  target(target: Target): string;
  block(stmts: Stmt[]): PyLine;
};

// ---------------------------------------------------------------- NodeDef (N-01)

export type NodeDef = {
  key: string;
  shape: "stmt" | "expr";
  category: Category;
  slots: Slot[];
  /** Builtin parameter names in order (arity = length); template placeholders use them. */
  params?: string[];
  /** Emitter aliases accepted by the parser (G-02), e.g. "random.randint". */
  aliases?: string[];
  /** N-05 */
  imports?: "math" | "random";
  /** E-05 precedence of this expression; undefined = atom. */
  precedence?: (node: Expr) => number;
  /** Not offered in the palette (the `empty` placeholder). */
  hidden?: boolean;
  /** For literal blocks: the zero-like literal of the same type (L-44). */
  zeroLike?(node: Expr): Expr;
  /** For call-like expressions without `params`: what is called and with how many arguments. */
  callee?(node: Expr): Callee;
  /** Its body regions are loop bodies (`break` / `continue` allowed inside). */
  loop?: boolean;
  /** Where the statement may appear: inside a loop, or inside a function (validation). */
  requires?: "loop" | "function";
  create(): Stmt | Expr;
  run: StmtRunner | ExprRunner;
  python(node: Stmt | Expr, ctx: EmitContext): PyLine[] | string;
};

type StmtOf<K extends StmtKind> = Extract<Stmt, { kind: K }>;
type ExprOf<K extends ExprKind> = Extract<Expr, { kind: K }>;

type StmtDef<K extends StmtKind> = Omit<NodeDef, "shape" | "create" | "run" | "python"> & {
  create(): StmtOf<K>;
  run(node: StmtOf<K>, ctx: RunContext): Generator<Event, Signal, void>;
  python(node: StmtOf<K>, ctx: EmitContext): PyLine[];
};

type ExprDef<K extends ExprKind> = Omit<NodeDef, "shape" | "create" | "run" | "python"> & {
  create(): ExprOf<K>;
  run(node: ExprOf<K>, ctx: RunContext): Generator<Event, Value, void>;
  python(node: ExprOf<K>, ctx: EmitContext): string;
};

export function defineStmt<K extends StmtKind>(def: StmtDef<K>): NodeDef {
  return { shape: "stmt", ...def } as unknown as NodeDef;
}

export function defineExpr<K extends ExprKind>(def: ExprDef<K>): NodeDef {
  return { shape: "expr", ...def } as unknown as NodeDef;
}
