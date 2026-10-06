# 04 — Runtime

## Interpreter (`src/runtime/`)

R-01 `run(program, inputs: Record<Id, Data>, seed: number, modules?: Module[]): Runner`
executes a program with no diagnostics; `modules` are the modules the
program uses (D-04).

```ts
export type Runner = {
  next(): Event | Done;
  state(): State; // call only when paused
  stdout(): string[];
  draws(): number[]; // every random result in order
};
export type Done =
  | { type: "done"; steps: number; loops: number }
  | { type: "error"; error: RuntimeError; steps: number };
export type State = { frames: Frame[]; heap: Heap };
export type Frame = { fn: Id | "main"; module?: Id; callNodeId?: NodeId; vars: Map<Id, Value> }; // R-16
export type RuntimeError = {
  nodeId: NodeId;
  code: RuntimeCode;
  params: Record<string, string | number>;
};
```

R-02 Events:

```ts
export type Event =
  | { type: "enter"; nodeId: NodeId }
  | { type: "read"; nodeId: NodeId; refs: Ref[] }
  | { type: "write"; nodeId: NodeId; ref: Ref; value: Value }
  | { type: "swap"; nodeId: NodeId; a: Ref; b: Ref }
  | { type: "compare"; nodeId: NodeId; left: Value; right: Value; result: boolean }
  | { type: "loop"; nodeId: NodeId; var?: Id; value?: Value }
  | { type: "call"; nodeId: NodeId; fn: Id; args: Value[] }
  | { type: "return"; nodeId: NodeId; fn: Id; value: Value }
  | { type: "print"; nodeId: NodeId; text: string };
export type Ref =
  | { var: Id }
  | { heap: HeapId; index: number }
  | { heap: HeapId; key: string }
  | { heap: HeapId; field: Id };
```

R-03 Per statement: one `enter`, then the events of its expressions
(`read`, `compare`, `call`/`return`), then its effect (`write`, `swap`,
`print`, `loop`).

R-04 `read` is emitted for `index`, `key`, and `field` reads and for `in`
on a list (one ref per compared element); variable reads emit nothing.

R-05 `write` is emitted for `assign`, `append` (new index), `insert`,
`pop` (removed index and value), `delete`, and each field set by `new`.

R-06 `compare` is emitted for every comparison `binop` (`== != < <= > >=`
and `in`), with `left` and `right` holding the two operand values; the
operator is the node's.

R-07 `loop` is emitted at the start of each iteration of `for`, `foreach`,
and `while` (after the `while` compare).

R-08 `Done.loops` counts `loop` events; `Done.steps` counts all events.

R-09 Runtime error codes:

| Code           | Raised by              | params                    |
| -------------- | ---------------------- | ------------------------- |
| `E_UNDEFINED`  | reading a variable never assigned (a loop that ran no iteration, L-43) | `name` |
| `E_INDEX`      | L-20                   | `index`, `length`         |
| `E_KEY`        | L-21                   | `key`                     |
| `E_FIELD`      | L-23                   | `cls`, `field`            |
| `E_TYPE`       | L-14/15/21/25          | `left`, `right`           |
| `E_DIV_ZERO`   | L-13                   |                           |
| `E_POP_EMPTY`  | `pop` on an empty list |                           |
| `E_ARITY`      | L-22                   | `name`, `expected`, `got` |
| `E_RECURSION`  | L-28                   |                           |
| `E_STEP_LIMIT` | L-31                   |                           |

R-10 The same program, inputs, and seed produce the same event sequence.

R-13 Blocks implement their behaviour as generators (N-01 `run`):

```ts
export type Signal =
  | undefined | { kind: "break" } | { kind: "continue" } | { kind: "return"; value: Value };
export type StmtRunner = (node: Stmt, ctx: RunContext) => Generator<Event, Signal, void>;
export type ExprRunner = (node: Expr, ctx: RunContext) => Generator<Event, Value, void>;
export type RunContext = {
  program: Program;
  heap: Heap;
  eval(expr: Expr): Generator<Event, Value, void>;   // dispatches through the registry
  exec(body: Stmt[]): Generator<Event, Signal, void>; // emits `enter` per statement (R-03)
  get(name: Id, nodeId: NodeId): Value;               // current frame
  set(name: Id, value: Value): void;
  call(fn: Id, args: Value[], nodeId: NodeId): Generator<Event, Value, void>;
  fail(nodeId: NodeId, code: RuntimeCode, params?: Record<string, string | number>): never;
  random: { int(a: number, b: number): number; float(a: number, b: number): number };
  print(line: string): void;
};
```

R-14 `Runner.next()` resumes the program generator once; every yielded value
is one event. Frames form a stack owned by the runner; `call` pushes a frame,
emits `call`, executes the body, emits `return`, and pops. `E_STEP_LIMIT` is
returned by the `next()` after the 1,000,000th event; `E_RECURSION` when a
call would make the stack deeper than 200 frames.

R-15 `E_TYPE` params `left` and `right` are the type names of the operands
(`int`, `float`, `str`, `bool`, `none`, `list`, `dict`, or the class name);
a `bool` is not a number for arithmetic and ordering.

R-16 A call resolved to a module function (L-46) pushes a frame with
`module` set to the module name; inside it, names resolve within that
module (D-05), and the `call` and `return` events are as for a program
function. Events emitted while a module frame is on the stack are not
visible steps (R-11).

R-18 `run` accepts an entry `{ fn: Id; args: Data[] }` in place of `main`:
the named function of the program or module is the first frame, and `done`
then carries `value: Data`, the function's return value, and `args: Data[]`,
the arguments as they are after the run (D-06, D-19).

## Driver (`src/store/run.ts`)

R-11 A visible step is an event emitted while no module frame is on the
stack; a module call is one visible step, its `return`. Run first advances
a separate runner, discarded afterwards, to its end in batches of 2,000
with `setTimeout(0)` between batches and records `total`, the number of
visible steps it produced irrespective of how it ended (after an error the
failing step is step `total`), `outcome`, the manner in which it ended, and `prints`, the
visible step of each `print`; then it creates the shown runner at step 0.
Step: `next()` until the next visible step. Play: one Step every
`1000 / speed` ms, speed in `[1, 50]`. Seek(k): a new runner advanced to
visible step `k`, in the same batches, rebuilding `state`, `stdout`, and
`verdicts` from every event it passes. When `k` is at or after the current
step, the driver continues the current runner in place of a new one; the
two reach the same position (R-10). Back: Seek(`step - 1`), and
Seek(`k - 1`) while a Seek to `k` is in progress. Stop: discard the runner.
While the pre-run, a Seek, or a Skip works through its batches `busy` is
true and Step and Play do nothing; Pause during the pre-run makes the run
open paused. A run of no step is `done` immediately; a run is `done` or in
`error` on reaching step `total`.

R-12 Driver state: `status` (`idle | paused | playing | done | error`),
`step`, `total`, `outcome`, `prints`, `lastEvent`, `state` (refreshed after
each step in step and play mode, at the end of each batch, and on pause,
done, error), `frame` (the index of the frame shown, U-68), `stdout`,
`verdicts` (the last check result per diamond, U-61), `taken` (the
statements entered in the current pass, U-61), `pass` (for a `loop`
`lastEvent`, the number of that loop's passes since it was entered, U-63),
`breakpoint` (a `NodeId` or none, R-19), `busy` (R-11), `caseIndex` (the
chosen case, U-32), `verdict` (the chosen case's result, C-15, only while
the run is at step `total`), and `difference` (`{ step, line? }`, the step
at which a run started by `Watch this case` opened, U-81, until Stop).
After an error `lastEvent` is none at step `total`. A published `state` is a
copy of the frames' variables and of the heap: a later step does not change
it. `Done.steps` counts every event, visible or not.

R-17 Step over: `next()` repeatedly, in R-11 batches, until the frame
count is at most its value before the first `next()` and the run is at a
visible step (R-11), or the run ends.

R-19 The driver holds at most one breakpoint, a statement's `NodeId`, from
its setting until Stop. Play, Step over, and Skip pause at a visible
`enter` of that node and, when it is a loop, at each of its `loop` events
(the run is then at the loop's check); Step and Seek ignore it. Skip:
`next()` repeatedly, in R-11 batches and without publishing the
intervening steps, until such a pause or the end of the run.

## Python emitter (`src/python/emit.ts`)

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
(T-06).

E-08 A statement block's `python()` returns `PyLine[]` where
`PyLine = string | { block: Stmt[] }`; an expression block's returns text.
The emitter indents a block by one level, writes `pass` for an empty block,
and records the line map while flattening. Blocks receive
`EmitContext = { expr(e): string; operand(e, precedence, side): string; target(t): string; block(stmts): PyLine }`;
`operand` applies E-05. Targets are rendered by the emitter: `name`,
`<list>[<index>]`, `<dict>[<key>]`, `<obj>.<field>`. An `empty` expression
emits `...`.

E-09 `emit(program, modules?)` also returns
`modules: Array<{ name: Id; code: string; map: Record<NodeId, { start: number; end: number }> }>`,
one entry per module the program uses (D-04), each laid out per E-02
without inputs or `main`; `emit(module)` produces a module's file alone,
with its `map`.

## Parser (`src/python/parse.ts`)

G-01 `parse(text, scope): Expr | ParseError` implements:

```
expr     := or
or       := and ("or" and)*
and      := not ("and" not)*
not      := "not" not | cmp
cmp      := arith (("==" | "!=" | "<" | "<=" | ">" | ">=" | "in") arith)?
arith    := term (("+" | "-") term)*
term     := factor (("*" | "/" | "//" | "%") factor)*
factor   := "-" factor | power
power    := postfix ("**" factor)?
postfix  := atom ("[" expr "]" | "." NAME | "." NAME "(" args ")" | "(" args ")")*
atom     := NUMBER | STRING | "True" | "False" | "None" | NAME
          | "[" args "]" | "{" (expr ":" expr ("," expr ":" expr)*)? "}" | "(" expr ")"
args     := (expr ("," expr)*)?
```

The root of the result has `source: "text"`. Number text CPython rejects
(`0777`) is `E_PARSE_SYNTAX`; `\xNN` escapes are decoded. A construct whose
block is not in the registry is `E_PARSE_SYNTAX` at its token, so the
registry alone determines what the language accepts.

G-02 `NAME(...)` resolves in the order of L-46: a class or function of the
program, a learner module, a built-in module, a builtin in `03-nodes.md`
(`math.exp`, `random.randint`, `random.uniform` accepted as aliases), else
`E_UNKNOWN_CALL`.

G-03 `a.b(...)` resolves to a method in `03-nodes.md`, else `E_UNKNOWN_CALL`.

G-04 Chained comparison → `E_PARSE_CHAIN`; other syntax errors →
`E_PARSE_SYNTAX`; both carry `position`.

G-05 `unparse` is the emitter's expression function;
`unparse(parse(s))` is a fixed point of `parse ∘ unparse` (T-04).

## CPython check (`scripts/check.ts`)

R-20 For each challenge and test: run the interpreter on `solution`; emit
Python; write a script of (1) a shim replacing `random.randint` and
`random.uniform` with functions returning `draws()` in order and raising
when exhausted, (2) the emitted code with the test's inputs, (3) an
epilogue printing one JSON line `{"stdout": [...], "vars": {...}}` using
the `toData` rules; write each module the solution uses (E-09) as
`<name>.py` alongside the script; run `python3`; compare with the
interpreter under C-10. Every built-in module (D-15) is also emitted
alone and compiled by `python3 -m py_compile`.
