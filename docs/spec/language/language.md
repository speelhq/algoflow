# Language

Code: `src/lang/`: types `types.ts`, validation `validate.ts`, edits
`edit.ts`, data conversion `data.ts`, import `migrate.ts`, traversal
`walk.ts`, scope `scope.ts`, kinds `kinds.ts`. Tests: beside each file.

## Identifiers

A variable, function, parameter, or field name matches
`/^[a-z_][a-z0-9_]*$/`.

A class name matches `/^[A-Z][A-Za-z0-9]*$/`.

No name is in `RESERVED`:

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
  version: 2;
  title: string;
  challengeId?: string;
  inputs: InputDecl[]; // empty in Playground (`scope.md`, Curriculum)
  classes: ClassDef[];
  functions: FunctionDef[];
  main: Stmt[];
};
export type InputDecl = { name: Id; kind: Kind };
export type ClassDef = { id: NodeId; name: Id; fields: Field[] };
export type Field = { name: Id; default: Data }; // Semantics, Objects
export type FunctionDef = { id: NodeId; name: Id; params: Id[]; body: Stmt[] };
export type NodeId = string; // 12-char nanoid
export type Id = string;
```

`NodeId` values are unique within a program.

Function names, class names, and input names are unique within a program
and don't collide with each other.

An input declares only its name and kind, and its value comes from the chosen
case (`challenges.md`, Schema), because a value in the program would be a
second copy of one case, which the chart and the `Python` tab would show while
Run used another case.

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
  | { $cls: string; $id?: number; [field: string]: Data } // object (expectations, module cases, a Module page's arguments)
  | { [key: string]: Data }; // dict; int keys are written "$int:3"
```

`toValue(data, heap)` allocates heap entries for lists, dicts, and
objects. `toData(value, heap)` is its inverse, and it numbers objects with
`$id` in the order it first reaches them. `toValue` allocates one object
per distinct `$id`, so references shared within one value, or across the
values converted with one heap, stay shared. A cycle ends in
`{ $cls, $id }`. A repeated object is written again in full under its
`$id`, not as a reference node, so two `Data` values can be compared as
they are.

The `Data` of a program or challenge file is canonical: every number is
finite, and an integral number lies in the int range (Run-time values). In
canonical `Data`, an integral float is written `{ $float: n }`, and a `$int:`
key is an integer in that range, written as Python writes it: `$int:0`, never
`$int:-0`, because those two would name one int, as `-0` and `0` do in Python,
and a second spelling of a key either misses a lookup that CPython makes or
doesn't convert back to itself.

`migrate()` rejects a field that its block wouldn't make (`fieldsError`,
`blocks.md`) and a class field default that isn't canonical `Data`, and it
reports the path of the fault. `migrate()` and `validate()` split faults by
where they are fixed. `validate()` reports what an edit can produce, which the
learner fixes on its node. A fault that only a hand edit makes (an unknown
kind, a missing field, a literal its block wouldn't make, or a `Data` value
that isn't canonical) has no node to fix it on. So `migrate()` refuses it, and
`validate()` never reads a literal field.

While no registered block constructs an object (`new`), a program holds no
class and `Data` holds no object. Until such a block exists, `migrate()`
rejects a class and an input of the kind `object`, and `pnpm check` rejects
a `$cls` in a challenge file and a class name in its `defines`. Each
rejection reports the path of the fault. Until then, only a hand-written
file holds a class or an object. `migrate()` and `pnpm check` refuse it
rather than read what they can, because reading it would need code for
identity, cycles, constructors, and field defaults that no learner reaches,
and refusing it keeps a `$cls` record from passing as a dict.

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

`int` and `float` are distinct.

An `int` is an integer of magnitude at most 2^53 − 1, because a double rounds
2^53 + 1 to 2^53, so an `int` of 2^53 could be a wrong value that looks right
(`9007199254740991 + 2`). A literal or a `Data` number beyond that range is
refused (`parser.md`; Data above), not run as a `float`, because CPython runs
the emitted `raw` as the exact int, so the chart, the `Python` tab, and the
run would show three different numbers with no message, and because
`JSON.parse` rounds a `Data` number before any check sees it.

An operation whose result is an integer outside that range gives a
`float`, because the learner can see this difference from Python, while a
wrong `int` wouldn't show.

## Statements

```ts
type S = { id: NodeId; name?: string }; // Statement names
export type Stmt =
  | (S & { kind: "assign"; target: Expr; value: Expr })
  | (S & { kind: "delete"; target: Expr })
  | (S & { kind: "if"; cond: Expr; then: Stmt[]; else: Stmt[] })
  | (S & { kind: "for"; var: Id; start: Expr; stop: Expr; body: Stmt[] })
  | (S & { kind: "foreach"; var: Id; list: Expr; body: Stmt[] })
  | (S & { kind: "while"; cond: Expr; body: Stmt[] })
  | (S & { kind: "break" })
  | (S & { kind: "continue" })
  | (S & { kind: "print"; args: Expr[] })
  | (S & { kind: "return"; value?: Expr })
  | (S & { kind: "expr"; expr: Expr })
  | (S & { kind: "swap"; a: Expr; b: Expr });
```

A target is an expression that names where a value is stored: a `var`, an
`index`, a `key`, or a `field`. Each of these is a block that declares
`locate` (`blocks.md`, The block definition). A `target` slot holds one
target, or `empty` while it is unfilled (Expressions). `migrate()` refuses
any other expression there, and no edit makes one (`editor.md`, Targets).
A separate target type was rejected, because Python reads a target as an
expression in store position (`nums[j] = …`), and a second type would
repeat each rule of the expression in the emitter, the chart, and every
traversal.

## Expressions

```ts
type E = { id: NodeId };
export type Expr =
  | (E & { kind: "empty" }) // an unfilled slot, below
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

`num.raw` is the literal's source text, and the emitter writes it. `float`
is true when `raw` contains `.`, `e`, or `E`.

An unfilled required expression slot holds `{ kind: "empty" }`. `create()`
fills required slots with it, `validate` reports `E_EMPTY_SLOT` with the
slot name, and the emitter writes `...` for it. It is never executed.
`Expr | null` was rejected, because it would spread null checks through
every block and the emitter, while an `empty` kind keeps `Expr` a closed
union.

## Semantics

Each rule has a test with its example, in the test of the block its
heading names. `src/runtime/semantics.test.ts` tests the rules under Values
and the run.

### Operators (`binop`)

| Rule | Example |
| --- | --- |
| `int ∘ int` is `int` for `+ - * // % **` (non-negative exponent); `/` is `float` | `7 // 2 → 3`, `4 / 2 → 2.0` |
| any `float` operand → `float` | `1 + 2.0 → 3.0` |
| `//` floors; `%` takes the divisor's sign | `-7 // 2 → -4`, `-7 % 2 → 1` |
| division or modulo by zero → `E_DIV_ZERO` | `1 / 0` |
| `0` or `0.0` to a negative power → `E_DIV_ZERO` | `0 ** -1` |
| `+` on two `str` concatenates; `str` with a number → `E_TYPE` | `"a" + "b" → "ab"` |
| ordering between a number and a `str` → `E_TYPE` | `1 < "a"` |
| `==`: numbers by value (`1 == 1.0`), a `bool` and a number as `0` or `1` and the number, strings by value, lists and dicts structurally, objects by identity | `True == 1 → True` |
| `and` / `or` short-circuit and return the deciding operand | `0 or 5 → 5` |
| `in`: list membership by `==`; dict key membership; `str` substring | `"bc" in "abcd" → True` |

`==` accepts a `bool` as Python does, although arithmetic and ordering
refuse one (`interpreter.md`, Errors). `==` and `in` never fail, so a
stricter `==` would answer differently from the emitted Python with no
message.

### Loops (`for`, `foreach`)

| Rule | Example |
| --- | --- |
| `for` iterates `start … stop-1`, bounds evaluated once, `int` only else `E_TYPE` | |
| `foreach` visits `list[0]`, `list[1]`, … and reads the list's length before each pass, as Python does, so changing the list inside the loop changes the passes | appending in the body adds a pass |

`foreach` reads the live list, not a snapshot, because a snapshot would run a
body that changes the list differently from the emitted Python, with no sign
of it. Every other difference from Python is stricter and ends in an error (a
`bool` isn't a number, recursion stops at 200, `E_DECLARE_FIRST`).

### Lists (`swap`, `method:copy`)

| Rule | Example |
| --- | --- |
| `swap(a, b)` runs as `a, b = b, a`: `b`'s place is found and its value read, then `a`'s; then `a`'s place is found again and written, then `b`'s | `swap(nums[0], nums[2])` on `[1, 2, 3]` → `[3, 2, 1]`; `swap(i, nums[i])` with `i = 0`, `nums = [1, 9]` → `i = 1`, `nums = [1, 0]` |
| `copy()` copies one list level | |

### Calls (`call`, `print`, `call:randint`)

| Rule | Example |
| --- | --- |
| a call of a program function is positional with exact arity (validated); no `return` → `None`; depth > 200 → `E_RECURSION` | |
| `print` joins args with one space using Python `str()`: `True`, `None`, `2.0`, `[1, 2]`, `{'a': 1}`, `Value(data=2.0, grad=0.0, prev=[], op='')` | |
| `randint(a, b)` (inclusive, `int`) draws from mulberry32 seeded per run | |
| `randint(a, b)` with `a > b` → `E_EMPTY_RANGE` | `randint(5, 1)` |
| `randint(a, b)` with a bound that isn't an `int` → `E_TYPE` | `randint(1.0, 2)` |

A bound of `1.0` is refused too, because CPython 3.12 and later, which
`pnpm check` requires, raise `TypeError` for any `float` bound.

### Objects (`new`, `field`)

| Rule | Example |
| --- | --- |
| `new C(args)` sets every field to a fresh copy of its default, then assigns args in field order; too many args → `E_ARITY` | |
| `o.f` without field `f` → `E_FIELD` | |
| `v.f` where `v` isn't an object → `E_FIELD`, with the type name of `v` as `cls` | `n.x` with `n = 3` |
| a field default is a number, string, boolean, `null`, `[]`, or `{}` | |

A value that isn't an object fails with `E_FIELD`, not `E_TYPE`, because the
fault is a field it doesn't have, and `E_TYPE` would name a second operand
where there is none.

### Values and the run (`src/runtime`)

| Rule | Example |
| --- | --- |
| false values: `0`, `0.0`, `""`, `[]`, `{}`, `None`, `False` | |
| list index is `int`, else `E_TYPE`; negative counts from the end; out of range → `E_INDEX` | `[1,2][-1] → 2` |
| dict keys are `int` or `str`, else `E_TYPE`; missing key → `E_KEY` | |
| lists, dicts, objects are references; assignment copies the reference | |
| a run stops with `E_EVENT_LIMIT` after 1,000,000 events | |

## Scope

A name is visible from its first `assign` (or `for`/`foreach` variable, or
parameter) to the end of its region and in nested regions.

A `target` slot that `binds` (`blocks.md`, The block definition), as
`assign`'s does, declares the variable its target is and doesn't read it.
An item, a key, or a field in that slot, and every target of a slot that
doesn't bind (`delete`, `swap`), reads its expressions before the value is
stored.

A name first assigned inside `then`, `else`, or a loop body and referenced
after that compound statement gives `E_DECLARE_FIRST`. `hoistAssign` fixes it
by inserting `name = <default of the same type>` before the compound
statement.

Functions see only their parameters and body. Field defaults see nothing.

A `for` or `foreach` variable is assigned by the loop statement in the
region that contains the loop, so it stays visible after the loop. The
bounds and the iterated list are read before the variable exists.

`hoistAssign` takes the default from the first assignment to the name inside
the compound statement: `num` → `0` (or `0.0` when float), `str` → `""`,
`bool` → `False`, `list` → `[]`, `dict` → `{}`, and any other value → `None`.

A variable can't take the name of a function, a class, a builtin, or a module
function or class the program uses (below) (`E_DUPLICATE_NAME`), because the
interpreter, which resolves calls by name, runs such a program and CPython
doesn't: `count = 0` beside `def count()` fails in CPython. The parameters of
one function are distinct. A function can't take a builtin's name, because the
builtin's registry key would shadow the function.

A `call` or `new` resolves its name in this order: a function or class of
the program, a learner module, a built-in module, then a builtin of
`blocks.md`. A program definition shadows every module, and a learner
module shadows a built-in module of the same name (`modules.md`, Schema). A
name that two modules used by the program both define gives
`E_DUPLICATE_NAME` on the call.

## Validation

`validate(program): Diagnostic[]`, where
`Diagnostic = { nodeId, code, params, fix?: "hoistAssign" }`, runs after
every edit and before every run.

| Code               | Condition                                                   | params                    |
| ------------------ | ----------------------------------------------------------- | ------------------------- |
| `E_UNDEFINED`      | a name not visible (Scope)                                  | `name`                    |
| `E_DECLARE_FIRST`  | a name first assigned in a compound statement and read after it (Scope) | `name`, `compound` |
| `E_BAD_NAME`       | a name that breaks Identifiers                              | `name`                    |
| `E_DUPLICATE_NAME` | a name taken twice (Program; Scope)                         | `name`                    |
| `E_BREAK_OUTSIDE`  | `break`/`continue` outside a loop                           |                           |
| `E_RETURN_OUTSIDE` | `return` in `main`                                          |                           |
| `E_ARITY`          | wrong argument count                                        | `name`, `expected`, `got` |
| `E_UNKNOWN_CALL`   | unknown function, module function, builtin, method, or class | `name`                    |
| `E_EMPTY_SLOT`     | required slot empty (prevents execution)                    | `slot`                    |
| `E_DEFAULT`        | a field default that Semantics, Objects doesn't allow       | `field`                   |
| `E_DUPLICATE_ID`   | two nodes share an id (Program)                             |                           |

## Edits

`edit.ts` exports pure functions that return a new `Program`: `insertStmt`,
`moveStmt`, `removeStmt`, `duplicateStmt`, `setSlot`, `setExpr`,
`insertItem` and `removeItem` (an item of an `exprs` slot), `renameName`,
`setStmtName`, `addFunction`, `removeFunction`, `addClass`, `removeClass`,
`setFields`, `setParams`, and `hoistAssign`.

Every edit keeps node ids unique.

A statement position is
`Place = { parent: NodeId | "main"; slot: "main" | "body" | "then" | "else"; index: number }`
(`parent` is `"main"`, a function id, or a compound statement's id).
`insertStmt` and `moveStmt` take one.

`moveStmt` counts `index` in the target region after the moved statement
has been removed, because the drop indicator is computed on the list
without the dragged card.

`hoistAssign(program, compound, name)` takes the id of the compound statement
before which it inserts the assignment, which is the `compound` that
`E_DECLARE_FIRST` reports.

The other edits address nodes by id. `setExpr` takes an item index for
`exprs` slots.

History keeps the last 100 programs for undo and redo, and opening a
program starts an empty history. Consecutive changes typed into one field
of the node editor form one entry, because a typed value changes the chart
with every key. An entry per key would spend the 100 entries on one word,
and an entry made only on leaving the field would keep the chart behind the
editor.

## Storage

Programs persist to the `localStorage` key
`algoflow:program:<challengeId | playground id>` 500 ms after the last
edit, and at once when the browser hides the page. Export writes
`<title>.algoflow.json`, with the modules the program uses embedded
(`modules.md`, Operations). Import validates and migrates by `version`
(`src/lang/migrate.ts`).

`migrate()` reads versions 1 and 2 and returns version 2. A version-1
target `{ kind, ...parts }` becomes the expression of that kind, with those
parts and an id the program doesn't hold. A variable target with no name
becomes `empty`. A target whose kind no registered block has is refused as
an unknown kind.

The value stored under `algoflow:program:<id>` is the `Program` JSON
itself. Loading passes it through `migrate()` and treats a rejected value
as absent, so opening a problem then creates its program
(`challenges.md`, Opening and bundling). A zustand `persist` wrapper was
rejected, because it doesn't suit one key per program, and `migrate()` must
check whatever storage returns.

A restored program takes the `challengeId` and `inputs` of its challenge,
and a Playground program has neither.

A Playground program's id is `play-` followed by a NodeId.
`algoflow:playground` holds `Record<id, { edited: number }>`: the time of each
Playground program's last save, in milliseconds since the epoch. The record
lists exactly the Playground programs in storage. The time is kept here, not
in `Program`, because `Program` would then carry that time into every export
and challenge file. The `play-` prefix keeps a Playground id from reading as a
challenge id.

## Statement names

A statement's `name` is the learner's name for its node (`editor.md`, Node
names). It is one line of text, stored trimmed and with each run of spaces
as one space, and it is absent when empty. `setStmtName` and `migrate()`
store it this way, and `setStmtName` turns each line break into a space.

`migrate()` rejects a statement's name that isn't one line of text.

A statement's name changes neither validation nor execution.

## Kinds

A kind is what the value list and the name list (`editor.md`, Value list;
Name fields) know of a value before the program runs: `number`, `text`,
`truefalse`, `none`, `list`, `dict`, or `object`.

An expression's kind comes from its block's `kind` (`blocks.md`), given the
kinds of the expressions inside it. An expression whose kind can't be
determined has none.

A variable's kind is its input's declared kind. Without one, it is the kind
of the value of its first assignment in program order. Without that, it is
the kind its loop block declares (`declares`, `blocks.md`: `number` for a
`for` variable). A parameter and a `foreach` variable have no kind.

## Verification

The tests of `src/lang` give every validation code a failing and a passing
case, show that every edit keeps node ids unique, and show that `migrate()`
accepts each supported version and rejects a malformed program with the
path of the fault.
