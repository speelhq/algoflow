# 02 — Language

Types: `src/lang/types.ts`. Validation: `src/lang/validate.ts`. Edits:
`src/lang/edit.ts`. Data conversion: `src/lang/data.ts`.

## Identifiers

L-01 A variable, function, parameter, or field name matches
`/^[a-z_][a-z0-9_]*$/`.

L-02 A class name matches `/^[A-Z][A-Za-z0-9]*$/`.

L-03 No name is in `RESERVED`:

```
False None True and as assert async await break class continue def del elif
else except finally for from global if import in is lambda nonlocal not or
pass raise return try while with yield
list dict set len print range min max sum abs input str int float bool
tuple id type self math random round sorted
```

## Program

```ts
export type Program = {
  version: 1;
  title: string;
  challengeId?: string;
  inputs: Input[]; // empty in Playground (S-07)
  classes: ClassDef[];
  functions: FunctionDef[];
  main: Stmt[];
};
export type Input = { name: Id; value: Data };
export type ClassDef = { id: NodeId; name: Id; fields: Field[] };
export type Field = { name: Id; default: Data }; // L-30
export type FunctionDef = { id: NodeId; name: Id; params: Id[]; body: Stmt[] };
export type NodeId = string; // 12-char nanoid
export type Id = string;
```

L-04 `NodeId` values are unique within a program.

L-05 Function names, class names, and input names are unique within a
program and do not collide with each other.

## Data

`Data` is the JSON form used in program and challenge files.

```ts
export type Data =
  | number // integer → int; fractional or exponent → float
  | { $float: number } // integral float, e.g. 2.0
  | string
  | boolean
  | null
  | Data[]
  | { $cls: string; $id?: number; [field: string]: Data } // object (expectations, module cases, D-18 arguments)
  | { [key: string]: Data }; // dict; int keys are written "$int:3"
```

L-06 `toValue(data, heap)` allocates heap entries for lists, dicts, and
objects; `toData(value, heap)` is its inverse and numbers objects `$id` in
first-reach order. `toValue` allocates one object per distinct `$id`, so
references shared within one value, or across the values converted with
one heap, remain shared.

## Run-time values

```ts
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
```

L-07 `int` and `float` are distinct; `int` values are integral doubles
within ±2^53; a non-integral or overflowing result is `float`.

## Statements

```ts
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

export type Target = VarTarget | IndexTarget | KeyTarget | FieldTarget;
export type VarTarget = { kind: "var"; name: Id };
export type IndexTarget = { kind: "index"; list: Expr; index: Expr };
export type KeyTarget = { kind: "key"; dict: Expr; key: Expr };
export type FieldTarget = { kind: "field"; obj: Expr; field: Id };
```

## Expressions

```ts
type E = { id: NodeId; source?: "text" };
export type Expr =
  | (E & { kind: "empty" }) // L-09
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
```

L-08 `num.raw` is the literal's source text and is what the emitter
writes; `float` is true when `raw` contains `.`, `e`, or `E`.

L-09 An unfilled required expression slot holds `{ kind: "empty" }`:
`create()` fills required slots with it, `validate` reports `E_EMPTY_SLOT`
with the slot name, and the emitter writes `...` for it. It is never
executed.

## Semantics

Each rule has a test using the example.

| Id   | Rule                                                                                                                                             | Example                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| L-10 | `int ∘ int` is `int` for `+ - * // % **` (non-negative exponent); `/` is `float`                                                                 | `7 // 2 → 3`, `4 / 2 → 2.0`  |
| L-11 | any `float` operand → `float`                                                                                                                    | `1 + 2.0 → 3.0`              |
| L-12 | `//` floors; `%` takes the divisor's sign                                                                                                        | `-7 // 2 → -4`, `-7 % 2 → 1` |
| L-13 | division or modulo by zero → `E_DIV_ZERO`                                                                                                        | `1 / 0`                      |
| L-14 | `+` on two `str` concatenates; `str` with a number → `E_TYPE`                                                                                    | `"a" + "b" → "ab"`           |
| L-15 | ordering between a number and a `str` → `E_TYPE`                                                                                                 | `1 < "a"`                    |
| L-16 | `==`: numbers by value (`1 == 1.0`), strings by value, lists and dicts structurally, objects by identity                                         |                              |
| L-17 | `and` / `or` short-circuit and return the deciding operand                                                                                       | `0 or 5 → 5`                 |
| L-18 | false values: `0`, `0.0`, `""`, `[]`, `{}`, `None`, `False`                                                                                      |                              |
| L-19 | `in`: list membership by L-16; dict key membership; `str` substring                                                                              |                              |
| L-20 | list index is `int`; negative counts from the end; otherwise `E_INDEX`                                                                           | `[1,2][-1] → 2`              |
| L-21 | dict keys are `int` or `str`, else `E_TYPE`; missing key → `E_KEY`                                                                               |                              |
| L-22 | `new C(args)` sets every field to a fresh copy of its default, then assigns args in field order; too many args → `E_ARITY`                       |                              |
| L-23 | `o.f` without field `f` → `E_FIELD`                                                                                                              |                              |
| L-24 | lists, dicts, objects are references; assignment copies the reference; `copy()` copies one list level                                            |                              |
| L-25 | `for` iterates `start … stop-1`, bounds evaluated once, `int` only else `E_TYPE`                                                                 |                              |
| L-26 | `foreach` visits `list[0]`, `list[1]`, … and reads the list's length before each pass, as Python does, so changing the list inside the loop changes the passes | appending in the body adds a pass |
| L-27 | `swap` exchanges `list[i]` and `list[j]`                                                                                                         |                              |
| L-28 | calls are positional with exact arity (validated); no `return` → `None`; depth > 200 → `E_RECURSION`                                             |                              |
| L-29 | `print` joins args with one space using Python `str()`: `True`, `None`, `2.0`, `[1, 2]`, `{'a': 1}`, `Value(data=2.0, grad=0.0, prev=[], op='')` |                              |
| L-30 | a field default is a number, string, boolean, `null`, `[]`, or `{}`                                                                              |                              |
| L-31 | a run stops with `E_STEP_LIMIT` after 1,000,000 events                                                                                           |                              |
| L-32 | `random_int(a, b)` (inclusive, `int`) and `random_float(a, b)` draw from mulberry32 seeded per run; `a > b` → `E_TYPE`                                             |                              |

## Scope

L-40 A name is visible from its first `assign` (or `for`/`foreach`
variable, or parameter) to the end of its region and in nested regions.

L-41 A name first assigned inside `then`, `else`, or a loop body and
referenced after that frame → `E_DECLARE_FIRST`; the fix inserts
`name = <default of the same type>` before the frame.

L-42 Functions see only their parameters and body. Field defaults see
nothing.

L-43 A `for` or `foreach` variable is assigned by the loop statement in the
region that contains the loop, so it remains visible after the loop; bounds
and the iterated list are read before the variable exists.

L-44 `hoistAssign` takes the default from the first assignment to the name
inside the frame: `num` → `0` (or `0.0` when float), `str` → `""`, `bool` →
`False`, `list` → `[]`, `dict` → `{}`; any other value → `None`.

L-45 A variable may not take the name of a function, a class, a builtin, or
a module function or class the program uses (L-46) (`E_DUPLICATE_NAME`);
the parameters of one function are distinct.

L-46 A `call` or `new` resolves its name in this order: a function or class
of the program, a learner module, a built-in module, a builtin of
`03-nodes.md`; a program definition shadows every module, and a learner
module shadows a built-in module of the same name (D-02); a name defined by
two modules the program both uses is `E_DUPLICATE_NAME` on the call.

## Validation

`validate(program): Diagnostic[]`, `Diagnostic = { nodeId, code, params, fix?: EditName }`,
run after every edit and before every run.

| Code               | Condition                                                   | params                    |
| ------------------ | ----------------------------------------------------------- | ------------------------- |
| `E_UNDEFINED`      | name not visible (L-40)                                     | `name`                    |
| `E_DECLARE_FIRST`  | L-41                                                        | `name`                    |
| `E_BAD_NAME`       | L-01/02/03                                                  | `name`                    |
| `E_DUPLICATE_NAME` | L-05, L-45, L-46                                            | `name`                    |
| `E_BREAK_OUTSIDE`  | `break`/`continue` outside a loop                           |                           |
| `E_RETURN_OUTSIDE` | `return` in `main`                                          |                           |
| `E_ARITY`          | wrong argument count                                        | `name`, `expected`, `got` |
| `E_UNKNOWN_CALL`   | unknown function, module function, builtin, method, or class | `name`                    |
| `E_EMPTY_SLOT`     | required slot empty (prevents execution)                    | `slot`                    |
| `E_DEFAULT`        | L-30                                                        | `field`                   |
| `E_DUPLICATE_ID`   | L-04                                                        |                           |

## Edits and persistence

L-50 `edit.ts` exports pure functions returning a new `Program`:
`insertStmt`, `moveStmt`, `removeStmt`, `duplicateStmt`, `setSlot`,
`setExpr`, `renameName`, `addFunction`, `removeFunction`, `addClass`,
`removeClass`, `setFields`, `setParams`, `hoistAssign`, and `resetProgram`
(an empty `main` with no functions or classes, keeping `title`,
`challengeId`, and `inputs`; U-05).

L-51 Every edit preserves L-04.

L-52 History keeps the last 100 programs for undo and redo.

L-53 Programs persist to `localStorage` key
`algoflow:program:<challengeId | playground id>` 500 ms after the last
edit; export writes `<title>.algoflow.json` with the modules the program
uses embedded (D-13); import validates and migrates by `version`
(`src/lang/migrate.ts`).

L-54 A statement position is
`Place = { parent: NodeId | "main"; slot: "main" | "body" | "then" | "else"; index: number }`
(`parent` is `"main"`, a function id, or a frame id). `insertStmt`,
`moveStmt`, and `hoistAssign` take a `Place`; `moveStmt` counts `index` in
the target region after the moved statement has been removed. The other
edits address nodes by id; `setExpr` takes an item index for `exprs` slots.

L-55 The value stored under `algoflow:program:<id>` is the `Program` JSON
itself; loading passes it through `migrate()` and treats a rejected value as
absent (C-13 then applies); the challenge's `challengeId` and `inputs`
replace those of a restored program, and a Playground program has neither.
