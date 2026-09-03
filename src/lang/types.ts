// 02-language.md: the Program AST, run-time values, diagnostics, and edit names.
// No third-party imports (P-01).

export type NodeId = string; // 12 characters from the nanoid alphabet (id.ts)
export type Id = string;

// ---------------------------------------------------------------- Program

export type Program = {
  version: 1;
  title: string;
  challengeId?: string;
  inputs: Input[]; // empty in free mode
  classes: ClassDef[];
  functions: FunctionDef[];
  main: Stmt[];
};
export type Input = { name: Id; value: Data };
export type ClassDef = { id: NodeId; name: Id; fields: Field[] };
export type Field = { name: Id; default: Data }; // L-30
export type FunctionDef = { id: NodeId; name: Id; params: Id[]; body: Stmt[] };

// ---------------------------------------------------------------- Data (JSON form)

export type Data =
  | number // integer → int; fractional or exponent → float
  | { $float: number } // integral float, e.g. 2.0
  | string
  | boolean
  | null
  | Data[]
  | { $cls: string; [field: string]: Data } // object (challenge expectations only)
  | { [key: string]: Data }; // dict; int keys are written "$int:3"

// ---------------------------------------------------------------- Run-time values

export type Value =
  | { t: "int"; v: number }
  | { t: "float"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "none" }
  | { t: "list"; ref: HeapId }
  | { t: "dict"; ref: HeapId }
  | { t: "obj"; ref: HeapId };
export type HeapId = number;
export type HeapEntry =
  | { kind: "list"; items: Value[] }
  | { kind: "dict"; entries: Map<string, Value> } // "i:3" for int 3, "s:ab" for str "ab"
  | { kind: "obj"; cls: Id; fields: Map<Id, Value> };
export type Heap = Map<HeapId, HeapEntry>;

// ---------------------------------------------------------------- Statements

export type Stmt =
  | { id: NodeId; kind: "assign"; target: Target; value: Expr }
  | { id: NodeId; kind: "delete"; target: IndexTarget | KeyTarget }
  | { id: NodeId; kind: "if"; cond: Expr; then: Stmt[]; else: Stmt[] }
  | { id: NodeId; kind: "for"; var: Id; start: Expr; stop: Expr; body: Stmt[] }
  | { id: NodeId; kind: "foreach"; var: Id; list: Expr; body: Stmt[] }
  | { id: NodeId; kind: "while"; cond: Expr; body: Stmt[] }
  | { id: NodeId; kind: "break" }
  | { id: NodeId; kind: "continue" }
  | { id: NodeId; kind: "print"; args: Expr[] }
  | { id: NodeId; kind: "return"; value?: Expr }
  | { id: NodeId; kind: "expr"; expr: Expr }
  | { id: NodeId; kind: "swap"; list: Expr; i: Expr; j: Expr }
  | { id: NodeId; kind: "comment"; text: string };
export type StmtKind = Stmt["kind"];

export type Target = VarTarget | IndexTarget | KeyTarget | FieldTarget;
export type VarTarget = { kind: "var"; name: Id };
export type IndexTarget = { kind: "index"; list: Expr; index: Expr };
export type KeyTarget = { kind: "key"; dict: Expr; key: Expr };
export type FieldTarget = { kind: "field"; obj: Expr; field: Id };

// ---------------------------------------------------------------- Expressions

type E = { id: NodeId; source?: "text" };
export type Expr =
  | (E & { kind: "empty" }) // L-09: an unfilled required slot
  | (E & { kind: "num"; value: number; float: boolean; raw: string })
  | (E & { kind: "str"; value: string })
  | (E & { kind: "bool"; value: boolean })
  | (E & { kind: "none" })
  | (E & { kind: "var"; name: Id })
  | (E & { kind: "binop"; op: BinOp; left: Expr; right: Expr })
  | (E & { kind: "unop"; op: "neg" | "not"; operand: Expr })
  | (E & { kind: "index"; list: Expr; index: Expr })
  | (E & { kind: "key"; dict: Expr; key: Expr })
  | (E & { kind: "field"; obj: Expr; field: Id })
  | (E & { kind: "list"; items: Expr[] })
  | (E & { kind: "dict"; entries: Array<{ key: Expr; value: Expr }> })
  | (E & { kind: "new"; cls: Id; args: Expr[] })
  | (E & { kind: "call"; fn: Id; args: Expr[] })
  | (E & { kind: "method"; obj: Expr; name: Id; args: Expr[] });
export type ExprKind = Expr["kind"];
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

export type Node = Stmt | Expr;

// ---------------------------------------------------------------- Names (L-01..L-03)

export const NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;
export const CLASS_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
export const RESERVED: ReadonlySet<string> = new Set(
  `False None True and as assert async await break class continue def del elif
else except finally for from global if import in is lambda nonlocal not or
pass raise return try while with yield
list dict set len print range min max sum abs input str int float bool
tuple id type self math random round sorted`.split(/\s+/),
);

// ---------------------------------------------------------------- Validation (02 "Validation")

export type DiagnosticCode =
  | "E_UNDEFINED"
  | "E_DECLARE_FIRST"
  | "E_BAD_NAME"
  | "E_DUPLICATE_NAME"
  | "E_BREAK_OUTSIDE"
  | "E_RETURN_OUTSIDE"
  | "E_ARITY"
  | "E_UNKNOWN_CALL"
  | "E_EMPTY_SLOT"
  | "E_DEFAULT"
  | "E_DUPLICATE_ID";

export type Diagnostic = {
  nodeId: NodeId;
  code: DiagnosticCode;
  params: Record<string, string | number>;
  fix?: EditName;
};

// ---------------------------------------------------------------- Edits (L-50, L-54)

export type EditName =
  | "insertStmt"
  | "moveStmt"
  | "removeStmt"
  | "duplicateStmt"
  | "setSlot"
  | "setExpr"
  | "renameName"
  | "addFunction"
  | "removeFunction"
  | "addClass"
  | "removeClass"
  | "setFields"
  | "hoistAssign";

/** L-54: a statement position. `parent` is a frame or function id, or "main". */
export type Place = {
  parent: NodeId | "main";
  slot: "main" | "body" | "then" | "else";
  index: number;
};
