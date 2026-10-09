# Pages

U-01 The application has six pages, addressed by hash routes: Problems
(`#/`), Problem (`#/p/<id>`), Playground (`#/play`, U-15), Playground
program (`#/play/<id>`), Modules (`#/modules`, D-07), and Module
(`#/m/<name>`, D-08). A Playground program is the Problem page without the
`Problem` tab, the Input nodes, and Submit (S-07); its top bar has
`← Playground` in place of `← Problems`, an editable title in place of the
problem title, `Export` (L-53) before undo, and a `⋯` of `Help` alone
(U-05).

U-02 Problems page: a 52 px header with the app name, the tabs `Problems`,
`Playground`, and `Modules`, Help, and the JA/EN switch; below it one
section per study plan and `More problems` (U-12). The Playground and
Modules pages share the header.

U-03 Problem page: a 52 px top bar with `← Problems`, the title, undo,
redo, and `⋯` (U-05), and no action on the program's run; below it two
regions: the panel (U-20) on the left, 320 px by default, resizable from
280 px to 50 % of the viewport width, collapsible (U-24), its width
persisted under `algoflow:layout`; and the canvas, which holds from top to
bottom the path bar (U-30), the chart, while running the narration line
(U-63), and the run bar (U-60). There is no third region.

U-04 Help, opened from `⋯` (U-05) or the header's `?` (U-02), is a dialog
with the keyboard table below and three lines describing the loop (build
the chart, run it on one input, submit); texts under `app.help.*`, no
external links.

U-05 `⋯` opens a menu: `Open in Playground`, which creates a Playground
program from the current program, titled with the problem's title, each
input becoming an assignment at the top of `main` (the E-03 form), and
opens it; and `Help` (U-04).

U-06 Every page sets the browser tab title to `<title> — AlgoFlow`, where
`<title>` is the problem's or Playground program's title, the module's
title or name (D-01), or the page name.

U-07 A hash that names no page of U-01, a Problem route whose id names
no challenge, or a Playground program route whose id `algoflow:playground`
does not list (L-57), shows the Problems page.

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Problems  FizzBuzz                                         ↶ ↷  ⋯ │
├─────────────────────┬────────────────────────────────────────────────┤
│ Problem Result Py…  │ ▾ main                                         │
│                     │                 ● Start                        │
│ Case n=15 ▾ ✓ Submit│                 Input n = 15 ▾                 │
│ Variables           │                 Set i to 1                     │
│  n 15   i 3         │            ◇ i < n + 1? ──No──▶ ● End          │
│ Output   Expected   │              Yes                               │
│  1        1         │  ◇ (remainder of i divided by 15) = 0? ✗       │
│  2        2         │              No …                              │
│           Fizz      ├────────────────────────────────────────────────┤
│                     │ (remainder of 3 divided by 15) = 0? No         │
│                     │ ❚❚ |◀ ▶| ⤼ ▶▶ ━●━ 23 of 124  Slow Normal Fast ■│
└─────────────────────┴────────────────────────────────────────────────┘
```

## Problems page

U-10 A problem row shows a status mark (`✓` solved, `•` attempted, blank),
the title, the difficulty (`Easy`, `Medium`, `Hard`), and the topic tags; a
row opens the Problem page.

U-12 The page shows one section per plan in C-16 order: the title, the
one-line description, `n of m solved`, `Start` (the plan's first problem)
while no problem of the plan has a progress entry (C-17), else
`Continue: <title>` (the first unsolved problem, named) while one is
unsolved, and no button once
every problem is solved; then the plan's rows in plan order. A last section
`More problems` holds the problems in no plan, ordered by title, and is
absent while there are none. There are no filters and no overall progress
meter.

U-13 Per-problem progress (C-17) drives the status marks and the plan
counts.

U-14 Topics are fixed: `Output`, `Variables`, `Loops`, `Conditions`,
`Lists`, `Searching`, `Sorting`, `Recursion`, `Dictionaries`, `Classes`,
`Gradients` (`problems.topic.<key>`); they appear as tags on rows (U-10)
and in the `Problem` tab (U-21).

## Playground page

U-15 Under the header a card holds `Playground`, a one-line description
(`playground.description`), `Import…`, and `New`; below it one row per
Playground program (its title, the time of its last edit, and `Delete`),
ordered by last edit with the latest first, or `playground.empty` while
there is none; a row opens its program. `New` opens an empty program titled
`playground.untitled`; `Import…` (L-53) adds one from a file, and a file
that `migrate()` rejects adds nothing and shows `playground.importFailed`;
`Delete` asks for confirmation in a dialog and then removes the program
from storage.

## Panel

U-20 The panel has the tabs `Problem`, `Result`, and `Python` on a Problem
page, and `Result` and `Python` on a Playground program and a Module page.
A page opens on its first tab; `Run`, `Submit`, and `Test` (D-20) select
`Result`; nothing selects `Python` or returns to `Problem` automatically.

U-21 Tab `Problem`: the title, the difficulty, and the topic tags; the
statement (markdown); `Example` (the first test's inputs and its expected
output, one line per value, an output of more than eight lines folding to
its first five and `… n more`); `Cases used by Submit` (the inputs of every
test); a `Hints` section revealing one hint per click on `Show next hint`
and showing `n of 3 shown`, the number being recorded (C-17); and a
`Solution` row with `Show solution` (U-22).

U-22 `Show solution` shows the solution in the canvas, read-only,
under a band `Solution` with `Load into my chart`, which replaces the
program with the solution as one undoable edit (L-52), and
`Back to my chart`; showing it is recorded (C-17).

U-27 `Run` and `Submit` act on the learner's program; while the solution
is shown (U-22), either first returns the canvas to the learner's
chart. While running, `Submit`, `Show solution`, and `Compare with the
solution` are disabled.

U-23 Tab `Result` shows, for one case: the case selector, which holds the
same choice as the Input nodes (U-32), with `✓ Submit` (U-80) beside it on
a Problem page; the variables of the shown frame
(U-68) with one view each (V-01..V-06); `Output`, the lines printed so far;
beside it `Expected`, when the case is one of the challenge's tests and
expects `stdout`, the two aligned line by line with a blank cell where one
side has no line; every expected variable as a row with its value, or a
blank when the program never created it, beside its expected value; and,
when the run ends on such a case, that case's verdict (C-15) with the first
output row that differs, or else the first variable row that differs,
marked. While a run is on the chart, an `Expected` line beyond the lines
printed so far is drawn muted. After a submission the tab adds what
U-81..U-85 state. A Playground program has no case selector and no
`Expected`. Before any run the tab shows the case selector with `Submit`,
the chosen case's `Expected`, and `result.empty` (`Run to see the values`).

U-24 The panel collapses to a 40 px rail from a toggle in its header; the
state persists under `algoflow:layout`.

U-25 Tab `Python` shows the emitted code with line numbers (E-01):
keywords, strings, numbers, and comments are coloured and nothing else;
hovering a line outlines its node, selecting a node highlights its lines,
clicking a line selects its node and, for a line inside a function, shows
that function's chart (U-30); while running, the line of the current
statement is highlighted. `Copy` and a `.py` download act on the shown
file. When the program uses modules a file row switches among `main.py`
and one `<name>.py` per module (E-09); in a program's tab a module's file
is read-only, has no node interaction, and carries `Open module <name>`
(D-18), while on a Module page the module's file is the shown file with
the full node interaction. Python text appears nowhere else.

U-26 A challenge's markdown texts (`description`, `hints`, `takeaway`,
C-01) render paragraphs separated by a blank line, `` `code` ``,
`**bold**`, and `*italic*`; any other markdown is shown as written.

## First launch

U-90 With no `localStorage` data, the first problem of the first study
plan opens. The check is made once, when the application loads at the
Problems route, and finds no data when neither `algoflow:progress` nor any
`algoflow:program:*` key exists; the layout key (U-03) records no work and
does not count.

## Keyboard

| Keys                         | Action                              |
| ---------------------------- | ----------------------------------- |
| Delete, Backspace            | remove selected node, unless typing in the editor |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | undo, redo                          |
| Ctrl/Cmd+D                   | duplicate                           |
| Ctrl/Cmd+Enter               | Run / Pause                         |
| →, ←                         | Step, Back (run mode)               |
| Shift+→                      | Step over (run mode)                |
| Ctrl/Cmd+→                   | Skip (run mode)                     |
| Esc                          | close menu or editor, clear selection; while running, clear the breakpoint, else Stop |
| Tab, Shift+Tab               | next, previous field of a value line, then slot (U-53) |
| ↑, ↓                         | move the highlight in the editor's list (U-50, U-94) |
| ←, →                         | previous, next value or input of a value line (U-53) |
| Enter                        | choose the highlighted entry; in a name field not typed in, the next slot (U-94); else close the editor |

## Messages and i18n

U-70 Every diagnostic and runtime code has `error.<CODE>` in `en.json`:

| Code               | en                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `E_UNDEFINED`      | Variable {name} has not been created yet                                                                                |
| `E_DECLARE_FIRST`  | Create {name} before the if or loop                                                                                     |
| `E_BAD_NAME`       | Names start with a lowercase letter or _ and use only lowercase letters, digits, and _; Python keywords are not allowed |
| `E_DUPLICATE_NAME` | {name} is already in use                                                                                                |
| `E_BREAK_OUTSIDE`  | This block only works inside a loop                                                                                     |
| `E_RETURN_OUTSIDE` | Return only works inside a function                                                                                     |
| `E_ARITY`          | {name} needs {expected} values (got {got})                                                                              |
| `E_UNKNOWN_CALL`   | {name} was not found                                                                                                    |
| `E_EMPTY_SLOT`     | {slot} is empty                                                                                                         |
| `E_DEFAULT`        | The default of {field} must be a number, text, true/false, an empty list, or an empty dict                              |
| `E_DUPLICATE_ID`   | Two blocks share the same id                                                                                            |
| `E_PARSE_SYNTAX`   | Syntax error at character {position}                                                                                    |
| `E_PARSE_CHAIN`    | Write a < b < c as a < b and b < c                                                                                      |
| `E_INDEX`          | Item {index} does not exist (length {length})                                                                           |
| `E_KEY`            | Key {key} does not exist                                                                                                |
| `E_FIELD`          | {cls} has no field {field}                                                                                              |
| `E_TYPE`           | {left} and {right} cannot be used in this operation                                                                     |
| `E_DIV_ZERO`       | Cannot divide by zero                                                                                                   |
| `E_POP_EMPTY`      | The list is empty, nothing to pop                                                                                       |
| `E_RECURSION`      | Function calls are nested too deeply; check the stopping condition                                                      |
| `E_STEP_LIMIT`     | The loop does not seem to end; check its condition                                                                      |

U-71 All strings reside in `src/i18n/en.json` and `src/i18n/ja.json`
under `app.*`, `problems.*`, `problem.*`, `playground.*`, `modules.*`,
`chart.*`, `menu.*`, `editor.*`, `run.*`, `result.*`, `python.*`, `node.*`,
`error.*`; `scripts/i18n.ts` fails on a `t()` call with an unknown literal
key and on a key missing in either locale; test files and `*.d.ts` are
not scanned.

U-72 The Japanese locale uses polite form and everyday vocabulary for
block sentences, and gives the technical term in parentheses in `help`
texts (e.g. the loanword for "loop" beside the everyday word).

U-73 `t(key, params?)` in `src/i18n/t.ts` accepts only keys of `en.json`
(type `MessageKey`, derived from the file), replaces `{name}` placeholders
from `params`, falls back from the current locale to `en`, and returns the
key itself when no text exists.

## Verification

U-91 The end-to-end suite saves one screenshot per screen state under
`e2e/screenshots/`: Problems, Build, Run, Wrong Answer, Accepted,
Solution, the Python tab, Run inside a function, Playground, Modules, and
Module, and one per view (V-01, V-02, V-06), in each locale; CI compares
each screenshot with its baseline.
