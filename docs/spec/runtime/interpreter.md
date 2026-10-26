# Interpreter

The interpreter runs a program in the browser. Its runner executes the
program and emits one event for each thing the run does. Its driver
reads those events as the visible steps the screens show, answers the
controls of the run bar, and publishes the state the screens draw. This
file states the runner's interface, the events, the runtime errors, what
a block definition's `run` receives, how a module function runs, the
driver, and the check that holds the interpreter to CPython.

Code: the runner `src/runtime/`; the driver `src/store/run.ts` with
`src/store/steps.ts` and `src/store/batches.ts`; the CPython check
`scripts/check.ts` with `scripts/lib/cpython.ts` and
`scripts/lib/agreement.ts`. Tests: beside each file, and the tests of the
Semantics rules, where `language.md`, Semantics, places them.

## Runner

The runner executes one program and gives out its events one call at a
time.

`run(program, inputs: Record<Name, Data>, seed: number, modules: Module[]): Runner`
executes a program that has no diagnostics. `modules` lists the modules
the program uses (`modules.md`, Resolution). When the program uses none,
`modules` is empty.

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
export type Frame = { fn: Name | "main"; module?: Name; callNodeId?: NodeId; vars: Map<Name, Value> }; // Modules
export type RuntimeError = {
  nodeId: NodeId;
  code: RuntimeCode;
  params: Record<string, string | number>;
};
```

Each call of `next()` resumes the program's generator once, and each
value the generator yields is one event.

The runner owns the stack of frames. For each call, the runner does
these in order:

1. pushes a frame
2. emits `call`
3. executes the body
4. emits `return`
5. pops the frame

`next()` ends the run with an error at two limits:

- After the 1,000,000th event, `next()` returns `E_EVENT_LIMIT`.
- When a call would make the stack deeper than 200 frames, `next()`
  returns `E_RECURSION`.

Once `next()` has returned a `Done`, every later call returns that same
`Done` and emits no event. This holds after `done` and after an error
alike, so no caller has to guard the end of a run. Forbidding the later
call was rejected because the guard would then sit in every caller, and
nothing would catch a caller that forgot it.

Two runs of one program with the same inputs, seed, and modules emit the
same event sequence.

## Events

An event records one thing the run did. The runner emits the events in
the order Python does those things.

```ts
export type Event =
  | { type: "enter"; nodeId: NodeId }
  | { type: "read"; nodeId: NodeId; refs: Ref[] }
  | { type: "write"; nodeId: NodeId; ref: Ref; value: Value; from?: Ref } // `from`: `swap`
  | { type: "compare"; nodeId: NodeId; result: boolean }
  | { type: "loop"; nodeId: NodeId; var?: Name; value?: Value }
  | { type: "call"; nodeId: NodeId; fn: Name; args: Value[] }
  | { type: "return"; nodeId: NodeId; fn: Name; value: Value }
  | { type: "print"; nodeId: NodeId; text: string };
export type Ref =
  | { var: Name }
  | { heap: HeapId; index: number }
  | { heap: HeapId; key: string }
  | { heap: HeapId; field: Name };
```

`Done` counts the run:

- `events`: every event, whether or not a visible step shows it
- `loops`: the `loop` events

### The order of a statement's events

A statement emits its events in this order:

1. its `enter`
2. the events of its expressions: `read`, `compare`, and `call` with its
   `return`
3. the events of its effect: `write`, `print`, or `loop`

A `swap` emits the events of its two places in Python's order
(`language.md`, Semantics, Lists):

1. the events of reading `b`
2. the events of reading `a`
3. the events of finding `a` again, then its `write`
4. the events of finding `b` again, then its `write`

### `read`

A `read` is emitted in two cases:

- The context's `read` (Block definitions) emits one when it reads an
  item, a key, or a field, whether the runner evaluates an expression or
  a `swap` reads its places.
- `in` on a list emits one, with one ref for each item the `in`
  compares.

Reading a variable emits no event.

### `write`

These block definitions emit `write`, directly or through the context's
`store`:

- `assign`
- `swap`
- `append`, with the new index
- `insert`
- `pop`, with the removed index and value
- `delete`
- `new`, one `write` for each field it sets

The `write` of a `swap` carries in `from` the place where the `swap` read
the value it writes, so the driver can recognize an exchange (Steps and
batches).

The runner emits no event of its own for an exchange, because the driver
decides how an exchange's events are shown.

### `compare`

Each comparison `binop` emits `compare`, with the comparison's
result. The comparisons are `== != < <= > >=` and `in`. The
operator and the operands are those of the event's block.

The event doesn't carry the operand values, because the values alone
hide where they came from, and the narration instead writes the
comparison as the chart does, with each variable replaced by its value
(`run.md`, Narration). For example, the `3` and `0` of `i % 15 == 0`
don't show where the 3 came from.

When `if` or `while` has evaluated its condition, it emits a `compare`
that carries the condition's node id and the condition's truth value
(`language.md`, Semantics, Values and the run). When the last event of
evaluating the condition is already a `compare` with that node id, it emits
none. So, either way, each check of a diamond ends in one `compare` of
its whole condition.

`if` and `while` emit this `compare` because the driver can't infer the
truth value from the region the run enters next: an empty region holds
no statement for the run to enter, and a loop's exit enters whatever
follows the loop. The last event alone decides, because a call inside
the condition can reach the same diamond in another frame and emit a
`compare` with the same node id, and every call ends in its `return`.

### `loop`

`for`, `foreach`, and `while` emit `loop` at the start of each pass.

In a `while`, the `loop` follows the `compare` of its check.

## Errors

A runtime error ends the run with a code and its params. This table
lists the codes, what raises each, and its params:

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

The params hold:

- `left` and `right`, of `E_TYPE`: the type names of the two operands,
  `int`, `float`, `str`, `bool`, `none`, `list`, `dict`, or the class name
- `op`, of `E_VALUE` and `E_NUMBER_TEXT`: the registry key of the failing
  expression (`keyOf`)
- `type`, of `E_VALUE`: the type name of the value

A `bool` isn't a number for arithmetic, ordering, a list index, or `sum`,
because no program of the block language needs Python's reading of
`True` as `1` in those places.

`E_VALUE` is a code of its own, not an `E_TYPE`, because `E_TYPE` names
two operand types, which fits an operator but names neither the
operation nor the fault. For example, for `abs("x")` an `E_TYPE` message
would read `abs and str …`.

A message writes `op` as the block definition's label, so the message
follows the locale, and no block definition spells a message key.


## Block definitions


A block definition implements its behavior as a generator, its `run`
(`blocks.md`, The block definition). These are the types of `run` and of the
context the runner gives it:

```ts
export type Signal =
  | undefined | { kind: "break" } | { kind: "continue" } | { kind: "return"; value: Value };
export type StmtRunner = (block: Stmt, ctx: RunContext) => Generator<Event, Signal, void>;
export type ExprRunner = (block: Expr, ctx: RunContext) => Generator<Event, Value, void>;
export type RunContext = {
  program: Program;
  heap: Heap;
  eval(expr: Expr): Generator<Event, Value, void>;   // dispatches through the registry
  exec(body: Stmt[]): Generator<Event, Signal, void>; // emits `enter` per statement (Events)
  locate(target: Expr, at: NodeId): Generator<Event, Ref, void>; // the target's block definition's `locate`
  read(target: Expr, at: NodeId): Generator<Event, { ref: Ref; value: Value }, void>;
  save(ref: Ref, value: Value): void;
  store(target: Expr, value: Value, at: NodeId): Generator<Event, void, void>; // locate, save, its `write`
  call(fn: Name, args: Value[], nodeId: NodeId): Generator<Event, Value, void>;
  fail(nodeId: NodeId, code: RuntimeCode, params?: Record<string, string | number>): never;
  valueError(block: Expr, value: Value): never; // E_VALUE (Errors)
  textError(block: Expr, text: string): never;  // E_NUMBER_TEXT (Errors)
  random: { int(a: number, b: number): number };
  print(line: string): void;
};
```

The context finds a target's place with `locate` and uses that place in
`read` and `store`:

- `locate` evaluates the target's expressions as Python does, the
  container first and then its position or key, and gives the target's
  place as a `Ref`. For example, a `Ref` names a variable of the current
  frame, a list's item, or a dict's key. An error that `locate` raises
  has `at` as its `nodeId`.
- `read` locates the target and reads the value at that place. For a
  variable never assigned, it raises `E_UNDEFINED`. For a place that
  isn't a variable, it emits a `read` with the target's node id (Events).
- `store` locates the target after the block has evaluated the value,
  saves the value, and emits its `write`. The `write` carries `at`, the
  statement that makes the write (Events).

`read` reads a place, and `save` writes one, by its `Ref` variant, not
by the block that found it, so a variable, an item, and the places of a
`swap` share one rule for where a value is and when the runner emits its
`read`.

## Modules

This section states how a call into a module runs, and how a run starts
at a module function instead of `main`.

A call that resolves to a module function (`language.md`, Scope) runs as
a call of a program function runs. Its frame has `module` set to the
module's name.

Inside a module frame, a `call` or a `new` resolves within that module
(`modules.md`, Resolution).

`run` accepts an entry `{ fn: Name; args: Data[] }` in place of `main`. With
an entry:

- The named function of the program or of the module is the first frame.
- `done` carries `value: Data`, the function's return value, and
  `args: Data[]`, the arguments as they are after the run (`modules.md`,
  Resolution; Cases).

## Driver

The driver runs a program for the screens. It reads a runner's events as
visible steps, works through them in batches, answers the controls of the
run bar, and publishes the state the screens draw.

### Steps and batches

A visible step is one of these:

- an event emitted while no module frame is on the stack, other than a
  write of an exchange
- the `return` event of a call into a module
- an exchange of two writes
- the call of `next()` that fails

So a module call is one visible step: taking the minimum of a heap, for
example.

In a program's run, the narration shows a module call by its returned
value.

`Open <name>` shows the function's inside (`modules.md`, Operations).

The run steps into a function the learner is still building, because
the function belongs to the program until the learner moves it with
`Move to module…`.

Two `write` events in a row form an exchange when each carries in `from`
the place the other writes.

The event of an exchange is `{ type: "swap"; nodeId: NodeId; a: Ref; b: Ref }`,
where `a` and `b` are the places the two writes write (`views.md`;
`run.md`, Narration).

The driver shows each `write` of a `swap` as a step of its own in two
cases:

- when the `swap` finds its places again elsewhere. For example:
  `swap(i, nums[i])`.
- when the `swap` emits an event while it finds the second place again.

The driver shows the writes apart there, because one `swap` step would
follow a step that already shows the first write alone, and the slide
would hide that step.

The exchange belongs to the driver, not to the runner, because only the
event after the first write reveals the exchange, and the runner can't
know that event before it has run the code that makes it.

`src/store/steps.ts` reads a runner one visible step at a time, and the
pre-run, Step, Seek, and Skip all read through it, so every count of
visible steps agrees.

To recognize an exchange, the driver reads the event after a `write`
that carries `from`. When the driver will publish the write's step, it
copies the state before it reads that event. When that event isn't the
other write of an exchange, the driver publishes the write's step with
that copy, so a frame that a call in the second place pushes isn't shown
before its `call`.

The driver takes that copy only for a step it publishes:

- a Step
- a step of Play
- the step a Seek reaches
- the last step of a batch

The driver copies for no other step, because a Seek through a long run
would otherwise copy the heap at every `swap`.

The driver works through runners in batches of 20,000 visible steps,
with `setTimeout(0)` between batches, because a visible step costs one
call of `next()`, or two for an exchange, and a call costs about 0.65 µs
at the heaviest work measured, so a batch takes about 13 ms, under one
display frame.

A batch bounded by time was rejected because it would never yield under
the tests' fake timers, which stop `performance.now`. Once a block makes
one call far more costly, a batch bounded by time becomes the better
choice.

Run first advances a separate runner to its end in batches. This run is
the pre-run. From the pre-run, Run records:

- `total`: the number of visible steps the runner produced, however the
  run ended. After an error, the failing step is step `total`.
- `outcome`: how the run ended.
- `prints`: the visible step of each `print`.

Run then creates the shown runner at step 0 and discards the separate
runner.

Run finds the end before it plays, because knowing the end does three
things:

- It tells the learner at once that a loop never ends, because playback
  at the fastest speed would show that only after eighteen hours.
- It gives the position bar its length.
- It lets `Watch this case` open the run at the step that printed the
  first differing line.

A run's seed depends on its test (`challenges.md`, Schema):

- A run of a case takes its test's seed, or seed 1 when the test has
  none.
- A run with no test takes seed 1 too. A Playground program's run is a
  run with no test.

At its end, a run is `done` or in `error`:

- A run of no step is `done` at once.
- A finished run is `done` when it reaches step `total`. There the
  driver calls `next()` once more, so that the runner's frames have
  unwound.
- A failed run is in `error` at step `total`.

The call of `next()` that fails is a step of its own, so a failed run's
`total` is one more than its steps with an event, and the position bar's
last position shows the error.

### Controls

The driver answers these controls:

- Step: the next visible step.
- Play: one Step every `1000 / speed` ms, where speed is 1, 4, or 15 for
  `Slow`, `Normal`, and `Fast` (`run.md`, Run bar).
- Seek(k): a new runner advanced to visible step `k` in batches. The
  driver rebuilds `state`, `stdout`, and `verdicts` from every event the
  runner passes. When `k` is at or after the current step, Seek continues
  the shown runner instead of starting a new one, because the shown
  runner reaches the same position as a new one would (Runner).
- Back: Seek(`step - 1`). While a Seek to `k` is in progress, Back is
  Seek(`k - 1`).
- Step over: visible steps, in batches, until the frame count of a step's
  state is at most that of the step it started from, or until the run
  ends. A step's state is the state the step would publish (Steps and
  batches), not the runner's, because the runner's state can be one call
  deeper after the driver has read past a write.
- Skip: visible steps, in batches and without publishing the steps in
  between, until a pause at the breakpoint or the end of the run.
- Stop: discards the runner.

For Play, a slider of 1 to 50 steps a second was rejected because a
beginner has no use for the number:

- At `Slow`, the learner follows each step.
- At `Normal`, the learner watches a loop go round.
- At `Fast`, the learner reaches a later point while the chart still
  moves.
- With Skip and the position bar, the learner jumps further.

While the pre-run, a Seek, or a Skip works through its batches, `busy`
is true.

While `busy` is true, the play button, Step, and Play do nothing. During
a Skip, though, the play button reads `❚❚ Pause` and cancels the Skip.
These controls do nothing then, because a control that took over the
runner would restart the pre-run, or leave a Seek at a step the position
bar doesn't show.

`busy` is a field of its own, not a sixth value of `status`, because a
sixth status would make every test of `status` in the screens
three-way.

A call shows in the called function's own chart (`run.md`, Call stack).
Expanding a call inline in the caller's chart was rejected because the
flowchart becomes hard to read one level down, and the learner would
have two places to edit a function.

The driver holds at most one breakpoint, a statement's `NodeId`, from
when it is set until Stop.

Play, Step over, and Skip pause at a visible `enter` of the breakpoint's
statement. When the statement is a loop, they also pause at each of its
`loop` events, where the run is at the loop's check. Step and Seek ignore
the breakpoint. `Next pass`, a run to the next `loop` event, was rejected
because in bubble sort it stops at every inner pass, not once per outer
pass, and it can't say which loop is meant. A breakpoint says by its
location where the run pauses. For example: a breakpoint on the outer
loop pauses once per outer pass, and one on a `print` pauses at the next
output.

### Published state

The driver publishes these fields:

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
| `activeId` | the statement that contains `lastEvent`'s block, or, after an error, the failing block (`chart.md`, Zoom and highlight) |
| `breakpoint` | a `NodeId` or none (Controls) |
| `busy` | a boolean (Controls) |
| `caseIndex` | the chosen case (`chart.md`, Input chart nodes) |
| `verdict` | the chosen case's result (`challenges.md`, Judging), only while the run is at step `total` |
| `difference` | `{ step, line? }`, the step at which a run started by `Watch this case` opened (`run.md`, Submission), until Stop |

After an error, `lastEvent` is none at step `total`.

The driver keeps `taken` and `verdicts` per frame:

- A `call` starts them empty for the called frame.
- A `return` gives back the caller's as they were.

A published `state` is a copy of the frames' variables and of the heap,
so a later step doesn't change it. A shallow copy would share the
runner's maps and change at the next step, so a screen could neither
compare two states nor memoize on one.

A copy one level deep is enough, because values are immutable records.

The driver refreshes `state` while playing because the `Result` tab
follows every step, the fastest speed included.

The driver updates `taken` and `pass` from every visible step it passes,
because neither can be rebuilt from `lastEvent` after a Seek.

`Watch this case` is an option of Run, not a step that the caller passes
to Run, because only the driver's own pre-run knows where the first
differing line was printed.

## CPython check

The check holds the interpreter to CPython on every test of every
challenge. For each test, the check:

1. runs the interpreter on `solution`
2. emits Python and writes a script
3. runs the script with `python3`
4. compares CPython's result with the interpreter's by the judge's
   equality (`challenges.md`, Judging)

The script has three parts, in this order:

1. a shim: `random.randint` returns the runner's `draws()` in order and
   raises when they run out
2. the emitted code with the test's inputs
3. an epilogue that prints one JSON line,
   `{"stdout": [...], "vars": {...}}`, by the `toData` rules

The epilogue writes Python's values as `Data` itself, so the one
equality rule that judges an expectation also compares the two engines.

The check writes each module the solution uses (`emitter.md`) as
`<name>.py` beside the script.

The check also emits every built-in module (`modules.md`, Built-in
modules) on its own and compiles it with `python3 -m py_compile`.

## Verification

Tests cover:

- the rules of `language.md`, Semantics, Values and the run, in the
  tests of `src/runtime`
- each runtime error code, with the rule or the block definition that
  raises it
- the same event sequence for the same program, inputs, seed, and
  modules (Runner), in the tests of `src/runtime` and `src/store/run.ts`
- every statement of Driver, in the tests of `src/runtime` and
  `src/store/run.ts`
