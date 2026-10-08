# 03 — Nodes

N-01 Every block is one file `src/nodes/<key>.ts` (a `:` in the key becomes
`-` in the file name: `call-abs.ts`, `method-append.ts`) exporting a `NodeDef`,
registered in `src/nodes/index.ts`; no other module branches on `kind`,
builtin name, or method name. Traversal, validation, the block menu, the
value list, and the chart read a block's `slots`, `menu`, and flags instead.

```ts
export type NodeDef = {
  key: string;
  shape: "stmt" | "expr";
  category: "basic" | "control" | "list" | "function" | "dict" | "class"; // in menu order (U-40)
  slots: Slot[];
  params?: string[]; // builtin parameter names in order; a trailing `?` marks optional
  aliases?: string[]; // Python spellings the parser accepts (G-02), e.g. "random.randint"
  imports?: "math" | "random"; // N-05
  precedence?(node: Expr): number; // E-05; undefined = atom
  loop?: boolean; // its body regions are loop bodies
  requires?: "loop" | "function"; // where the statement may appear (E_BREAK_OUTSIDE, E_RETURN_OUTSIDE)
  hidden?: boolean; // not in the block menu (`empty`, `expr`)
  create(): Stmt | Expr; // required slots hold `empty` (L-09)
  run: StmtRunner | ExprRunner; // R-13
  python(node: Stmt | Expr, ctx: EmitContext): PyLine[] | string; // E-08: stmt → lines, expr → text
  form?(node: Stmt | Expr, ctx: { creates: boolean }): string; // N-08
  text?(node: Stmt | Expr, slot: string): string; // N-08
  kind?(node: Expr, kindOf: (e: Expr) => Kind | undefined): Kind | undefined; // L-59
  menu?: MenuEntry[]; // the entries of the value list (U-52, N-11)
  chart?:
    | { branch: { yes: string; no: string } }
    | { check: string }
    | { counted: string }
    | { jump: "exit" | "next" }; // N-09
};
export type Slot = {
  name: string;
  role: "expr" | "exprs" | "id" | "body" | "target" | "text";
  required?: boolean;
};
export type Kind = "number" | "text" | "truefalse" | "none" | "list" | "dict" | "object"; // L-59
export type MenuEntry = {
  name: string; // "" for the block's own label and help, else node.<key>.<name>.label / .help
  group: "values" | "functions" | "calculate" | "compare" | "convert" | "items" | "totals"
    | "combine" | "other";
  on?: Kind[]; // offered after a value of these kinds, which it takes as its first input
  preset?: Record<string, unknown>; // slot values set on the block's create() (binop `op`)
  symbol?: string; // shown before the name in the list (`×`)
  keys?: string; // what typed in a value line inserts it (U-93)
};
```

Slot roles: `expr` one expression; `exprs` an ordered list; `id` a name;
`body` a statement region; `target` an assignment target; `text` a literal
field (`num.value`, `str.value`, an operator).

N-02 i18n keys per block in `en.json`: `node.<key>.label`,
`node.<key>.template` (the node's sentence with `{slot}` placeholders),
`node.<key>.help`. The template column below is the `en.json` text;
`ja.json` provides the same keys with the same placeholders. A block
with a second template form keeps it under `node.<key>.template<Form>`:
`assign.templateCreate`, `bool.templateFalse`, `unop.templateNot`,
`binop.templateMod`, `binop.templateFloorDiv`, `binop.templatePow`,
`binop.templateIn`. A menu entry with a `name` has `node.<key>.<name>.label`
and `node.<key>.<name>.help`; a help that ends with how to type the entry
names its keys (`Type %.`).

N-03 The Python column is the exact emitted text; `<x>` denotes an
emitted slot. Each block has a codegen test asserting this text and an
interpreter test (N-10).

## Statements

| key        | category | slots                  | en template                                                                                                         | Python                                                                              |
| ---------- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `assign`   | basic    | target, value          | `set {target} to {value}`; when `target` is a variable first assigned here: `create {target} and set it to {value}` | `<target> = <value>`                                                                |
| `if`       | control  | cond, then, else       | `if {cond}`                                                                                                         | `if <cond>:` … `else:` (else omitted when empty; empty region → `pass`)             |
| `for`      | control  | var, start, stop, body | `for {var} from {start} up to {stop}`                                                                               | `for <var> in range(<stop>):` when start is `num` 0, else `range(<start>, <stop>):` |
| `foreach`  | list     | var, list, body        | `for each {var} in {list}`                                                                                          | `for <var> in <list>:`                                                              |
| `while`    | control  | cond, body             | `while {cond}`                                                                                                      | `while <cond>:`                                                                     |
| `break`    | control  |                        | `stop the loop`                                                                                                     | `break`                                                                             |
| `continue` | control  |                        | `skip to next iteration`                                                                                            | `continue`                                                                          |
| `print`    | basic    | args                   | `print {args}`                                                                                                      | `print(<a>, <b>)`                                                                   |
| `return`   | function | value?                 | `return {value}`                                                                                                    | `return <value>` / `return`                                                         |
| `expr`     | basic    | expr                   | `{expr}`                                                                                                            | `<expr>`                                                                            |
| `swap`     | list     | list, i, j             | `swap items {i} and {j} of {list}`                                                                                  | `<list>[<i>], <list>[<j>] = <list>[<j>], <list>[<i>]`                               |
| `delete`   | list     | target                 | `delete {target}`                                                                                                   | `del <target>`                                                                      |

## Expressions

| key     | category | slots           | en template                                                         | Python                 |
| ------- | -------- | --------------- | ------------------------------------------------------------------- | ---------------------- |
| `num`   | basic    | value           | `{value}`                                                           | `raw`                  |
| `str`   | basic    | value           | `"{value}"`                                                         | double-quoted, escaped |
| `bool`  | basic    |                 | `true` / `false`                                                    | `True` / `False`       |
| `none`  | basic    |                 | `none`                                                              | `None`                 |
| `var`   | basic    | name            | `{name}`                                                            | `name`                 |
| `binop` | basic    | op, left, right | `{left} {op} {right}` (N-08); `remainder of {left} divided by {right}`, `whole-number quotient of {left} divided by {right}`, `{left} to the power of {right}`, `{left} is in {right}` | infix per E-05         |
| `unop`  | basic    | op, operand     | `−{operand}` / `not {operand}`                                      | `-<x>` / `not <x>`     |
| `index` | list     | list, index     | `item {index} of {list}`                                            | `<list>[<index>]`      |
| `list`  | list     | items           | `[{items}]`                                                         | `[<a>, <b>]`           |
| `key`   | dict     | dict, key       | `{dict} at {key}`                                                   | `<dict>[<key>]`        |
| `dict`  | dict     | entries         | `{ {entries} }`                                                     | `{<k>: <v>, …}`        |
| `field` | class    | obj, field      | `{field} of {obj}`                                                  | `<obj>.<field>`        |
| `new`   | class    | cls, args       | `new {cls}({args})`                                                 | `<Cls>(<args>)`        |
| `call`  | function | fn, args        | `{fn}({args})`                                                      | `<fn>(<args>)`         |

## Builtin calls (`key = "call:<name>"`, shape expr)

| name                         | category | args | en template                                        | Python                                 |
| ---------------------------- | -------- | ---- | -------------------------------------------------- | -------------------------------------- |
| `len`                        | list     | a    | `count of {a}`                                     | `len(<a>)`                             |
| `abs`                        | basic    | x    | `absolute value of {x}`                            | `abs(<x>)`                             |
| `min`, `max`                 | basic    | a, b | `smaller of {a} and {b}` / `larger of {a} and {b}` | `min(<a>, <b>)` / `max(<a>, <b>)`      |
| `sum`                        | list     | a    | `sum of {a}`                                       | `sum(<a>)`                             |
| `str`, `int`, `float`        | basic    | x    | `{x} as text` / `as whole number` / `as decimal`   | `str(<x>)` / `int(<x>)` / `float(<x>)` |
| `random_int`                 | basic    | a, b | `random whole number from {a} to {b}`              | `random.randint(<a>, <b>)`             |
| `random_float`               | basic    | a, b | `random decimal from {a} to {b}`                   | `random.uniform(<a>, <b>)`             |
| `exp`, `log`, `sqrt`, `tanh` | basic    | x    | `exp({x})` …                                       | `math.exp(<x>)` …                      |
| `round`                      | basic    | x, n | `round {x} to {n} decimals`                        | `round(<x>, <n>)`                      |

## Methods (`key = "method:<name>"`)

| name     | on   | shape | args       | en template                               | Python                       |
| -------- | ---- | ----- | ---------- | ----------------------------------------- | ---------------------------- |
| `append` | list | stmt  | x          | `append {x} to {a}`                       | `<a>.append(<x>)`            |
| `insert` | list | stmt  | i, x       | `insert {x} at {i} in {a}`                | `<a>.insert(<i>, <x>)`       |
| `pop`    | list | expr  | i?         | `take the last item of {a}` / `take item {i} of {a}` | `<a>.pop()` / `<a>.pop(<i>)` |
| `copy`   | list | expr  |            | `copy of {a}`                             | `<a>.copy()`                 |
| `sort`   | list | stmt  |            | `sort {a} ascending`                      | `<a>.sort()`                 |
| `get`    | dict | expr  | k, default | `{d} at {k} or {default}`                 | `<d>.get(<k>, <default>)`    |
| `keys`   | dict | expr  |            | `keys of {d}`                             | `list(<d>.keys())`           |

N-04 Method statements (`append`, `insert`, `sort`) are `expr`
statements wrapping a `method` expression; the block menu lists them as
statements. The `expr` statement block itself is `hidden`: the menu
offers it only as those method statements and as calls (U-40).

N-05 `random_*` adds `import random`; `exp`, `log`, `sqrt`, `tanh` add
`import math` (E-02).

## Classes

N-06 A class is edited in its chart tab as an ordered field table
(name, default per L-30) with add, remove, and reorder.

N-07 Emitted form:

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

`[]` and `{}` defaults use the `None` idiom; other defaults are literals;
`__repr__` lists fields in order (L-29).

## Node text

N-08 The chart renders every node and every expression from
`node.<key>.template<form>` (N-02) where `form` is
`form(node, { creates })` (`""` for the base template; `assign` →
`Create` when the statement creates its variable, `bool` → `False`,
`unop` → `Not`, `binop` → `Mod`, `FloorDiv`, `Pow`, `In` for `%`, `//`,
`**`, `in`), and renders a `text` slot with `text(node, slot)` (`num` →
`raw`; `binop` `op` → `−` `×` `÷` `=` `≠` `≤` `≥` for `-` `*` `/` `==`
`!=` `<=` `>=`), defaulting to the slot's string value; the hidden `empty`
block has the three N-02 keys and its template is the U-51 placeholder
text. Only `+ − × ÷ ( ) = ≠ < ≤ > ≥` are written as symbols; every other
operation is written in words. An expression whose template for its form
has words outside its placeholders is a word operation: as an operand of
an operator it is put in brackets, and an operator or a word operation
inside a word operation's input is put in brackets
(`(remainder of i divided by 15) = 0`, `item (i + 1) of nums`); an
operator is an expression with a precedence whose template has no words
outside its placeholders, and operators among themselves are
parenthesised as E-05 states. A variable is written
as a bold word in the variable colour, on the chart and in the editor,
never in a box. A node's sentence is drawn with its first letter
capitalised when it begins with a word of its template (`Set total to 0`)
and as written when it begins with a slot (`i < n + 1?`); the block menu
and the editor show the template as written.

## Chart shape

N-09 A block with body regions, or one that sends control elsewhere than
the next statement in a loop, declares `chart` (U-33): `if` declares
`{ branch: { yes: "then", no: "else" } }`; `while` declares
`{ check: "body" }`; `for` and `foreach` declare `{ counted: "body" }` and
carry three more keys, `node.<key>.init`, `node.<key>.check`, and
`node.<key>.step`, the texts of the generated nodes:

| key       | init                    | check                          | step                        |
| --------- | ----------------------- | ------------------------------ | --------------------------- |
| `for`     | `Set {var} to {start}`  | `{var} < {stop}?`              | `Set {var} to {var} + 1`    |
| `foreach` | `Start at the first item of {list}` | `Is there an item left?` | `Set {var} to the next item` |

`break` declares `{ jump: "exit" }` and `continue` declares
`{ jump: "next" }`: the edge of each leads where control goes, out of the
innermost loop or into its next pass (U-33).

The chart renders every other block as a box with its sentence; the
interpreter and emitter are unaffected by `chart`.

## Menu entries

N-11 Expression blocks declare the entries of the value list (U-52) in
`menu`; an entry with `on` is offered after a value of those kinds and
takes it as its first input, and one without `on` fills an input where a
value is expected. A block not yet registered has no entry. Kinds are
those of L-59; `any` below means every kind.

| key               | name       | label                   | group      | on                   | symbol | keys  |
| ----------------- | ---------- | ----------------------- | ---------- | -------------------- | ------ | ----- |
| `str`             |            | Text                    | values     |                      |        |       |
| `bool`            | `true`     | True                    | values     |                      |        |       |
| `bool`            | `false`    | False                   | values     |                      |        |       |
| `none`            |            | None                    | values     |                      |        |       |
| `list`            |            | Empty list              | values     |                      |        | `[`   |
| `dict`            |            | Empty dict              | values     |                      |        |       |
| `unop`            | `not`      | Not                     | combine    |                      |        | `not` |
| `call:max`        |            | Larger of two           | functions  |                      |        |       |
| `call:min`        |            | Smaller of two          | functions  |                      |        |       |
| `call:random_int` |            | Random whole number     | functions  |                      |        |       |
| `binop`           | `add`      | Add                     | calculate  | number, text         | `+`    | `+`   |
| `binop`           | `sub`      | Subtract                | calculate  | number               | `−`    | `-`   |
| `binop`           | `mul`      | Multiply                | calculate  | number               | `×`    | `*`   |
| `binop`           | `div`      | Divide                  | calculate  | number               | `÷`    | `/`   |
| `binop`           | `mod`      | Remainder               | calculate  | number               |        | `%`   |
| `binop`           | `floorDiv` | Whole-number quotient   | calculate  | number               |        | `//`  |
| `binop`           | `pow`      | Power                   | calculate  | number               |        | `**`  |
| `call:abs`        |            | Absolute value          | calculate  | number               |        |       |
| `call:round`      |            | Round                   | calculate  | number               |        |       |
| `binop`           | `eq`       | Equals                  | compare    | any                  | `=`    | `==`  |
| `binop`           | `ne`       | Does not equal          | compare    | any                  | `≠`    | `!=`  |
| `binop`           | `lt`       | Less than               | compare    | number, text         | `<`    | `<`   |
| `binop`           | `le`       | At most                 | compare    | number, text         | `≤`    | `<=`  |
| `binop`           | `gt`       | Greater than            | compare    | number, text         | `>`    | `>`   |
| `binop`           | `ge`       | At least                | compare    | number, text         | `≥`    | `>=`  |
| `binop`           | `in`       | Is in a list            | compare    | any                  |        | `in`  |
| `call:str`        |            | As text                 | convert    | any                  |        |       |
| `call:int`        |            | As whole number         | convert    | number, text         |        |       |
| `call:float`      |            | As decimal              | convert    | number, text         |        |       |
| `index`           |            | Item at a position      | items      | list                 |        |       |
| `method:pop`      |            | Take the last item      | items      | list                 |        |       |
| `call:len`        |            | Count                   | totals     | list, text, dict     |        |       |
| `call:sum`        |            | Sum                     | totals     | list                 |        |       |
| `binop`           | `and`      | And                     | combine    | truefalse            |        | `and` |
| `binop`           | `or`       | Or                      | combine    | truefalse            |        | `or`  |
| `method:copy`     |            | Copy                    | other      | list                 |        |       |
| `binop`           | `join`     | Join with another list  | other      | list                 | `+`    |       |
| `key`             |            | Value at a key          | items      | dict                 |        |       |
| `field`           |            | Field                   | items      | object               |        |       |

`binop` entries preset `op`; `bool` entries preset `value`. The help of
`and` reads that it is true when both sides are, and the help of `or` that
it is true when one side or both are.

## Adding a node

`/add-node`: create `src/nodes/<key>.ts`; add the three i18n keys to both
locales; register; add a codegen test (exact text) and an interpreter test.

## Verification

N-10 Each block has a test asserting its exact Python text (N-03), one
asserting its event sequence and result, and, where it can fail, one
error case.
