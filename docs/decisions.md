# Decisions

Why the facts in `docs/spec/` were chosen, and the alternatives rejected.
One section per specification file, then the engineering choices and the
process. An entry stays only while a plausible change would otherwise undo a
deliberate choice: a rejected alternative, or a constraint the code, the
configuration, `CLAUDE.md`, and the statement itself do not show. What they
show, what fails at once when broken, and history have no entry. An entry
names the ids it explains; when a statement changes, its entry changes in
the same commit, and an entry whose statement is deleted is deleted with
it.

## Scope

<!-- `01-scope.md` -->

**The application has no roles** (S-01, S-09). A table of users by role
(trainee, self-learner, instructor) was dropped: a trainee and a
self-learner use the same features, and an instructor's work (challenge
files, plans, built-in modules) is authoring in the repository, not a
feature of the application. "The environment is the core and the problems
are a curriculum" was rejected as a statement because it states nothing
testable.

**Plans chain through modules, not starters** (S-05, C-19, C-21). A
starter chain (each problem starts from the previous solution) discards
the learner's own version; a module chain keeps it, and a bug in the
learner's `heap_pop` surfacing in `dijkstra-heap` is the note's "inspect
the block you rely on", not a defect. A built-in module with the same
names lets a learner who skipped a problem, or a self-learner, start
anywhere (the note's "predefined blocks as shortcuts, still inspectable"),
but it would let every problem after the first be passed without building
anything; `defines` (C-21) refuses a submission whose named function
resolves to a built-in module, so the exercise is retained while the
shortcut remains available for later problems.

**Playground holds many programs** (S-07, U-15, U-05). One `free` slot
made starting a new program an act of destruction; the note's "use it in
a larger program" has nowhere else to happen than Playground once a plan
ends. `Open in Playground` converts a solved problem into the start of that
larger program, with inputs fixed as the assignments E-03 already emits.

**Plans `structures` and `dp`; the rest stays out of plans** (S-05). A
plan's order must be significant. The seven `structures` problems build on
one another through the list-as-stack, list-as-queue, and `heap` module;
`dijkstra-grid` then `dijkstra-heap` shows a block being swapped for a
faster one with the same answer, visible in the step count on the Accepted
card. The three `dp` problems widen the same table technique (one
dimension, two, strings), which is the same form of concept progression as
the course plan. `gcd`, `is-prime`, and `fisher-yates` are not built upon
later; `fibonacci-memo` and `hanoi` would form a two-problem recursion
plan, which is insufficient until further recursion problems are added.
Adding any of them to the course plan is the instructor's decision, since
that plan mirrors a fixed three-day course.

## Language

<!-- `02-language.md` -->

**An empty slot is an expression kind** (L-09). `create()` must return a
statement whose required slots exist; making the slot type `Expr | null`
would distribute null checks through every block and the emitter. A dedicated
`empty` kind keeps `Expr` a closed union, lets validation report
`E_EMPTY_SLOT` generically, and emits `...` so the Python tab still renders.

**Statements are addressed by `Place`** (L-54). Edits from the UI arrive as
a drop at index N of region R; a `{ parent, slot, index }` triple names every
region (main, a function body, a frame region) without exposing array
references. `moveStmt` counts the index after removal because a drag within
one region is the common case and the drop indicator is computed on the
list without the dragged card.

**A `for` variable belongs to the enclosing region** (L-43). Python leaves
the loop variable defined after the loop, and `for` reads its bounds before
the body runs, so the variable is treated as assigned by the statement that
owns the loop, not inside its body. Names first assigned in the body still
raise `E_DECLARE_FIRST` afterwards.

**`hoistAssign` picks the default from the first inner assignment** (L-44).
The fix must be type-consistent as the learner reads it: a counter starts at
`0`, a message at `""`, a flag at `False`, a collection empty. When the first
value is not a literal the default is `None`, which any later assignment
replaces.

**Repeated objects carry the same `$id` in `toData`** (L-06). A list holding
the same object twice (micrograd `mul(a, a)`) must show identity; a second
full copy with the same `$id` is simpler to compare than a reference node,
and a cycle degrades to `{ $cls, $id }` so the conversion terminates.

**Variables may not shadow callables** (L-45). `count = 0` alongside
`def count()` runs in the interpreter (calls resolve by name) but fails in
CPython; the same holds for a function named after a builtin such as
`random_int`, whose registry key would take precedence without notice.

**Typing is one step of history** (L-52). A name typed into a slot
changes the chart with every key, so that the generated nodes follow the
variable as it is typed (U-42); one history entry per key would spend the
100 entries on one word and make undo remove a letter at a time. A field
that changed only on leaving it would keep the chart behind the editor.

**A save also happens when the page is hidden** (L-53). The 500 ms delay
spares storage a write per key, but a tab closed within it would lose the
last edit; the browser's `pagehide` is the last moment a page may write.

**Playground programs have an index** (L-57). The stored value is the
`Program` itself (L-55), which has no field for the time of its last edit,
and a Playground row needs that time (U-15); adding a field to `Program`
would put a storage concern into every export and every challenge file. A
key holding the ids and their times also gives the Playground page its list
without scanning every key of the origin, and the `play-` prefix keeps a
Playground id from ever reading as a challenge id.

**Storage holds the raw `Program` JSON** (L-55). A zustand `persist` wrapper
does not suit one key per challenge, and `migrate()` must validate whatever
is returned; the raw form is also what Export writes (L-53). A rejected value
resolves to an empty main rather than failing the load.

## Nodes

<!-- `03-nodes.md` -->

**Categories live in `src/nodes/categories.ts`**. `NodeDef.category`
(03-nodes) is owned by the node registry; the block menu (U-40) takes the
order from there rather than declaring its own copy, so adding a category
cannot leave the menu and the registry inconsistent. The file has no
imports, so `src/nodes` remains free of store and React dependencies.

**Blocks declare their menu entries** (N-11). The value list groups by
purpose, and one block can serve several groups (`binop` is `Add`,
`Equals`, and `And`), so a block lists its entries, each with its group,
the kinds it applies to, its symbol, and its keys; the editor reads them
and names no block, as N-01 requires, and a block added later brings its
entries with it.

**A `create` template after a frame**. `if c: y = 1` followed by `y = 2`
renders both as `create y`: L-41 makes `y` invisible after the frame, so the
outer assignment is where the region gains the name.

## Runtime

<!-- `04-runtime.md` -->

**`bool` is not a number** (R-15). Python treats `True` as `1`, but block
programs never rely on it and the interpreter's `E_TYPE` keeps the type model
simple for learners; solutions avoid the construct so CPython agrees.

**The parser consults the registry** (G-01). Grammar-legal forms whose block
is not registered (`[1, 2]`, `xs[i]`, `p.x`, `Cls()`) would pass the parser
and cause `unparse`, `validate`, or `run` to fail with an unknown-node
error; reporting `E_PARSE_SYNTAX` at the token keeps the failure a
diagnostic, and the registry alone decides what parses.

**`state` is refreshed while playing, as a copy** (R-12). The `Result` tab
must update per step at speed 50. The refresh was a shallow copy of the
frame list, which shared the runner's variable maps and heap: a published
`state` changed at the next step, so a screen could neither compare two
states nor memoize on one, and a `compare` event narrated later showed a
list's current contents. A published `state` is now a copy of the
variables and of the heap entries; values are immutable records, so one
level is sufficient. The cost per publish is proportional to the size of
the heap. Batches publish once per batch.

**A finished runner keeps its outcome** (R-22). A runner that is called
again after its end returns the same `Done` rather than an error or an
undefined value, so a caller that drains it in batches (Submit, the
pre-run, `scripts/check.ts`) needs no guard around its last batch.
Forbidding the call instead would move that guard into every caller with
nothing to detect a caller that forgot it.

**The CPython epilogue converts values in Python** (R-20). Serialising Python
values as `Data` on the Python side (`$float`, `$int:` keys, `$cls`/`$id`)
lets the TypeScript side compare with the same `dataEquals` used for
expectations, so one equality rule (C-10) serves both engines.

**Python stays the only generated language** (04-runtime). The note
lists JavaScript and Dart; JavaScript would not preserve the third
commitment: it has no int/float distinction, `-7 % 2` is `-1`, there is
no `//`, and `in` on an array tests indices, so a faithful emitter would
either produce output differing from the chart or wrap arithmetic in
helper functions unsuitable for a learner to read. If a second language is
required later, the block language must first be narrowed or the helpers
accepted.

**No statement-level Python import** (G-01). The beginner's loop never
involves typing Python, and a learner able to type it does not need blocks;
the block language is a strict subset, so most pasted Python would fail
without a clear diagnostic. The `Python` tab, whose lines and nodes
select each other (U-25), provides the transition from chart to text. The
keys of a value line (U-93) spell operators as Python does (`==`, `*`),
but the line never shows Python text: each key is replaced at once by what
the chart writes.

**The driver publishes its projection, not only its position** (R-11,
R-12).
`taken`: U-61 colours the path of the current pass, which cannot be rebuilt
from `lastEvent` after a Seek, so the projection keeps it beside `verdicts`
and a `loop` event clears both. `pass`: `Pass 3` requires a count for each
loop since its `enter`, which only a replaying projection holds. `busy`: the
five statuses have no value for a pre-run, a Seek, or a Skip in progress,
and a program that does not terminate pre-runs for several seconds (500
timers, which browsers clamp to about 4 ms each); a sixth status would have
made every test of `status` in the screens three-way. While `busy`, Step
and Play do nothing, because taking over the runner would leave a Seek at an
arbitrary step under a position bar that shows another; Pause still cancels
a Skip, and Pause during the pre-run opens the run paused rather than being
discarded. `verdict` is judged once, on the pre-run's runner, and published
only at step `total`, so Back from the end removes it again. `Watch this
case` is `run({ watch: true })` and not a step passed in: the runners of
Submit record no print steps, so only the driver's own pre-run determines
where the differing line was printed, and an outdated difference cannot be
passed in.

**A step count includes the failing step** (R-11). A step is one call of
`next()`, and the call that fails is one; an error run therefore has
`total = events + 1`, step `total` has no event, and the last position of
the position bar is where the error is shown. A finished run is `done` on
reaching `total`, not one Step later: U-81 names that step "the last step
of the run", and the driver makes one further call of `next()` there so
that the frames have unwound.

**A comparison is narrated from the frame** (R-06, U-63). The `compare`
event carried the two operand values so that a template sentence could be
filled with them; the operands alone (`3` and `0` of `i % 15 == 0`) hide
where the 3 came from. The narration writes the comparison as the chart
does with each variable replaced by its value in the shown frame, which
shows the origin, so the event carries its result only. A list keeps its
name: its items were narrated by the `read` events before the comparison.

**The driver publishes the statement to highlight** (R-12, U-39). Expression
events carry the id of an expression, and the chart, the narration, and the
`Python` tab all need the statement that contains it. The driver already
holds the owner map for its marks, so it publishes `activeId` once rather
than each screen resolving the owner again.

## UI

<!-- `05-ui.md` -->

The UI is designed for a person who has never programmed (S-09), around
one task, building a program as a flowchart and observing it run, and one
loop per problem (S-10): read, build, run on one input, compare, fix,
submit, proceed. The rejected alternative, cards that read as code lines
with a blocks palette, a properties panel, and tabbed run panels, kept
control flow invisible, placed values in a table separated from the program,
and placed instructor tools at the same level as the core loop. The screens
behind the ids in `05-ui.md` are on the design canvas "AlgoFlow Screens"
(the flowchart and loop notation studies are on the earlier canvas "AlgoFlow
Redesign").

**The layout store validates on both paths** (U-03, U-24, U-60). Setters clamp, and
`mergePersisted` re-validates whatever is returned from `localStorage`: a
non-number or out-of-range size falls back to the default or the lower
limit, and the upper limit, half the viewport, is applied by `panelWidth()`
where the width is set and where it is drawn. Trusting the snapshot would
allow a hand-edited or stale entry to render an unusable panel. Because both
paths validate, a snapshot written under an older shape needs no `migrate`
step: its unknown fields resolve to the defaults, so `version` remains `1`.

**The key check scans with a regex, not a parser** (U-71). The pattern matches `t("…")` and
`t('…')` while ignoring `at(`, `obj.t(`, and template literals; it also
matches inside comments, which is accepted. A parser would be more precise
but adds a dependency to a script that must remain fast and simple. Test
files are skipped because they call `t()` with deliberately unknown keys.
Keys built at run time are not scanned; the `node.*` keys are checked
against the registry in `src/nodes/index.test.ts`.

**`en.json` holds only keys something renders** (U-71). Keys are added
with the code that uses them, so wording is decided when the UI exists and
the parity check never requires translating unused strings.

**The chart highlights the owning statement** (U-39, U-61). `compare`,
`read`, and `call` events carry expression ids while the chart has nodes
only for statements; `ownerStmts()` resolves them once per program. A
diamond's ✓/✗ comes from its last `compare`, or from the `loop` event of a
generated check, and clears when the diamond is entered again or a loop
containing it starts a new pass, so a loop shows the current iteration;
`not (a < b)` shows the inner compare, which is accepted.

**A flowchart, not sentence blocks or a node graph** (U-30). Three
directions were drawn. Sentence blocks keep branches as indented text and
never show two paths. A free node graph requires the learner to manage edge
drawing and loops manually and does not suit a structured `Program`. The
auto-laid-out flowchart shows Yes/No paths and loop-backs graphically and
keeps the AST as the source of truth.

**Loops are drawn as init, check, and step** (U-33, N-09). Three notations
were compared on the study "Loop notation: three options" of the canvas
"AlgoFlow Redesign". The JIS X 0121 / ISO 5807 loop-limit pair is the
standard form for counted loops and the one Japanese textbooks and the FE
exam use, and a dashed container is legible, but both conceal the check.
Python's `for i in range(...)` and JavaScript's `for (init; check; step)`
both run as init → check → body → step → check, and `while` is that
shape, so one form serves every loop and matches the execution order. The
form adds three nodes to every counted loop; they are generated, grey, and
owned by the loop block, so the learner does not edit them, the program
retains one `for`, and the emitter is unchanged. The check reads
`i < stop?` with the bound as written, not an inclusive
`Repeat i from 1 to n` (emitting `range(1, n + 1)`) and not a display-only
`Is i ≤ n?` for `x + 1` bounds: the check reads as the emitted `range`
does, so the chart and the `Python` tab agree (the third commitment of
`00-conventions.md`), and a display rule for one bound form would mix `<`
and `≤` across loops.

**The catalog is its plans** (U-10..U-14, C-16). "Day 1/2/3" tabs and a
"micrograd" tab grouped problems by course logistics; ordered study plans
state which problem to attempt next instead. With 38 problems the page is one
section per plan plus `More problems`: a flat list under a filter row
(topics, difficulty, status, search) suits thousands of problems, and here
its order would be the plans' order in any case. Topics
remain as tags so a problem outside the plans states what it practises. No
global progress meter and no "blocks used" column: neither assists a
beginner in choosing.

**The moment is on the chart, the state is in the panel** (U-23,
U-61..U-63). Data, Trace, and Output tabs under the program drew the
learner's attention away from it, so the current step stays on the chart:
the current node, the taken path, the `✓`/`✗` marks, and the narration beside
the node, which carries the values relevant at that step (`Pass 3: i is
3`, `(remainder of 3 divided by 15) = 0? No`). A badge with the loop variable
beside the loop's check was rejected: it is state, it sat beside a diamond
that is outside the viewport while a long body runs, which is when the pass
number is required, and extending it to `while` required an assumption about
which variables to show. The state does not fit on the chart: a card
positioned at the chart's top right covers the `Yes` branches that extend
rightwards, an output strip beside `End` is outside the viewport in any chart
longer than the window while the run scrolls to the current node, and a grid,
a tree, or an object graph requires substantial space. Variables and output
therefore live in the `Result` tab, beside the expected values. A trace table
(one row per event) serves instructors, not learners, and belongs to no
milestone.

**A loop pass starts with blank diamonds** (U-61). Clearing a mark only on
re-entry leaves a nested diamond that the current pass skips displaying the
previous pass's `✗`, which reads as "this condition is false now" for a
condition that was never evaluated. U-61 draws the current pass, so the
marks share that scope.

**Help is the keyboard table** (U-04). The keyboard actions have no other
surface, so a dialog holding that table plus the build → run → submit loop
is the minimal content the button can open. Directing it at the problem
description instead has no meaning on the Problems page, which has no
problem open.

**The input is a node, and Run and Submit share one view** (U-32, U-23,
C-15). A test-case panel under the chart duplicated the Input node;
choosing a case on the node is the same action as reading it. The case chosen
there has an expectation, so a Run shows `Expected` beside `Output` from
the first step and ends with that case's verdict; Submit is the same view
with one chip per case. The learner observes that Submit is Run on every
case, and the comparison step no longer waits for a submission.

**A Playground program goes back to the Playground** (U-01, U-05). The
page a Playground program is opened from is the Playground page, so its back
link leads there. `Open in Playground` on a Playground program would copy
it under the same title, which `⋯` has no reason to offer; the title of a
program opened from a problem is the problem's, because the program of a
problem has no title the learner ever sees.

**A drop cannot land inside the dragged node** (U-36). Moving a loop into
its own body has no result: the region would be removed with the
statement that holds it. Its connectors accept no drop rather than refusing
it with a message, because nothing a learner could change makes that drop
valid.

**A target is a name with forms** (U-94). An assignment's target is a
variable far more often than an item or a field, so the slot is the name
input of an `id` slot with its list; the item, key, and field forms
are offered from that list once their blocks exist, and their parts are
ordinary expression slots.

**A leading minus makes a number** (U-50). `found = -1` is the commonest
negative a learner types; requiring the unary minus from a group would make
it the one number not typed. The text is read by the parser, so `-1` is
the negation of `1`, as Python reads it, and `-3 ** 2` keeps Python's
meaning in the chart and the emitted code.

**An entry chosen after a value takes it as its first input** (U-53).
Building a value left to right is how it is typed and read, so whatever
follows a value applies to it: an operator, a word operation, a builtin.
Making the learner choose `abs` first and rebuild the value inside it
would cost two steps for what is one thought. An operator binds by the
precedence Python gives it, so `total + i × 2` reads and runs as it is
written, and the operations Python spells with keys (`%`, `//`, `**`,
`in`) bind the same way, so typed keys group as Python groups them; any
other word operation is a phrase around its inputs, so it takes the last
value only, and the brackets the chart draws around it (N-08) show what it
took. Inputs left to fill are fields in the line, reached with Tab.

**The Playground page reuses the Problems page** (U-15). Both pages list
rows under one header, so the Playground page takes the Problems page's
section card for its title, description, `Import…`, and `New`, and its row
style for the programs; a row needs only what tells two programs apart, the
title and the last edit. `Delete` asks first, in a dialog, because a
deleted program has no other copy and no undo reaches across pages; the
editor's undo history belongs to the open program.

**Python is opened, never shown** (U-25, U-20). A per-block Python fragment
and Python visible by default taught syntax before the flow was
understood. Python is a tab of the panel that nothing selects for the
learner; the Accepted view offers it (`See your program as Python`) because
the moment after solving is when code is worth introducing. A tab rather
than a pane to the right of the chart keeps the page at two regions at every
width; the cost, not seeing variables and code simultaneously, falls on a
reader who has chosen to view code and who still has the chart and its
narration.

**Blocks are added from the edge, edited in place** (U-34, U-41). A palette
requires a beginner to survey a vocabulary before writing; the `+` on the
edge where the block will be placed, followed by an editor popover on the
node, keeps the learner's attention on the chart.

**Solution revealed on request**. A learner may view the solution; hiding
it entirely would cause self-learners to look elsewhere.

**No editing while paused** (U-60). Replaying an edited program to the
same step count arrives at a different position in a different program, and
a rule that resynchronises by node breaks on the edited node; a learner
would interpret either outcome as the fix having moved the run. The
build/run boundary is retained, and the fix cycle is Stop, edit, Run.
`Run to this node` (a deterministic means of returning to a position of
interest) was recorded and not scheduled.

**Load the solution, then change it** (U-22). A read-only solution stops
the note's loop at "inspect"; loading it into the learner's chart as one
undoable edit continues to "modify". The same rule applies to built-in
modules (`Clone`): what the learner did not write is read-only until
copied, after which it is the learner's own. `Copy into this program`,
which copied one module function into a program where it shadowed the
module, was dropped: it was a second means of owning module code, and it
left a call that appears identical while resolving to something else
without indication. A learner's own module is edited
in place, a built-in one is cloned, and a `defines` problem is built, not
copied.

**Step over and `Open <name>`** (R-17, U-41). Reading a program at more
than one level of detail (the note's high, mid, and low levels) is a
run-time operation: Step over keeps the learner at the caller's level, and
`Open <name>` descends one level. Step (into) and Play still descend into
the program's own functions. Inline expansion of a call inside the caller's
chart was rejected: the flowchart loses legibility one level down, and a
function would have two editing locations.

**No `Make a function` from a selection**. Extracting statements into a
function needs parameter and return inference and a multi-select UI;
`Add function` in the path bar's `▾` (U-30) gives an empty function whose
body the learner builds, and choosing the parameters manually is where a
beginner learns what a parameter is.

**Cards, and no bars** (V-01, V-03, V-06). Bars show the pattern of a
list immediately and are the conventional sorting representation, but every
problem needs the number itself (`9 > 7`, evenness, `dp` values), and
converting a height back into a number is a cost a beginner incurs at every
step. No problem of the curriculum has a list of numbers longer than the
card limit, so bars would appear only as a switch no screen needs. A write
changes a card immediately: the orange highlight indicates the change and
the narration states the previous value. The swap slide is retained because
it is the only feature that distinguishes an exchange from two writes.

**The view switch lives outside the AST** (V-06, `algoflow:views`). A
view preference in `Program` would be exported, imported, and diffed with
the code; keying it by storage key and variable name in its own store
keeps L-53 and `Export` about the program only. A challenge never names a
view: the third commitment remains selection by value type, with the
learner's switch as the one override.

**Two regions, on every page** (U-03, U-20). Panel and chart, nothing
else: the `Result` tab absorbed the floating variables card and the output
strip, the `Python` tab absorbed the right-hand pane, and the transport is
docked under the chart. The panel may expand to half the viewport because a
grid, an object graph, or code needs the width, and with no third region
nothing competes for it. Playground and Module pages have the same panel
without the `Problem` tab, so the three editing pages share one skeleton.

**A path bar instead of tabs** (U-30, U-68). Tabs for `main`, functions,
and classes were a flat list, conveyed no call relationships,
overflowed at twenty charts, presented a trainee with a single `main` tab
beside a `+` prompting a function, and needed a second component while
running (a call-stack strip) plus a rule exchanging one for the other. One
path states the current position in both modes: in build mode the trail of
`Open <name>`, while running the call stack. It is always shown, even with
`main` alone: hiding it would remove the chart list and `Add function`
from the page, would make a new component appear at the moment functions are
introduced, and would need a display condition; shown, it introduces the
term `main` that the `Python` tab's `main.py` repeats. All charts side by
side on one canvas was rejected: three charts do not fit 960 px legibly.
Observed while drawing the board: full argument text does not fit a
segment, so only numbers, texts, and booleans are shown.

**A function's own operations sit on its `Start` node** (U-31). With tabs
removed the path bar remains purely navigational; the `Start name(params)`
terminal is the function's signature, so its editor holds the name, the
parameters, `Delete function`, and `Move to module…`. This also gives
parameters an editing location, which the tabbed design never stated.

**Run knows the end before it plays** (R-11, U-60, U-81). Execution is
deterministic and inexpensive, so Run executes everything first and then
replays. That informs the learner immediately that a loop never ends (at
playback speed `E_STEP_LIMIT` is five and a half hours away at speed 50),
gives the position bar its length, and lets a Wrong Answer move directly to
the step that printed the first wrong line instead of stepping there. Only
the count, the outcome, and the steps of the prints are kept, so a backward
Seek replays from the start, as Back has always done. Observed while drawing
the board: with the position bar the transport is too long to float over the
chart's corner without covering the loop's back edge, so it is docked.

**A wrong answer marks no node** (U-81, U-82). A runtime error has a
location, so its node is outlined. A wrong answer has a differing line and
the node that printed it, which is rarely the cause: a loop started at 0
prints `FizzBuzz` from a correct block. Marking that block asserted
what the application does not know, and adding the loop variable to the
hint only mitigated an incorrect mark. Red on the chart now means a runtime
error and nothing else. The route to the cause is one button,
`▶ Watch this case`, which opens the run paused at the first difference
(the `print` of the differing line, or the end of the run when nothing
printed it, which also covers a wrong variable); from there the values are
in `Result` and Back leads to the cause. A second button with a label per
kind of difference was dropped: the narration at the arrival step states
what happened there.

**No generated hint** (U-82, U-23). A sentence classifying the first
difference as a missing line, an extra line, or a different value had no
rule behind it, and none can be given: whether `FizzBuzz` against `1` is a
wrong value or one extra line that shifted the rest can only be inferred
from the following lines, and that inference fails (`1, 2, 3` against
`2, 4, 6` is read as an extra `1`); a full line diff infers differently and
no more reliably. It is the same fault as marking a block: stating what the
application does not know. The rows constitute the entire message: output
aligned by position with blank cells, and every expected variable as a row,
blank when the program never created it, which also reveals a misnamed
variable (`total` blank beside `sum_all 55`) with no special case. `Hint`
retains one meaning, the three authored hints of a challenge.

**One breakpoint and Skip, not `Next pass`** (R-19, U-60). Stepping is one
event, Step over has no effect before functions exist, and dragging the
position bar cannot arrive exactly at the start of a given pass, so a
coarser movement was needed. `Next pass` (run to the next `loop` event) was
a special case tied to one event type, and it failed its own purpose: in
bubble sort it stops at every inner pass, whereas the instructive unit is
one outer pass putting the largest item last, and it provides no way to
specify which loop is meant. A breakpoint specifies it by location: on the
outer loop it advances an outer pass, on a `print` it advances to the next
output, and nothing about passes or events has to be learned. It is kept to
the smallest form: one at a time, set by clicking a node during a run (a
click while playing pauses first, the rule the path bar uses), removed at
Stop, never stored, with one rule: the run pauses when it arrives there.
`Skip` advances without drawing to the next pause, or to the end, which
also replaces dragging the bar to its right end. It cannot be set in build
mode, where a click edits. Step over is retained: it is tied to calls, the
level of detail the design is built on. `Breakpoint` is the term used by
every debugger the learner will encounter later, as with `Module`,
`Clone`, and `Test`.

**Small rules settled with the boards** (U-33, U-40, D-22, U-85). A slot
drawn on a generated loop node is the loop's slot, so the rule for slots
(U-41) already makes `Set i to 0` the route to the start value, the most
common beginner error, with no rule of its own. The menu's categories are
ordered Basic, Control, List, because a beginner needs `if` and `for`
before list blocks. A module edited in another tab does not stop a run: the
run keeps the modules it started with, nothing fails because replay is
deterministic, and the next Run adopts the change, which needs neither a
stop nor a message explaining one. The refusal of a built-in function in a
`defines` problem names the module and both remedies. hanoi prints the
disk it moves, since `src` and `dst` are lists with no name to print; the
final lists verify the moves. Proposals dropped as special cases: filling a
`for` variable with the first unused of `i j k` (an inference, and
`create()` receives no context), and comparing step counts across the
three sorts (an inferred relation between problems, and one more stored
field).

**Four rules removed or corrected on a pass for special cases** (U-53,
C-03, L-26). The Variables group offered `v + 1` and `v - 1` when
the slot was an `index` or a `for` bound and a `for` variable was visible:
an inference about the learner's intent, tied to two block kinds, which
made the menu branch on kind against N-01; wrapping `i` with `+` or typing
the text achieves the same result. A boundary test was one whose localized
name began with `edge:`, a flag concealed in a display string, and the name
itself was displayed nowhere (cases are shown by their inputs) while still
requiring a Japanese text; the name was dropped and the flag is
`edge: true`. `foreach` iterated over a snapshot, so a
body that changes its list ran differently here and in the emitted Python,
without any indication, unlike the other differences from Python (a `bool`
is not a number, recursion stops at 200, `E_DECLARE_FIRST`), which are all
stricter and terminate in an error; it now visits the live list by index as
Python does, keeping the third commitment for learners' programs, which are
not checked against CPython.

**Run with diagnostics leads to the first one** (U-60). A disabled button
gives no reason; an enabled one that opens the chart holding the problem,
selects the node, and shows the message does. An empty slot is handled the
same way and is otherwise not an error (U-37): a block marked red at the
moment of insertion reports an error before the learner has finished
entering the value.

**After the run has ended, a click edits** (U-60). Once a run is `done` or
in `error` there is no position to preserve, so clicking a node leaves run
mode and opens its editor; after a runtime error that is the failing node,
one click from its correction. While paused there is a position, so leaving
requires an explicit `Stop`.

**One step is one event, and every event is narrated** (U-63). Grouping
events into one step per statement was considered; arrival followed by a
decision and arrival followed by a value change are two distinct
occurrences, consistent with the machine performing one operation at a
time, so event stepping is retained, with sentences added for `enter`,
`read`, `swap`, and the end. Python notation is excluded from the
narration.

**The `+` menu offers statements, in a beginner's order** (U-40). Listing
every registered block placed expression blocks at positions where they
cannot be inserted. Blocks that cannot be placed at the current connector
are shown disabled with the reason rather than hidden, which conveys that
they exist and where they apply. The bare `expr` statement block is
meaningless to a beginner and is hidden; it appears as method statements
and calls. Restricting the menu per challenge was rejected: it conceals the
language and adds authoring work. Observed while drawing the board:
built-in module groups would overfill a trainee's menu, so modules are
placed behind one `Modules ▸` row.

**Names come from the problem** (U-94). A verdict compares
`expect.variables` by name, so a learner who names `total` differently
fails without a visible reason; offering the expected names first removes
that failure mode. This is the problem's own contract, not a challenge
determining the appearance of the UI, so it does not affect the views
commitment. The names are a list under the field, as the values are, with
no limit and no fixed common names (`i`, `count`, `found`), which a
learner would read before the names the problem needs.

**The popover stays; in-node editing was rejected** (U-41, U-50). The
chart is shown fitted to its width, a diamond has little room, and a
value being built needs space at full size; the popover is always at
100 %. What changed is the cost of reaching it: a click on a slot drawn on
the node opens the editor focused on that slot, ready for typing. The popover
stays inside the chart region: one placed against the viewport flips over
the panel whenever the node's right side lacks room, and hides the
statement the learner is building from.

**A statement is a named action; a value is one line** (U-41, U-50, U-52). A
statement has few, fixed parts, so its sentence shows each as a field; a
value has any shape, so it is one line, typed or built from a list. The chip
editor nested a box per operation, so a value of three operations was three
levels of boxes, and editing one part meant finding its box; a line reads
left to right as the chart writes it. The list holds every entry, symbols
included, so nothing has to be known to be found, and its groups follow
purpose (`Calculate`, `Compare`, `Items`) rather than block categories,
because a learner looks for what to do with a value, not for where a block
is filed. A text is entered through `Text` alone, so no quote is typed and
none can be left out.

**Typing replaces a value the editor opens on** (U-53, U-41). A slot
reached by Tab holds a value already, `0` in a new `for`: a caret after it
would make every digit typed extend it (`01`), so the value is selected,
as a text field selects what it holds, and the first value typed replaces
it. An operator's key applies to the selection instead: an operator alone
is no value, so `*` on a selected `n` can only mean `n × …`. The editor
takes the keyboard only for a slot clicked or still to fill, the first such
slot when the node's words are clicked: one opened by a click on a
finished node leaves it with the chart, where Delete and the arrow keys
act on the node.

**The chart writes the block language** (N-08, U-33). Python stays in its
tab (U-25); the chart uses the symbols a learner knows from school (`+ − × ÷
( ) = ≠ < ≤ > ≥`) and words for everything else (`remainder of i divided by
15`, `count of nums`). `=` only compares: setting a variable is always `Set
… to`, so the two meanings Python separates as `=` and `==` never meet on
the chart. A word operation next to a symbol or inside another operation is
ambiguous without brackets (`remainder of i + 1 divided by 3`), so it is
bracketed; operators among themselves follow Python's precedence, so the
chart and the emitted code group alike. A variable is a bold word in its own
colour, not a box, which would cut the sentence into pieces.

**Keys are typed as Python spells them and shown as the chart writes
them** (U-93). `<=` already shows `≤`, so `==` shows `=` and `!=` shows
`≠` by the same rule; a single `=` is Python's assignment and inserts
nothing, so it is never read as a comparison. A word operation has a key
where Python has one (`%`, `//`, `**`), so a learner who later reads the
`Python` tab meets the keys already typed. `(` opens a pair of brackets
and `)` closes it, and brackets are not stored, so a bracket can never be
left unclosed.

**A node may be named, and the name is a comment** (U-95, L-58, E-11,
L-55). No generated sentence fits every expression, and a condition
written in symbols does not say what it is for; a name in the learner's
own words does, for any statement. A name is optional, in the learner's own
words, and never asked for; the named node shows the name alone, and the
statement stays one hover away and in the `Python` tab, where the name is
the comment above it. The `comment` block is removed with it: it drew
Python's `#` on the chart, and a named node says what it said where it
applies.

**Kinds choose the list** (L-59, U-52, N-11, U-50). After a value the list
offers what applies to that kind of value, so a list does not offer
`Multiply`; the kind comes from inputs and first assignments, which is known
without running. A kind that cannot be told shows every entry, and `Show
all` ends every list, so nothing is hidden by a wrong guess. It lists only
what can be chosen at the caret, so every row it shows acts; an operation
chosen where a value is expected is placed with its inputs empty. A typed
word searches every entry for the same reason. It matches the start of a
word only, since a match inside a word (`i` in `first`) is never the name
meant, and Enter takes the first match, so the kind's entries come before
the rest (`an` after a comparison is `And`). `Or` is explained as one side
or both, because in everyday English or often means only one.

**A diamond's narration asks and answers** (U-63). The diamond already
shows its verdict as `✓` or `✗` and colours the edge taken, so `is false,
so No` said a third time what the chart shows, with a word, `false`, found
nowhere else on it. The narration writes the diamond's question with the
values and the edge's label (`(remainder of 3 divided by 15) = 0? No`);
`true` and `false` remain for a comparison that is a value, such as one
side of `and`.

**The top bar holds only the loop's actions** (U-03, U-05). The title
is retained because it is the only indication of the learner's location
when the panel shows `Result` or is collapsed, and because Playground's
editable title and a module's name need the same slot. The difficulty badge
was removed: it assists in choosing a problem, not in solving one.
`Open in Playground` and Help are placed under `⋯`.

**The solution is shown where a chart fits** (U-22). A flowchart with
branches does not fit a 320 px panel, so the solution occupies the chart
region, read-only, beneath a band with `Load into my chart` and
`Back to my chart`. Hints became a section under the statement rather than
a tab, because a hint refers to the statement it would hide.

**A plan's end is said, not skipped** (U-83). With sections per plan,
the next row after the last course problem would place a trainee in the
first data-structure problem; `Plan complete` returns the choice to the
learner.

**A diamond is its condition and a question mark** (U-33). The
condition templates (`is divisible by`, `equals`, eight in all) named only
the conditions they listed: any other expression fell back to symbols, the
diamond then needed a second sentence per template (`Is x is divisible by
15?`), and a template was a third notation beside the chart's and
Python's. Without templates the diamond writes its condition in the
chart's own notation and adds `?`, which reads the same in every language;
`Is` in front of it was dropped for the same reason. Where a condition is
long or its purpose is not evident, the learner names the node (U-95).

**`break` and `continue` draw where they jump** (U-33, U-34, N-09). An edge to
the next node, the earlier drawing, is a path the run never takes, and a
learner reading the chart follows it. Both blocks declare
`requires: "loop"`, so only the kind distinguishes an exit from a jump to
the next pass, and the chart may not branch on the kind (N-01); each
therefore declares its jump in `chart`, as `if` and the loops declare their
regions, and the layout routes the edge from the declaration, so the two
work inside any loop block added later. A rule in the layout for the two
kinds was rejected for N-01, and a node with no edge states where control
does not go without stating where it goes. The edges leave by the right
like a `Return`'s and run down lanes inside the loop's right extent: `exit`
joins the `No` lane, and `next` meets the end of the body, at the step node
of a counted loop, where `continue` lands in Python's `for`, or at the
start of the back edge. A `Return` is identified by
`requires: "function"`: its edge runs to `End` along one vertical line on
the right. A `Return` or a jump carries the connector after it, since no
other edge leaves it. After a branch whose regions all return or jump there
is no edge and no connector.

**Routes are parsed by hand** (U-01, U-07). Six hash routes with at most
one parameter are a `parseRoute()` function and a `hashchange` subscription
through `useSyncExternalStore`; a router dependency would bring nested
layouts, loaders, and history modes that a hash-addressed single page does
not use. A route that names nothing falls back to the Problems page rather
than an error page, because every page is reachable from there.

**First launch counts the learner's work, once** (U-90). The layout store
writes `algoflow:layout` as soon as the panel is resized, so "no
`localStorage` data" would turn false without any problem having been
touched; progress and programs are what a learner's work leaves. The check
runs once per load: the tutorial records nothing until its first
submission, hint, or shown solution, so a check on every visit to the
Problems page would send `← Problems` straight back to the tutorial.

**A plan's button follows its progress** (U-12). `Start` on a plan with
entries would hide that the learner has begun; `Continue` on a plan with no
unsolved problem has no destination, so the button is removed rather than
pointed at a solved problem. `More problems` is omitted while empty for the
reason C-18 gives for plans: an empty section is inert.

**Markdown is a four-rule subset** (U-26). Challenge texts are written in
the repository and use paragraphs, code, bold, and italic; a markdown
library would add a dependency, an HTML sanitiser for its output, and
headings, tables, and links that a statement in a 320 px panel should not
contain. Rendering React elements from four rules emits no HTML string, so
nothing needs sanitising, and a construct outside the subset shows as typed
rather than failing.

**Fitting never enlarges** (U-38). A chart of three nodes fitted to a
960 px region would be drawn at several times its size, with text larger
than anything else on the page; fitting only shrinks a chart that is too
wide, and a small chart sits at 100 % in the middle. The bounds keep the
smallest text legible and the largest chart navigable; from 100 %, steps of 1.25
reach 200 % in four clicks and 25 % in seven.

**A loop that has ended loses its mark** (U-61). A `for` that ended kept the
`✓` of its last successful pass, because it never evaluates its check as an
expression, while the same loop written as a `while` showed the `✗` of its
failing compare. Emitting an event for the failed check would have changed
every event count of every finished loop; keeping the mark would leave a
`✓` on a check that has failed. The driver instead clears a loop's own
diamond at the first `enter` outside the loop, which needs no new event and
uses the body lists it already keeps for U-61. A loop that is the last
statement of its frame is followed by no `enter`, so its mark stays; the
narration at that point (`Finished in N steps`) already says the run is over.

**Running to a node is a click and Skip** (U-60, R-19). A learner who
wants a paused run to reach a node clicks it, presses `Skip`, and clears the
breakpoint by clicking again or with Esc. A `Run to this node` action would
have given nodes a context menu, which nothing else on the chart has, and a
modifier on the click has no touch equivalent and adds a key that works only
while running. The three actions are already specified and each is one
click.

**Run leaves the solution** (U-27). The solution band offers no Run of its
own: the solution is to be read, and its outcome is known. Running the
learner's program while the chart region shows the solution would put the
highlight, the marks, and the narration on a chart other than the one
running, so Run and Submit bring the learner's chart back first.

**A labelled edge is taken by its verdict** (U-61). `taken` lists the
statements of the current pass, which places both ends of a diamond's `Yes`
and `No` edges on the path whenever the diamond was entered. The diamond's
mark says which way the check went, so a `Yes` edge is drawn as taken when
the mark is `✓`, a `No` edge when it is `✗`, and an unlabelled edge when
both its ends are on the path. A loop that has ended has lost its mark
(U-61), so once control is elsewhere its `No` edge is drawn as taken when
what it leads to is on the path, whether a statement, the next loop's
junction, or a branch's merge.

**A submission is shown until the next run** (U-86, U-60, C-15). Submit
judges every test on runners of its own, and the tab cannot show a run's
rows and a submission's in 320 px, so the submission replaces the run's
rows; the next Run, including `Watch this case`, replaces it again. A chip
only chooses which test's rows are read: setting the Input nodes from it
would change the case under the chart, and `Watch this case` already sets
them. While running, the top bar holds only the run's own controls, as the
boards draw it: a verdict arriving during playback would replace the rows
of the run being watched, and a learner who has watched a run reaches
Submit with one `Stop`.

**While running, the case and the chart stay the run's** (U-27, U-32).
Choosing another case discards the runner (C-13), and showing the solution
would replace the running chart with one the run is not on, leaving the
transport without the chart it drives. Both are therefore unavailable until
`Stop`, as editing is (U-60): a learner who wants another case or the
solution stops first, which is one click and says what happens to the run.

**`Next problem` wraps round the plan** (U-83). After the plan's last row,
a learner who skipped an earlier problem has not completed the plan, so
`Plan complete` would be untrue; the first unsolved problem after the
current one, counting round from the plan's start, is the one the plan
still asks for. `Plan complete` therefore means every problem is solved.

**The panel's upper bound is applied with the viewport, not stored** (U-03).
The store held a constant maximum of 480 px from the retired shell. Half the
viewport width is not a constant, and a store that read `window.innerWidth`
would not run under the node test environment and would keep an outdated
bound after the window is resized. The store therefore keeps the requested
width with its lower bound only, and one pure function applies the upper
bound from the viewport width given to it, both when the handle sets the
width and when the page draws it, so a stored width above the bound is drawn
at the bound without being rewritten.

**Screenshots are compared with baselines only once no page is added**
(U-91). A baseline changes with every change to its screen, so comparing
while pages are still being added would turn each such pull request into a
baseline update and catch nothing; the screenshots are saved for review
until then.

**V-05 states no number** (V-05). A frame-time assertion in Playwright on
CI hardware is either too permissive to be meaningful or unreliable, and an
untested number may not appear in the specification, so V-05 keeps the
implementation constraint and the target, 32 ms per drawn step, is recorded
here.

## Challenges

<!-- `06-challenges.md` -->

**Input names are checked by `scripts/check.ts`, not by `validate()`**. Inputs
have no NodeId to attach a diagnostic to and are read-only in the editor
(U-31); challenge files are the only source, so the schema check covers L-01
for them.

**Challenges are bundled with `import.meta.glob`** (C-14). Fetching the JSON
at run time would need a manifest, asynchronous loading, and the Pages base
path; a generated module would add a build step. The glob is typed by
`vite/client`, works under Vitest, and the check script keeps reading from
disk. The types reside in a leaf module so `tsx` never evaluates the glob.

**Tests are judged on disposable runners** (C-15). The driver shows one run;
judging three tests through it would discard the learner's position. Each test
runs in R-11 batches with `setTimeout(0)` between them so a non-terminating
program cannot block the tab. `judge()` is shared with `scripts/check.ts` so
the Result tab and CI agree on C-10.

**Plans grow with the files** (C-18). C-16 makes `pnpm check` fail on an id
without a file, and a plan with no members would render an inert U-12 card
(`0 of 0 solved`, `Start` with no destination), so a plan enters
`plans.json` with its first member and lists the members that exist. The
plans are bundled by a static import in `src/challenges/plans.ts` rather
than the challenge glob of `index.ts`, which lets the glob exclude
`plans.json` with a negated pattern. Membership and order are not checked
against the S-05 table by code: copying the table into `scripts/` would
duplicate a spec fact, and making `plans.json` the authority would remove
the curriculum from the spec. `pnpm check` prints `in no plan: …` after
the plans line so an omitted entry is visible on every run.

**The tutorial prints two values** (S-05, C-22, L-29). `"Hello, " + name`
made the first action combine a text, an operator applied to a value,
and a variable, and its second hint explained wrapping before any problem had
introduced an operator. `print("Hello,", name)` prints the same line for
every test, because `print` joins its values with one space, and its first
action adds a second value to a slot that already holds one; `+` on text is
left to a later problem whose subject is operators. The instructor chose
it: the order in which a course introduces ideas is course content.

**Showing the solution is recorded** (C-17). `solution: true` requires an
entry, and a learner who only viewed the solution has used the problem as
much as one who took a hint; the entry is `attempted`. The key holds the
bare record, as C-17 writes it, through a custom storage of the persist
middleware.

## Modules

<!-- `08-modules.md` -->

A concept note of 2026-09-17, written without knowledge of the
project, describes an environment in which any block can be opened, its
implementation inspected, and a learner's own abstraction reused in a
larger program. The blocks of `03-nodes.md` are its lowest level and a
function is its middle level; what the spec lacked was a way to keep a
function beyond one program, the loop that makes a learner build one, and
the run-time controls that let a program be read at more than one level of
detail. The entries below record what was taken from the note and what
was not; those on the plans are under Scope, and those on Step over and on
editing while paused under UI.

**A module is a function that outlives its program** (08-modules). Its
semantics are a function's; the difference is ownership and lifetime: a
function belongs to one `Program`, a module belongs to the learner and is
referenced by many programs: defined once, parameterised, called from any
program, and edited in one place with the change reaching every use. A
`Program` holds one program only, so that layer is added outside
`Program`. `Module` was chosen over `Functions` (collides with the block
menu's `Function` category and a program's own functions, excludes classes,
cannot group a `heap`) and `Library` (a single flat collection, and already
used in `docs/` for dependencies); it is the Python word, the learner
encounters it again as `import`, and it groups `heap_push`, `heap_pop`, and
`heapify` the way the note's data-structure tree does.

**A module uses no other module** (D-05). Module-to-module imports need
dependency order, cycle detection, and a second `from … import` layer in
E-09; nothing in the curriculum needs them, so `micrograd` is one module
rather than `engine` and `nn`. The rule can be lifted when a plan needs a
module built on another; the trigger is a challenge whose `module` would
have to call another learner module.

**A learner module shadows a built-in one** (D-02, D-11). The note's
"rebuild it from basic blocks" needs the learner's version to take
precedence under the same name, or every later problem would have to be
told which one to use. `Clone` is the entry to editing a built-in module
and makes the shadowing explicit on the Modules page; the word was chosen
over `Copy to my modules` because, like `Module`, it is one the learner
encounters again when programming.

**Modules are emitted as files, not inlined** (E-02, E-09, U-25). Inlining
a module's functions into `main.py` would make the `Python` tab state
something the chart does not (one program) and hide the module the learner
built.
`from heap import heap_push, heap_pop` plus `heap.py` in its own tab states
exactly what the chart states, keeps every file copyable into a Python
interpreter, and introduces the term the learner will need. Calls remain
unqualified (`heap_push(h, x)`), because `heap.push(h, x)` would collide
with the method syntax of G-03.

**A module call is one step; its interior is reachable by one click**
(R-16, R-11, D-18, D-06). The note's "Extract Minimum can be used as a
single operation, and opened" is taken literally: in a program's run a
module function is a block, narrated by its returned value, and
`Open <name>` shows its interior. Opening it in a second browser tab keeps
the program, even a paused run, exactly as it was, so no context is lost;
and the Module page receives that call's arguments and runs the one
function in isolation, which locates a bug in `heap_pop` more directly than
stepping through hundreds of steps of `dijkstra` to reach it. While the
learner is still building a function it belongs to the program and is
stepped into; `Move to module` is the point at which it becomes a block.
Showing the module's chart in place within the program page was rejected:
it needed a second, shared-edit mode of the same page. The position bar
counts visible steps while `Done.steps` counts every event, so
`dijkstra-heap` still shows fewer steps than `dijkstra-grid` on the
Accepted view. Costs: a `storage` listener so other tabs observe a module
edit (D-22), and two tiled windows fall below the 1280 px gate (S-02), so
the second tab is used as a tab.

**Modules have cases because a module change reaches every program**
(D-19..D-21). The absence of a challenge had been read as the absence of
tests, but a module is where tests matter most: editing `backward_step` for
the `tanh` problem can break every solved problem that uses it, and the
module is where that is detected. A case is a saved run (arguments,
returned value, arguments afterwards), the same idea as a recorded
expectation (C-20), so no test is written from an empty starting point;
`Test` is the established programming term, distinct from a problem's
`Submit`. Cases recorded from an accepted submission were rejected: no rule
selects suitable calls (the first `heap_push` of a test pushes onto an
empty heap, and a recursion produces thousands of calls), they would fix
the learner's own behaviour as correct, and they omit the act of judging a
result. Instead a learner module inherits the built-in module's cases for a
function of the same name: written by the author, with edge cases, checked
in both engines, and able to detect what the problem's tests do not.
`toValue` rebuilding one object per `$id` (L-06) is what lets an object
graph be a case argument or be transferred to the Module page.

**`heap_push` and `heap_pop`** (D-16). `push`/`pop` as module functions
would appear beside the list method `pop` in the block menu and be confused
with it (`pop(h)` versus `h.pop()`); the prefixed names follow
`heapq.heappush` and keep the module's name in every call.

**The module store names no service** (D-14). `localStorage` is sufficient
for a three-day course on one machine, and export files cover
transfer between machines; a server would justify its accounts only once
sharing between learners or synchronisation across devices becomes a goal.
Keeping every read and write behind one store lets that decision be taken
later without modifying callers, and the specification does not commit to a
vendor.

## Engineering

<!-- the stack, tooling, and tests -->

**`@types/node` stays on the major of `.node-version`**. CI runs Node 22;
types from a later major would accept APIs that Node 22 lacks, and every
check would still pass, so a bump of `@types/node` follows `.node-version`.

**Rules turned off**.

- `react/react-in-jsx-scope`: the automatic JSX runtime (`jsx: react-jsx`)
  never needs `React` in scope; the rule reports every element.
- `jsx-a11y/prefer-tag-over-role`: the resize handle is an interactive
  `role="separator"` (a splitter); `<hr>` is a static separator.
- `require-yield`: literal and variable runners are generators that never
  yield, by design.
- `unicorn/no-thenable`: 02-language names the `if` regions `then` and
  `else`.
- `no-redundant-type-constituents`: `Id | "main"` and `NodeId | "main"` are
  written as in the spec to document intent.
- `no-await-in-loop` in `e2e/`: Playwright assertions in a loop are
  intentionally sequential; `Promise.all` would race the browser.

**Warnings do not fail `pnpm lint`**. Most warnings are
`no-unsafe-type-assertion` where something the type checker cannot follow
establishes a value's shape, such as the registry's slot list or a check
after `JSON.parse`; expressing each in the types is not justified.

**Custom resize handle instead of `react-resizable-panels`**. U-03
states limits in pixels; the library works in percentages, and the handle
is approximately sixty lines with pointer capture. It also avoids one
dependency that nothing requires.

**Chromium only, 1440 × 900**. One browser keeps CI under one minute
and matches the desktop-only scope (S-02); the viewport exceeds the 1280 px
gate with margin for the default panel sizes.

**No React Testing Library**. Unit tests cover stores, `t()`, and script
logic; component behaviour is exercised end to end by Playwright (U-91). Installing a DOM testing library for components that are largely
placeholders would add a second, slower means of testing the same behaviour.

**`pnpm check` is one script**. pnpm appends command-line arguments to the end
of the script string, so `tsx scripts/check.ts && tsx scripts/i18n.ts` would
pass `challenges/x.json` to the i18n script; `check.ts` invokes the i18n check
itself instead.

**The end-to-end tests load a solution through storage**. C-13's restore path
places a finished program on the page in one step; building each one through
the `+` menu would make every test of running or submitting depend on the
editor, which the editing tests and the build of FizzBuzz from an empty chart cover. A
development-only affordance would be untested UI.

## Process

<!-- how work proceeds -->

**The specification states no schedule** (00-conventions). A plan file in
the specification held three kinds of statement: the schedule (`M-`), the
engineering constraints (`P-`), and the test obligations (`T-`). Each had a
second copy elsewhere: the schedule in every GitHub milestone's description
and in the prompts that started each milestone, the constraints in
`CLAUDE.md` and the configuration files, and every deferred feature in the
specification carried a milestone tag that went stale whenever work moved.
Each fact now has one home. A milestone's description and its issues hold
the scope and the exit criterion. `CLAUDE.md` and the configuration hold the
engineering choices, and the rule that `src/lang`, `src/runtime`,
`src/python`, and `src/nodes` import only each other is a lint rule,
because a rule a machine checks needs no reviewer. It covers `src/nodes`
because the other three import it, so a package reaching `src/nodes` would
reach them all. A specification file whose statements a test suite
establishes ends with those tests, so a test obligation sits beside the
statements it covers.

**Identifiers link statements to tests and to writing about them**
(00-conventions). A test that names the ids it verifies is found by a
search when its statement changes, and a document, an issue, a pull
request, a review finding, or a decision can point at one exact statement;
a check's message names the statement it enforces so that its author finds
the rule. Ids in code
comments added a second map from statements to code that nothing checked:
the tests already lead from a statement to the code that meets it, and a
comment's id went stale silently when its statement or its code changed.
Ids in commit messages repeated the pull request's Why section. The
numbering needs no more rule than "the next number": a deleted statement
takes its citations in the repository with it, and an old issue or pull
request that cites a number later given to a new statement is read as the
record of its own time. Keeping deleted statements as "withdrawn" text, or
listing their numbers, guarded only that rare case and cost every reader of
the specification.

**A milestone is split into issues when it starts** (`/milestone`). One task
issue per part a person can see working gives the milestone its progress,
lets the pull request close each part by number, and lets a part move to
another milestone. Issues written months ahead would describe screens whose
boards are not settled and would be rewritten before use, so a milestone
holds its scope in its description until its session splits it. The split
is marked by the description itself: once every part of its `Scope:`
paragraph is an issue, the paragraph is replaced by a pointer to the issues, so the scope
always has exactly one home and an unrelated issue filed under the
milestone earlier does not count as a split.

**One pull request per milestone** (`CLAUDE.md`). A milestone's exit
criterion is a path through the running application, and a pull request
that ends halfway shows screens that cannot be judged. Pull requests split
by size had to be stacked, because nobody merges while a session runs:
every base had to be retargeted, `Closes` had no effect until a merge into
`main`, every check ran again per branch, and one `en.json` change became a
rebase conflict. The reviews read the whole diff in any case. Granularity
stays in the commits: each is a vertical slice that passes lint and tests,
specification changes come first, and rebase merges keep them on `main`. A
part that does not depend on the rest may still have its own pull request
from `main`.

**The milestone prompt is a skill** (`/milestone`). A session began with a
pasted prompt, kept outside git, that repeated the milestone's scope, listed
the ids to read, and restated the session's procedure. The scope is on the
milestone and its issues, the ids are in each issue's Spec section, and the
procedure is a tracked skill, so starting a milestone is one command and its
procedure is reviewed and versioned like the code.

**Two reviews before the pull request** (`/milestone`). `/code-review` reads
the diff for defects; a subagent reads it against the specification and
reports only a violated id or behaviour no id requires, each with a
scenario. The narrow brief keeps preferences out and finds where the code
went beyond the specification, which is where an id is missing. Each review
finds defects the other does not.

**No handoff file**. A file rewritten at the end of every session and read
at the start of the next held the state of the repository (git and the pull
requests state it), what a session built (the code states it), open
questions (issues state them, with a milestone and a history), and tool
behaviour (`CLAUDE.md` states it and is loaded at every start). It was one
more copy of the same facts, diverged between sessions, and, being
untracked, was the one file a reset could lose.

**Boards are exported into the repository**. The screens are drawn on design
canvases, which open only for the people they are shared with. A canvas
cannot be reviewed in a pull request or diffed when a board changes. A PNG in
`docs/design/` for each board, with a README naming what each shows and
where the specification deviates, gives every reader the same source; the
canvas remains the tool for drawing, and the specification remains the
authority. A board that a later board or the specification has replaced has
no PNG, because a PNG in the repository is read as the source of a screen.
The canvas links sit in `docs/design/README.md` beside the export procedure,
because whoever re-exports a board needs them, and a link reveals nothing
to anyone without access.

**Issues carry the questions; the specification carries the answers**. The
specification states facts and never history, so an open question has no
place in it. An issue keeps the question with its reasons and its age, is
assigned to the milestone that needs the answer, and is closed by the pull
request that writes the id, which is where the answer belongs. Four labels
are sufficient because they answer the one question a session asks of an
issue: whether it requires a decision, a fix, a merge of two copies, or a
measurement first.

**One template per kind of issue; spec ids follow the facts they cite**. An
issue is written from the template of its kind: Summary, the sections of its
kind (Observed and Cause, Options, Copies, Cost, Steps), Spec, and Done
when. Done when states the condition that closes the issue. The milestone is
the issue's Milestone field and is not repeated in the body. Spec states
each statement that applies as a sentence ending in its id, so the issue is
readable without the ids and the ids lead to the specification; the title
and Summary carry no id, so the issue list and the first paragraph state the
problem in words. A `decision` may open with Observed, because a gap in the
specification can show in what the code does. A section that does not apply
states `None` and the reason, because a section that does not apply and a
section omitted in error are otherwise indistinguishable. One template for
all kinds was rejected: it had no section for a decision's options, a
debt's copies, or a cost, and its `Where` line put a bare id before the
problem was stated.

**A pull request states what it closes**. The pull request template has
Closes, because GitHub closes an issue on merge only when the body names it,
and Screenshots, because a pull request that changes a screen carries its
images (U-91). A checklist was not added: the template asks for pasted
command output, and a ticked box is an assertion.
