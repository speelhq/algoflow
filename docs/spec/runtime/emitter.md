# Emitter

Emitter: `src/python/emit.ts`.

E-01 `emit(program): { code: string; map: Record<NodeId, { start: number; end: number }> }`,
1-based inclusive lines; a frame maps to its header line; `else:` is
unmapped.

E-02 File layout (sections only if non-empty; one blank line between
sections, two around classes and functions): the `import` lines, then one
`from <name> import a, b` line per module the program uses (D-04, modules
in name order, names in first-use order), then classes, functions, inputs,
and `main`.

```python
import math
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

E-03 Inputs are emitted as assignments of their `Data` in declaration
order.

E-04 4-space indentation, no trailing whitespace, one trailing newline.

E-05 Parentheses only when a child's precedence is lower than its parent's,
or equal on the right of a left-associative operator (`**` is
right-associative; comparisons and `in` are non-associative, so an equal
child on either side is parenthesized). Precedence low → high: `or`, `and`,
`not`, comparisons and `in`, `+ -`, `* / // %`, unary `-`, `**`.

E-06 `num` emits `raw`; `str` emits double quotes with `\\ \" \n \t \r`
escaped and any other control character as `\xNN`; `bool` emits
`True`/`False`; `none` emits `None`.

E-07 For every challenge solution the emitted files, run by `python3`,
produce the same stdout and final main-level variables as the interpreter
(C-23).

E-08 A statement block's `python()` returns `PyLine[]` where
`PyLine = string | { block: Stmt[] }`; an expression block's returns text.
The emitter indents a block by one level, writes `pass` for an empty block,
and records the line map while flattening. Blocks receive
`EmitContext = { expr(e): string; operand(e, precedence, side): string; target(t): string; block(stmts): PyLine }`;
`operand` applies E-05. Targets are rendered by the emitter: `name`,
`<list>[<index>]`, `<dict>[<key>]`, `<obj>.<field>`. An `empty` expression
emits `...`.

E-11 A statement with a name (L-58) is preceded by the comment line
`# <name>` at its indentation, and its map entry starts at that line.

E-09 `emit(program, modules?)` also returns
`modules: Array<{ name: Id; code: string; map: Record<NodeId, { start: number; end: number }> }>`,
one entry per module the program uses (D-04), each laid out per E-02
without inputs or `main`; `emit(module)` produces a module's file alone,
with its `map`.

## Verification

E-10 A fixture of 200 expressions emits the expected text (E-05).
