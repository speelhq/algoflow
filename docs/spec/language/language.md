# Language

This file states the program model: how a program is stored as an AST,
how its values are written in files and held during a run, what each
statement and expression means, which names are visible where, which
faults validation reports, how a program is edited, and where it
persists.

Code: `src/lang/`: types `types.ts`, validation `validate.ts`, edits
`edit.ts`, data conversion `data.ts`, import `migrate.ts`, traversal
`walk.ts`, scope `scope.ts`, kinds `kinds.ts`. Tests: beside each file.

## Identifiers

Identifiers are the names in a program. A name has one of two forms:

- A variable, function, parameter, or field name matches
  `/^[a-z_][a-z0-9_]*$/`.
- A class name matches `/^[A-Z][A-Za-z0-9]*$/`.

No name is in `RESERVED`:

```
False None True and as assert async await break class continue def del elif
else except finally for from global if import in is lambda nonlocal not or
pass raise return try while with yield
list dict set len print range min max sum abs input str int float bool
tuple id type self math random round sorted
```

## Program

A program is one `Program` value:

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
export type InputDecl = { name: Name; kind: Kind };
export type ClassDef = { id: NodeId; name: Name; fields: Field[] };
export type Field = { name: Name; default: Data }; // Semantics, Objects
export type FunctionDef = { id: NodeId; name: Name; params: Name[]; body: Stmt[] };
export type NodeId = string; // 12-char nanoid
export type Name = string;
```

Within a program, `NodeId` values are unique. Function names, class names,
and input names are unique within a program, and they don't collide with
each other.

An input declares only its name and its kind. Its value comes from the
chosen case (`challenges.md`, Schema), because a value in the program
would be a second copy of one case. The chart and the `Python` tab would
then show that copy while Run used another case.

## Data

`Data` is the JSON form in which program files and challenge files write
a value. A run works on `Value`s instead (Run-time values), and
`toValue()` and `toData()` convert between the two.

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

### Converting to and from values

`toValue(data, heap)` turns `Data` into a `Value`, and allocates a heap
entry for every list, dict, and object it meets. `toData(value, heap)`
does the reverse.

`toData()` gives each object a `$id`, and it numbers objects in the order
it first reaches them. `toValue()` allocates one object per distinct
`$id`. So two references to one object, inside one value or across the
values that `toValue()` converts with one heap, still point at one object
after `toValue()`.

When an object refers back to itself through a cycle, `toData()` writes
the inner reference as `{ $cls, $id }` and nothing more.

When an object appears twice, `toData()` writes it in full both times,
under the same `$id`, rather than as a reference, so two `Data` values can
be compared as they stand.

### Canonical form

Every program file and challenge file holds `Data` in canonical form:

- Every number is finite.
- Every integral number lies in the int range (Run-time values).
- An integral float is written `{ $float: n }`.
- An `$int:` key is an integer in that range, spelled as Python spells
  it.

`$int:-0` is rejected because `-0` and `0` are one int in Python, so with
both spellings a key could miss a lookup that CPython makes, or fail to
convert back to itself. `$int:0` is canonical, and `$int:-0` is not.

### Faults that `migrate()` rejects

`migrate()` reads a stored or imported program (Storage). It rejects a
field that the block's definition wouldn't make (`fieldsError`,
`blocks.md`) and a class field default that isn't canonical `Data`, and it
reports the path of the fault.

`migrate()` and `validate()` catch different faults, depending on who
fixes the fault and where. `validate()` reports the faults that an edit
can produce, and the learner fixes each of those on its node. Some faults
can only come from editing the file by hand:

- an unknown kind
- a missing field
- a literal that the block's definition wouldn't make
- a `Data` value that isn't canonical

There is no node to fix those faults on, so `migrate()` rejects the file
instead, and `validate()` never reads a literal field.

### Classes and objects before `new` exists

A program holds no class and `Data` holds no object, because no
registered block definition constructs an object yet. Until a `new` block
definition exists:

- `migrate()` rejects a class, and an input of the kind `object`.
- `pnpm check` rejects a `$cls` in a challenge file, and a class name in
  its `defines`.

`migrate()` and `pnpm check` each report the path of the fault.

Until then, only a hand-written file can hold a class or an object.
`migrate()` and `pnpm check` reject such a file rather than read what they
can, because reading it would need code for identity, cycles,
constructors, and field defaults that no learner reaches. Rejecting it
also keeps a `$cls` record from passing as a dict.

## Run-time values

During a run, a value is a `Value`, and every list, dict, and object lives
on the heap:

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
  | { kind: "obj"; cls: Name; fields: Map<Name, Value> };
export type Heap = Map<HeapId, HeapEntry>;
```

`int` and `float` are distinct.

### Int range

An `int` is an integer of magnitude at most 2^53 − 1, because a double
rounds 2^53 + 1 to 2^53, so an `int` of 2^53 could be a wrong value that
looks right. `9007199254740991 + 2` is such a value.

A literal or a `Data` number beyond that range is rejected (`parser.md`;
Data), not run as a `float`, for two reasons:

- CPython runs the emitted `raw` as the exact int, so the chart, the
  `Python` tab, and the run would show three different numbers with no
  message.
- `JSON.parse` rounds a `Data` number before any check sees it.

When an operation's result is an integer outside that range, the
operation gives a `float`, because the learner can see this difference
from Python, while a wrong `int` wouldn't show.

## Statements

A statement is one of these kinds:

```ts
type S = { id: NodeId; name?: string }; // Statement names
export type Stmt =
  | (S & { kind: "assign"; target: Expr; value: Expr })
  | (S & { kind: "delete"; target: Expr })
  | (S & { kind: "if"; cond: Expr; then: Stmt[]; else: Stmt[] })
  | (S & { kind: "for"; var: Name; start: Expr; stop: Expr; body: Stmt[] })
  | (S & { kind: "foreach"; var: Name; list: Expr; body: Stmt[] })
  | (S & { kind: "while"; cond: Expr; body: Stmt[] })
  | (S & { kind: "break" })
  | (S & { kind: "continue" })
  | (S & { kind: "print"; args: Expr[] })
  | (S & { kind: "return"; value?: Expr })
  | (S & { kind: "expr"; expr: Expr })
  | (S & { kind: "swap"; a: Expr; b: Expr });
```

### Targets

A target is an expression that names where a value is stored: a `var`, an
`index`, a `key`, or a `field`. Each of these is a block definition that
declares `locate` (`blocks.md`, The block definition).

A `target` slot holds one target, or `empty` while it is unfilled
(Expressions). `migrate()` rejects any other expression in a `target`
slot. No edit puts any other expression there (`editor.md`, Targets).

A separate target type was rejected because Python reads a target as an
expression in store position, and because a second type would repeat each
rule of the expression in the emitter, the chart, and every traversal.
`nums[j] = …` is such a target.

## Expressions

An expression is one of these kinds:

```ts
type E = { id: NodeId };
export type Expr =
  | (E & { kind: "empty" }) // an unfilled slot, below
  | (E & { kind: "num"; value: number; float: boolean; raw: string })
  | (E & { kind: "str"; value: string })
  | (E & { kind: "bool"; value: boolean })
  | (E & { kind: "none" })
  | (E & { kind: "var"; name: Name })
  | (E & { kind: "binop"; op: BinOp; left: Expr; right: Expr })
  | (E & { kind: "unop"; op: "neg" | "not"; operand: Expr })
  | (E & { kind: "index"; list: Expr; index: Expr })
  | (E & { kind: "key"; dict: Expr; key: Expr })
  | (E & { kind: "field"; obj: Expr; field: Name })
  | (E & { kind: "list"; items: Expr[] })
  | (E & { kind: "dict"; entries: Array<{ key: Expr; value: Expr }> })
  | (E & { kind: "new"; cls: Name; args: Expr[] })
  | (E & { kind: "call"; fn: Name; args: Expr[] })
  | (E & { kind: "method"; obj: Expr; name: Name; args: Expr[] });
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

`num.raw` is the literal's source text, and the emitter writes it. When
`raw` contains `.`, `e`, or `E`, `float` is true.

### Empty slots

An unfilled required expression slot holds `{ kind: "empty" }`. Each
consumer handles it in its own way:

- `create()` fills every required slot with it.
- `validate()` reports it as `E_EMPTY_SLOT` with the slot's name.
- The emitter writes `...` for it.
- The interpreter never executes it.

`Expr | null` was rejected because it would spread null checks through
every block definition and the emitter, while an `empty` kind keeps `Expr`
a closed union.

## Semantics

This section states what each operation does at run time. Each heading
names the block definition whose test holds one test per rule under it,
with the rule's example. `src/runtime/semantics.test.ts` tests
the rules under Values and the run.

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

`==` accepts a `bool`, as Python does, although arithmetic and ordering
refuse one (`interpreter.md`, Errors). It accepts one because `==` and
`in` never fail, so a stricter `==` would answer differently from the
emitted Python with no message.

### Loops (`for`, `foreach`)

| Rule | Example |
| --- | --- |
| `for` iterates `start … stop-1`, bounds evaluated once, `int` only else `E_TYPE` | |
| `foreach` visits `list[0]`, `list[1]`, … and reads the list's length before each pass, as Python does, so changing the list inside the loop changes the passes | appending in the body adds a pass |

`foreach` reads the live list, not a snapshot, because a snapshot would
run a body that changes the list differently from the emitted Python, with
no sign of it.

Every other difference from Python is stricter and ends in an error:

- A `bool` isn't a number.
- Recursion stops at 200.
- A name that is first assigned inside a compound statement and read
  after it gives `E_DECLARE_FIRST` (Scope).

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

A bound of `1.0` is rejected too, because CPython 3.12 and later raise
`TypeError` for any `float` bound, and `pnpm check` requires that version.

### Objects (`new`, `field`)

| Rule | Example |
| --- | --- |
| `new C(args)` sets every field to a fresh copy of its default, then assigns args in field order; too many args → `E_ARITY` | |
| `o.f` without field `f` → `E_FIELD` | |
| `v.f` where `v` isn't an object → `E_FIELD`, with the type name of `v` as `cls` | `n.x` with `n = 3` |
| a field default is a number, string, boolean, `null`, `[]`, or `{}` | |

A value that isn't an object fails with `E_FIELD`, not `E_TYPE`, because
the fault is a field it doesn't have. `E_TYPE` would name a second operand
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

Scope states where a name becomes visible, which names a definition can't
take, and how a call finds what it names.

### Visibility

A name becomes visible at one of three places:

- its first `assign`
- the `for` or `foreach` that introduces it as its variable
- the function that takes it as a parameter

It stays visible to the end of its region and in the regions inside it.

A `target` slot that `binds` (`blocks.md`, The block definition) declares
the variable that its target names, and it doesn't read that variable.
`assign`'s slot binds; `delete`'s and `swap`'s slots don't.

Two kinds of target read their expressions before the value is stored:

- an item, a key, or a field in a binding slot
- every target of a slot that doesn't bind

A `for` or `foreach` variable is assigned by the loop statement itself, in
the region that contains the loop, so it stays visible after the loop.

The loop reads its bounds, or the iterated list, before the variable
exists.

A function sees only its parameters and its body.

A field default sees nothing.

### Declaring a name before a compound statement

A name that is first assigned inside `then`, `else`, or a loop body, and
read after that compound statement, gives `E_DECLARE_FIRST`.

`hoistAssign` fixes it by inserting `name = <default of the same type>`
before the compound statement, and it takes the default from the first
assignment to the name inside that statement:

- `num` → `0`, or `0.0` when the number is a float
- `str` → `""`
- `bool` → `False`
- `list` → `[]`
- `dict` → `{}`
- any other value → `None`

### Names a definition can't take

A variable can't take a name that one of these holds (Resolving a call;
`E_DUPLICATE_NAME`):

- a function of the program
- a class of the program
- a builtin
- a function or class of a module that the program uses

A variable can't take those names because the interpreter resolves calls
by name and runs such a program, while CPython doesn't. `count = 0` beside
`def count()` fails in CPython.

The parameters of one function are distinct.

A function can't take a builtin's name, because the builtin's registry key
would shadow the function.

### Resolving a call

A `call` or a `new` resolves its name in this order:

1. a function or class of the program
2. a learner module
3. a built-in module
4. a builtin of `blocks.md`

So a program definition shadows every module, and a learner module shadows
a built-in module of the same name (`modules.md`, Schema).

When two modules that the program uses both define a name, a call of that
name gives `E_DUPLICATE_NAME`.

## Validation

`validate(program): Diagnostic[]` runs after every edit and before every
run. A `Diagnostic` is `{ nodeId, code, params, fix?: "hoistAssign" }`.
`validate()` reports these codes:

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
| `E_DUPLICATE_ID`   | two nodes share a node id (Program)                         |                           |

## Edits

`edit.ts` exports pure functions that return a new `Program`: `insertStmt`,
`moveStmt`, `removeStmt`, `duplicateStmt`, `setSlot`, `setExpr`,
`insertItem`, `removeItem`, `renameName`, `setStmtName`, `addFunction`,
`removeFunction`, `addClass`, `removeClass`, `setFields`, `setParams`, and
`hoistAssign`. `insertItem` and `removeItem` add and remove an item of an
`exprs` slot.

Every edit keeps node ids unique.

### Statement positions

`insertStmt` and `moveStmt` take a statement position,
`Place = { parent: NodeId | "main"; slot: "main" | "body" | "then" | "else"; index: number }`.
Its `parent` is `"main"`, a function's node id, or a compound statement's
node id.

`moveStmt` counts `index` in the destination region after it has removed
the moved statement, because the chart computes the drop indicator
on the list without the dragged block.

`hoistAssign(program, compound, name)` takes `compound`, the node id of a
compound statement, and inserts the assignment before that statement.
That node id is the `compound` that `E_DECLARE_FIRST` reports.

The other edits address nodes by node id. `setExpr` takes an item index
for an `exprs` slot.

### History

History keeps the last 100 programs for undo and redo. Opening a program
starts an empty history.

Consecutive changes that the learner types into one field of the block
editor form one entry, because a typed value changes the chart with every
key. Two alternatives were rejected:

- An entry per key would spend the 100 entries on one word.
- An entry made only on leaving the field would keep the chart behind the
  editor.

## Storage

A program persists in the browser, and the learner can export it as a
file and import it again.

### Where a program is stored

A program persists to the `localStorage` key
`algoflow:program:<challengeId | playground id>`. The application saves
it 500 ms after the last edit, and at once when the browser hides the
page. The key holds the `Program` JSON itself.

When the application loads a program, it passes the stored value through
`migrate()` and treats a rejected value as absent, so opening a problem
then creates its program (`challenges.md`, Opening and bundling).

A Zustand `persist` wrapper was rejected because it doesn't suit one key
per program, and because `migrate()` must check whatever storage returns.

A loaded program takes the `challengeId` and the `inputs` of its
challenge. A Playground program has neither.

### Export and import

When the learner exports a program, the application writes
`<title>.algoflow.json` and embeds the modules the program uses
(`modules.md`, Operations). When the learner imports a file, `migrate()`
checks it and migrates it by `version` (`src/lang/migrate.ts`).

`migrate()` reads versions 1 and 2 and returns version 2. Three rules
apply to the targets it reads:

- A version-1 target `{ kind, ...parts }` becomes the expression of that
  kind, with those parts and a new node id that the program doesn't hold.
- A variable target with no name becomes `empty`.
- When no registered block definition has the target's kind, `migrate()`
  rejects the target as an unknown kind.

### Playground programs

A Playground id is `play-` followed by a `NodeId`, so it can't read as a
challenge id.

`algoflow:playground` holds `Record<string, { edited: number }>`, keyed by
Playground id: the time of each Playground program's last save, in
milliseconds since the epoch. The record lists exactly the Playground
programs in storage.

The time is kept in this record, not in `Program`, because `Program`
would then carry it into every export and challenge file.

## Statement names

A statement's `name` is the learner's own name for it (`editor.md`,
Node names). It is one line of text. `setStmtName` and `migrate()` both
store a name the same way:

- trimmed
- with each run of spaces as one space
- absent, when the result is empty

`setStmtName` also turns each line break into a space. `migrate()`
rejects a name that isn't one line of text.

A statement's name changes neither validation nor execution.

## Kinds

A kind is what the value list and the name list (`editor.md`, Value list;
Name fields) know of a value before the program runs. The kinds are
`number`, `text`, `truefalse`, `none`, `list`, `dict`, and `object`.

A block definition's `kind` (`blocks.md`) gives an expression's kind from
the kinds of the expressions inside it. An expression whose kind can't be
determined has none.

A variable's kind is found in this order:

1. the kind its input declares
2. the kind of the value of its first assignment, in program order
3. the kind its loop block definition declares (`declares`, `blocks.md`)

A `for` variable's block definition declares `number`. A parameter and a
`foreach` variable have no kind.

## Verification

The tests of `src/lang` show three things:

- Every validation code has a failing and a passing case.
- Every edit keeps node ids unique.
- `migrate()` accepts each supported version and rejects a malformed
  program with the path of the fault.
