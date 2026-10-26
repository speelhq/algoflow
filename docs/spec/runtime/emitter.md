# Emitter

The emitter writes a program as a Python file, together with the file's
line map. This file states the emitter's interface, why Python is the
only language it writes, the layout of the file, where the emitter
writes parentheses and how it writes a literal, what a block definition's
`python()` returns and receives, and how the emitter writes a module's
file.

Code: `src/python/emit.ts`, `strings.ts`, `precedence.ts`. Tests:
`emit.test.ts`, with the expression fixture `fixtures/expressions.ts`.

## Interface

`emit` returns the program's file, its line map, and the modules'
files (Modules):

`emit(program, inputs: Record<Name, Data>, modules: Module[]): { code: string; map: Record<NodeId, { start: number; end: number }>; modules }`

The map's lines are 1-based and inclusive. A compound statement maps to
its header line, and `else:` has no entry in the map.

## The generated language

Python is the only language the emitter writes. JavaScript, which was
considered together with Dart, differs from Python in these ways:

- It has no distinction between `int` and `float`.
- It makes `-7 % 2` equal `-1`.
- It has no `//`.
- Its `in` on an array tests indices.

So a JavaScript file would either differ from the program or wrap
arithmetic in helpers that a learner can't read. A second language would
first need a narrower block language or those helpers.

## File layout

The file holds these sections, in this order:

1. the `import` lines, then one `from <name> import a, b` line for each
   module the program uses (`modules.md`, Resolution)
2. the classes
3. the functions
4. one section that holds the inputs and then `main`

A section appears only if it isn't empty.

Two blank lines separate a class or a function from what is next to it,
and one blank line separates any other two sections.

The `from` lines follow the order of the modules' names, and each line
lists its names in the order the program first uses them.

The emitter writes each input as an assignment of its value in
`inputs`, in the order the inputs are declared.

For example:

```python
import random
from heap import heap_push, heap_pop


class Value:
    ...


def backward(root):
    ...


nums = [5, 3, 1, 4, 2]
n = len(nums)
for i in range(n - 1):
    for j in range(n - 1 - i):
        if nums[j] > nums[j + 1]:
            nums[j], nums[j + 1] = nums[j + 1], nums[j]
print(nums)
```

The `...` bodies stand for code the example leaves out.

Each emitted file:

- uses 4-space indentation
- has no trailing whitespace
- ends with one newline

## Expressions

This section states where the emitter writes parentheses and how it
writes a literal and an `empty` expression.

The emitter writes an `empty` expression as `...`.

### Parentheses

The emitter writes parentheses around a child expression only when the
child's precedence is lower than its parent's, or equal on a side the
parent's operator doesn't associate to. That side is:

- the right of a left-associative operator
- the left of `**`, which is right-associative
- either side of a comparison or `in`, which are non-associative

The precedence levels, from low to high:

1. `or`
2. `and`
3. `not`
4. comparisons and `in`
5. `+ -`
6. `* / // %`
7. unary `-`
8. `**`

### Literals

The emitter writes each literal as its Python text:

- `num`: its `raw` text
- `str`: its text in double quotes, with `\\ \" \n \t \r` escaped and
  any other control character written as `\xNN`
- `bool`: `True` or `False`
- `none`: `None`


## Block definitions


This section states what a block definition's `python()` returns and
receives, and how the emitter writes a target and a statement with a
caption.

A block definition writes the Python of its blocks with `python()`:

- A statement block definition's `python()` returns `PyLine[]`, where
  `PyLine = string | { region: Stmt[] }`.
- An expression block definition's `python()` returns text.

The emitter flattens the lines: it indents each `{ region }` entry by one
level, writes `pass` for an empty one, and records the line map as it
goes.

A block definition's `python()` receives this context:
`EmitContext = { expr(e): string; operand(e, precedence, side): string; slot(block, name): string; region(stmts): PyLine }`.

- `operand` writes `e` as the child on `side` of a parent at
  `precedence`, and applies the parentheses rule (Parentheses).
- `slot` writes the input of a slot. When the slot declares `atom`
  (`blocks.md`, Notation), `slot` writes the input as an atom, so `slot`
  parenthesizes an operation in the input.

The emitter writes a target as the expression it is (`language.md`,
Statements, Targets).

Before a statement with a caption (`language.md`, Captions), the
emitter writes the comment line `# <caption>` at the statement's
indentation, and the statement's map entry starts at that line.

## Modules

This section states the modules `emit` receives and returns, how the
emitter lays out a module's file, and how it writes a call of a module
function.

The `modules` argument lists the modules the program uses (`modules.md`,
Resolution). When the program uses no module, the argument is empty.

The returned `modules` holds one entry for each module:
`Array<{ name: Name; code: string; map: Record<NodeId, { start: number; end: number }> }>`.
Inlining a module's functions into `main.py` was rejected because the
`Python` tab would then show one program where the canvas and the path
bar show a program and a module.

The emitter lays out a module's file as it lays out the program's file
(File layout), without inputs or `main`.

`emit(module)` writes a module's file alone, with its `map`.

The emitter writes a call of a module function unqualified. For
example: `heap_push(h, x)`. A qualified call was rejected because
`heap.push(h, x)` would collide with the parser's method syntax.

## Verification

A fixture of 200 expressions checks that the emitter writes each of them
as the expected text under the parentheses rule (Parentheses).
