// The Program AST, run-time values, and diagnostics (docs/spec/language/language.md).
// No third-party imports.

export type NodeId = string; // 12 characters from the nanoid alphabet (id.ts)
export type Name = string;

// ---------------------------------------------------------------- Program

export type Program = {
  version: 1;
  title: string;
  challengeId?: string;
  inputs: InputDecl[]; // empty in a Playground program
  /** Empty: no registered block definition constructs an object, so `migrate()` refuses a class. */
  classes: [];
  functions: FunctionDef[];
  main: Stmt[];
};
/** An input of the program: its name and kind; its value comes from the chosen case. */
export type InputDecl = { name: Name; kind: Kind };
export type FunctionDef = { id: NodeId; name: Name; params: Name[]; body: Stmt[] };
/** `main`, or a function by its node id; `"main"` is never a node id, which has 12 characters. */
export type Routine = "main" | NodeId;

// ---------------------------------------------------------------- Data (JSON form)

export type Data =
  | number // integer → int; fractional or exponent → float
  | { $float: number } // integral float, e.g. 2.0
  | string
  | boolean
  | null
  | Data[]
  | { [key: string]: Data }; // dict; int keys are written "$int:3"

// ---------------------------------------------------------------- Run-time values

export type Value =
  | { t: "int"; v: number }
  | { t: "float"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "none" }
  | { t: "list"; ref: HeapId }
  | { t: "dict"; ref: HeapId };
export type HeapId = number;
export type HeapEntry =
  | { type: "list"; items: Value[] }
  | { type: "dict"; entries: Map<string, Value> }; // "i:3" for int 3, "s:ab" for str "ab"
export type Heap = Map<HeapId, HeapEntry>;

// ---------------------------------------------------------------- Statements

/** `caption`: the learner's text for the statement, one trimmed line, absent when empty. */
type S = { id: NodeId; caption?: string };
export type Stmt =
  | (S & { type: "assign"; target: Expr; value: Expr })
  | (S & { type: "delete"; target: Expr })
  | (S & { type: "if"; cond: Expr; then: Stmt[]; else: Stmt[] })
  | (S & { type: "for"; var: Expr; start: Expr; stop: Expr; body: Stmt[] })
  | (S & { type: "foreach"; var: Expr; list: Expr; body: Stmt[] })
  | (S & { type: "while"; cond: Expr; body: Stmt[] })
  | (S & { type: "break" })
  | (S & { type: "continue" })
  | (S & { type: "print"; args: Expr[] })
  | (S & { type: "return"; value?: Expr })
  | (S & { type: "expr"; expr: Expr })
  | (S & { type: "swap"; a: Expr; b: Expr });
export type StmtType = Stmt["type"];

// ---------------------------------------------------------------- Expressions

type E = { id: NodeId };
export type Expr =
  | (E & { type: "empty" }) // What an empty slot holds
  | (E & { type: "num"; value: number; float: boolean; raw: string })
  | (E & { type: "str"; value: string })
  | (E & { type: "bool"; value: boolean })
  | (E & { type: "none" })
  | (E & { type: "var"; name: Name })
  | (E & { type: "binop"; op: BinOp; left: Expr; right: Expr })
  | (E & { type: "unop"; op: "neg" | "not"; operand: Expr })
  | (E & { type: "index"; list: Expr; index: Expr })
  | (E & { type: "key"; dict: Expr; key: Expr })
  | (E & { type: "list"; items: Expr[] })
  | (E & { type: "dict"; entries: Array<{ key: Expr; value: Expr }> })
  | (E & { type: "call"; fn: Name; args: Expr[] })
  | (E & { type: "method"; obj: Expr; name: Name; args: Expr[] });
export type ExprType = Expr["type"];
export type BinOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "//"
  | "%"
  | "**"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "and"
  | "or"
  | "in";

export type Block = Stmt | Expr;

/** What is known of a value before the program runs. */
export type Kind = "number" | "text" | "truefalse" | "none" | "list" | "dict";
export const KINDS: readonly Kind[] = ["number", "text", "truefalse", "none", "list", "dict"];

// ---------------------------------------------------------------- Names

export const NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;
export const CLASS_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
/** Python's keywords. */
export const PYTHON_KEYWORDS: ReadonlySet<string> = new Set(
  `False None True and as assert async await break class continue def del elif
else except finally for from global if import in is lambda nonlocal not or
pass raise return try while with yield`.split(/\s+/),
);
/** Python's keywords, and the builtin and module names a name may not take. */
export const RESERVED: ReadonlySet<string> = new Set([
  ...PYTHON_KEYWORDS,
  ...`list dict set len print range min max sum abs input str int float bool
tuple id type self math random round sorted`.split(/\s+/),
]);

// ---------------------------------------------------------------- Validation

export const DIAGNOSTIC_CODES = [
  "E_UNDEFINED",
  "E_DECLARE_FIRST",
  "E_BAD_NAME",
  "E_DUPLICATE_NAME",
  "E_BREAK_OUTSIDE",
  "E_RETURN_OUTSIDE",
  "E_ARITY",
  "E_UNKNOWN_CALL",
  "E_EMPTY_SLOT",
  "E_DUPLICATE_ID",
] as const;
export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];

export type Diagnostic = {
  nodeId: NodeId;
  code: DiagnosticCode;
  params: Record<string, string | number>;
  /** The edit that fixes it: `hoistAssign`, for `E_DECLARE_FIRST`. */
  fix?: "hoistAssign";
};

// ---------------------------------------------------------------- Edits

/** What holds a region: a routine, or a compound statement by its node id. */
// oxlint-disable-next-line typescript/no-duplicate-type-constituents -- a compound statement's id is a parent too, though `Routine` already spells `NodeId`
export type RegionParent = Routine | NodeId;
/** A statement position. */
export type Place = {
  parent: RegionParent;
  slot: "main" | "body" | "then" | "else";
  index: number;
};
