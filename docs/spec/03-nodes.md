# 03 — Nodes

N-01 Every block is one file `src/nodes/<key>.ts` (a `:` in the key becomes
`-` in the file name: `call-abs.ts`, `method-append.ts`) exporting a `NodeDef`,
registered in `src/nodes/index.ts`; no other module branches on `kind`,
builtin name, or method name. Traversal, validation, the block menu, and the
chart read a block's `slots` and flags instead.

```ts
export type NodeDef = {
  key: string;
  shape: "stmt" | "expr";
  category: "basic" | "control" | "list" | "function" | "dict" | "class" | "math"; // in menu order (U-40)
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
  chart?: { branch: { yes: string; no: string } } | { check: string } | { counted: string }; // N-09
};
export type Slot = {
  name: string;
  role: "expr" | "exprs" | "id" | "body" | "target" | "text";
  required?: boolean;
};
```

Slot roles: `expr` one expression; `exprs` an ordered list; `id` a name;
`body` a statement region; `target` an assignment target; `text` a literal
field (`num.value`, `str.value`, `comment.text`, an operator).

N-02 i18n keys per block in `en.json`: `node.<key>.label`,
`node.<key>.template` (the node's sentence with `{slot}` placeholders),
`node.<key>.help`. The template column below is the `en.json` text;
`ja.json` provides the same keys with the same placeholders (M-10). A block
with a second template form keeps it under `node.<key>.template<Form>`:
`assign.templateCreate`, `bool.templateFalse`, `unop.templateNot`.

N-03 The Python column is the exact emitted text; `<x>` denotes an
emitted slot. Each block has a codegen test asserting this text and an
interpreter test (T-02).

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
| `comment`  | basic    | text                   | `# {text}`                                                                                                          | `# <text>`                                                                          |

## Expressions

| key     | category | slots           | en template                                                         | Python                 |
| ------- | -------- | --------------- | ------------------------------------------------------------------- | ---------------------- |
| `num`   | basic    | value           | `{value}`                                                           | `raw`                  |
| `str`   | basic    | value           | `"{value}"`                                                         | double-quoted, escaped |
| `bool`  | basic    | value           | `true` / `false`                                                    | `True` / `False`       |
| `none`  | basic    |                 | `none`                                                              | `None`                 |
| `var`   | basic    | name            | `{name}`                                                            | `name`                 |
| `binop` | basic    | op, left, right | `{left} {op} {right}` with `×` `÷` for `*` `/`; `{left} in {right}` | infix per E-05         |
| `unop`  | basic    | op, operand     | `−{operand}` / `not {operand}`                                      | `-<x>` / `not <x>`     |
| `index` | list     | list, index     | `item {index} of {list}`                                            | `<list>[<index>]`      |
| `list`  | list     | items           | `[{items}]`                                                         | `[<a>, <b>]`           |
| `key`   | dict     | dict, key       | `{dict} at {key}`                                                   | `<dict>[<key>]`        |
| `dict`  | dict     | entries         | `{ {entries} }`                                                     | `{<k>: <v>, …}`        |
| `field` | class    | obj, field      | `{obj}.{field}`                                                     | `<obj>.<field>`        |
| `new`   | class    | cls, args       | `new {cls}({args})`                                                 | `<Cls>(<args>)`        |
| `call`  | function | fn, args        | `{fn}({args})`                                                      | `<fn>(<args>)`         |

## Builtin calls (`key = "call:<name>"`, shape expr)

| name                         | category | args | en template                                        | Python                                 |
| ---------------------------- | -------- | ---- | -------------------------------------------------- | -------------------------------------- |
| `len`                        | list     | a    | `length of {a}`                                    | `len(<a>)`                             |
| `abs`                        | basic    | x    | `absolute value of {x}`                            | `abs(<x>)`                             |
| `min`, `max`                 | basic    | a, b | `smaller of {a} and {b}` / `larger of {a} and {b}` | `min(<a>, <b>)` / `max(<a>, <b>)`      |
| `sum`                        | list     | a    | `sum of {a}`                                       | `sum(<a>)`                             |
| `str`, `int`, `float`        | basic    | x    | `{x} as text` / `as integer` / `as decimal`        | `str(<x>)` / `int(<x>)` / `float(<x>)` |
| `random_int`                 | basic    | a, b | `random integer from {a} to {b}`                   | `random.randint(<a>, <b>)`             |
| `random_float`               | math     | a, b | `random decimal from {a} to {b}`                   | `random.uniform(<a>, <b>)`             |
| `exp`, `log`, `sqrt`, `tanh` | math     | x    | `exp({x})` …                                       | `math.exp(<x>)` …                      |
| `round`                      | math     | x, n | `round {x} to {n} decimals`                        | `round(<x>, <n>)`                      |

## Methods (`key = "method:<name>"`)

| name     | on   | shape | args       | en template                               | Python                       |
| -------- | ---- | ----- | ---------- | ----------------------------------------- | ---------------------------- |
| `append` | list | stmt  | x          | `append {x} to {a}`                       | `<a>.append(<x>)`            |
| `insert` | list | stmt  | i, x       | `insert {x} at {i} in {a}`                | `<a>.insert(<i>, <x>)`       |
| `pop`    | list | expr  | i?         | `pop last of {a}` / `pop item {i} of {a}` | `<a>.pop()` / `<a>.pop(<i>)` |
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

N-08 The chart renders every node and chip from
`node.<key>.template<form>` (N-02) where `form` is `form(node, { creates })`
(`""` for the base template; `assign` → `Create` when the statement creates
its variable, `bool` → `False`, `unop` → `Not`), and renders a `text` slot
with `text(node, slot)` (`num` → `raw`; `binop` `op` → `×` / `÷` for `*` /
`/`), defaulting to the slot's string value; the hidden `empty` block has the
three N-02 keys and its template is the U-51 placeholder text. A node's
sentence is drawn with its first letter capitalised (`Set total to 0`);
chips, the block menu, and the editor show the template as written.

## Chart shape

N-09 A block with body regions declares `chart` (U-33): `if` declares
`{ branch: { yes: "then", no: "else" } }`; `while` declares
`{ check: "body" }`; `for` and `foreach` declare `{ counted: "body" }` and
carry three more keys, `node.<key>.init`, `node.<key>.check`, and
`node.<key>.step`, the texts of the generated nodes:

| key       | init                    | check                          | step                        |
| --------- | ----------------------- | ------------------------------ | --------------------------- |
| `for`     | `Set {var} to {start}`  | `Is {var} < {stop}?`           | `Set {var} to {var} + 1`    |
| `foreach` | `Start at the first item of {list}` | `Is there an item left?` | `Set {var} to the next item` |

The chart renders every other block as a box with its sentence; the
interpreter and emitter are unaffected by `chart`.

## Adding a node

`/add-node`: create `src/nodes/<key>.ts`; add the three i18n keys to both
locales; register; add a codegen test (exact text) and an interpreter test.
