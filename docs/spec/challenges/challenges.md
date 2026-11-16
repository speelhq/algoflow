# Challenges

A challenge is a JSON file in `challenges/`, shown to learners as a
problem: a description, inputs, tests that judge a submission, hints,
and a solution. The study plans order the challenges. This file states
the challenge schema, the checks that `scripts/check.ts` makes, the module
fields, the hints, the study plans, how a submission is judged, how
progress is recorded, how a problem opens and how the files are
bundled, how a challenge names its variables, how the plan tables
read, the problems of each plan, and the verification.

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

Every challenge has a challenge id, which is its `id`.

Each test is a case: one set of inputs with its expectation.

## Checks

`scripts/check.ts` checks every challenge for:

- the schema (Schema)
- the `version`, `edge`, `ja`, and input-value rules (Checks)
- the input names
- `defines` (Modules and definitions)
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
case. For example: an empty list, zero, or a single item.

A flag marks an edge test, not a name that begins with `edge:`, because a
test is shown by its inputs and has no name, and a name would need a
Japanese text.

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

## Names

This section states how a challenge names its variables.

A challenge names each input, each expected variable, and each variable
of its `solution` for what its value is, in whole English words joined
by `_`, such as `total_seconds`. Three kinds of variable have shorter
names:

- a number that mathematics names with a letter, such as a side of a
  triangle or the number that a problem takes apart: one letter, such
  as `n`, `a`, `b`, and `c`
- the variable of a `for` block: `i`, `j`, or `k`
- the table that a dynamic-programming problem fills: `dp`

`dp` keeps the name that books on dynamic programming give the table,
so a learner who reads one of them finds the same name.

These things have one name in every challenge:

- the list of numbers that a problem works on: `nums`
- the value that a search looks for: `target`
- a position in a list: `position`
- the largest value: `largest`
- a true or false result: a name that starts with `is_`, such as
  `is_prime`

A name chosen for each problem on its own was rejected, because a
learner who meets `found` for a position in one problem and `at` in
the next reads two ideas where there is one.

## Study plans

A study plan is a named, ordered list of challenges.

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
- objects by class, attribute set, and attribute values

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
`import.meta.glob`.

`scripts/check.ts` reads the files from disk.

## Plan tables

Each plan's section lists its problems in a table. The tables read as
follows:

- An input is written `name: default`.
- An expectation is `expect.variables` unless `stdout` is stated.
- In the `edge tests` columns, an entry written `edge: …` is a test with
  `edge: true`, and the text after it only describes the test.

## Values-and-decisions plan (`decisions`)

This section lists the problems of the `decisions` plan.

| challenge id    | difficulty, topics | inputs                | expectation                                                                                                                                                                       | edge tests                                                                        |
| --------------- | ------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| hello           | easy, output       | `name: "World"`       | stdout `Hello, World`                                                                                                                                                             | `edge: empty` `""` → `Hello, `; `"Ada"` → `Hello, Ada`                            |
| swap-values     | easy, variables    | `a: 3, b: 7`          | `a = 7`, `b = 3`, with a temporary variable                                                                                                                                       | `edge: equal` `5, 5`; negatives                                                   |
| rectangle       | easy, variables    | `width: 3, height: 4` | `area = 12`, `perimeter = 14`                                                                                                                                                     | `edge: 0` `width: 0, height: 5` → `0`, `10`; `1, 1` → `1`, `4`                    |
| minutes-seconds | easy, variables    | `total_seconds: 135`  | `minutes = 2`, `seconds = 15`                                                                                                                                                     | `edge: 0` → `0`, `0`; `60` → `1`, `0`                                             |
| even-or-odd     | easy, conditions   | `n: 7`                | stdout `odd`                                                                                                                                                                      | `edge: 0` → `even`; `-3` → `odd`                                                  |
| grade           | easy, conditions   | `score: 72`           | stdout `C`: `A` from 90, `B` from 80, `C` from 70, `D` from 60, else `F`                                                                                                          | `edge: 0` → `F`; `100` → `A`; each boundary                                       |
| max-of-three    | easy, conditions   | `a: 3, b: 9, c: 5`    | `largest = 9`                                                                                                                                                                     | `edge: equal` `3,3,3`; negatives                                                  |
| sort-three      | easy, conditions   | `a: 3, b: 1, c: 2`    | `a = 1`, `b = 2`, `c = 3`, by comparing two values and swapping them                                                                                                              | `edge: sorted` `1, 2, 3`; `3, 2, 1`; `2, 1, 2` → `1, 2, 2`                        |
| leap-year       | easy, conditions   | `year: 2024`          | `is_leap = True`                                                                                                                                                                  | `edge: 1900` → `False`; `2000` → `True`; `2023` → `False`                         |
| triangle-type   | medium, conditions | `a: 3, b: 4, c: 5`    | stdout `scalene`; checked in this order, `not a triangle` when a side is not less than the sum of the other two, `equilateral` when all three are equal, `isosceles` when two are | `edge: no triangle` `1, 2, 3`; `3, 1, 1` → `not a triangle`; `2, 2, 2`; `2, 2, 3` |

`hello` prints two values, `print("Hello,", name)`, not
`"Hello, " + name`, because the concatenation would make the learner's
first action combine a text, an operator, and a variable before any
problem introduces operators.

## Loops plan (`loops`)

This section lists the problems of the `loops` plan.

| challenge id        | difficulty, topics       | inputs         | expectation                                                                                   | edge tests                                          |
| ------------------- | ------------------------ | -------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| countdown           | easy, loops              | `n: 5`         | stdout `5` … `0`, one per line, with `while`                                                  | `edge: 0` → `0`; `2` → `2`, `1`, `0`                |
| sum-to-n            | easy, loops variables    | `n: 10`        | `total = 55`                                                                                  | `edge: 0` → `0`; `1` → `1`                          |
| fizzbuzz            | easy, loops conditions   | `n: 15`        | stdout 1..n with `Fizz`, `Buzz`, `FizzBuzz`                                                   | `edge: 1`; `3`                                      |
| fibonacci           | easy, loops variables    | `n: 10`        | `fibonacci = 55`, the `n`th Fibonacci number, counting 0 as the 0th and 1 as the 1st          | `edge: 0` → `0`; `1` → `1`; `2` → `1`               |
| isqrt               | easy, loops              | `n: 20`        | `root = 4`, the largest whole number whose square is at most `n`, found by counting up        | `edge: 0` → `0`; `1` → `1`; `16` → `4`              |
| times-table         | easy, loops output       | `n: 3`         | stdout `1 x 1 = 1`, `1 x 2 = 2` … `3 x 3 = 9`, nine lines, the second number changing fastest | `edge: 1` → one line; `2` → four lines              |
| number-triangle     | easy, loops output       | `n: 3`         | stdout `1`, `1 2`, `1 2 3`, each line a text of the numbers from 1 separated by one space     | `edge: 1` → `1`; `4` → four lines                   |
| collatz             | medium, loops            | `n: 6`         | `steps = 8`                                                                                   | `edge: 1` → `0`; `7` → `16`                         |
| russian-peasant     | medium, loops conditions | `a: 13, b: 12` | `product = 156`, by halving `a` and doubling `b`, adding `b` when `a` is odd                  | `edge: 0` `a: 0` → `0`; `1, 9` → `9`; `8, 5` → `40` |
| pythagorean-triples | medium, loops conditions | `n: 20`        | `count = 6`, the triples `a < b < c <= n` with `a * a + b * b == c * c`                       | `edge: 4` → `0`; `5` → `1`; `10` → `2`              |

## Lists plan (`lists`)

This section lists the problems of the `lists` plan.

| challenge id      | difficulty, topics     | inputs                             | expectation                                                                                     | edge tests                                                      |
| ----------------- | ---------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| count-occurrences | easy, lists conditions | `nums: [3, 1, 3, 2, 3], target: 3` | `count = 3`                                                                                     | `edge: empty` → `0`; `target` absent → `0`                      |
| average           | easy, lists            | `nums: [70, 85, 90]`               | `mean = 81.666…`, the sum divided by the number of items                                        | `edge: one` `[100]` → `100.0`; `[1, 2]` → `1.5`                 |
| list-max          | easy, lists            | `nums: [4, 9, 2, 7]`               | `largest = 9`                                                                                   | `edge: one` `[7]`; `[-3, -1, -2]` → `-1`                        |
| index-of-max      | easy, lists searching  | `nums: [3, 8, 5, 8]`               | `position = 1`, the position of the first largest                                               | `edge: one` `[4]` → `0`; `[1, 2, 9]` → `2`                      |
| linear-search     | easy, lists searching  | `nums: [4, 9, 2, 7], target: 2`    | `position = 2`                                                                                  | `edge: missing` → `-1`; first of duplicates                     |
| filter-evens      | easy, lists conditions | `nums: [1, 2, 3, 4, 6]`            | `evens = [2, 4, 6]`, with `append`                                                              | `edge: empty` → `[]`; no evens → `[]`                           |
| double-items      | easy, lists            | `nums: [1, 2, 3]`                  | `nums = [2, 4, 6]` in place                                                                     | `edge: empty` → `[]`; negatives                                 |
| running-total     | easy, lists            | `nums: [3, 1, 4, 1]`               | `totals = [3, 4, 8, 9]`, the prefix sums                                                        | `edge: empty` → `[]`; one item                                  |
| longest-streak    | medium, lists          | `nums: [1, 1, 2, 2, 2, 3]`         | `longest_streak = 3`, the most equal values in a row                                            | `edge: empty` → `0`; `edge: one` `[7]` → `1`; `[1, 2, 3]` → `1` |
| second-largest    | medium, lists          | `nums: [4, 9, 2, 7]`               | `second_largest = 7`, the largest value below the largest; each list holds two different values | `edge: repeated largest` `[5, 5, 3]` → `3`; `[1, 2]` → `1`      |

## Sorting plan (`sorting`)

This section lists the problems of the `sorting` plan.

| challenge id   | difficulty, topics      | inputs                                      | expectation                                                                                                               | edge tests                                            |
| -------------- | ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| reverse-list   | easy, lists             | `nums: [1, 2, 3, 4]`                        | `nums = [4, 3, 2, 1]` in place with `swap`                                                                                | `edge: empty`; `edge: one`; odd length                |
| rotate-left    | easy, lists             | `nums: [1, 2, 3, 4]`                        | `nums = [2, 3, 4, 1]`, by shifting each item left                                                                         | `edge: empty`; `edge: one`                            |
| move-zeros     | medium, lists           | `nums: [0, 1, 0, 3, 12]`                    | `nums = [1, 3, 12, 0, 0]` in place, the other items in their order                                                        | `edge: empty`; no zeros; all zeros                    |
| bubble-sort    | medium, lists sorting   | `nums: [5, 3, 1, 4, 2]`                     | `nums = [1, 2, 3, 4, 5]`                                                                                                  | `edge: empty`; `edge: one`; `[2, 2, 1]`; sorted       |
| selection-sort | medium, lists sorting   | as bubble-sort                              | as bubble-sort                                                                                                            | as bubble-sort                                        |
| insertion-sort | medium, lists sorting   | as bubble-sort                              | as bubble-sort                                                                                                            | as bubble-sort                                        |
| binary-search  | medium, lists searching | `nums: [1, 3, 5, 7, 9, 11], target: 7`      | `position = 3`, `nums` unchanged                                                                                          | `edge: missing` → `-1`; `edge: empty`; first and last |
| merge-sorted   | medium, lists sorting   | `left: [1, 4, 6], right: [2, 3, 7]`         | `merged = [1, 2, 3, 4, 6, 7]`                                                                                             | `edge: empty` `left: []` → `right`; equal items       |
| counting-sort  | medium, lists sorting   | `nums: [3, 1, 2, 3, 0]`, values from 0 to 9 | `nums = [0, 1, 2, 3, 3]`, from a list of counts                                                                           | `edge: empty`; one value repeated                     |
| median         | easy, lists sorting     | `nums: [70, 90, 80, 60]`                    | `median = 75.0`, the mean of the two middle items with `/`, or the middle item itself when the length is odd, with `sort` | `edge: one` `[50]` → `50`; `[3, 1, 2]` → `2`          |

## Number-algorithms plan (`numbers`)

This section lists the problems of the `numbers` plan.

| challenge id      | difficulty, topics       | inputs                                          | expectation                                                                                                                 | edge tests                                           |
| ----------------- | ------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| digit-sum         | easy, loops              | `n: 1234`                                       | `total = 10`                                                                                                                | `edge: 0` → `0`; `1000` → `1`                        |
| palindrome-number | easy, loops conditions   | `n: 12321`                                      | `is_palindrome = True`                                                                                                      | `edge: 0` → `True`; `123` → `False`; `120` → `False` |
| gcd               | easy, loops              | `a: 48, b: 18`                                  | `gcd = 6`, with `while b != 0`                                                                                              | `edge: zero` `48, 0` → `48`; `a < b`                 |
| is-prime          | easy, loops conditions   | `n: 29`                                         | `is_prime = True`                                                                                                           | `edge: 1` → `False`; `2` → `True`; `9` → `False`     |
| change-making     | easy, loops lists        | `amount: 1260, coins: [500, 100, 50, 10, 5, 1]` | `count = 6`, the fewest coins, taking the largest first                                                                     | `edge: 0` → `0`; `999` → `15`                        |
| to-binary         | medium, loops lists      | `n: 13`                                         | `bits = [1, 1, 0, 1]`, with `insert` at the front                                                                           | `edge: 0` → `[0]`; `1` → `[1]`; `8` → `[1, 0, 0, 0]` |
| prime-factors     | medium, loops lists      | `n: 60`                                         | `factors = [2, 2, 3, 5]`                                                                                                    | `edge: 1` → `[]`; `13` → `[13]`                      |
| sieve             | medium, lists loops      | `n: 30`                                         | `count = 10`, the primes up to `n`, with a list of flags                                                                    | `edge: 1` → `0`; `2` → `1`                           |
| luhn              | medium, loops conditions | `n: 79927398713`                                | `is_valid = True`, by the Luhn check digit                                                                                  | `edge: 0` → `True`; `79927398710` → `False`          |
| newton-sqrt       | medium, loops            | `n: 2.0`                                        | `root`, the square root, from `root ← (n + 1) / 2`, repeating `root ← (root + n / root) / 2` while `root * root - n > 1e-9` | `edge: 1.0` → `1.0`; `9.0` → `3.0`; `0.25` → `0.5`   |

## Data-structure plan (`structures`)

This section lists the problems of the `structures` plan.

`heap_push` and `heap_pop` compare heap items as the built-in `heap`
does (`modules.md`, Built-in modules, `heap`).

`heap-push` and `heap-pop` carry `module: heap`. `dijkstra-heap` and
`astar-grid` use
`heap_push` and `heap_pop` from the learner's `heap` module or the
built-in one (`language.md`, Scope).

| challenge id   | difficulty, topics      | inputs                                            | expectation                                                                                                                                                 | edge tests                                                   |
| -------------- | ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| stack-balance  | medium, lists           | `text: "([]{})"`                                  | `is_balanced = True` with a list as stack                                                                                                                   | `edge: empty` → `True`; `"(]"`; `"(("`                       |
| bfs-grid       | hard, lists searching   | `grid: 5×5 of 0/1, start: [0, 0], goal: [4, 4]`   | `distance = 8`, table `seen`; frontier list used as a queue; `deltas = [[0,1],[1,0],[0,-1],[-1,0]]`                                                         | `edge: unreachable` → `-1`; start equal to goal → `0`        |
| heap-push      | medium, lists           | `heap: [], items: [5, 3, 8, 1]`                   | `heap = [1, 3, 8, 5]` after `heap_push(heap, item)` for each item: append, then sift up with `swap`; `defines: [heap_push]`                                 | `edge: empty` items → `[]`; one item                         |
| heap-pop       | medium, lists           | `heap: [1, 3, 8, 5]`                              | `smallest = 1`, `heap = [3, 5, 8]` via `heap_pop(heap)`: root out, last item to the root, sift down; `defines: [heap_pop]`                                  | `edge: one` → `heap = []`; `edge: two` `[2, 9]`; `[1, 1, 2]` |
| dijkstra-grid  | hard, lists searching   | `cost: 5×5 ints, start, goal`                     | `total`; frontier list, minimum removed by a program function `pop_min(frontier)`                                                                           | `edge: 1×1`; uniform costs                                   |
| dijkstra-heap  | hard, lists searching   | as dijkstra-grid                                  | same `total`; the frontier is a heap of `[distance, row, column]` kept with `heap_push` and `heap_pop`                                                      | as dijkstra-grid                                             |
| astar-grid     | hard, lists searching   | as bfs                                            | `distance = 8`, `expanded` at most bfs's; the frontier is a heap of `[estimate, row, column]` with `abs(row - goal_row) + abs(column - goal_column)` inline | as bfs                                                       |

## Dynamic-programming plan (`dp`)

This section lists the problems of the `dp` plan.

| challenge id | difficulty, topics | inputs                                                  | expectation                                | edge tests                                    |
| ------------ | ------------------ | ------------------------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| coin-change  | hard, lists loops  | `coins: [1, 2, 5], amount: 11`                          | `fewest = 3`, list `dp` of length 12       | `edge: 0` → `0`; `coins [2], amount 3` → `-1` |
| knapsack     | hard, lists loops  | `weights: [1, 3, 4], values: [15, 20, 30], capacity: 4` | `largest = 35`, table `dp`                 | `edge: capacity 0` → `0`                      |
| lcs          | hard, lists loops  | `first: "ABCBDAB", second: "BDCABA"`                    | `length = 4`, table `dp` 8 × 7             | `edge: empty` → `0`                           |

## Verification

`pnpm check` passes for every challenge, every test in the interpreter
and in CPython, the plans, and the built-in modules (`modules.md`,
Built-in modules).
