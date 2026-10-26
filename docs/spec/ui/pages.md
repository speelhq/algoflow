# Pages

A page is one screen of the application, addressed by a hash route.
This file states the pages and their routes, the layout of the Problem
page, Help and `⋯`, the Problems page, the Playground page, the panel
and its tabs, the first launch, the keyboard, the messages, the
catalogs and the Japanese texts, how a value is written on one line,
and the verification.

Code: `src/ui/app`, `src/ui/problems`, `src/ui/playground`, the panel
and its tabs in `src/ui/problem`, `src/ui/python`, `src/ui/text`,
`src/i18n`, and `src/store/layout.ts`. Tests: beside each file, and
`e2e/`.

## Pages and routes

The application has six pages, each addressed by a hash route:

- Problems: `#/`
- Problem: `#/p/<id>`
- Playground: `#/play` (Playground page)
- Playground program: `#/play/<id>`
- Modules: `#/modules` (`modules.md`, Pages)
- Module: `#/m/<name>` (`modules.md`, Pages)

A Playground program is the Problem page without the `Problem` tab, the
Input chart nodes, and `Submit` (`scope.md`, Curriculum, Playground
programs).

A Playground program's top bar differs from the Problem page's in four
things:

- `← Playground` instead of `← Problems`
- an editable title instead of the problem title
- `Export` (`language.md`, Storage) before undo
- a `⋯` with `Help` alone, because `Open in Playground` would copy the
  program under its own title

The Problems page has a 52 px header, which holds:

- the app name
- the tabs `Problems`, `Playground`, and `Modules`
- Help
- the JA/EN switch

Below the header is one section per study plan (Problems page).

The Playground and Modules pages share this header.

Every page sets the browser tab title to `<title> — AlgoFlow`, where
`<title>` is:

- on a Problem page: the problem's title
- on a Playground program: the program's title
- on a Module page: the module's title or name (`modules.md`, Schema)
- on the other pages: the page name

The application shows the Problems page for:

- a hash that names no page
- a Problem route whose challenge id names no challenge
- a Playground program route whose Playground id isn't listed in
  `algoflow:playground` (`language.md`, Storage)

## Page layout

The Problem page is a top bar over two parts, the panel and the canvas,
and no third part, because the `Result` tab takes the place of a
floating variables card and an output strip, and the `Python` tab takes
the place of a right-hand pane, so the panel can widen to half the
viewport for a grid, an object graph, or code.

The top bar is 52 px high and holds:

- `← Problems`
- the title
- undo and redo
- `⋯` (Help and `⋯`)

The top bar holds no difficulty badge and no action on the program's
run: `Run` and `Submit` aren't in it, because starting a run and
pausing it would then sit at opposite edges of the page, and `Submit`
would read as having the same weight as `Run`. `Submit` judges every
case and records the attempt, and `Run` tries one case.

The panel (Panel) is on the left. It is 320 px wide by default,
resizable from 280 px to 50 % of the viewport width, and collapsible,
and its width persists under `algoflow:layout`.

The canvas holds, from top to bottom:

- the path bar (`chart.md`, Charts and the path bar)
- the chart
- the narration line, while running (`run.md`, Narration)
- the run bar (`run.md`, Run bar)

The layout store keeps the requested panel width, bounded below, and
one pure function applies the upper bound where the width is set and
where it is drawn, because the bound follows the viewport, and a store
that read `window.innerWidth` wouldn't run under the node tests and
would keep a stale bound after a resize.

The panel collapses to a 40 px rail from a toggle in its header. The
collapsed state persists under `algoflow:layout`.

`algoflow:layout` holds the record of `panel`, `collapsed`, and `speed`
directly, with no wrapper and no `version`, as `algoflow:progress` holds
its own (`challenges.md`, Progress). The layout store validates the
record when it sets a field and when it reads storage. A non-number or an
out-of-range size falls back to the default or the lower bound, so a
hand-edited or stale record never draws an unusable panel, and a record
of an older shape needs no `version` or migration.

The Problem page, during a run, looks like this:

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

Help is a dialog, opened from `⋯` or the header's `?`. It holds the
keyboard table (Keyboard), because the table has no other place.

Help also holds three lines that describe the loop: build the program,
run it on one input, submit. It doesn't hold the problem's description,
because that would mean nothing on the Problems page, which has no
problem open.

Help's texts are under `app.help.*`, and it has no external links.

On a Problem page, `⋯` opens a menu of `Open in Playground` and
`Help`.

`Open in Playground` creates a Playground program from the current
program and opens it. The new program takes the problem's title,
because the Problem page never shows its program's own title.

Each input becomes an assignment of the chosen case's value
(`chart.md`, Input chart nodes) at the top of `main`, in the form that
`emitter.md` writes inputs in.

## Problems page

The Problems page lists every problem by study plan, and a row opens
the Problem page. A problem row shows:

- a status icon: `✓` solved, `•` attempted, or blank
- the title
- the difficulty: `Easy`, `Medium`, or `Hard`
- the topic tags

The page shows one section per plan, in the order of `challenges.md`,
Study plans. A section shows:

- the title
- the one-line description
- `n of m solved`
- the plan's button
- the plan's rows, in plan order

The page has no filters and no overall progress meter, because the
plans' order says which problem to attempt next, a filter row suits
thousands of problems, and a meter or a `blocks used` column helps no
beginner choose. Topics stay as tags, so a row says what it practices.

A plan's button depends on the plan's progress entries
(`challenges.md`, Progress):

- while no problem of the plan has an entry: `Start`, for the plan's
  first problem
- once a problem of the plan has an entry and while one is unsolved:
  `Continue: <title>`, where `<title>` is the first unsolved problem
- once every problem is solved: no button

A problem's progress entry sets its status icon, and a plan's
`n of m solved` counts its solved problems.

Topics are fixed (`problems.topic.<key>`):

- `Output`
- `Variables`
- `Loops`
- `Conditions`
- `Lists`
- `Searching`
- `Sorting`
- `Recursion`
- `Dictionaries`
- `Classes`

## Playground page

The Playground page lists the Playground programs and makes new ones.
Under the header, a card holds:

- `Playground`
- a one-line description (`playground.description`)
- `Import…`
- `New`

Below the card is one row per Playground program, ordered by last edit
with the latest first. A row shows:

- the title
- the time of its last edit
- `Delete`

While there is no program, the page shows `playground.empty`. A row
opens its program.

The card's and a row's controls:

- `New` opens an empty program titled `playground.untitled`.
- `Import…` (`language.md`, Storage) adds a program from a file. When
  `migrate()` rejects the file, `Import…` adds nothing and shows
  `playground.importFailed`.
- `Delete` asks for confirmation in a dialog, then removes the program
  from storage.

## Panel

The panel is the left part of a Problem page, a Playground program,
and a Module page, and it holds the page's tabs.

### Tabs

The panel's tabs depend on the page:

- a Problem page: `Problem`, `Result`, and `Python`
- a Playground program and a Module page: `Result` and `Python`

A page opens on its first tab. `Run`, `Submit`, and `Test`
(`modules.md`, Cases) select `Result`.

Nothing selects `Python` or returns to `Problem` automatically, because
Python shown by default, or as a fragment per block, would teach syntax
before the flow is understood. The Accepted view offers the `Python`
tab after solving.

### Problem tab

The `Problem` tab shows, in order:

- the title, the difficulty, and the topic tags
- the problem's description, rendered as Markdown
- `Example`
- `Cases used by Submit`
- the `Hints` section
- a `Solution` row with `Show solution`

`Example` shows the first test's inputs and its expected output, one
line per value, and an output of more than eight lines folds to its
first five and `… n more`.

`Cases used by Submit` shows the inputs of every test.

The `Hints` section reveals one hint per click on `Show next hint` and
shows `n of 3 shown`, and the application records the number of hints
shown (`challenges.md`, Progress). The hints are a section here,
because a hint refers to the description, which a tab of their own
would hide.

The `Solution` row offers the solution, because hiding it would send
self-learners elsewhere.

`Show solution` shows the solution in the canvas, read-only, under a
band `Solution` that holds `Load into my chart` and `Back to my chart`.
A flowchart with branches doesn't fit the 320 px panel, so the solution
takes the chart's place.

`Load into my chart` replaces the program with the solution as one
undoable edit (`language.md`, Edits), so the learner can change what
they would otherwise only read.

The application records that the solution was shown (`challenges.md`,
Progress).

`Run` and `Submit` act on the learner's program. While the solution is
shown, either one first returns the canvas to the learner's program,
because a run under the solution's chart would put the highlight, the
marks, and the narration on a chart other than the one running.

While running, `Submit`, `Show solution`, and
`Compare with the solution` are disabled, because showing the solution
or choosing another case while running would replace what the run bar
drives, so `Show solution` and the case selector wait for `Stop`, as
editing does.

The application renders a challenge's Markdown texts (`description`,
`hints`, and `takeaway`; `challenges.md`, Schema) in four forms:

- paragraphs separated by a blank line
- `` `code` ``
- `**bold**`
- `*italic*`

The application shows any other Markdown as written.

The application renders the four forms as React elements, so no HTML
string needs sanitizing. A Markdown library was rejected, because it
would bring a dependency, an HTML sanitizer for its output, and
headings, tables, and links that a description in a 320 px panel
shouldn't hold.

### Result tab

The `Result` tab shows one case. It holds:

- the case selector, which shows the same choice as the Input chart nodes
  (`chart.md`, Input chart nodes), with `✓ Submit` (`run.md`, Submission)
  beside it on a Problem page
- `Variables`: the variables of the shown frame (`run.md`, Call stack),
  with one view each (`views.md`)
- `Output`, the lines printed so far

When the case is one of the challenge's tests and expects `stdout`,
`Expected` stands beside `Output`, and the two are aligned line by line,
with a blank cell where one side has no line. While a run is on the
chart, an `Expected` line beyond the lines printed so far is drawn
muted.

Each expected variable is a row that shows its value beside its
expected value. When the program never gave the variable a value, its
value is blank.

When the run ends on one of the challenge's tests, the tab shows that
test's verdict (`challenges.md`, Judging), and it highlights the first
output row that differs, or else the first variable row that differs.

After a submission, the tab adds what `run.md`, Submission, states.

A Playground program has no case selector and no `Expected`.

Before any run, the tab shows `Run to see the values` (`result.empty`),
and on a Problem page also the case selector with `✓ Submit` and the
chosen case's `Expected`.

### Python tab

The `Python` tab shows the emitted code with line numbers
(`emitter.md`).

The tab colors keywords, strings, numbers, and comments, and nothing
else.

The tab writes the inputs with the values of the chosen case
(`chart.md`, Input chart nodes).

Python text appears nowhere else.

The tab's lines and the chart nodes are linked:

- Hovering a line outlines its chart node.
- Selecting a block highlights its lines.
- Clicking a line selects its block and, for a line inside a function,
  shows that function's chart (`chart.md`, Charts and the path bar).
- While running, the line of the current statement is highlighted.

`Copy` and a `.py` download act on the shown file.

When the program uses modules, a file row switches among `main.py` and
one `<name>.py` per module (`emitter.md`). A module's file:

- in a program's tab: is read-only, has no links to the chart nodes,
  and carries `Open module <name>` (`modules.md`, Operations)
- on a Module page: is the shown file, with every link to its chart nodes

## First launch

With no `localStorage` data, the application opens the first problem
of the first study plan. When neither `algoflow:progress` nor any
`algoflow:program:*` key exists, the application finds no data.
`algoflow:layout` doesn't count, because it records no work, and the
layout store writes it as soon as the panel is resized.

When the application loads at the Problems route, it checks once for
data, because the first problem records nothing until its first
submission, hint, or shown solution, so every click on `← Problems`
would come straight back to it.

## Keyboard

A Problem page and a Playground program answer these keys:

| Keys                         | Action                              |
| ---------------------------- | ----------------------------------- |
| Delete, Backspace            | remove selected block, unless typing in the editor |
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

This section states the keys and the wording of the texts that report
a diagnostic, a parse error, or a runtime error. Every diagnostic,
parse, and runtime code has the key `error.<code>` in `en.json`, and
that key's text takes the code's params (`language.md`, Validation;
`parser.md`; `interpreter.md`, Errors).

A message writes its `op` parameter as the label of the block definition
that `op` names (`block.<op>.label`; `interpreter.md`, Errors).

A message, a `help` text, and an explanation say that a variable gets
or has a value, never that it is created, because a variable has no
form of its own for its first value (`blocks.md`, Notation).

## Catalogs

A catalog holds the strings of one locale that the application words.
All strings are in `src/i18n/en.json` and `src/i18n/ja.json`, under
these namespaces:

- `app.*`
- `problems.*`
- `problem.*`
- `playground.*`
- `modules.*`
- `chart.*`
- `menu.*`
- `editor.*`
- `run.*`
- `result.*`
- `python.*`
- `block.*`
- `error.*`

A change adds a key together with the code that renders it, so the
writer words the key once the UI exists, and no translator is asked for
an unused string.

### The key check

`pnpm check` (`scripts/lib/i18n-check.ts`) checks the keys that the
code names against the keys that the catalogs hold. It fails on a
`t()` call in `src/` whose first argument is a string literal that
`en.json` doesn't hold. The check doesn't scan `*.d.ts` files or test
files, because test files call `t()` with unknown keys on purpose.

The check reads each file with `oxc-parser`, so it doesn't read
comments, and a call counts only when its callee is the name `t`. For
example: `at(` and `obj.t(` don't count. A pattern over the text was
rejected, because it can't tell a comment from code, or read a
template literal that spans lines or nests another.

A template literal passed to `t()` without a cast to `MessageKey` is
checked by TypeScript, not by the check, so it yields only keys of
`MessageKey`.

`pnpm check` fails on a scanned file that `oxc-parser` rejects.

`pnpm check` fails on a key of `en.json` that no scanned file names. A
string literal, or a template literal with no placeholder, that is the
whole key names it wherever it stands. For example: a `t()` argument,
a branch of a ternary, a value of a map, or a narration's `key`.

When a template literal is one of these, it names every key its text
matches:

- `t()`'s first argument itself
- a branch of a conditional or logical expression in that argument

Each placeholder stands for one segment: a run of characters other
than `.`. For example: `` t(`problems.topic.${topic}`) `` names every
`problems.topic.*` key. When a template literal with a placeholder
begins with the placeholder, or stands outside the two places above, it
names no key, because one that begins with a placeholder would match
every key. For example: a storage key's `${prefix}${id}`. A list of
each family's members was rejected, because it would repeat the union
the code already types, beside the template literal that builds the
family's keys.

The keys built from data are built in `src/i18n/t.ts`, and the check
names them with the same functions:

- `block.<key>.<part>` (`blockKey`), under `blockPrefix(key)` for each
  key the registry holds
- `error.<code>` (`errorKey`), for each code of `ERROR_CODES`
  (`src/i18n/codes.ts`: `DIAGNOSTIC_CODES`, `RUNTIME_CODES`, and
  `PARSE_CODES`)

A template literal passed to `t()` with a cast to `MessageKey` names no
key, because TypeScript doesn't check what it yields, and its pattern
would match a whole namespace.

The check doesn't report a key left behind when a member leaves a
family whose template literal remains, or when a named menu entry, a
slot's name, or a generated chart node's text leaves a registered block
definition. Those leftovers aren't reported, because a family's members
are a type, which the check doesn't read without the type checker, and
naming a block definition's keys one by one would copy `blocks.md`,
Catalog keys, into the check, beside the code that builds them.

The check does report a removed block definition's keys.

`pnpm check` fails on a key that one locale holds and the other doesn't.

### Japanese

The Japanese locale writes a label, a menu entry, a button, and a
`foreach`'s generated chart nodes in plain form or as a noun, the way a
command is named. For example: `余り`, `値を入れる`. It writes `help` texts,
explanations, messages, and the narration in polite form, because they
are spoken to the learner.

A `help` text gives a term's technical word in parentheses. For
example: the loanword for "loop" beside its Japanese word.

`src/i18n/glossary.json` lists, for each term:

- the English term
- the Japanese word the Japanese texts call it by
- the technical word a `help` text gives in parentheses, where the term
  has one
- the words avoided for it

A term's Japanese word and technical word are its glossary words. The
learner can't tell two words for one thing from two things, and the
instructor teaches with the words the screens use, so one list serves
the writer and the reviewer of every Japanese text.

`pnpm check` fails on a text of `ja.json` that holds an avoided word,
and it names the key and the word. The words are compared after Unicode
NFKC normalization, so a half-width katakana word is found too. A
glossary with no check was rejected, because a word that drifts would
be found only when a review noticed it. A check that a Japanese text
holds a term's glossary word wherever its English holds the term was
rejected, because a natural Japanese sentence often leaves the term
out, and each such text would need an exception.

`pnpm check` fails on a glossary that does one of these:

- lists a term twice
- gives one glossary word to two terms
- avoids a word that is a glossary word or part of one

A glossary avoids no part of a glossary word, because Japanese has no
spaces between words, so an avoided word is found inside a longer one.

When a text fails although its word is right, the writer rewords the
text or removes the word from the avoided words. The glossary exempts
no key or file, because an exemption kept by key goes stale while the
texts change.

### `t()`

`t(key, params?)` in `src/i18n/t.ts` accepts only keys of `en.json`,
whose type `MessageKey` is derived from the file. It does three things:

- replaces `{name}` placeholders from `params`
- falls back from the current locale to `en`
- returns the key itself when no text exists

### Changing the language

On a change of language, the application rebuilds the part of the
page below the header, keyed by the locale, so every component and memo
there is made in the new language. A reload was rejected, because it
shows a blank page and moves the keyboard focus off the switch. A
re-render in place was rejected, because every memo whose result holds
text would have to list the language, while rebuilding the page leaves
a rule only for the three places that keep text beyond it.

On a change of language, the application renders the header again in
place, so the switch keeps the keyboard focus.

Rebuilding the page doesn't reach three places, so each has its own
rule:

- The header memoizes no text.
- A module-level cache of text keeps one entry per locale. For
  example: the value list's entries.
- A store holds keys and codes, not texts.

A title the application gives a program is the learner's data and
keeps the language it was given in. Such a title is
`playground.untitled`, or the problem's title that `Open in Playground`
gives.

`<html lang>` is the current locale, so a screen reader reads a text in
its language and the browser chooses fonts for it.

## Values on one line

A value written on one line is written as a block's notation writes it.
Such a value stands in an Input chart node, a case label, the case menu,
`Example`, the narration, a `Result` row, and `Variables`. The forms:

- a number as Python's `str()` writes it: `3`, `2.0`
- `True`, `False`, `None`
- a text in quotes
- a list as `[1, "a"]`
- a dict as `{"a": 1, 3: 2}`

A list's and a dict's items are written by the same rule and separated
by `, `.

A variable shown with its value or its view (`views.md`) in
`Variables`, a `Result` row, a case label, the case menu, an Input
chart node, or `Example` is written as an assignment writes it. For
example: `n ← 15`.

The variables of a case label and of the case menu are separated by
`, ` in every locale, as items are (`blocks.md`, Notation). For
example: `a ← 3, b ← 9`.

The narration states a variable and its value in a sentence (`run.md`,
Narration).

`Output` shows what `print` printed, as Python's `str()` writes it.

## Verification

The end-to-end suite draws, in each locale:

- one screenshot per screen state: Problems, Build, Run, Wrong Answer,
  Accepted, Solution, the Python tab, Run inside a function,
  Playground, Modules, and Module
- one per view (`views.md`): the views chosen by value, the object
  graph, and the views a learner switches to

The end-to-end suite switches the language on each page that holds the
switch, then draws that page and each screen state above, and checks
that every text except a program's title is the same as when the page
is loaded in the chosen language.

A run of the end-to-end suite that updates snapshots writes the
screenshots to `e2e/screenshots/`. `pnpm screenshots` is such a run:
it passes `--update-snapshots`. Every other run writes them under
`test-results/`, because text antialiasing differs between runs, so
redrawing the tracked files on every run would leave changes to
discard.

CI compares each screenshot with its baseline.
