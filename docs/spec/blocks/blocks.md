# Blocks

A block definition is one kind of statement or expression of the block
language. It declares its slots, how it runs, the Python it emits, its
text on the chart, and its entries in the menus, and every other part of the
application reads those declarations. This file states what a block
definition declares and lists every block definition.

Code: `src/blocks/`: one file per block definition, `registry.ts`,
`types.ts`, `categories.ts`. Tests: one `<key>.test.ts` per block
definition, and `registry.test.ts`.

## The block definition

Every block definition is one file, `src/blocks/<key>.ts`, and the file
exports a `BlockDef`. A `:` in the key becomes `-` in the file name. For
example: `call-abs.ts`, `method-append.ts`.

```ts
export type BlockDef = {
  key: string;
  shape: "stmt" | "expr";
  category: "basic" | "control" | "list" | "function" | "dict" | "class"; // in menu order (`editor.md`, Block menu)
  slots: Slot[];
  params?: Param[]; // builtin and method parameters in order (argument counts below)
  aliases?: string[]; // Python spellings the parser accepts (`parser.md`), e.g. "random.randint"
  imports?: "random"; // a builtin's module (Builtin calls)
  precedence?(node: Expr): number; // `emitter.md`; undefined = atom
  loop?: boolean; // its body regions are loop bodies
  requires?: "loop" | "function"; // where the statement may appear (E_BREAK_OUTSIDE, E_RETURN_OUTSIDE)
  hidden?: boolean; // not in the block menu (`empty`, `expr`)
  zeroLike?(node: Expr): Expr; // a literal block's zero of the same type (`hoistAssign`)
  callee?(node: Expr): Callee; // a call-like block's callee and argument count
  create(): Stmt | Expr; // required slots hold `empty` (`language.md`, Expressions)
  run: StmtRunner | ExprRunner; // `interpreter.md`, Block definitions

  python(node: Stmt | Expr, ctx: EmitContext): PyLine[] | string; // `emitter.md`: stmt → lines, expr → text
  notation(node: Stmt | Expr): string; // Notation
  fieldsError?(fields: Readonly<Record<string, unknown>>): FieldFault | undefined; // `language.md`, Data
  text?(node: Stmt | Expr, slot: string): string; // Notation
  kind?(node: Expr, kindOf: (e: Expr) => Kind | undefined): Kind | undefined; // Kinds
  declares?: Kind; // the kind of the variable its `id` slot names (`language.md`, Kinds)
  locate?(node: Expr, ctx: RunContext, at: NodeId): Generator<Event, Ref, void>; // a target's place (`interpreter.md`, Block definitions)
  menu?: MenuEntry[]; // the entries of the value list (Menu entries)
  chart?:
    | { branch: { cond: string; yes: string; no: string } }
    | { check: { cond: string; body: string } }
    | { counted: { body: string; init: string; check: string; update: string } }
    | { jump: "exit" | "next" }; // Chart shape
};
export type Param = { name: string; optional?: true }; // `name` as the notation writes it
export type FieldFault = { field: string; message: string }; // a stored field no edit writes
export type Callee = {
  name: Id;
  argc: number;
  family: "builtin" | "function" | "class" | "method"; // builtin, method: arity from `params`
};
export type Slot = {
  name: string;
  role: "expr" | "exprs" | "id" | "body" | "target" | "text";
  required?: boolean;
  atom?: true; // its input binds as an atom (Notation)
  binds?: true; // a `target` slot that declares the variable its target is (`language.md`, Scope)
};
export type Kind = "number" | "text" | "truefalse" | "none" | "list" | "dict" | "object"; // `language.md`, Kinds
export type MenuEntry = {
  name: string; // "" for the block's own label and help, else block.<key>.<name>.label / .help
  group: "values" | "conditions" | "calculate" | "items" | "compare" | "convert"; // `editor.md`, Value list
  on?: Kind[]; // offered after a value of these kinds, which it takes as its first input
  preset?: Record<string, unknown>; // slot values set on the block's create() (binop `op`)
  symbol?: string; // shown before the name in the list (`×`)
  keys?: string; // what typed in a value line inserts it (`editor.md`, Backspace and keys)
};
```

### Slots

A slot has one of six roles:

- `expr` holds one expression.
- `exprs` holds an ordered list of expressions.
- `id` holds a name.
- `body` holds a statement region.
- `target` holds one target (`language.md`, Statements). The emitter and
  the chart write it as the expression it is.
- `text` holds a literal field of an expression: `num.value`,
  `str.value`, or an operator.

No statement has a `text` slot, because a statement's literal text would
be a comment, and a statement's name takes the place of comments
(`editor.md`, Node names).

### Parameters

A builtin or a method takes at least as many arguments as it has
parameters not marked `optional`, and at most as many as it has
parameters. When too few are passed, `E_ARITY` gives the number of
parameters not marked `optional` as `expected`. When too many are passed,
it gives the number of parameters as `expected`.

A builtin's `create()` gives it one empty argument per parameter not
marked `optional`.

An optional parameter is marked by `optional`, not in its name, because
wherever code looks a parameter up by the name that its notation writes,
it would have to strip a mark such as `n?`.

### The registry

`src/blocks/registry.ts` registers every block definition, and it is the
only registry. Every other module reaches a block definition through it.

No module other than a block definition's file and the registry's `keyOf`
branches on `kind`, a builtin name, or a method name. Traversal,
validation, the block menu, the value list, and the chart read a block
definition's `slots`, `menu`, and flags instead.

## Catalog keys

Each block definition has these keys in `en.json`, and `ja.json`
provides the same keys:

- `block.<key>.label`: the block definition's name in the block menu and
  the value list
- `block.<key>.help`: its help
- `block.<key>.slot.<slot>`: the name of each slot of a statement that
  the editor shows as a field. For example, `block.assign.slot.value` is
  `value`.
- `block.<key>.<name>.label` and `block.<key>.<name>.help`: the label and
  the help of a menu entry with a `name`

The hidden `empty` block definition has its label and help.

No help names its entry's keys, because a help that named them would
repeat the block definition's `keys` in every locale. The explanation
line writes them from `keys` (`editor.md`, Explanation line).

A block's notation isn't a catalog key. It is the block definition's
`notation()`, the same in every locale (Notation).

## Statements

The statement block definitions. The Python column is the exact emitted
text, and `<x>` stands for an emitted slot.

| key        | category | slots                  | notation                                                                                                            | Python                                                                              |
| ---------- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `assign`   | basic    | target, value          | `{target} ← {value}`                                                                                                | `<target> = <value>`                                                                |
| `if`       | control  | cond, then, else       | `{cond}` (its diamond, `chart.md`, Shapes)                                                                          | `if <cond>:` … `else:` (else omitted when empty; empty region → `pass`)             |
| `for`      | control  | var, start, stop, body | `{var} ← {start}`, its init (Chart shape)                                                                           | `for <var> in range(<stop>):` when start is `num` 0, else `range(<start>, <stop>):` |
| `foreach`  | list     | var, list, body        | `for {var} in {list}`                                                                                               | `for <var> in <list>:`                                                              |
| `while`    | control  | cond, body             | `{cond}` (its diamond)                                                                                              | `while <cond>:`                                                                     |
| `break`    | control  |                        | `break`                                                                                                             | `break`                                                                             |
| `continue` | control  |                        | `continue`                                                                                                          | `continue`                                                                          |
| `print`    | basic    | args                   | `print({args})`                                                                                                     | `print(<a>, <b>)`                                                                   |
| `return`   | function | value?                 | `return {value}`, drawn `return` with no value                                                                      | `return <value>` / `return`                                                         |
| `expr`     | basic    | expr                   | `{expr}`                                                                                                            | `<expr>`                                                                            |
| `swap`     | list     | a, b                   | `swap({a}, {b})`                                                                                                    | `<a>, <b> = <b>, <a>`                                                               |
| `delete`   | list     | target                 | `del {target}`                                                                                                      | `del <target>`                                                                      |

A new `for` has no variable name, because `create()` receives no context,
and filling in the first unused name of `i`, `j`, and `k` would be a
special case.

## Expressions

The expression block definitions:

| key     | category | slots           | notation                                                            | Python                 |
| ------- | -------- | --------------- | ------------------------------------------------------------------- | ---------------------- |
| `num`   | basic    | value           | `{value}`                                                           | `raw`                  |
| `str`   | basic    | value           | `"{value}"`                                                         | double-quoted, escaped |
| `bool`  | basic    |                 | `True` / `False`                                                    | `True` / `False`       |
| `none`  | basic    |                 | `None`                                                              | `None`                 |
| `var`   | basic    | name            | `{name}`                                                            | `name`                 |
| `binop` | basic    | op, left, right | `{left} {op} {right}` (Notation)                                    | infix (`emitter.md`)   |
| `unop`  | basic    | op, operand     | `−{operand}` / `not {operand}`                                      | `-<x>` / `not <x>`     |
| `index` | list     | list, index     | `{list}[{index}]`                                                   | `<list>[<index>]`      |
| `list`  | list     | items           | `[{items}]`                                                         | `[<a>, <b>]`           |
| `key`   | dict     | dict, key       | `{dict}[{key}]`                                                     | `<dict>[<key>]`        |
| `dict`  | dict     | entries         | `{ {entries} }`                                                     | `{<k>: <v>, …}`        |
| `field` | class    | obj, field      | `{obj}.{field}`                                                     | `<obj>.<field>`        |
| `new`   | class    | cls, args       | `{cls}({args})`                                                     | `<Cls>(<args>)`        |
| `call`  | function | fn, args        | `{fn}({args})`                                                      | `<fn>(<args>)`         |

## Builtin calls (`key = "call:<name>"`, shape expr)

The builtins, each an expression:

| name                         | category | args | notation                                           | Python                                 |
| ---------------------------- | -------- | ---- | -------------------------------------------------- | -------------------------------------- |
| `len`                        | list     | a    | `len({a})`                                         | `len(<a>)`                             |
| `abs`                        | basic    | x    | `abs({x})`                                         | `abs(<x>)`                             |
| `min`, `max`                 | basic    | a, b | `min({a}, {b})` / `max({a}, {b})`                  | `min(<a>, <b>)` / `max(<a>, <b>)`      |
| `sum`                        | list     | a    | `sum({a})`                                         | `sum(<a>)`                             |
| `str`, `int`, `float`        | basic    | x    | `str({x})` / `int({x})` / `float({x})`             | `str(<x>)` / `int(<x>)` / `float(<x>)` |
| `randint`                    | basic    | a, b | `randint({a}, {b})`                                | `random.randint(<a>, <b>)`             |

A builtin is named as Python names it.

A builtin of a module, such as `randint` of `random`, is called
`<module>.<name>` in Python. The parser accepts that spelling as the
builtin's alias, and the emitter adds `import <module>` (`emitter.md`).

A name of its own, such as `random_int`, was rejected because the chart
writes the Python name: a function could take that name and be drawn as
the builtin, and the name the function couldn't take would be one the
learner never reads.

## Methods (`key = "method:<name>"`)

The methods:

| name     | on   | shape | args       | notation                                  | Python                       |
| -------- | ---- | ----- | ---------- | ----------------------------------------- | ---------------------------- |
| `append` | list | stmt  | x          | `{a}.append({x})`                         | `<a>.append(<x>)`            |
| `insert` | list | stmt  | i, x       | `{a}.insert({i}, {x})`                    | `<a>.insert(<i>, <x>)`       |
| `pop`    | list | expr  | i?         | `{a}.pop()` / `{a}.pop({i})`              | `<a>.pop()` / `<a>.pop(<i>)` |
| `copy`   | list | expr  |            | `{a}.copy()`                              | `<a>.copy()`                 |
| `sort`   | list | stmt  |            | `{a}.sort()`                              | `<a>.sort()`                 |
| `get`    | dict | expr  | k, default | `{d}.get({k}, {default})`                 | `<d>.get(<k>, <default>)`    |
| `keys`   | dict | expr  |            | `{d}.keys()`                              | `list(<d>.keys())`           |

Method statements (`append`, `insert`, `sort`) are `expr` statements that
wrap a `method` expression, and the block menu lists them as statements.
The `expr` block definition itself is `hidden`, so the block menu offers
it only as those method statements and as calls (`editor.md`, Block
menu).

## Classes

The learner edits a class in its field table, which lists its fields in
order, and adds, removes, and reorders fields there. Each field has a
name and a default that `language.md`, Semantics, Objects, allows.

The emitted form:

```python
class Value:
    def __init__(self, data=0.0, grad=0.0, prev=None, op=""):
        self.data = data
        self.grad = grad
        self.prev = [] if prev is None else prev
        self.op = op

    def __repr__(self):
        return f"Value(data={self.data!r}, grad={self.grad!r}, prev={self.prev!r}, op={self.op!r})"
```

A `[]` or `{}` default uses the `None` idiom, and any other default is a
literal. `__repr__` lists the fields in order, as `print` does
(`language.md`, Semantics, Calls).

## Notation

The chart, the value line, the block menu, the explanation line, and the
narration all write a block from its block definition's
`notation(node)`: the text of the tables above, with `{slot}`
placeholders.

A notation is the same in every locale, because the learner reads a block
again at every step of a run, in whatever language they read. The words a
learner needs to choose and understand a block definition come in the
learner's language instead (`pages.md`, Catalogs): the label, the help,
the value list, the explanation line, and the narration.

### Text slots

A `text` slot is written with `text(node, slot)`, which defaults to the
slot's string value.

`num` writes `raw`.

`binop`'s `op` writes a symbol for each of these operators, and it writes
`%`, `//`, `**`, `and`, `or`, and `in` as Python does:

- `-` → `−`
- `*` → `×`
- `/` → `÷`
- `==` → `=`
- `!=` → `≠`
- `<=` → `≤`
- `>=` → `≥`

The notation of the hidden `empty` block is `…`, drawn as the placeholder of
an empty input (`editor.md`, Value line).

### The form of an expression

Every expression is one of these:

- an operator between or before its inputs: `i % 15`, `not done`
- a call: `len(nums)`, `f(x)`
- an item, a key, or a field: `nums[i]`, `d["a"]`, `node.next`
- a value

No expression is written in the learner's language, so no rule of the
chart or the editor reads a translated word. The words of a notation are
Python's, the same in every locale: `and`, `not`, `len`, `print`.

The chart and the value line parenthesize operators as the emitter does
(`emitter.md`). An input whose slot declares `atom`, such as the list of
an item, binds as an atom, as Python binds the value that it takes an
item from, so an operation in that input is parenthesized. For example:
`(a + b)[0]`. The emitter, the chart, and the value line read that one
declaration.

### Symbols

Comparison and arithmetic keep the symbols a learner knows from school:
`=`, `≠`, `≤`, `×`, `÷`. An operation that school has no symbol for is
written with Python's symbol, `%`, `//`, or `**`, and named in words in
the value list. An operation written in words was rejected because it
needs parentheses of its own. For example: `(remainder of i divided by 15) =
0`. It also carries one language's word order into every translation,
and it is a second notation that the learner gives up for Python.

A variable gets a value with `←`, the first time and every time after,
because no adult reads the arrow as an equation, and `=` keeps its school
meaning, to compare. For example: `total ← 0`. A first assignment has no
form of its own, because Python has none, and a separate `create` form
would draw one statement two ways.

### Calls and statements

A builtin and a method are written as calls, named as Python names them.
A builtin is written without its module. For example: `randint`.

`print(…)`, `return`, `break`, `continue`, and `del` are written as
Python writes them.

`swap` is a call of its own. For example: `swap(nums[j], nums[j + 1])`.
It names the two places it exchanges, and the `Python` tab writes it as
their exchange.

The `Python` tab writes Python (`emitter.md`), where `←` becomes `=`.

### Drawing

When the lines of the block editor write a slot twice, the slot is a
field in its first place, and the other place draws its value. For
example, `for` writes `{var}` in its init and in its check.

The items of an `exprs` slot, a call's arguments, and a function's
parameters are separated by `, `, as Python separates them, in every
locale.

On the chart and in the editor, a variable is written as a bold word in
the variable color, never in a box, because a box would cut the block into
pieces. A block is drawn as its notation writes it, with no capital letter
added.

## Chart shape

A block definition with body regions, or one that sends control somewhere
other than the next statement in a loop, declares `chart` (`chart.md`,
Shapes). The chart draws every other block as a box with its notation.
`chart` doesn't affect the interpreter or the emitter.

- `if` declares `{ branch: { cond: "cond", yes: "then", no: "else" } }`.
- `while` declares `{ check: { cond: "cond", body: "body" } }`, where
  `cond` names the slot of the condition its diamond asks.
- `for` and `foreach` declare `counted`, which names their body and the
  texts of their generated chart nodes.
- `break` declares `{ jump: "exit" }` and `continue` declares
  `{ jump: "next" }`. The edge of each leads where control goes: out of
  the innermost loop, or into its next pass.

The texts of a counted loop's generated chart nodes, with `{slot}`
placeholders:

| key       | init                    | check                     | update               |
| --------- | ----------------------- | ------------------------- | -------------------- |
| `for`     | `{var} ← {start}`       | `{var} < {stop}`          | `{var} ← {var} + 1`  |
| `foreach` | `First item of {list}`  | `{list} has another item` | `{var} ← next item` |

The chart draws a check the way it asks every diamond's condition
(`chart.md`, Shapes), so a diamond's `?` follows one rule. For example:
`i < n + 1?`.

The texts of `for` are notation: the block definition declares them, and
they are the same in every locale.

The texts of `foreach` hold words, because Python keeps the position
hidden, so the loop's generated chart nodes have no expression to write.
They are its catalog keys `block.foreach.init`, `check`, and `update`,
translated. They are the only chart node texts in words.

A counted loop's own notation names it in the block menu and the editor.
`for`'s notation is its init.

## Menu entries

Expression block definitions declare the entries of the value list
(`editor.md`, Value list) in `menu`. The value list offers an entry with
`on` after a value of those kinds, and the entry takes that value as its
first input. An entry without `on` fills an input where a value is
expected. Kinds are those of `language.md`, Kinds, and `any` below means
every kind. Each block definition declares its own entries, because one
block definition serves several groups: `binop` is `Add`, `Equals`, and
`And`.

| key               | name       | label                   | group      | on                   | symbol | keys  |
| ----------------- | ---------- | ----------------------- | ---------- | -------------------- | ------ | ----- |
| `str`             |            | Text                    | values     |                      |        |       |
| `bool`            | `true`     | True                    | values     |                      |        |       |
| `bool`            | `false`    | False                   | values     |                      |        |       |
| `none`            |            | None                    | values     |                      |        |       |
| `list`            | `empty`    | Empty list              | values     |                      |        | `[`   |
| `dict`            |            | Empty dict              | values     |                      |        |       |
| `unop`            | `not`      | Not                     | conditions |                      | `not`  | `not` |
| `binop`           | `and`      | And                     | conditions | truefalse            | `and`  | `and` |
| `binop`           | `or`       | Or                      | conditions | truefalse            | `or`   | `or`  |
| `call:randint`    |            | Random whole number     | calculate  |                      |        | `randint` |
| `binop`           | `add`      | Add                     | calculate  | number, text         | `+`    | `+`   |
| `binop`           | `sub`      | Subtract                | calculate  | number               | `−`    | `-`   |
| `binop`           | `mul`      | Multiply                | calculate  | number               | `×`    | `*`   |
| `binop`           | `div`      | Divide                  | calculate  | number               | `÷`    | `/`   |
| `binop`           | `mod`      | Remainder               | calculate  | number               | `%`    | `%`   |
| `binop`           | `floorDiv` | Whole-number quotient   | calculate  | number               | `//`   | `//`  |
| `binop`           | `pow`      | Power                   | calculate  | number               | `**`   | `**`  |
| `call:abs`        |            | Absolute value          | calculate  | number               |        | `abs` |
| `call:max`        |            | Larger of two           | calculate  | number, text         |        | `max` |
| `call:min`        |            | Smaller of two          | calculate  | number, text         |        | `min` |
| `index`           |            | Item at a position      | items      | list                 |        | `[`   |
| `method:pop`      |            | Take the last item      | items      | list                 |        |       |
| `call:len`        |            | Count                   | items      | list, text, dict     |        | `len` |
| `call:sum`        |            | Sum                     | items      | list                 |        | `sum` |
| `method:copy`     |            | Copy                    | items      | list                 |        |       |
| `binop`           | `join`     | Join with another list  | items      | list                 | `+`    |       |
| `key`             |            | Value at a key          | items      | dict                 |        |       |
| `field`           |            | Field                   | items      | object               |        |       |
| `binop`           | `eq`       | Equals                  | compare    | any                  | `=`    | `==`  |
| `binop`           | `ne`       | Does not equal          | compare    | any                  | `≠`    | `!=`  |
| `binop`           | `lt`       | Less than               | compare    | number, text         | `<`    | `<`   |
| `binop`           | `le`       | At most                 | compare    | number, text         | `≤`    | `<=`  |
| `binop`           | `gt`       | Greater than            | compare    | number, text         | `>`    | `>`   |
| `binop`           | `ge`       | At least                | compare    | number, text         | `≥`    | `>=`  |
| `binop`           | `in`       | Is in a list            | compare    | any                  | `in`   | `in`  |
| `call:str`        |            | As text                 | convert    | any                  |        | `str` |
| `call:int`        |            | As whole number         | convert    | number, text         |        | `int` |
| `call:float`      |            | As decimal              | convert    | number, text         |        | `float` |

`binop` entries preset `op`, and `bool` entries preset `value`. `list`'s
`empty` presets no item, so a list with items is named by the block
definition's own label, `List`.

The help of `and` says that it is true when both sides are. The help of
`or` says that it is true when one side or both are, because in everyday
English "or" often means only one.

## Kinds

The expression block definitions give these kinds (`language.md`, Kinds):

| key | kind |
| --- | --- |
| `num` | a number |
| `str` | a text |
| `bool` | a true/false value |
| `none` | none |
| `unop` | a true/false value for `not`, and a number for `−` |
| `binop`, a comparison or `in` | a true/false value |
| `binop`, `and` or `or` | the kind of both inputs when they agree |
| `binop`, `+` | the kind of both inputs when they agree and aren't true/false |
| `binop`, `*` | a list or a text when one input is a list or a text |
| `binop`, any other case | a number |
| `call:abs`, `call:int`, `call:float`, `call:randint` | a number |
| `call:str` | a text |
| `call:min`, `call:max` | the kind of their first input |
| `call:len`, `call:sum` | a number |
| `list`, `method:copy` | a list |
| `dict` | a dict |
| `new` | an object |

Where the table gives no kind, the expression has none, because a wrong
kind would hide the entries that apply, while no kind lists every entry.

`index`, `key`, `field`, and `method:pop` have no kind, because the kind
of an item would need a list kind that names the kind of its items, and a
kind doesn't hold that (`language.md`, Kinds). A `foreach` variable has
no kind for the same reason.

## Verification

Each block definition has these tests:

- one that asserts its exact notation and its exact Python text
  (Statements, and the tables after it)
- one that asserts its event sequence and result
- one per rule filed under it in the Semantics of `language.md`
- where it can fail, one error case
