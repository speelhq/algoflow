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
Curriculum). Its top bar has `← Playground` instead of `← Problems`, an
editable title instead of the problem title, `Export` (`language.md`,
Storage) before undo, and a `⋯` with `Help` alone, because
`Open in Playground` would copy the program under its own title.

The Problems page has a 52 px header with the app name, the tabs
`Problems`, `Playground`, and `Modules`, Help, and the JA/EN switch. Below
the header is one section per study plan (Problems page).

The Playground and Modules pages share the header of the Problems page.

Every page sets the browser tab title to `<title> — AlgoFlow`, where
`<title>` is the problem's or Playground program's title, the module's
title or name (`modules.md`, Schema), or the page name.

A hash that names no page, a Problem route whose id names no challenge, or
a Playground program route whose id `algoflow:playground` doesn't list
(`language.md`, Storage), shows the Problems page.

## Page layout

The Problem page has a 52 px top bar with `← Problems`, the title, undo, redo,
and `⋯` (Help and `⋯`), with no difficulty badge and no action on the
program's run. Below it are two parts. The panel (Panel) is on the left: 320
px wide by default, resizable from 280 px to 50 % of the viewport width, and
collapsible, with its width persisted under `algoflow:layout`. The canvas
holds, from top to bottom, the path bar (`chart.md`, Charts and the path bar),
the chart, the narration line while running (`run.md`, Narration), and the run
bar (`run.md`, Run bar). There is no third part, because the `Result` tab
takes the place of a floating variables card and an output strip, and the
`Python` tab takes the place of a right-hand pane, so the panel can widen to
half the viewport for a grid, an object graph, or code. `Run` and `Submit`
aren't in the top bar, because starting a run and pausing it would then sit at
opposite edges of the page, and `Submit`, which judges every case and records
the attempt, would read as having the same weight as `Run`, which tries one.

The store keeps the requested panel width with its lower bound, and one
pure function applies the upper bound where the width is set and where it
is drawn, because the bound follows the viewport, and a store that read
`window.innerWidth` wouldn't run under the node tests and would keep a
stale bound after a resize.

The panel collapses to a 40 px rail from a toggle in its header. The state
persists under `algoflow:layout`.

`algoflow:layout` holds the record of `panel`, `collapsed`, and `speed`
itself, with no wrapper and no `version`, as `algoflow:progress` holds its own
(`challenges.md`, Progress). The store validates the record when it sets a
field and when it reads storage. A non-number or an out-of-range size falls
back to the default or the lower bound, so a hand-edited or stale record never
draws an unusable panel, and a record of an older shape needs no `version` or
migration.

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
table below and three lines that describe the loop (build the chart, run
it on one input, submit). Its texts are under `app.help.*`, and it has no
external links. Help holds the keyboard table because the table has no
other place. It doesn't hold the problem's description, because that would
mean nothing on the Problems page, which has no problem open.

`⋯` opens a menu of `Open in Playground` and `Help`.

`Open in Playground` creates a Playground program from the current program
and opens it. The new program is titled with the problem's title (the
program's own title is never shown). Each input becomes an assignment of
the chosen case's value (`chart.md`, Input nodes) at the top of `main`, in
the form that `emitter.md` writes inputs in.

## Problems page

A problem row shows a status mark (`✓` solved, `•` attempted, blank), the
title, the difficulty (`Easy`, `Medium`, `Hard`), and the topic tags. A
row opens the Problem page.

The page shows one section per plan, in the order of `challenges.md`, Study
plans. A section shows the title, the one-line description,
`n of m solved`, the plan's button, and then the plan's rows in plan order.
There are no filters and no overall progress meter, because the plans'
order says which problem to attempt next, a filter row suits thousands of
problems, and a meter or a `blocks used` column helps no beginner choose.
Topics stay as tags, so a row says what it practices.

A plan's button is `Start` (the plan's first problem) while no problem of the
plan has a progress entry (`challenges.md`, Progress). Otherwise, it is
`Continue: <title>` (the first unsolved problem, named) while a problem is
unsolved, and it is absent once every problem is solved.

Per-problem progress drives the status marks and the plan counts.

Topics are fixed: `Output`, `Variables`, `Loops`, `Conditions`, `Lists`,
`Searching`, `Sorting`, `Recursion`, `Dictionaries`, and `Classes`
(`problems.topic.<key>`).

## Playground page

Under the header, a card holds `Playground`, a one-line description
(`playground.description`), `Import…`, and `New`. Below it is one row per
Playground program (its title, the time of its last edit, and `Delete`),
ordered by last edit with the latest first, or `playground.empty` while
there is none. A row opens its program. `New` opens an empty program
titled `playground.untitled`. `Import…` (`language.md`, Storage) adds a
program from a file, and a file that `migrate()` rejects adds nothing and
shows `playground.importFailed`. `Delete` asks for confirmation in a
dialog, then removes the program from storage.

## Panel

### Tabs

The panel has the tabs `Problem`, `Result`, and `Python` on a Problem page,
and `Result` and `Python` on a Playground program and a Module page. A page
opens on its first tab. `Run`, `Submit`, and `Test` (`modules.md`, Cases)
select `Result`. Nothing selects `Python` or returns to `Problem`
automatically, because Python shown by default, or as a fragment per block,
would teach syntax before the flow is understood. The Accepted view offers it,
the moment after solving.

### Problem tab

The `Problem` tab shows the title, the difficulty, and the topic tags, then
the problem's description (Markdown), `Example`, `Cases used by Submit`, the
`Hints` section, and a `Solution` row with `Show solution`. `Example` shows
the first test's inputs and its expected output, one line per value, and an
output of more than eight lines folds to its first five and `… n more`.
`Cases used by Submit` shows the inputs of every test. The `Hints` section
reveals one hint per click on `Show next hint` and shows `n of 3 shown`, and
the number is recorded (`challenges.md`, Progress). The solution is offered,
because hiding it would send self-learners elsewhere. The hints are a section
here, because a hint refers to the description, which a tab of their own would
hide.

`Show solution` shows the solution in the canvas, read-only, under a band
`Solution` that holds `Load into my chart` and `Back to my chart`.
`Load into my chart` replaces the program with the solution as one undoable
edit (`language.md`, Edits). Showing the solution is recorded
(`challenges.md`, Progress). A flowchart with branches doesn't fit the 320 px
panel, so the solution takes the chart's place, and loading it as one undoable
edit lets the learner change what they would otherwise only read.

`Run` and `Submit` act on the learner's program. While the solution is
shown, either one first returns the canvas to the learner's chart. While
running, `Submit`, `Show solution`, and `Compare with the solution` are
disabled. A run under the solution's chart would put the highlight, the
marks, and the narration on a chart other than the one running, and
showing the solution or choosing another case while running would replace
what the run bar drives, so both wait for `Stop`, as editing does.

A challenge's Markdown texts (`description`, `hints`, `takeaway`,
`challenges.md`, Schema) render paragraphs separated by a blank line, ``
`code` ``, `**bold**`, and `*italic*`. Any other Markdown is shown as written.
A Markdown library was rejected, because it would bring a dependency, an HTML
sanitizer for its output, and headings, tables, and links that a description
in a 320 px panel shouldn't hold. The four rules are rendered as React
elements, so no HTML string needs sanitizing.

### Result tab

The `Result` tab shows one case. It holds the case selector, which shows the
same choice as the Input nodes (`chart.md`, Input nodes), with `✓ Submit`
(`run.md`, Submission) beside it on a Problem page. It holds the variables of
the shown frame (`run.md`, Call stack), with one view each (`views.md`), and
`Output`, the lines printed so far. When the case is one of the challenge's
tests and expects `stdout`, `Expected` stands beside `Output`, and the two are
aligned line by line, with a blank cell where one side has no line. Each
expected variable is a row with its value, or a blank when the program never
gave it a value, beside its expected value. When the run ends on one of the
challenge's tests, the tab shows that test's verdict (`challenges.md`,
Judging), with the first output row that differs, or else the first variable
row that differs, marked. While a run is on the chart, an `Expected` line
beyond the lines printed so far is drawn muted. After a submission, the tab
adds what `run.md`, Submission, states. A Playground program has no case
selector and no `Expected`. Before any run, the tab shows the case selector
with `✓ Submit`, the chosen case's `Expected`, and `Run to see the values`
(`result.empty`).

### Python tab

The `Python` tab shows the emitted code with line numbers (`emitter.md`).
Keywords, strings, numbers, and comments are colored, and nothing else is.
Hovering a line outlines its node, and selecting a node highlights its
lines. Clicking a line selects its node and, for a line inside a function,
shows that function's chart (`chart.md`, Charts and the path bar). While
running, the line of the current statement is highlighted. `Copy` and a
`.py` download act on the shown file. When the program uses modules, a file
row switches among `main.py` and one `<name>.py` per module (`emitter.md`).
In a program's tab, a module's file is read-only, has no node interaction,
and carries `Open module <name>` (`modules.md`, Operations). On a Module
page, the module's file is the shown file, with the full node interaction.
Python text appears nowhere else.

The `Python` tab writes the inputs with the values of the chosen case
(`chart.md`, Input nodes).

## First launch

With no `localStorage` data, the first problem of the first study plan opens.
The check is made once, when the application loads at the Problems route,
because the tutorial records nothing until its first submission, hint, or
shown solution, so a check on every visit would send `← Problems` straight
back to it. It finds no data when neither `algoflow:progress` nor any
`algoflow:program:*` key exists. The layout key doesn't count, because it
records no work, and the layout store writes it as soon as the panel is
resized.

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
(`block.<op>.label`, `interpreter.md`, Errors).

A message, a help, and an explanation say that a variable gets or has a
value, never that it is created, because a variable has no form of its own
for its first value (`blocks.md`, Node text).

## Catalogs

All strings are in `src/i18n/en.json` and `src/i18n/ja.json`, under
`app.*`, `problems.*`, `problem.*`, `playground.*`, `modules.*`, `chart.*`,
`menu.*`, `editor.*`, `run.*`, `result.*`, `python.*`, `block.*`, and
`error.*`. A key is added with the code that renders it, so its wording is
decided when the UI exists, and no translation is asked for an unused
string.

`pnpm check` (`scripts/lib/i18n-check.ts`) fails on a `t()` call in `src/`
whose first argument is a string literal that `en.json` doesn't hold. The
check doesn't scan test files, which call `t()` with unknown keys on purpose,
or `*.d.ts` files. The check reads each file with `oxc-parser`, so a call
counts only when its callee is the name `t` (not `at(` or `obj.t(`), and
comments aren't read. A pattern over the text was rejected, because it can't
tell a comment from code, or read a template literal that spans lines or nests
another. TypeScript checks a template literal passed to `t()` instead, so such
a literal yields only keys of `MessageKey`.

`pnpm check` fails on a scanned file that `oxc-parser` rejects.

`pnpm check` fails on a key of `en.json` that no scanned file names. A
string literal, or a template literal with no placeholder, that is the
whole key names it wherever it stands (a `t()` argument, a branch of a
ternary, a value of a map, a narration's `key`).

A template literal that `t()`'s first argument can evaluate to (the
argument itself, or a branch of a conditional or logical expression in it)
names every key its text matches, with each placeholder standing for one
segment, a run of characters other than `.`. For example,
`` t(`problems.topic.${topic}`) `` names every `problems.topic.*` key. A
template literal that begins with a placeholder, or stands anywhere else,
names no key, because one such as a storage key's `${prefix}${id}` would
match every key. A list of each family's members was rejected, because it
would repeat the union the code already types, beside the template literal
that builds the family's keys.

The keys built from data are built in `src/i18n/t.ts`, and the check names
them with the same functions: `block.<key>.<part>` (`blockKey`) under
`blockPrefix(key)` for each key the registry holds, and `error.<code>`
(`errorKey`) for each code of `ERROR_CODES` (`src/i18n/codes.ts`:
`DIAGNOSTIC_CODES`, `RUNTIME_CODES`, and `PARSE_CODES`). A template literal
passed to `t()` with a cast to `MessageKey` names no key, because
TypeScript doesn't check what it yields, and its pattern would match a
whole namespace.

The check doesn't report a key left behind when a member leaves a family whose
template literal remains, or when a named menu entry, a slot's name, or a
generated node's text leaves a registered block. It does report a removed
block's keys. Those leftovers aren't reported, because a family's members are
a type, which the check doesn't read without the type checker, and naming a
block's keys one by one would copy `blocks.md`, Catalog keys, into the check,
beside the code that builds them.

`pnpm check` fails on a key that one locale holds and the other doesn't.

The Japanese locale writes a label, a menu entry, a button, and a
`foreach`'s generated nodes in plain form or as a noun (`余り`, `値を入れる`),
as a command is named. It writes help, explanations, messages, and the
narration in polite form, because they are spoken to the learner. A help
gives the technical term in parentheses (for example, the loanword for
"loop" beside the everyday word).

`src/i18n/glossary.json` lists, for each term, the English term, the
Japanese word the Japanese texts call it by, the technical word a `help`
text gives in parentheses where the term has one, and the words avoided
for it. A term's Japanese word and technical word are its glossary words.
The learner can't tell two words for one thing from two things, and the
instructor teaches with the words the screens use, so one list serves the
writer and the reviewer of every Japanese text.

`pnpm check` fails on a text of `ja.json` that holds an avoided word, and
it names the key and the word. The words are compared after Unicode NFKC
normalization, so a half-width katakana word is found too. A glossary with
no check was rejected, because a word that drifts would be found only when
a review noticed it. A check that a Japanese text holds a term's glossary
word wherever its English holds the term was rejected, because a natural
Japanese sentence often leaves the term out, and each such text would need
an exception.

`pnpm check` fails on a glossary that lists a term twice, gives one glossary
word to two terms, or avoids a word that is a glossary word or part of one,
because Japanese has no spaces between words, so an avoided word is found
inside a longer one.

The glossary exempts no key or file. A text that fails although its word
is right is reworded, or the word leaves the avoided words, because an
exemption kept by key goes stale while the texts change.

`t(key, params?)` in `src/i18n/t.ts` accepts only keys of `en.json` (type
`MessageKey`, derived from the file), replaces `{name}` placeholders from
`params`, falls back from the current locale to `en`, and returns the key
itself when no text exists.

A change of language rebuilds the part of the page below the header, keyed
by the locale, so every component and memo there is made in the new
language. A reload was rejected, because it shows a blank page and moves
the keyboard focus off the switch. A re-render in place was rejected,
because every memo whose result holds text would have to list the
language, while rebuilding the page leaves a rule only for the few places
that keep text beyond it (below).

The header is rendered again in place on a change of language, so the
switch keeps the keyboard focus.

The header memoizes no text, a module-level cache of text (the value list's
entries) is kept per locale, and a store holds keys and codes, not texts,
because these are the places that rebuilding the page doesn't reach.

A title the application gives a program (`playground.untitled`, or the
problem's title that `Open in Playground` gives) is the learner's data and
keeps the language it was given in.

`<html lang>` is the current locale, so a screen reader reads a text in its
language and the browser chooses fonts for it.

## Values on one line

A value written on one line (an Input node, a case label, `Example`, the
narration, a `Result` row, `Variables`) is written as the blocks write it: a
number as Python's `str()` writes it (`3`, `2.0`), `True`, `False`, `None`, a
text in quotes, a list as `[1, "a"]`, and a dict as `{"a": 1, 3: 2}`. A list's
and a dict's items are written by the same rule and separated by `, `. A
variable shown with its value or its view (`views.md`) in `Variables`, a
`Result` row, a case label, the case menu, an Input node, or `Example` is
written as an assignment writes it (`n ← 15`). The variables of a case label
and of the case menu are separated by `, ` (`a ← 3, b ← 9`) in every locale,
as items are (`blocks.md`, Node text). The narration states a variable and its
value in a sentence (`run.md`, Narration). `Output` shows what `print`
printed, as Python's `str()` writes it.

## Verification

The end-to-end suite draws one screenshot per screen state: Problems, Build,
Run, Wrong Answer, Accepted, Solution, the Python tab, Run inside a
function, Playground, Modules, and Module, and one per view (`views.md`:
the views chosen by value, the object graph, and the views a learner
switches to), in each locale.

The end-to-end suite switches the language on each page that holds the switch,
then draws that page and each screen state above, and finds that every text
except a program's title is the same as when the page is loaded in the chosen
language.

A run of the screenshot suite that updates snapshots (`pnpm screenshots`
passes `--update-snapshots`) writes the screenshots to `e2e/screenshots/`.
Every other run writes them under `test-results/`, because text
antialiasing differs between runs, so redrawing the tracked files on every
run would leave changes to discard.

CI compares each screenshot with its baseline.
