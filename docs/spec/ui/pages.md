# Pages

Code: `src/ui/app`, `src/ui/problems`, `src/ui/playground`, the panel and
its tabs in `src/ui/problem`, `src/ui/python`, `src/ui/text`, `src/i18n`,
`src/store/layout.ts`. Tests: beside each file, and `e2e/`.

## Pages and routes

The application has six pages, addressed by hash routes: Problems (`#/`),
Problem (`#/p/<id>`), Playground (`#/play`, Playground page), Playground
program (`#/play/<id>`), Modules (`#/modules`, `modules.md`, Pages), and
Module (`#/m/<name>`, same). A Playground program is the Problem page
without the `Problem` tab, the Input nodes, and Submit (`scope.md`,
Curriculum); its top bar has `← Playground` in place of `← Problems`, an
editable title in place of the problem title, `Export` (`language.md`,
Storage) before undo, and a `⋯` of `Help` alone, as `Open in Playground`
would copy the program under its own title.

Problems page: a 52 px header with the app name, the tabs `Problems`,
`Playground`, and `Modules`, Help, and the JA/EN switch; below it one
section per study plan (Problems page).

The Playground and Modules pages share the header of the Problems page.

Every page sets the browser tab title to `<title> — AlgoFlow`, where
`<title>` is the problem's or Playground program's title, the module's
title or name (`modules.md`, Schema), or the page name.

A hash that names no page, a Problem route whose id names no challenge, or
a Playground program route whose id `algoflow:playground` does not list
(`language.md`, Storage), shows the Problems page.

## Page layout

Problem page: a 52 px top bar with `← Problems`, the title, undo, redo, and
`⋯` (Help and `⋯`), with no difficulty badge and no action on the
program's run; below it two
regions: the panel (Panel) on the left, 320 px by default, resizable from
280 px to 50 % of the viewport width, collapsible, its width persisted under
`algoflow:layout`; and the canvas, which holds from top to bottom the path
bar (`chart.md`, Charts and the path bar), the chart, while running the narration line (`run.md`,
Narration), and the run bar (`run.md`, Run bar). There is no third region:
the `Result` tab takes the place of a floating variables card and an output
strip, and the `Python` tab that of a right-hand pane, so the panel can
widen to half the viewport for a grid, an object graph, or code. `Run` and
`Submit` are not in the top bar: starting a run and pausing it would sit at
opposite edges of the page, and `Submit`, which judges every case and
records the attempt, would read as the same weight as `Run`, which tries
one.

The store keeps the requested panel width with its lower bound, and one
pure function applies the upper bound where the width is set and where it
is drawn: the bound follows the viewport, and a store reading
`window.innerWidth` would not run under the node tests and would keep a
stale bound after a resize.

The panel collapses to a 40 px rail from a toggle in its header; the state
persists under `algoflow:layout`.

`algoflow:layout` holds the record of `panel`, `collapsed`, and `speed`
itself, with no wrapper and no `version`, as `algoflow:progress` holds its
own (`challenges.md`, Progress). The store validates the record when it
sets a field and when it reads storage, a non-number or out-of-range size
falling back to the default or the lower limit, so a hand-edited or stale
record never draws an unusable panel and a record of an older shape needs
no `version` or migration.

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Problems  FizzBuzz                                         ↶ ↷  ⋯ │
├─────────────────────┬────────────────────────────────────────────────┤
│ Problem Result Py…  │ ▾ main                                         │
│                     │                 ● Start                        │
│ Case n ← 15 ▾ Submit│                 Input n ← 15 ▾                 │
│ Variables           │                 i ← 1                          │
│  n ← 15   i ← 3     │            ◇ i < n + 1? ──No──▶ ● End          │
│ Output   Expected   │              Yes                               │
│  1        1         │            ◇ i % 15 = 0? ✗                     │
│  2        2         │              No …                              │
│           Fizz      ├────────────────────────────────────────────────┤
│                     │ 3 % 15 = 0? No                                 │
│                     │ ❚❚ |◀ ▶| ⤼ ▶▶ ━●━ 23 of 124  Slow Normal Fast ■│
└─────────────────────┴────────────────────────────────────────────────┘
```

## Help and `⋯`

Help, opened from `⋯` or the header's `?`, is a dialog with the keyboard
table below and three lines describing the loop (build the chart, run it on
one input, submit); texts under `app.help.*`, no external links. The
keyboard table has no other place, and the problem's description would mean
nothing on the Problems page, which has no problem open.

`⋯` opens a menu of `Open in Playground` and `Help`.

`Open in Playground` creates a Playground program from the current program,
titled with the problem's title (the program's own title is never shown),
each input becoming an assignment of the chosen case's value (`chart.md`,
Input nodes) at the top of `main` (the form `emitter.md` writes inputs in),
and opens it.

## Problems page

A problem row shows a status mark (`✓` solved, `•` attempted, blank), the
title, the difficulty (`Easy`, `Medium`, `Hard`), and the topic tags; a row
opens the Problem page.

The page shows one section per plan in the order of `challenges.md`, Study
plans: the title, the one-line description, `n of m solved`, the plan's
button, then the plan's rows in plan order. There are no filters and no
overall progress meter: the plans' order says which problem to attempt
next, a filter row suits thousands of problems, and a meter or a
`blocks used` column helps no beginner choose; topics stay as tags so that
a row says what it practises.

A plan's button is `Start` (the plan's first problem) while no problem of
the plan has a progress entry (`challenges.md`, Progress), else
`Continue: <title>` (the first unsolved problem, named) while one is
unsolved, and absent once every problem is solved.

Per-problem progress drives the status marks and the plan counts.

Topics are fixed: `Output`, `Variables`, `Loops`, `Conditions`, `Lists`,
`Searching`, `Sorting`, `Recursion`, `Dictionaries`, and `Classes`
(`problems.topic.<key>`).

## Playground page

Under the header a card holds `Playground`, a one-line description
(`playground.description`), `Import…`, and `New`; below it one row per
Playground program (its title, the time of its last edit, and `Delete`),
ordered by last edit with the latest first, or `playground.empty` while
there is none; a row opens its program. `New` opens an empty program titled
`playground.untitled`; `Import…` (`language.md`, Storage) adds one from a
file, and a file that `migrate()` rejects adds nothing and shows
`playground.importFailed`; `Delete` asks for confirmation in a dialog and
then removes the program from storage.

## Panel

### Tabs

The panel has the tabs `Problem`, `Result`, and `Python` on a Problem page,
and `Result` and `Python` on a Playground program and a Module page. A page
opens on its first tab; `Run`, `Submit`, and `Test` (`modules.md`, Cases)
select `Result`; nothing selects `Python` or returns to `Problem`
automatically. Python shown by default, or as a fragment per block, would
teach syntax before the flow is understood; the Accepted view offers it,
the moment after solving.

### Problem tab

Tab `Problem`: the title, the difficulty, and the topic tags; the
statement (markdown); `Example` (the first test's inputs and its expected
output, one line per value, an output of more than eight lines folding to
its first five and `… n more`); `Cases used by Submit` (the inputs of every
test); a `Hints` section revealing one hint per click on `Show next hint`
and showing `n of 3 shown`, the number being recorded (`challenges.md`,
Progress); and a `Solution` row with `Show solution`. The solution is
offered, as hiding it would send self-learners elsewhere; the hints are a
section here because a hint refers to the statement, which a tab of their
own would hide.

`Show solution` shows the solution in the canvas, read-only, under a band
`Solution` with `Load into my chart`, which replaces the program with the
solution as one undoable edit (`language.md`, Edits), and
`Back to my chart`; showing it is recorded (`challenges.md`, Progress). A
flowchart with branches does not fit the 320 px panel, so the solution
takes the chart's region, and loading it as one undoable edit lets the
learner change what they would otherwise only read.

`Run` and `Submit` act on the learner's program; while the solution is
shown, either first returns the canvas to the learner's chart. While
running, `Submit`, `Show solution`, and `Compare with the solution` are
disabled. A run under the solution's chart would put the highlight, the
marks, and the narration on a chart other than the one running, and
showing the solution or choosing another case while running would replace
what the run bar drives, so both wait for `Stop`, as editing does.

A challenge's markdown texts (`description`, `hints`, `takeaway`,
`challenges.md`, Schema) render paragraphs separated by a blank line,
`` `code` ``, `**bold**`, and `*italic*`; any other markdown is shown as
written. A Markdown library was rejected: it would bring a dependency, an
HTML sanitiser for its output, and headings, tables, and links that a
statement in a 320 px panel should not hold; the four rules are rendered as
React elements, so no HTML string needs sanitising.

### Result tab

Tab `Result` shows, for one case: the case selector, which holds the same
choice as the Input nodes (`chart.md`, Input nodes), with `✓ Submit`
(`run.md`, Submission) beside it on a Problem page; the variables of the
shown frame (`run.md`, Call stack) with one view each (`views.md`);
`Output`, the lines printed so far; beside it `Expected`, when the case is
one of the challenge's tests and expects `stdout`, the two aligned line by
line with a blank cell where one side has no line; every expected variable
as a row with its value, or a blank when the program never gave it a value,
beside its expected value; and, when the run ends on such a case, that
case's verdict (`challenges.md`, Judging) with the first output row that
differs, or else the first variable row that differs, marked. While a run
is on the chart, an `Expected` line beyond the lines printed so far is drawn
muted. After a submission the tab adds what `run.md`, Submission states. A
Playground program has no case selector and no `Expected`. Before any run
the tab shows the case selector with `Submit`, the chosen case's
`Expected`, and `result.empty` (`Run to see the values`).

### Python tab

Tab `Python` shows the emitted code with line numbers (`emitter.md`):
keywords, strings, numbers, and comments are coloured and nothing else;
hovering a line outlines its node, selecting a node highlights its lines,
clicking a line selects its node and, for a line inside a function, shows
that function's chart (`chart.md`, Charts and the path bar); while running, the line of the current
statement is highlighted. `Copy` and a `.py` download act on the shown file.
When the program uses modules a file row switches among `main.py` and one
`<name>.py` per module (`emitter.md`); in a program's tab a module's file is
read-only, has no node interaction, and carries `Open module <name>`
(`modules.md`, Operations), while on a Module page the module's file is the
shown file with the full node interaction. Python text appears nowhere
else.

The `Python` tab writes the inputs with the values of the chosen case
(`chart.md`, Input nodes).

## First launch

With no `localStorage` data, the first problem of the first study plan
opens. The check is made once, when the application loads at the Problems
route, and finds no data when neither `algoflow:progress` nor any
`algoflow:program:*` key exists; the layout key records no work and does
not count, as the layout store writes it as soon as the panel is resized.
The tutorial records nothing until its first submission, hint, or shown
solution, so a check on every visit would send `← Problems` straight back
to it.

## Keyboard

| Keys                         | Action                              |
| ---------------------------- | ----------------------------------- |
| Delete, Backspace            | remove selected node, unless typing in the editor |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | undo, redo                          |
| Ctrl/Cmd+D                   | duplicate                           |
| Ctrl/Cmd+Enter               | the play button (`run.md`, Run bar): Run, Pause, Play, Replay |
| →, ←                         | Step, Back (run mode)               |
| Shift+→                      | Step over (run mode)                |
| Ctrl/Cmd+→                   | Skip (run mode)                     |
| Esc                          | close menu or editor, clear selection; while running, clear the breakpoint, else Stop |
| Tab, Shift+Tab               | next, previous field of a value line, then slot (`editor.md`, Value list) |
| ↑, ↓                         | move the highlight in the editor's list (`editor.md`, Value list) |
| ←, →                         | previous, next value or input of a value line (`editor.md`, Value list) |
| Enter                        | choose the highlighted entry, and in a target's line, when it leaves no input to fill, go to the next slot (`editor.md`, Targets); in a name field not typed in, the next slot (`editor.md`, Name fields); else close the editor |

## Messages

Every diagnostic, parse, and runtime code has `error.<CODE>` in `en.json`,
whose text takes the code's params (`language.md`, Validation;
`parser.md`; `interpreter.md`, Errors).

A message writes its `op` parameter as the label of that block
(`node.<op>.label`, `interpreter.md`, Errors).

A number a message names (`run.endless`'s step limit) is written as the
current locale writes numbers (`1,000,000`).

A message, a help, and an explanation say that a variable gets or has a
value, never that it is created: a variable has no form of its own for its
first value (`nodes.md`, Node text).

## Catalogs

All strings reside in `src/i18n/en.json` and `src/i18n/ja.json` under
`app.*`, `problems.*`, `problem.*`, `playground.*`, `modules.*`, `chart.*`,
`menu.*`, `editor.*`, `run.*`, `result.*`, `python.*`, `node.*`, and
`error.*`. A key is added with the code that renders it, so its wording is
decided when the UI exists and no translation is asked for an unused
string.

`pnpm check` (`scripts/lib/i18n-check.ts`) fails on a `t()` call in `src/`
whose first argument is a string literal that `en.json` does not hold;
test files, which call `t()` with unknown keys on purpose, and `*.d.ts` are
not scanned. The check reads each file with `oxc-parser`, so a call is one
whose callee is the name `t` (not `at(` or `obj.t(`) and comments are not
read. A pattern over the text was rejected: it cannot tell a comment from code, nor read a template
literal that spans lines or nests another. A template literal passed to
`t()` is checked by TypeScript instead: it yields only keys of
`MessageKey`.

`pnpm check` fails on a scanned file that `oxc-parser` rejects.

`pnpm check` fails on a key of `en.json` that no scanned file names. A
string literal, or a template literal with no placeholder, that is the
whole key names it wherever it stands (a `t()` argument, a branch of a
ternary, a value of a map, a narration's `key`).

A template literal that `t()`'s first argument can evaluate to (the
argument itself, or a branch of a conditional or logical expression in it)
names every key its text matches, each placeholder standing for one
segment, a run of characters other than `.`:
`` t(`problems.topic.${topic}`) `` names every `problems.topic.*` key. A
template literal that begins with a placeholder, or stands anywhere else,
names none, as one such as a storage key's `${prefix}${id}` would match
every key. A list of each family's members was rejected: it would repeat
the union the code already types, beside the template literal that builds
the family's keys.

The keys built from data are built in `src/i18n/t.ts`, and the check names
them with the same functions: `node.<key>.<part>` (`nodeKey`) under
`nodePrefix(key)` for each key the registry holds, and `error.<code>`
(`errorKey`) for each code of `ERROR_CODES` (`src/i18n/codes.ts`:
`DIAGNOSTIC_CODES`, `RUNTIME_CODES`, and `PARSE_CODES`). A template literal
passed to `t()` with a cast to `MessageKey` names no key: TypeScript does
not check what it yields, and its pattern would match a whole namespace.

A key left behind when a member leaves a family whose template literal
remains, or a named menu entry, a slot's name, or a generated node's text
leaves a registered block, is not reported, while a removed block's keys
are. A family's members are a type, which the check does not read without
the type checker, and naming a block's keys one by one would copy
`nodes.md`, Catalog keys, into the check beside the code that builds them.

`pnpm check` fails on a key that one locale holds and the other does not.

The Japanese locale writes a label, a menu entry, a button, and a
`foreach`'s generated nodes in plain form or as a noun (`余り`, `値を入れる`),
as a command is named, and help, explanations, messages, and the narration
in polite form, as they are spoken to the learner; a help gives the
technical term in parentheses (e.g. the loanword for "loop" beside the
everyday word).

`src/i18n/glossary.json` lists, for each term, the English term, the
Japanese word the Japanese texts call it by, the technical word a `help`
text gives in parentheses where the term has one, and the words avoided
for it; a term's Japanese word and technical word are its glossary words.
The learner cannot tell two words for one thing from two things, and the
instructor teaches with the words the screens use, so one list serves the
writer and the reviewer of every Japanese text.

`pnpm check` fails on a text of `ja.json` that holds an avoided word,
naming the key and the word; the words are compared after Unicode NFKC
normalization, so a half-width katakana word is found too. A glossary with
no check was rejected: a word that drifts is found only when a review
notices it. A check that a Japanese text holds a term's glossary word
wherever its English holds the term was rejected: a natural Japanese
sentence often leaves the term out, and each such text would need an
exception.

`pnpm check` fails on a glossary that lists a term twice, gives one
glossary word to two terms, or avoids a word that is a glossary word or
part of one: Japanese has no spaces between words, so an avoided word is
found inside a longer one.

The glossary exempts no key or file: a text that fails although its word is
right is reworded, or the word leaves the avoided words, as an exemption
kept by key goes stale while the texts change.

`t(key, params?)` in `src/i18n/t.ts` accepts only keys of `en.json` (type
`MessageKey`, derived from the file), replaces `{name}` placeholders from
`params`, falls back from the current locale to `en`, and returns the key
itself when no text exists.

A change of language makes the part of the page below the header again,
keyed by the locale, so every component and memo there is made in the new
language. A reload was rejected: it shows a blank page and moves the
keyboard focus off the switch. A re-render in place was rejected: every
memo whose result holds text would have to list the language, while making
the page again leaves a rule only for the few places text is kept beyond
it (below).

The header is rendered again in place on a change of language, so the
switch keeps the keyboard focus.

The header memoizes no text, a module-level cache of text (the value list's
entries) is kept per locale, and a store holds keys and codes, not texts:
these are what making the page again does not reach.

A title the application gives a program (`playground.untitled`, or the
problem's title that `Open in Playground` gives) is the learner's data and
keeps the language it was given in.

`<html lang>` is the current locale, so a screen reader reads a text in its
language and the browser chooses fonts for it.

## Values on one line

A value written on one line (an Input node, a case label, `Example`, the
narration, a `Result` row, `Variables`) is written as the blocks write it: a
number as Python's `str()` writes it (`3`, `2.0`), `True`, `False`, `None`,
a text in quotes, a list `[1, "a"]`, and a dict `{"a": 1, 3: 2}`, its items
written by the same rule and separated by `, `. A variable shown with its
value or its view (`views.md`) in `Variables`, a `Result` row, a case label,
the case menu, an Input node, or `Example` is written as an assignment
writes it (`n ← 15`), and the variables of a case label and the case menu
are separated by `, ` (`a ← 3, b ← 9`) in every locale, as items are
(`nodes.md`, Node text); the narration says it in a sentence (`run.md`,
Narration). `Output` shows what `print` printed, as Python's `str()` writes
it.

## Verification

The end-to-end suite draws one screenshot per screen state: Problems, Build,
Run, Wrong Answer, Accepted, Solution, the Python tab, Run inside a
function, Playground, Modules, and Module, and one per view (`views.md`:
the views chosen by value, the object graph, and the views a learner
switches to), in each locale.

The end-to-end suite switches the language on each page that holds the
switch, then draws that page and each screen state above, and finds every
text but a program's title the same as when it is loaded in the language
chosen.

A run of the screenshot suite that updates snapshots (`pnpm screenshots`
passes `--update-snapshots`) writes the screenshots to `e2e/screenshots/`;
every other run writes them under `test-results/`: text antialiasing
differs between runs, so redrawing the tracked files on every run would
leave changes to discard.

CI compares each screenshot with its baseline.
