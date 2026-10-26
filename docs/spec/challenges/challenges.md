# Challenges

A challenge is a JSON file in `challenges/`, shown to learners as a
problem: a description, inputs, tests that judge a submission, hints,
and a solution. The study plans order the challenges. This file states
the challenge schema, the checks that `scripts/check.ts` makes, the module
fields, the hints, the study plans, how a submission is judged, how
progress is recorded, how a problem opens and how the files are
bundled, the problems of each plan, and the verification.

Code: `challenges/*.json`, `challenges/plans.json`, `src/challenges/`
with the `Challenge` and `Plan` types in `types.ts`, and
`scripts/check.ts` with `scripts/lib/challenge.ts`, `plans.ts`,
`interp.ts`, and `agreement.ts`. Tests: beside each file.

## Schema

Each challenge is one file `challenges/<id>.json` of this shape:

```ts
export type Challenge = {
  id: string; // file name without .json
  title: Localized;
  difficulty: "easy" | "medium" | "hard";
  topics: Topic[]; // ≥ 1, from the topic list (`pages.md`, Problems page)
  description: Localized; // markdown
  inputs: InputDecl[]; // language.md
  tests: Test[]; // ≥ 3
  hints: Localized[]; // exactly 3 (Hints)
  takeaway?: Localized; // one sentence shown as `What you used` (`run.md`, Submission)
  module?: Name; // Modules and definitions
  defines?: Name[]; // Modules and definitions
  solution: Program; // inputs identical to `inputs`
};
export type Test = {
  inputs: Record<Name, Data>; // every input, a value of its kind (`language.md`, Kinds); shown by these values
  edge?: boolean; // Checks
  seed?: number; // default 1
  expect: { variables?: Record<Name, Data>; stdout?: string[] }; // ≥ 1
};
export type Localized = { en: string; ja?: string }; // ja: Checks
export type Topic = "output" | "variables" | "loops" | "conditions" | "lists" | "searching"
  | "sorting" | "recursion" | "dictionaries" | "classes";
```

## Checks

`scripts/check.ts` checks every challenge for:

- the schema (Schema)
- the `version`, `edge`, `ja`, and input-value rules of this section,
  the input names, and `defines` (Modules and definitions)
- `solution`, validated as `language.md` states, with the built-in
  modules (`modules.md`, Built-in modules)
- `solution`, run on every test in the interpreter against `expect`
  (Judging)
- `solution`'s emitted Python, run in CPython against the interpreter's
  result (`interpreter.md`, CPython check)

What the hints name, in their order (Hints), is for review, not for
`scripts/check.ts`.

`scripts/check.ts`, not `validate()`, checks input names, because an
input has no `NodeId` to attach a diagnostic to, and no edit changes an
input's name.

A `solution` has the `version` that `migrate()` returns (`language.md`,
Storage), because the build bundles a challenge file as it is, with no
`migrate()`, so a file of another version would reach the page unchecked.

Every challenge has at least one test with `edge: true`, a boundary
case. For example: an empty list, zero, or a single item. A test is
marked as an edge test by a flag, not by a name that begins with
`edge:`, because a test is shown by its inputs and has no name, and a
name would need a Japanese text.

Every value of a test's `inputs` is one that the blocks write: its
Python text (`emitter.md`) parses (`parser.md`), so that
`Open in Playground` makes it an assignment (`pages.md`, Help and `⋯`).

Every `Localized` text of a challenge, a plan, and a built-in module
has its `ja` text (`scope.md`, Product).

`scripts/check.ts` fails on a `ja` text of a challenge, a plan, or a
built-in module that holds a word the glossary avoids, compared as
`pages.md`, Catalogs, states. The failure names the file, the field,
and the word.

`scripts/check.ts` fails on:

- a plan member with no challenge file
- a member listed twice
- a challenge in two plans
- a challenge in no plan

`scripts/check.ts` fails on a plan with no members, because such a plan
would draw a card that reads `0 of 0 solved` and has a `Start` with no
destination.

## Modules and definitions

This section states the two fields that tie a challenge to a module.

`module` names the learner module that the challenge's functions and
classes belong to. An accepted submission then offers
`Move to module <name>` (`run.md`, Submission).

`defines` lists the names that the submission must define in the
program or in a learner module. Submit refuses a listed name that
resolves to a built-in module (`run.md`, Submission), because in a
problem that asks for the definition, the built-in module would pass
without the learner building anything.

The built-in module still lets a learner who skipped a problem start
anywhere, with blocks that stay inspectable.

`scripts/check.ts` requires `solution` to define every listed name
itself.

## Hints

The three hints name, in this order:

1. the block definition or module function to use
2. the shape of the loop or condition
3. the remaining step

The hints follow this order so that a learner without an instructor
can complete the problem after the third hint.

## Study plans

`challenges/plans.json` lists the study plans in display order:

```ts
export type Plan = {
  id: string; // unique among the plans
  title: Localized;
  description: Localized; // one line
  problems: string[]; // challenge ids, in order
};
```

The plans and their members are those of the curriculum (`scope.md`,
Curriculum, Study plans). Once the file of a plan's first member in the
curriculum exists, `plans.json` lists the plan with the members whose
files exist, in the curriculum's order.

Every challenge is in exactly one plan, once. A challenge that no plan
takes yet waits as a `challenge` issue, because a challenge in no plan
would need a section, an order, and a `Next problem` rule of its own.

No code checks membership and order against the curriculum, because
the curriculum's table copied into `scripts/` would be a second copy,
and making `plans.json` the authority would take the curriculum out of
the spec.

## Judging

A test passes when both hold:

- every `expect.variables` entry equals the final value of the
  main-level variable it names
- `expect.stdout` equals `stdout()` line by line

Equality compares:

- ints exactly
- floats within an absolute 1e-6
- strings, booleans, and none exactly
- lists element by element
- dicts by key set and values
- objects by class, field set, and field values

No list, dict, or object compares by identity.

A runtime error fails the test.

The test's row shows the runtime error (`run.md`, Submission).

An accepted submission requires every test to pass.

Run (`run.md`, Run bar) drives one runner with the inputs of the chosen
case (`chart.md`, Input chart nodes), and judges that case at the end
of the run (`pages.md`, Panel, Result tab).

Submit (`run.md`, Submission) judges every test on its own runner in
batches (`interpreter.md`, Driver), without affecting the driver, and
records the attempt (Progress). Submit has runners of its own because
judging through the driver would discard the learner's position.

Run and Submit use the modules the program uses (`modules.md`,
Resolution).

Run, Submit, and `scripts/check.ts` take every test's verdict against
`expect` from `src/challenges/judge.ts`.

## Progress

Progress persists under the `localStorage` key `algoflow:progress`,
keyed by challenge id, as
`Record<string, { status: "attempted" | "solved"; hints: number; solution: boolean }>`.

A browser tab adds a problem's entry on the problem's first submission,
first revealed hint, or shown solution. The entry's fields:

- `status`: `attempted` until a submission is accepted, then `solved`,
  which nothing clears
- `hints`: the number of hints revealed (`pages.md`, Panel, Problem
  tab)
- `solution`: whether the solution was shown (`pages.md`, Panel,
  Problem tab)

A shown solution makes the problem `attempted`, as a hint does, because
in both cases the learner used help.

Progress stores no event counts for comparing problems, because that
would infer a relation between problems and store one more field.

A browser tab that records progress writes the stored record joined
with its own, entry by entry:

- every entry of either
- `solved` over `attempted`
- the larger `hints`
- `solution` once either holds it

The tab joins when it writes, because writing back the record it read
at load would erase what another tab recorded after the load, even a
solved problem. The `storage` event alone would still lose an entry
written before the event arrives. Every field only grows, so a join
loses nothing and needs no timestamp.

When the window's `storage` event fires for `algoflow:progress`, a
browser tab reads the key again and joins it with its own record.

## Opening and bundling

This section states what opening a problem does and how the build
bundles the challenge files.

Opening a problem:

- restores its program from `localStorage` (`language.md`, Storage),
  or, when none is stored, creates a program whose `main` is empty and
  whose `challengeId` and `inputs` are the challenge's
- discards any runner (`interpreter.md`, Driver, Controls)
- selects the first test's inputs for the Input chart nodes (`chart.md`,
  Input chart nodes)

The build bundles `challenges/*.json` and `plans.json`.
`src/challenges/index.ts` imports the challenge files with
`import.meta.glob`. `scripts/check.ts` reads the files from disk.

## Course plan (`course`)

This section lists the problems of the `course` plan. The tables of
the three plans read as follows:

- An input is written `name: default`.
- An expectation is `expect.variables` unless `stdout` is stated.
- In the `edge tests` columns, an entry written `edge: …` is a test with
  `edge: true`, and the text after it only describes the test.

| id             | difficulty, topics          | inputs                                 | expectation                                  | edge tests                                            |
| -------------- | --------------------------- | -------------------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| tutorial       | easy, output                | `name: "Claude"`                       | stdout `Hello, Claude`                       | `edge: empty` `""` → `Hello, `                        |
| sum-to-n       | easy, loops variables       | `n: 10`                                | `total = 55`                                 | `edge: 0` → `0`; `1` → `1`                            |
| fizzbuzz       | easy, loops conditions      | `n: 15`                                | stdout 1..n with `Fizz`, `Buzz`, `FizzBuzz`  | `edge: 1`; `3`                                        |
| max-of-three   | easy, conditions            | `a: 3, b: 9, c: 5`                     | `biggest = 9`                                | `edge: equal` `3,3,3`; negatives                      |
| countdown      | easy, loops                 | `n: 5`                                 | stdout `5` … `0`, one per line, with `while` | `edge: 0` → `0`                                       |
| list-max       | easy, lists                 | `nums: [4, 9, 2, 7]`                   | `biggest = 9`                                | `edge: one` `[7]`; `[-3, -1, -2]` → `-1`              |
| count-evens    | easy, lists conditions      | `nums: [1, 2, 3, 4, 6]`                | `count = 3`                                  | `edge: empty` → `0`; no evens                         |
| linear-search  | easy, lists searching       | `nums: [4, 9, 2, 7], target: 2`        | `found = 2`                                  | `edge: missing` → `-1`; first of duplicates           |
| binary-search  | medium, lists searching     | `nums: [1, 3, 5, 7, 9, 11], target: 7` | `found = 3`, `nums` unchanged                | `edge: missing` → `-1`; `edge: empty`; first and last |
| bubble-sort    | medium, lists sorting       | `nums: [5, 3, 1, 4, 2]`                | `nums = [1, 2, 3, 4, 5]`                     | `edge: empty`; `edge: one`; `[2, 2, 1]`; sorted       |
| selection-sort | medium, lists sorting       | same                                   | same                                         | same                                                  |
| insertion-sort | medium, lists sorting       | same                                   | same                                         | same                                                  |
| reverse-list   | easy, lists                 | `nums: [1, 2, 3, 4]`                   | `nums = [4, 3, 2, 1]` in place with `swap`   | `edge: empty`; `edge: one`; odd length                |

The tutorial prints two values, `print("Hello,", name)`, not
`"Hello, " + name`, because the concatenation would make the learner's
first action combine a text, an operator, and a variable before any
problem introduces operators.

## Data-structure plan (`structures`)

This section lists the problems of the `structures` plan.

`heap_push` and `heap_pop` compare heap items with `<`, and compare an
item that is a list by its item 0 (`modules.md`, Built-in modules).

`heap-push` and `heap-pop` carry `module: heap`. The later problems use
`heap_push` and `heap_pop` from the learner's `heap` module or the
built-in one (`language.md`, Scope).

| id             | difficulty, topics      | inputs                                            | expectation                                                                                                              | edge tests                                              |
| -------------- | ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| stack-balance  | medium, lists           | `text: "([]{})"`                                  | `ok = True` with a list as stack                                                                                         | `edge: empty` → `True`; `"(]"`; `"(("`                  |
| bfs-grid       | hard, lists searching   | `grid: 5×5 of 0/1, start: [0, 0], goal: [4, 4]`   | `dist = 8`, table `seen`; frontier list used as a queue; `deltas = [[0,1],[1,0],[0,-1],[-1,0]]`                          | `edge: unreachable` → `-1`; start = goal → `0`          |
| heap-push      | medium, lists           | `heap: [], items: [5, 3, 8, 1]`                   | `heap = [1, 3, 8, 5]` after `heap_push(heap, x)` for each item: append, then sift up with `swap`; `defines: [heap_push]` | `edge: empty` items → `[]`; one item                    |
| heap-pop       | medium, lists           | `heap: [1, 3, 8, 5]`                              | `out = 1`, `heap = [3, 5, 8]` via `heap_pop(heap)`: root out, last item to the root, sift down; `defines: [heap_pop]`    | `edge: one` → `heap = []`; `edge: two` `[2, 9]`; `[1, 1, 2]` |
| dijkstra-grid  | hard, lists searching   | `cost: 5×5 ints, start, goal`                     | `total`; frontier list, minimum removed by a program function `pop_min(frontier)`                                        | `edge: 1×1`; uniform costs                              |
| dijkstra-heap  | hard, lists searching   | as dijkstra-grid                                  | same `total`; the frontier is a heap of `[d, r, c]` kept with `heap_push` and `heap_pop`                                 | as dijkstra-grid                                        |
| astar-grid     | hard, lists searching   | as bfs                                            | `dist = 8`, `expanded` ≤ bfs; the frontier is a heap of `[f, r, c]` with `abs(r - gr) + abs(c - gc)` inline               | as bfs                                                  |

## Dynamic-programming plan (`dp`)

This section lists the problems of the `dp` plan.

| id          | difficulty, topics | inputs                                             | expectation                                | edge tests                                    |
| ----------- | ------------------ | -------------------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| coin-change | hard, lists loops  | `coins: [1, 2, 5], amount: 11`                     | `best = 3`, list `dp` of length 12         | `edge: 0` → `0`; `coins [2], amount 3` → `-1` |
| knapsack    | hard, lists loops  | `weights: [1, 3, 4], values: [15, 20, 30], cap: 4` | `best = 35`, table `dp`                    | `edge: cap 0` → `0`                           |
| lcs         | hard, lists loops  | `s: "ABCBDAB", t: "BDCABA"`                        | `length = 4`, table `dp` 8 × 7             | `edge: empty` → `0`                           |

## Verification

`pnpm check` passes for every challenge, every test in the interpreter
and in CPython, the plans, and the built-in modules (`modules.md`,
Built-in modules).
