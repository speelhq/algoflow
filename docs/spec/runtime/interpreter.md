# Interpreter

Code: the runner `src/runtime/`; the driver `src/store/run.ts` with
`src/store/steps.ts` and `src/store/batches.ts`; the CPython check
`scripts/check.ts` with `scripts/lib/cpython.ts` and
`scripts/lib/agreement.ts`. Tests: beside each file, and the rules of
`language.md`'s Semantics as that section states.

## Runner

`run(program, inputs: Record<Id, Data>, seed: number, modules: Module[]): Runner`
executes a program with no diagnostics. `modules` lists the modules the
program uses (`modules.md`, Resolution), empty when it uses none.

```ts
export type Runner = {
  next(): Event | Done;
  state(): State; // call only when paused
  stdout(): string[];
  draws(): number[]; // every random result in order
};
export type Done =
  | { type: "done"; events: number; loops: number }
  | { type: "error"; error: RuntimeError; events: number };
export type State = { frames: Frame[]; heap: Heap };
export type Frame = { fn: Id | "main"; module?: Id; callNodeId?: NodeId; vars: Map<Id, Value> }; // Modules
export type RuntimeError = {
  nodeId: NodeId;
  code: RuntimeCode;
  params: Record<string, string | number>;
};
```

`Runner.next()` resumes the program generator once, and every yielded value
is one event. Frames form a stack that the runner owns. A call pushes a
frame, emits `call`, executes the body, emits `return`, and pops the frame.
`next()` returns `E_EVENT_LIMIT` when called after the 1,000,000th event,
and `E_RECURSION` when a call would make the stack deeper than 200 frames.

Once `next()` has returned a `Done`, every later call returns that same
`Done` and emits no event, after `done` and after an error alike, so no
caller guards the end of a run. Forbidding the call was rejected, because
it would put that guard in every caller, with nothing to catch a caller
that forgot it.

The same program, inputs, seed, and modules produce the same event
sequence.

## Events

```ts
export type Event =
  | { type: "enter"; nodeId: NodeId }
  | { type: "read"; nodeId: NodeId; refs: Ref[] }
  | { type: "write"; nodeId: NodeId; ref: Ref; value: Value; from?: Ref } // `from`: `swap`
  | { type: "compare"; nodeId: NodeId; result: boolean }
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

Each statement emits one `enter`, then the events of its expressions
(`read`, `compare`, `call`/`return`), then its effect (`write`, `print`,
`loop`). A `swap` statement's events follow Python's order (`language.md`,
Semantics, Lists): the events of reading `b`, then `a`, then of finding
`a` again and its `write`, then of finding `b` again and its `write`.

`read` is emitted for reading an item, a key, or a field (`read`, Blocks),
whether an expression is evaluated or a `swap` reads its places, and for
`in` on a list, with one ref per compared element. Variable reads emit
nothing.

`write` is emitted for `assign`, `swap`, `append` (the new index),
`insert`, `pop` (the removed index and value), `delete`, and each field
that `new` sets. A `swap`'s `write` carries in `from` the place its value
was read from, and the driver uses it to recognize an exchange (Steps and
batches). The runner emits the facts of the run in Python's order. It emits
no event of its own for an exchange, because the driver decides how an
exchange's events are shown.

`compare` is emitted for every comparison `binop` (`== != < <= > >=` and
`in`), with its result. The operator and the operands are the node's. The
event doesn't carry the operand values, because alone (`3` and `0` of
`i % 15 == 0`) they hide where the 3 came from, while the narration writes
the comparison as the chart does, with each variable replaced by its value
(`run.md`, Narration).

After `if` and `while` evaluate their condition, they emit a `compare` with
the condition's id and its truth value (`language.md`, Semantics, Values and
the run), unless the last event of evaluating the condition is a `compare`
with that id. So each check of a diamond ends in one `compare` of its whole
condition. `if` and `while` emit this `compare` because the driver can't infer
that truth from the region entered next: no statement enters an empty region,
and a loop's exit enters whatever follows it. Only the last event counts,
because a call inside the condition can reach the same diamond in another
frame, with a `compare` of the same id, and every call ends in its `return`.

`loop` is emitted at the start of each iteration of `for`, `foreach`, and
`while` (after the `while` compare).

`Done.loops` counts `loop` events, and `Done.events` counts all events.

## Errors

Runtime error codes:

| Code           | Raised by              | params                    |
| -------------- | ---------------------- | ------------------------- |
| `E_UNDEFINED`  | reading a variable never assigned (a loop that ran no iteration, `language.md`, Scope) | `name` |
| `E_INDEX`      | a list index (`language.md`, Semantics, Values and the run) | `index`, `length` |
| `E_KEY`        | a missing dict key (same)                         | `key`                     |
| `E_FIELD`      | a missing field (`language.md`, Semantics, Objects) | `cls`, `field`          |
| `E_TYPE`       | `+` mixing `str` and a number, ordering a number with a `str`, a dict key, a `for` bound, a `randint` bound, a list index that isn't an `int` or an item of a value that isn't a list, a `sum` item that isn't a number (`language.md`, Semantics) | `left`, `right` |
| `E_VALUE`      | `abs`, `int`, `float`, `len`, `sum`, or unary `-` of a value of a type it doesn't take | `op`, `type` |
| `E_NUMBER_TEXT`| `int` or `float` of a text that isn't such a number | `op`, `text`     |
| `E_EMPTY_RANGE`| `randint(a, b)` with `a > b`                      | `a`, `b`                  |
| `E_DIV_ZERO`   | division or modulo by zero; zero to a negative power | |
| `E_POP_EMPTY`  | `pop` on an empty list |                           |
| `E_ARITY`      | `new` with more arguments than fields             | `name`, `expected`, `got` |
| `E_RECURSION`  | a call deeper than 200 frames (Runner)            |                           |
| `E_EVENT_LIMIT`| the 1,000,000th event (Runner)                    |                           |

`E_TYPE`'s params `left` and `right` are the type names of the operands
(`int`, `float`, `str`, `bool`, `none`, `list`, `dict`, or the class name).
A `bool` isn't a number for arithmetic, ordering, a list index, or `sum`,
because block programs never need Python's reading of `True` as `1`
there.

`E_VALUE` and `E_NUMBER_TEXT` carry as `op` the registry key of the failing
expression (`keyOf`), and `E_VALUE` carries as `type` the type name of the
value. `E_VALUE` is separate from `E_TYPE` because `E_TYPE` names two
operand types, which fits an operator but would name neither the operation
nor the fault of `abs("x")` (`abs and str …`). `op` is written as the
block's label, so the message follows the locale, and no block spells a
message key.

## Blocks

Blocks implement their behavior as generators (`run`, `blocks.md`):

```ts
export type Signal =
  | undefined | { kind: "break" } | { kind: "continue" } | { kind: "return"; value: Value };
export type StmtRunner = (node: Stmt, ctx: RunContext) => Generator<Event, Signal, void>;
export type ExprRunner = (node: Expr, ctx: RunContext) => Generator<Event, Value, void>;
export type RunContext = {
  program: Program;
  heap: Heap;
  eval(expr: Expr): Generator<Event, Value, void>;   // dispatches through the registry
  exec(body: Stmt[]): Generator<Event, Signal, void>; // emits `enter` per statement (Events)
  locate(target: Expr, at: NodeId): Generator<Event, Ref, void>; // the target's block's `locate`
  read(target: Expr, at: NodeId): Generator<Event, { ref: Ref; value: Value }, void>;
  save(ref: Ref, value: Value): void;
  store(target: Expr, value: Value, at: NodeId): Generator<Event, void, void>; // locate, save, its `write`
  call(fn: Id, args: Value[], nodeId: NodeId): Generator<Event, Value, void>;
  fail(nodeId: NodeId, code: RuntimeCode, params?: Record<string, string | number>): never;
  valueError(node: Expr, value: Value): never; // E_VALUE (Errors)
  textError(node: Expr, text: string): never;  // E_NUMBER_TEXT (Errors)
  random: { int(a: number, b: number): number };
  print(line: string): void;
};
```

`locate` evaluates the target's expressions, the container before its
position or key as Python does, and gives the target's place as a `Ref`.
`locate`'s errors carry `at`. `read` locates the target and reads the value
there, with `E_UNDEFINED` for a variable never assigned, and emits a `read`
with the target's id for a place that isn't a variable (Events). `store`
locates the target after the value, saves the value, and emits its
`write`, which carries `at`, the statement whose effect the write is
(Events). `read` and `save` read and write by the `Ref` variant (a variable
of the current frame, a list's item, a dict's key), not by block, so a
variable, an item, and the places of a `swap` share one rule for where a
value is and when its read is emitted.

## Modules

A call resolved to a module function (`language.md`, Scope) runs as a call
of a program function does, and its frame has `module` set to the module
name.

Inside a module frame, a `call` or `new` resolves within that module
(`modules.md`, Resolution).

`run` accepts an entry `{ fn: Id; args: Data[] }` in place of `main`. With
an entry, the named function of the program or module is the first frame,
and `done` carries `value: Data`, the function's return value, and
`args: Data[]`, the arguments as they are after the run (`modules.md`,
Resolution; Cases).

## Driver

### Steps and batches

A visible step is an event emitted while no module frame is on the stack, the
`return` event of a call into a module, or an exchange of two writes (below).
So a module call is one visible step. In a program's run, a module function is
a block, such as taking the minimum of a heap, narrated by its returned value,
and `Open <name>` shows its inside (`modules.md`, Operations). A function the
learner is still building belongs to the program, and the run steps into it
until `Move to module…`.

Two `write` events in a row, each carrying in `from` the place the other
writes, are one visible step, an exchange. Its event is
`{ type: "swap"; nodeId: NodeId; a: Ref; b: Ref }`, where `a` and `b` are the
places the two writes write (`views.md`; `run.md`, Narration). A `swap` whose
places are found again elsewhere (`swap(i, nums[i])`), or whose second place
is found again with an event of its own, shows each `write` as its own step,
because one `swap` step there would follow a step that shows the first write
alone, which the slide would hide. The exchange belongs to the driver, not to
the runner, because only the event after the first write reveals it, and the
runner can't know that event before it has run the code that makes it.
`src/store/steps.ts` reads a runner one visible step at a time, for the
pre-run, Step, Seek, and Skip alike, so every count of visible steps agrees.

To recognize an exchange, the driver reads the event after a `write` that
carries `from`. When that event isn't the write's partner, the write's step
is published with the state copied before the driver read on, so a frame
that a call in the second place pushes isn't shown before its `call`. The
copy is taken only for a step the driver publishes (Step, Play, the step a
Seek reaches, the last step of a batch), because a Seek through a long run
would otherwise copy the heap at every `swap`.

The driver works through runners in batches of 20,000 visible steps (one
call of `next()`, or two for an exchange), with `setTimeout(0)` between
batches. At the heaviest work measured, about 0.65 µs a call, a batch takes
about 13 ms, which is under one frame. A batch bounded by time was
rejected, because it would never yield under the tests' fake timers, which
stop `performance.now`. A batch bounded by time becomes the better choice
once a block makes one call far more costly.

Run first advances a separate runner to its end in batches. From it, Run
records `total`, the number of visible steps the runner produced however it
ended (after an error, the failing step is step `total`); `outcome`, how it
ended; and `prints`, the visible step of each `print`. Then Run creates the
shown runner at step 0, and the separate runner is discarded. Knowing the end
before playing tells the learner at once that a loop never ends (playback at
the fastest speed would show it only after eighteen hours), gives the position
bar its length, and lets a wrong answer open at the step that printed the
first wrong line.

A run of a case takes the test's seed (`challenges.md`, Schema). A run with
no test, a Playground program's, takes seed 1, as a test without a
seed does.

A run of no step is `done` at once. A finished run is `done` on reaching
step `total`, where the driver makes one more call of `next()` so that the
runner's frames have unwound. A failed run is in `error` at step `total`.
The call that fails is a step of its own, so a failed run's `total` is its
visible steps plus one, and the position bar's last position is where its
error is shown.

### Controls

Step: the next visible step.

Play: one Step every `1000 / speed` ms, where speed is 1, 4, or 15
(`Slow`, `Normal`, `Fast`; `run.md`, Run bar). A slider of 1 to 50 steps a
second was rejected, because a beginner has no use for the number: `Slow`
follows each step, `Normal` watches a loop go round, `Fast` reaches a later
point while the chart still moves, and `Skip` and the position bar jump
further.

Seek(k): a new runner advanced to visible step `k` in batches, rebuilding
`state`, `stdout`, and `verdicts` from every event it passes. When `k` is
at or after the current step, the driver continues the current runner
instead of a new one, and the two reach the same position (Runner).

Back: Seek(`step - 1`), and Seek(`k - 1`) while a Seek to `k` is in
progress.

Stop: discard the runner.

While the pre-run, a Seek, or a Skip works through its batches, `busy` is
true, and the play button, Step, and Play do nothing, because a control that
took over the runner would restart the pre-run, or leave a Seek at a step the
position bar doesn't show. During a Skip, though, the play button reads
`❚❚ Pause` and cancels the Skip. `busy` stands beside the five statuses,
because a sixth status would make every test of `status` in the screens
three-way.

Step over: visible steps, in batches, until the frame count of a step's
state is at most that of the step it started from, or until the run ends.
A step's state is the one it publishes (Steps and batches), not the
runner's, which can be one call deeper after the driver has read past a
write. Expanding a call inline in the caller's chart was rejected, because
the flowchart becomes hard to read one level down, and a function would
have two places to be edited.

The driver holds at most one breakpoint, a statement's `NodeId`, from when it
is set until Stop. Play, Step over, and Skip pause at a visible `enter` of
that node and, when it is a loop, at each of its `loop` events (the run is
then at the loop's check). Step and Seek ignore the breakpoint. Skip: visible
steps, in batches and without publishing the ones in between, until such a
pause or the end of the run. `Next pass`, a run to the next `loop` event, was
rejected, because in bubble sort it stops at every inner pass, not once per
outer pass, and it can't say which loop is meant. A breakpoint says it by
location: an outer pass on the outer loop, the next output on a `print`.

### Published state

The driver publishes the fields of this table.

| Field | Description |
| --- | --- |
| `status` | `idle`, `paused`, `playing`, `done`, or `error` |
| `step` | the current visible step (Controls) |
| `total` | the number of visible steps of the run (Steps and batches) |
| `outcome` | how the pre-run ended, or none (Steps and batches) |
| `prints` | the visible step of each `print` (Steps and batches) |
| `lastEvent` | the event of the current visible step, or none (Steps and batches) |
| `state` | refreshed after each step of Step and Play, at the end of each batch, and on pause, done, and error |
| `frame` | the index of the frame shown (`run.md`, Call stack) |
| `stdout` | the shown runner's output (Runner) |
| `verdicts` | the last check result of each diamond in the shown frame's current pass (`run.md`, Path and marks) |
| `taken` | the statements entered in the shown frame's current pass (`run.md`, Path and marks) |
| `pass` | for a `loop` `lastEvent`, the number of that loop's passes since it was entered (`run.md`, Narration) |
| `activeId` | the statement that contains `lastEvent`'s node, or, after an error, the failing node (`chart.md`, Zoom and highlight) |
| `breakpoint` | a `NodeId` or none (Controls) |
| `busy` | a boolean (Controls) |
| `caseIndex` | the chosen case (`chart.md`, Input nodes) |
| `verdict` | the chosen case's result (`challenges.md`, Judging), only while the run is at step `total` |
| `difference` | `{ step, line? }`, the step at which a run started by `Watch this case` opened (`run.md`, Submission), until Stop |

After an error, `lastEvent` is none at step `total`. The driver keeps
`taken` and `verdicts` per frame: a `call` starts them empty for the called
frame, and a `return` gives back the caller's as they were. A published
`state` is a copy of the frames' variables and of the heap, so a later step
doesn't change it. `Done.events` counts every event, whatever steps show
it.

`state` is refreshed while playing because the `Result` tab follows every
step, the fastest speed included. The driver updates `taken` and `pass` from
every visible step it passes, because neither can be rebuilt from `lastEvent`
after a Seek. `Watch this case` is a run option, not a step passed in, because
only the driver's own pre-run knows where the differing line was printed. A
shallow copy of `state` would share the runner's maps and change at the next
step, so a screen could neither compare two states nor memoize on one. Values
are immutable records, so a copy one level deep is enough.

## CPython check

For each challenge and test, the check runs the interpreter on `solution`,
emits Python, writes a script, runs `python3`, and compares the result with
the interpreter's by the judge's equality (`challenges.md`, Judging). The
script has three parts: (1) a shim that replaces `random.randint` with a
function that returns `draws()` in order and raises when they run out, (2) the
emitted code with the test's inputs, and (3) an epilogue that prints one JSON
line, `{"stdout": [...], "vars": {...}}`, by the `toData` rules. The check
writes each module the solution uses (`emitter.md`) as `<name>.py` beside the
script. The check also emits every built-in module (`modules.md`, Built-in
modules) alone and compiles it with `python3 -m py_compile`. The epilogue
writes Python's values as `Data` itself, so the one equality rule used for
expectations compares both engines.

## Verification

The tests of `src/runtime` cover the Semantics rules under Values and the
run (`language.md`). Each runtime error code is tested with the rule or the
block that raises it. The tests of `src/runtime` and `src/store/run.ts`
cover determinism and every statement of Driver.
