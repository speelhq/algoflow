# 08 — Modules

Types: `src/modules/types.ts`. Resolution: `src/modules/resolve.ts`.
Store: `src/store/modules.ts`. Built-in modules: `modules/<name>.json`.

## Schema

D-01 A module is one JSON value:

```ts
export type Module = {
  version: 1;
  name: Id; // L-01; its Python file is <name>.py (E-09)
  title?: Localized; // built-in modules only; a learner module shows `name`
  classes: ClassDef[];
  functions: FunctionDef[];
  cases: Case[]; // D-19
};
export type Case = {
  fn: Id; // a function of this module
  args: Data[]; // one per parameter
  expect: { returns: Data; args: Data[] }; // the value returned, and the arguments after the run
};
```

`validate()` (02) applies to a module as to a program with no `main`;
L-04 and L-05 hold within the module.

D-02 Module names are unique among learner modules and unique among
built-in modules; a learner module with a built-in module's name shadows
it (L-46). Built-in modules are read-only.

## Resolution

D-03 Every module is visible to every program; a program uses a module by
calling one of its functions or constructing one of its classes (L-46).
Nothing in `Program` names a module.

D-04 `usedModules(program, modules): Module[]` is the set of modules whose
functions or classes the program's calls and `new` expressions resolve to,
in name order; `run` (R-01), `emit` (E-09), and `judge` (C-15) receive it.

D-05 A module function sees its parameters and the functions and classes
of its own module (L-42); a module uses no other module, and a name of a
program or of another module is `E_UNKNOWN_CALL` inside a module.

D-06 A module has no `main`. Its page runs one function at a time (R-18):
the shown function's parameters are Input nodes in the form of U-32, their
menu listing that function's cases (D-19) and `Custom…`, and after a run
`End` shows the returned value.

## Pages

D-07 Modules page (`#/modules`): one row per module (name or title, the
number of functions and classes, `Built-in` on built-in modules), learner
modules first in name order; `New module…` (prompts for the name, L-01),
`Import…` (D-13), and per learner row `Export` and `Delete` (D-12). The
rows have the form of U-15.

D-08 Module page (`#/m/<name>`, and `#/m/<name>/<fn>` showing that
function): the top bar with `← Modules`, the name, `▶ Run` (D-06), `Test`
(D-20), undo, redo, and `⋯` with Help; the panel with the tabs `Result`
and `Python` (U-20); the chart region with the path bar (U-30), whose `▾`
lists the module's functions and classes, `Add function`, and `Add class`.
A learner module's chart region carries the band
`Your module. Changes reach every program that uses it.` A built-in
module's charts are read-only, its editors show no footer, `▾` offers no
`Add`, and the top bar has `Clone` (D-11). Edits persist under D-14 with
the timing of L-53.

## Operations

D-09 `Move to module…` (U-31, U-83) moves a function or class, with every
program function and class it references, into an existing or new learner
module; the program's calls then resolve to the module (L-46). It is one
undoable edit of the program; the module change is not undone.

D-11 `Clone`, on a built-in module's page, creates a learner module with
the same name, content, and cases, which shadows the built-in one (D-02)
and opens for editing.

D-12 `Delete` lists the programs whose calls resolve to the module and
requests confirmation; afterwards those calls are `E_UNKNOWN_CALL` (U-37).

D-13 A module exports as `<name>.algoflow-module.json` (the D-01 value);
a program export (L-53) embeds the modules it uses under `modules`; import
validates each by `version`, adds modules whose names are new, keeps
existing ones unchanged, and reports `Kept existing module <name>`.

D-18 `Open <name>` on a module function or class (U-41, U-65) opens its
Module page in the browser window named `algoflow-module`, so a second
open reuses that tab: the Module page, on finding `algoflow:handoff`,
saves its pending edits, discards any run (R-11 Stop), and shows the named
function. The function's arguments accompany it: from a run, the arguments
of that call as they stood at its `call` event (R-11 Seek); in build mode,
the arguments that are literals; otherwise none. They are transferred with
the module and function names under `localStorage` key `algoflow:handoff`,
which the Module page reads once and removes, and they become the Input
nodes' `Custom…` values (D-06).

## Cases

D-19 `Save as case`, in the `Result` tab after a run of a function, adds a
case holding that run's arguments, returned value, and arguments after
the run; a case can be deleted.

D-20 `Test` runs every case of the module, each on its own runner (R-18),
and the `Result` tab shows `k of n passed`, one chip per case grouped by
function (the first failing one selected), and for the selected case its
arguments and `Yours` beside `Expected` for the returned value and for the
arguments after the run, compared by C-10, with `▶ Watch this case`.

D-21 When `Move to module…` (D-09) places a function into a learner module
whose name is a built-in module's, and the built-in module holds cases for
a function of that name while the learner module holds none, those cases
are copied into the learner module (`Clone` copies all of them, D-11).

## Storage

D-14 `src/store/modules.ts` is the only reader and writer of learner
modules; it persists them under `localStorage` key `algoflow:modules` as
`Record<Id, Module>` 500 ms after the last edit and exposes `list()`,
`get(name)`, `put(module)`, and `remove(name)`; nothing else accesses the
key.

D-22 The store re-reads `algoflow:modules` on the window's `storage`
event, so an edit in one browser tab propagates to the others: open
programs are validated again. A run in progress retains the modules it
began with (R-01); the next Run uses the modified ones.

## Built-in modules

D-15 `modules/<name>.json` files are bundled like challenges (C-14) and
checked by `scripts/check.ts`: D-01, then L-46 within the module, then
emitted and compiled per R-20, then every case run in the interpreter and
in CPython and compared under C-10. A challenge `solution` may use
built-in modules (S-06) and no learner module.

D-16 The built-in module `heap` (title `Heap`) defines
`heap_push(heap, x)`, which appends `x` and sifts it up with `swap`, and
`heap_pop(heap)`, which removes the root, moves the last item to the root,
sifts it down, and returns the root; items are compared with `<`, and a
list item by its item 0; `heap_pop` on an empty list raises `E_POP_EMPTY`
from the list method it calls.

D-17 The built-in module `micrograd` (title `Tiny Neural Network`) defines
`Value`, `add`, `mul`, `tanh_v`, `backward_step` (with its `"tanh"` case),
`build_topo`, `backward`, `Neuron`, `make_neuron`, `forward_neuron`,
`Layer`, `MLP`, `make_mlp`, `forward_mlp`, `parameters`, and `zero_grad`,
as the micrograd rows of `06-challenges.md` define them.
