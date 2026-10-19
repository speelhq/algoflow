# Modules

Code: types `src/modules/types.ts`, resolution `src/modules/resolve.ts`,
the store `src/store/modules.ts`, built-in modules `modules/<name>.json`.
Tests: beside each file.

## Schema

A module is one JSON value:

```ts
export type Module = {
  version: 1;
  name: Id; // a name as `language.md`, Identifiers allows; its Python file is <name>.py (`emitter.md`)
  title?: Localized; // built-in modules only; a learner module shows `name`
  classes: ClassDef[];
  functions: FunctionDef[];
  cases: Case[]; // Cases
};
export type Case = {
  fn: Id; // a function of this module
  args: Data[]; // one per parameter
  expect: { returns: Data; args: Data[] }; // the value returned, and the arguments after the run
};
```

`validate()` (`language.md`) applies to a module as it does to a program
with no `main`. Node ids and names are unique within the module, as they
are within a program. A module sits outside `Program` because it belongs to
the learner, not to one program: it is defined once, edited in one place,
and used by many programs. The name `Module` was chosen because it is the
Python word that the learner meets again in `import`. `Functions` was
rejected, because it collides with the block menu's `Function` category,
leaves out classes, and can't group a `heap`. `Library` was rejected,
because it names a single flat collection.

Module names are unique among learner modules, and unique among built-in
modules. A learner module with a built-in module's name shadows it
(`language.md`, Scope), so a block the learner rebuilt is used under its
name, and no problem has to say which one to use. Built-in modules are
read-only.

## Resolution

Every module is visible to every program. A program uses a module by
calling one of its functions or constructing one of its classes
(`language.md`, Scope). Nothing in `Program` names a module.

`usedModules(program, modules): Module[]` is the set of modules that the
program's calls and `new` expressions resolve to, in name order. `run`
(`interpreter.md`, Runner), `emit` (`emitter.md`), and `judge`
(`challenges.md`, Judging) receive it.

A module function sees its parameters and the functions and classes of its
own module (`language.md`, Scope). Inside a module, a name of a program or
of another module gives `E_UNKNOWN_CALL`. A module uses no other module,
because imports between modules would need dependency order, cycle
detection, and a second `from … import` layer in the emitted files, which
no problem of the curriculum needs. The rule is lifted when a challenge's
`module` has to call another learner module.

A module has no `main`. Its page runs one function at a time
(`interpreter.md`, Modules). The shown function's parameters are Input
nodes in the form of `chart.md`, Input nodes. Their menu lists that
function's cases (Cases), and they hold the arguments that `Open <name>`
brought (Operations) when the page was opened with them. After a run,
`End` shows the returned value.

## Pages

The Modules page (`#/modules`) has one row per module: learner modules first,
then built-in modules, each in name order. The page orders built-in modules by
name, not by title, because a title differs by locale, so the rows would move
when the language changes. A row shows the name or title, the number of
functions and classes, and `Built-in` on a built-in module. The page has
`New module…`, which prompts for the name, and `Import…` (Operations). Each
learner module's row has `Export` and `Delete` (Operations). The rows have the
form of `pages.md`, Playground page.

The Module page (`#/m/<name>`, and `#/m/<name>/<fn>` to show that
function) has three parts. The top bar holds `← Modules`, the name, undo,
redo, and `⋯` with Help. The panel holds the tabs `Result`, which has
`Test` (Cases) beside its case selector, and `Python` (`pages.md`, Tabs).
The canvas holds the path bar (`chart.md`, Charts and the path bar), whose
`▾` lists the module's functions and classes, `Add function`, and
`Add class`, and the run bar with `▶ Run` (`run.md`, Run bar). A learner
module's canvas carries the band
`Your module. Changes reach every program that uses it.` A built-in
module's charts are read-only. Its editors offer no editing, `Duplicate`,
or `Delete`, and `▾` offers no `Add`. Its top bar has `Clone`
(Operations). Edits persist under Storage, with the timing of
`language.md`, Storage.

## Operations

`Move to module…` (`chart.md`, Charts and the path bar; `run.md`,
Submission) moves a function or a class, with every program function and
class it references, into an existing or a new learner module. The
program's calls then resolve to the module. The move is one undoable edit
of the program, but undoing it doesn't undo the change to the module.

`Clone`, on a built-in module's page, creates a learner module with the
same name, content, and cases. The new module shadows the built-in one
(Schema) and opens for editing. The word `Clone` was chosen over
`Copy to my modules`, because the learner meets "clone" again in
programming.
`Copy into this program`, which would copy one module function into a
program where it shadows the module, was rejected, because it would be a
second way to own module code, and it would leave a call that looks the
same but resolves to something else.

`Delete` lists the programs whose calls resolve to the module and asks for
confirmation. Afterward, those calls give `E_UNKNOWN_CALL` (`chart.md`,
Editing on the chart).

A module exports as `<name>.algoflow-module.json` (the Schema value). A
program export (`language.md`, Storage) embeds the modules it uses under
`modules`. Importing a module file or a program export validates each
module by `version`, adds the modules
whose names are new, keeps existing ones unchanged, and reports
`Kept existing module <name>`.

`Open <name>` on a module function or class (`editor.md`, Node editor;
`run.md`, Errors) opens its Module page in the browser window named
`algoflow-module`, so a second open reuses that tab. When the Module page
finds `algoflow:handoff`, it saves its pending edits, discards any run
(`interpreter.md`, Controls), and shows the named function. The function's
arguments come with it. From a run, they are the arguments of that call as
they stood at its `call` event (`interpreter.md`, Controls). In build mode,
they are the arguments that are literals. In any other case, no arguments come
with it. They are passed with the module and function names under the
`localStorage` key `algoflow:handoff`, which the Module page reads once and
removes, and they become the Input nodes' values (Resolution). Opening the
function in a second browser tab leaves the program as it was, a paused run
included, and runs the one function with that call's arguments, so a bug in
`heap_pop` shows up sooner than in hundreds of steps of `dijkstra`. Showing
the module's chart within the program page was rejected, because the program
page would then need a second mode, in which an edit changes a module that
every program using it shares. The second window is a tab, because two tiled
windows would each be narrower than 1280 px (`scope.md`, Product).

## Cases

`Save as case`, in the `Result` tab after a run of a function, adds a case
that holds that run's arguments, its returned value, and the arguments after
the run. The learner can delete a case. A module change reaches every program,
so a module needs tests of its own. A case is a saved run, so no case is
written from an empty start. Recording cases from an accepted submission was
rejected, because no rule selects suitable calls (the first `heap_push` of a
test pushes onto an empty heap, and a recursion makes thousands of calls), the
cases would fix the learner's own behavior as correct, and they would leave
out the act of judging a result.

`Test` runs every case of the module, each on its own runner
(`interpreter.md`, Modules). The `Result` tab then shows `k of n passed`
and one chip per case, grouped by function, with the first failing case
selected. For the selected case, it shows the arguments, and `Yours` beside
`Expected` for the returned value and for the arguments after the run,
compared by the judge's equality (`challenges.md`, Judging), with
`▶ Watch this case`.

When `Move to module…` places a function into a learner module that has a
built-in module's name, and the built-in module holds cases for a function
of that name while the learner module holds none, those cases are copied
into the learner module (`Clone` copies all of them), because the author's
cases, checked in both engines, find what the problem's tests don't.

## Storage

`src/store/modules.ts` is the only reader and writer of learner modules. It
persists them under the `localStorage` key `algoflow:modules`, as
`Record<Id, Module>`, 500 ms after the last edit. It exposes `list()`,
`get(name)`, `put(module)`, and `remove(name)`, and nothing else accesses the
key. `localStorage` and export files are enough for a course on one machine,
so a server, with its accounts, would be worth adding only for sharing between
learners or syncing across devices. One store keeps that option open without
changing its callers.

The store reads `algoflow:modules` again on the window's `storage` event,
so an edit in one browser tab reaches the others, and open programs are
validated again. A run in progress keeps the modules it began with
(`interpreter.md`, Runner), so its replays stay deterministic. The next Run
uses the changed modules, with no stop and no message.

## Built-in modules

`modules/<name>.json` files are bundled like challenges (`challenges.md`,
Opening and bundling), and `scripts/check.ts` checks them in this order: the
Schema, then name resolution within the module, then emitting and compiling as
the CPython check states (`interpreter.md`, CPython check), then running every
case in the interpreter and in CPython and comparing the results by the
judge's equality. A challenge `solution` may use built-in modules (`scope.md`,
Curriculum). It uses no learner module.

The built-in module `heap` (title `Heap`) defines two functions.
`heap_push(heap, x)` appends `x` and sifts it up with `swap`.
`heap_pop(heap)` removes the root, moves the last item to the root, sifts
it down, and returns the root. Items are compared with `<`, and a list item
is compared by its item 0. `heap_pop` on an empty list raises
`E_POP_EMPTY` from the list method it calls. The names carry the prefix, as
`heapq.heappush` does, because `pop` alone would sit beside the list method
`pop` in the block menu (`pop(h)` against `h.pop()`).

## Verification

Tests cover the resolution and shadowing of names (`language.md`, Scope),
the emitted files of a program that uses `heap` (`emitter.md`), the frames
and visible steps of a module call and of Step over (`interpreter.md`,
Modules; Controls), entry runs, the export and import round trip, `Test`
verdicts, and the copying of a built-in module's cases.
