# UI decisions

Why the statements of this folder were chosen, and the alternatives
rejected (`docs/spec/README.md`, Reasons).

**One task and one loop per problem** (S-09, S-10, U-03, U-30). The UI is
built for a person who has never programmed, around one task, building a
program as a flowchart and observing it run, and one loop per problem:
read, build, run on one input, compare, fix, submit, proceed. Cards that
read as code lines with a blocks palette, a properties panel, and tabbed
run panels were rejected: they keep control flow invisible, place values in
a table separated from the program, and place instructor tools at the same
level as the core loop.

## Pages

**The layout store validates on both paths** (U-03, U-24, U-60). Setters
clamp, and `mergePersisted` re-validates whatever is returned from
`localStorage`: a non-number or out-of-range size falls back to the default
or the lower limit, and the upper limit, half the viewport, is applied by
`panelWidth()` where the width is set and where it is drawn. Trusting the
snapshot would allow a hand-edited or stale entry to render an unusable
panel. Because both paths validate, a snapshot written under an older shape
needs no `migrate` step: its unknown fields resolve to the defaults, so
`version` remains `1`.

**The key check scans with a regex, not a parser** (U-100). The pattern
matches `t("…")` and `t('…')` while ignoring `at(`, `obj.t(`, and template
literals; it also matches inside comments, which is accepted. A parser would
be more precise but adds a dependency to a script that must remain fast and
simple. Test files are skipped because they call `t()` with deliberately
unknown keys. Keys built at run time are not scanned; the `node.*` keys are
checked against the registry in `src/nodes/registry.test.ts`.

**`en.json` holds only keys something renders** (U-71, U-101). Keys are added
with the code that uses them, so wording is decided when the UI exists and
the parity check never requires translating unused strings.

**The catalog is its plans** (U-10, U-12, U-13, U-14, C-16). "Day 1/2/3"
tabs grouped problems by course logistics; ordered study plans state which
problem to attempt next instead. The page is one section per plan: a flat
list under a filter row (topics, difficulty, status, search) suits
thousands of problems, and here its order would be the plans' order in any
case. Topics remain as tags so a row states what it practises. No global
progress meter and no "blocks used" column: neither assists a beginner in
choosing.

**Help is the keyboard table** (U-04). The keyboard actions have no other
surface, so a dialog holding that table plus the build → run → submit loop
is the minimal content the button can open. Directing it at the problem
description instead has no meaning on the Problems page, which has no
problem open.

**A Playground program goes back to the Playground** (U-01, U-05). The
page a Playground program is opened from is the Playground page, so its back
link leads there. `Open in Playground` on a Playground program would copy
it under the same title, which `⋯` has no reason to offer; the title of a
program opened from a problem is the problem's, because the program of a
problem has no title the learner ever sees.

**The Playground page reuses the Problems page** (U-15). Both pages list
rows under one header, so the Playground page takes the Problems page's
section card for its title, description, `Import…`, and `New`, and its row
style for the programs; a row needs only what tells two programs apart, the
title and the last edit. `Delete` asks first, in a dialog, because a
deleted program has no other copy and no undo reaches across pages; the
editor's undo history belongs to the open program.

**Python is opened, never shown** (U-25, U-20). A per-block Python fragment
and Python visible by default would teach syntax before the flow is
understood. Python is a tab of the panel that nothing selects for the
learner; the Accepted view offers it (`See your program as Python`) because
the moment after solving is when code is worth introducing. A tab rather
than a pane to the right of the chart keeps the page at two regions at every
width; the cost, not seeing variables and code simultaneously, falls on a
reader who has chosen to view code and who still has the chart and its
narration.

**Solution revealed on request** (U-21, U-22). A learner may view the
solution; hiding it entirely would cause self-learners to look elsewhere.

**Load the solution, then change it** (U-22). A read-only solution would
leave the learner reading it; loading it into the learner's chart as one
undoable edit lets them change it. The same rule applies to built-in
modules (`Clone`): what the learner did not write is read-only until
copied, after which it is the learner's own. `Copy into this program`,
copying one module function into a program where it shadows the module,
was rejected: it would be a second means of owning module code, and it
would leave a call that appears identical while resolving to something
else without indication. A learner's own module is edited
in place, a built-in one is cloned, and a `defines` problem is built, not
copied.

**Two regions, on every page** (U-03, U-20). Panel and chart, nothing else:
the `Result` tab absorbed the floating variables card and the output strip,
the `Python` tab absorbed the right-hand pane, and the run's controls are
the run bar at the canvas's foot. The panel may expand to half the viewport
because a grid, an object graph, or code needs the width, and with no third
region nothing competes for it. Playground and Module pages have the same
panel without the `Problem` tab, so the three editing pages share one
skeleton.

**The top bar holds no run action** (U-03, U-05, U-60, U-80). With `Run`
and `Submit` in the top bar and the run's other controls in a bar under
the chart, starting a run and pausing it would be at opposite edges of the
page, and `Submit`, which judges every case and records the attempt, would
sit beside `Run`, which tries one case: the two read as one weight and one
is pressed for the other. The top bar holds only where the learner is and
what applies to the whole page: the title, which is the only
indication of the learner's location when the panel shows `Result` or is
collapsed and the slot Playground's editable title and a module's name
need, undo and redo, and `⋯` with `Open in Playground` and Help. It has
no difficulty badge, which assists in choosing a problem, not in solving
one.

**The solution is shown where a chart fits** (U-22). A flowchart with
branches does not fit a 320 px panel, so the solution occupies the chart
region, read-only, beneath a band with `Load into my chart` and
`Back to my chart`. Hints are a section under the statement rather than a
tab, because a hint refers to the statement a tab would hide.

**First launch counts the learner's work, once** (U-90). The layout store
writes `algoflow:layout` as soon as the panel is resized, so "no
`localStorage` data" would turn false without any problem having been
touched; progress and programs are what a learner's work leaves. The check
runs once per load: the tutorial records nothing until its first
submission, hint, or shown solution, so a check on every visit to the
Problems page would send `← Problems` straight back to the tutorial.

**A plan's button follows its progress** (U-99). `Start` on a plan with
entries would hide that the learner has begun; `Continue` on a plan with no
unsolved problem has no destination, so the button is removed rather than
pointed at a solved problem.

**Markdown is a four-rule subset** (U-26). Challenge texts are written in
the repository and use paragraphs, code, bold, and italic; a markdown
library would add a dependency, an HTML sanitiser for its output, and
headings, tables, and links that a statement in a 320 px panel should not
contain. Rendering React elements from four rules emits no HTML string, so
nothing needs sanitising, and a construct outside the subset shows as typed
rather than failing.

**Run leaves the solution** (U-27). The solution band offers no Run of its
own: the solution is to be read, and its outcome is known. Running the
learner's program while the canvas shows the solution would put the
highlight, the marks, and the narration on a chart other than the one
running, so Run and Submit bring the learner's chart back first.

**While running, the case and the chart stay the run's** (U-27, U-32).
Choosing another case discards the runner (C-13), and showing the solution
would replace the running chart with one the run is not on, leaving the
run bar without the chart it drives. Both are therefore unavailable until
`Stop`, as editing is (U-60): a learner who wants another case or the
solution stops first, which is one click and says what happens to the run.

**The panel's upper bound is applied with the viewport, not stored** (U-03).
Half the viewport width is not a constant, and a store that read
`window.innerWidth` would not run under the node test environment and would
keep an outdated bound after the window is resized. The store therefore
keeps the requested width with its lower bound only, and one pure function
applies the upper bound from the viewport width given to it, both when the
handle sets the width and when the page draws it, so a stored width above
the bound is drawn at the bound without being rewritten.

**Screenshots are compared with baselines only once no page is added**
(U-91). A baseline changes with every change to its screen, so comparing
while pages are still being added would turn each such pull request into a
baseline update and catch nothing; the screenshots are saved for review
until then.

## Chart

**The chart highlights the owning statement** (U-39). `compare`, `read`,
and `call` events carry expression ids while the chart has nodes only for
statements; `ownerStmts()` resolves them once per program.

**A diamond's mark answers its whole condition** (U-108, R-35). The mark is
the answer to the diamond's question, so it comes from the `compare` of the
whole condition and never from a comparison inside it: the last inner
compare of `not (a < b)` or `a < b and c < d` is not that answer, and a
condition such as `found` or `stack` contains no comparison at all.

**A flowchart, not sentence blocks or a node graph** (U-30). Three
directions were drawn. Sentence blocks keep branches as indented text and
never show two paths. A free node graph requires the learner to manage edge
drawing and loops manually and does not suit a structured `Program`. The
auto-laid-out flowchart shows Yes/No paths and loop-backs graphically and
keeps the AST as the source of truth.

**Loops are drawn as init, check, and step** (U-33, N-09, N-16). Three notations
were compared on the study "Loop notation: three options" of the Claude
Design file "AlgoFlow Redesign". The JIS X 0121 / ISO 5807 loop-limit pair
is the standard form for counted loops and the one Japanese textbooks and
the FE exam use, and a dashed container is legible, but both conceal the
check. Python's `for i in range(...)` and JavaScript's `for (init; check;
step)` both run as init → check → body → step → check, and `while` is that
shape, so one form serves every loop and matches the execution order. The
form adds three nodes to every counted loop; they are generated, grey, and
owned by the loop block, so the learner does not edit them, the program
retains one `for`, and the emitter is unchanged. The check reads `i < stop?`
with the bound as written, not an inclusive `Repeat i from 1 to n` (emitting
`range(1, n + 1)`) and not a display-only `Is i ≤ n?` for `x + 1` bounds:
the check reads as the emitted `range` does, so the chart and the `Python`
tab agree (the third commitment of `docs/spec/README.md`), and a display
rule for one bound form would mix `<` and `≤` across loops.

**The input is a node, and Run and Submit share one view** (U-32, U-23,
C-15). A test-case panel under the chart duplicated the Input node;
choosing a case on the node is the same action as reading it. The case chosen
there has an expectation, so a Run shows `Expected` beside `Output` from
the first step and ends with that case's verdict; Submit is the same view
with one chip per case. The learner observes that Submit is Run on every
case, and the comparison step no longer waits for a submission.

**A drop cannot land inside the dragged node** (U-36). Moving a loop into
its own body has no result: the region would be removed with the
statement that holds it. Its connectors accept no drop rather than refusing
it with a message, because nothing a learner could change makes that drop
valid.

**Blocks are added from the edge, edited in place** (U-34, U-41). A palette
requires a beginner to survey a vocabulary before writing; the `+` on the
edge where the block will be placed, followed by an editor popover on the
node, keeps the learner's attention on the chart.

**No `Make a function` from a selection** (U-30). Extracting statements
into a function needs parameter and return inference and a multi-select UI;
`Add function` in the path bar's `▾` (U-30) gives an empty function whose
body the learner builds, and choosing the parameters manually is where a
beginner learns what a parameter is.

**A path bar instead of tabs** (U-30, U-68). Tabs for `main`, functions,
and classes would be a flat list, convey no call relationships, overflow at
twenty charts, present a trainee with a single `main` tab beside a `+`
prompting a function, and need a second component while running (a
call-stack strip) plus a rule exchanging one for the other. One
path states the current position in both modes: in build mode the trail of
`Open <name>`, while running the call stack. It is always shown, even with
`main` alone: hiding it would remove the chart list and `Add function`
from the page, would make a new component appear at the moment functions are
introduced, and would need a display condition; shown, it introduces the
term `main` that the `Python` tab's `main.py` repeats. All charts side by
side on one canvas was rejected: three charts do not fit 960 px legibly.
Full argument text does not fit a segment, so only numbers, texts, and
booleans are shown.

**A function's own operations sit on its `Start` node** (U-31). Without
tabs the path bar is purely navigational; the `Start name(params)`
terminal is the function's signature, so its editor holds the name, the
parameters, `Delete function`, and `Move to module…`. This also gives
parameters an editing location, which the tabbed design never stated.

**A slot drawn on a generated node is the loop's** (U-33, U-41). A slot
drawn on a generated loop node is the loop's slot, so the rule for slots
(U-41) already makes `Set i to 0` the route to the start value, the most
common beginner error, with no rule of its own.

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

**A diamond is its condition and a question mark** (U-33). Condition
templates (`is divisible by`, `equals`) would name only the conditions
they list: any other expression would fall back to symbols, the diamond
would need a second sentence per template (`Is x is divisible by 15?`),
and a template would be a third notation beside the chart's and Python's.
Without templates the diamond writes its condition in the chart's own
notation and adds `?`, which reads the same in every language, and for the
same reason no `Is` stands in front of it. Where a condition is
long or its purpose is not evident, the learner names the node (U-95). A
text wider than 150 px is set on two lines, as the artboards draw it: a
diamond is 1.4 times as wide as its text, so one long line makes it far
wider than the boxes around it, and a split that leaves the longer line
shortest keeps it near their width.

**`break` and `continue` draw where they jump** (U-33, U-34, N-09). An edge
to the next node would be a path the run never takes, and a learner
reading the chart would follow it. Both blocks declare
`requires: "loop"`, so only the kind distinguishes an exit from a jump to
the next pass, and the chart may not branch on the kind (N-14); each
therefore declares its jump in `chart`, as `if` and the loops declare their
regions, and the layout routes the edge from the declaration, so the two
work inside any loop block added later. A rule in the layout for the two
kinds was rejected for N-14, and a node with no edge states where control
does not go without stating where it goes. The edges leave by the right
like a `Return`'s and run down lanes inside the loop's right extent: `exit`
joins the `No` lane, and `next` meets the end of the body, at the step node
of a counted loop, where `continue` lands in Python's `for`, or at the
start of the back edge. A `Return` is identified by
`requires: "function"`: its edge runs to `End` along one vertical line on
the right. A `Return` or a jump carries the connector after it, since no
other edge leaves it. After a branch whose regions all return or jump there
is no edge and no connector.

**Fitting never enlarges** (U-38). A chart of three nodes fitted to a
960 px region would be drawn at several times its size, with text larger
than anything else on the page; fitting only shrinks a chart that is too
wide, and a small chart sits at 100 % in the middle. The bounds keep the
smallest text legible and the largest chart navigable; from 100 %, steps of 1.25
reach 200 % in four clicks and 25 % in seven.

## Editor

**A target is a name with forms** (U-94, U-105). An assignment's target is a
variable far more often than an item or a field, so the slot is the name
input of an `id` slot with its list; the item, key, and field forms
are offered from that list, and their parts are
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
other entry takes the expression the list was chosen for (U-52): the list
offers `As text` after `i < n` because the comparison is a true/false
value, and applying it to `n` alone would apply what no row suggested and
fail when run. The brackets the chart draws around a word operation (N-08)
show what it took, and brackets typed first limit it to a part. Inputs
left to fill are fields in the line, reached with Tab.

**The Variables group offers no `v + 1`** (U-52). Offering `v + 1` and
`v - 1` there when the slot is an `index` or a `for` bound and a `for`
variable is visible would be an inference about the learner's intent, tied
to two block kinds, and would make the menu branch on kind against N-14;
wrapping `i` with `+` or typing the text achieves the same result.

**The `+` menu offers statements, in a beginner's order** (U-40). Listing
every registered block placed expression blocks at positions where they
cannot be inserted. Blocks that cannot be placed at the current connector
are shown disabled with the reason rather than hidden, which conveys that
they exist and where they apply. The bare `expr` statement block is
meaningless to a beginner and is hidden; it appears as method statements
and calls. Restricting the menu per challenge was rejected: it conceals the
language and adds authoring work. Built-in module groups would overfill a
trainee's menu, so modules are
placed behind one `Modules ▸` row. The menu's categories are ordered
Basic, Control, List, because a beginner needs `if` and `for` before list
blocks.

**Names come from the problem** (U-94). A verdict compares
`expect.variables` by name, so a learner who names `total` differently
fails without a visible reason; offering the expected names first removes
that failure mode. This is the problem's own contract, not a challenge
determining the appearance of the UI, so it does not affect the views
commitment. The names are a list under the field, as the values are, with
no limit and no fixed common names (`i`, `count`, `found`), which a
learner would read before the names the problem needs.

**A name field sets its name when chosen** (U-103). A name set with every
key would create `t`, `to`, and `tot` on the way to `total`, each a
variable of its own: the chart would switch between `Create` and `Set` at
every key, and the name list would offer names that exist only while being
typed. The list offers the name typed as `New variable`, so choosing it
costs one key, Enter.

**The popover stays; in-node editing was rejected** (U-41, U-50). The
chart is shown fitted to its width, a diamond has little room, and a
value being built needs space at full size; the popover is always at
100 %. Reaching it costs one click: a click on a slot drawn on the node
opens the editor focused on that slot, ready for typing. The
popover stays inside the canvas: one placed against the viewport flips
over the panel whenever the node's right side lacks room, and hides the
statement the learner is building from. It opens on the node's right
always: one that turns below or above a node in the middle of the canvas
covers the nodes the learner builds from, while a chart moved left as a
scroll keeps the node in view and is followed as any scroll is.

**A statement is a named action; a value is one line** (U-41, U-50, U-52). A
statement has few, fixed parts, so its sentence shows each as a field; a
value has any shape, so it is one line, typed or built from a list. A chip
editor nests a box per operation, so a value of three operations is three
levels of boxes, and editing one part means finding its box; a line reads
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

**Small rules of the value line** (U-50, U-53, U-54, U-93, U-103). A word
that names nothing holds the key typed after it, so `totl+` does not turn
into a `+` with nothing before it; the underline and the explanation line
show what to correct. `Did you mean` allows one letter in three, since two
letters on a short word reach unrelated names (`totl` and `Not`). A number
Python rejects (`07`) is not taken, so the line holds only what the
`Python` tab can print. An operator's key at an input still to fill does
nothing, because an operator needs the value before it; `-` there is the
sign. Backspace at an operation's empty first input moves left: removing
the operation would take the value typed after it too. For the same reason
Backspace at a later empty input moves left while another input after the
first holds a value (`f(a, b, …)` keeps `b`); with none, it removes the
operation, as deleting the operator of `a + …` does. Enter in a name
field not typed in keeps the name and moves on, since the learner has read
it and accepts it.

**The explanation line shows an input by its value** (U-96). Naming each
input in words (`position`) would need a name for every input of every
operation in every language, while the help of each entry (N-02) already
says in a sentence what its inputs are; the underline in the template
shows which input the caret is in, and the line above shows what it holds.

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
the comment above it. There is no `comment` block: it would draw
Python's `#` on the chart, and a named node says what a comment would say,
where it applies.

**Kinds choose the list** (L-59, U-52, N-11, U-50). After a value the list
offers what applies to that kind of value, so a list does not offer
`Multiply`; the kind comes from inputs and first assignments, which is known
without running. A group names what is done with a kind of value:
`Calculate` with a number, `Conditions` with a true/false value, `Items`
with a list, a dict, or an object, and `Compare` and `Convert` with any, so
after a value the learner reads its kind's group first and the two shared
ones after it. `Combine` was dropped because `Not` combines nothing and the
word suggests joining texts or lists, which sat elsewhere; `Other` because a
group named for nothing is where an entry is never looked for; `Totals` and
`Order` because a group of one or two rows is a heading to read for nothing;
`Functions` because its rows (`Larger of two`, `Random whole number`) are
calculations, and the word is one a beginner meets only when building a
function, so the group is `Your functions` and holds those alone. One order
holds everywhere, so `Show all` reads as the list does with more rows. A
kind that cannot be told shows every entry, and `Show all` ends every list,
so nothing is hidden by a wrong guess. It lists only what can be chosen at
the caret, so every row it shows acts; an operation chosen where a value is
expected is placed with its inputs empty. A typed word searches every entry
for the same reason. It matches the start of a word only, since a match
inside a word (`i` in `first`) is never the name meant, and a name field's
list (U-102) filters by the same rule. Enter takes the first match, so the
kind's entries come before the rest (`an` after a comparison is `And`). `Or`
is explained as one side or both, because in everyday English or often means
only one.

## Run

**The moment is on the chart, the state is in the panel** (U-23, U-61,
U-115, U-108, U-62, U-63, U-116). Data, Trace, and Output tabs under the
program would draw the learner's attention away from it, so the current step
stays in the canvas: the current node, the taken path, and the `✓`/`✗` marks
on the chart, and the narration in one line under it (U-63), which carries
the values relevant at that step (`Pass 3: i is 3`,
`(remainder of 3 divided by 15) = 0? No`). A badge with the loop variable
beside the loop's check was rejected: it is state, it would sit beside a
diamond that is outside the viewport while a long body runs, which is when
the pass number is required, and extending it to `while` would require an
assumption about which variables to show. The state does not fit on the
chart: a card positioned at the chart's top right covers the `Yes` branches
that extend rightwards, an output strip beside `End` is outside the viewport
in any chart longer than the window while the run scrolls to the current
node, and a grid, a tree, or an object graph requires substantial space.
Variables and output therefore live in the `Result` tab, beside the expected
values. A trace table (one row per event) serves instructors, not learners.

**A loop pass starts with blank diamonds** (U-109). Clearing a mark only on
re-entry leaves a nested diamond that the current pass skips displaying the
previous pass's `✗`, which reads as "this condition is false now" for a
condition that was never evaluated. U-61 draws the current pass, so the
marks share that scope.

**No editing while paused** (U-60). Replaying an edited program to the
same step count arrives at a different position in a different program, and
a rule that resynchronises by node breaks on the edited node; a learner
would interpret either outcome as the fix having moved the run. The
build/run boundary is retained, and the fix cycle is Stop, edit, Run.

**Step over and `Open <name>`** (R-17, U-41, U-60). Reading a program at
more than one level of detail is a run-time operation: Step over keeps the
learner at the caller's level, and `Open <name>` descends one level. Step
(into) and Play still descend into the program's own functions. Inline
expansion of a call inside the caller's chart was rejected: the flowchart
loses legibility one level down, and a function would have two editing
locations.

**Run knows the end before it plays** (R-23, U-60, U-81). Execution is
deterministic and inexpensive, so Run executes everything first and then
replays. That informs the learner immediately that a loop never ends (at
playback speed `E_STEP_LIMIT` is eighteen hours away at the fastest speed),
gives the position bar its length, and lets a Wrong Answer move directly to
the step that printed the first wrong line instead of stepping there. Only
the count, the outcome, and the steps of the prints are kept, so a backward
Seek replays from the start, as Back does. With the position bar the run's
controls are too long to float over the chart's corner without covering the
loop's back edge, so they form a bar docked at the canvas's foot.

**A wrong answer marks no node** (U-81, U-82). A runtime error has a
location, so its node is outlined. A wrong answer has a differing line and
the node that printed it, which is rarely the cause: a loop started at 0
prints `FizzBuzz` from a correct block. Marking that block would assert
what the application does not know, and adding the loop variable to the
hint would only mitigate an incorrect mark. Red on the chart means a
runtime error and nothing else. The route to the cause is one button,
`▶ Watch this case`, which opens the run paused at the first difference
(the `print` of the differing line, or the end of the run when nothing
printed it, which also covers a wrong variable); from there the values are
in `Result` and Back leads to the cause. A second button with a label per
kind of difference was dropped: the narration at the arrival step states
what happened there.

**No generated hint** (U-82, U-23). A sentence classifying the first
difference as a missing line, an extra line, or a different value has no
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
event, Step over equals Step in a program without functions, and dragging
the position bar cannot arrive exactly at the start of a given pass, so a
coarser movement is needed. `Next pass` (run to the next `loop` event) would
be a special case tied to one event type, and it fails its own purpose: in
bubble sort it stops at every inner pass, whereas the instructive unit is
one outer pass putting the largest item last, and it provides no way to
specify which loop is meant. A breakpoint specifies it by location: on the
outer loop it advances an outer pass, on a `print` it advances to the next
output, and nothing about passes or events has to be learned. It is kept to
the smallest form: one at a time, set by clicking a node during a run (a
click while playing pauses first, the rule the path bar uses), removed at
Stop, never stored, with one rule: the run pauses when it arrives there.
`Skip` advances without drawing to the next pause, or to the end, which also
replaces dragging the bar to its right end. It cannot be set in build mode,
where a click edits. Step over is retained: it is tied to calls, the level
of detail the design is built on. `Breakpoint` is the term used by every
debugger the learner will encounter later, as with `Module`, `Clone`, and
`Test`.

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

**One step is one event, and every event is narrated** (U-63, U-117).
Grouping events into one step per statement was considered; arrival followed
by a decision and arrival followed by a value change are two distinct
occurrences, consistent with the machine performing one operation at a time,
so a step is one event, and every event and the end have a sentence. Python
notation is excluded from the narration.

**A diamond's narration asks and answers** (U-116). The diamond already
shows its verdict as `✓` or `✗` and colours the edge taken, so
`is false, so No` would say a third time what the chart shows, with a word,
`false`, found nowhere else on it. The narration writes the diamond's
question with the values and the edge's label
(`(remainder of 3 divided by 15) = 0? No`); `true` and `false` remain for a
comparison that is a value, such as one side of `and`. A condition that is
one variable keeps its name (`found? Yes`, `n? Yes`): the question asks
whether that variable holds and the answer says it, so its value in the
name's place would drop the question, and for a boolean (`true? Yes`) say
the verdict twice.

**The run is one bar** (U-60, U-03). Every control of a run sits in the run
bar at the canvas's foot, under the chart it drives, in build mode as in
run mode. `Run` and `Play` as two buttons would serve one intention, to
make the run go on, the first pre-running and starting, the second
resuming. One play button takes `Run`'s place and reads `Pause`, `Play`,
or, at the last step, `Replay`, which seeks to step 0 and plays, so the
button a learner pressed to start is the one that pauses. The pre-run
(R-23) happens behind `Run`.

**The narration is a line under the chart** (U-63, U-65). A tooltip beside
the current node would move with every step, cover the node it describes
whenever the chart is narrower than the tooltip, and leave the viewport
with a node near its edge. One line between the chart and the run bar is
always in the same place, so the eye learns where the sentence is, it
never covers the chart, and it reads the same at every zoom. The chart
keeps what belongs to a place: the current node, the taken path, and the
`✓`/`✗` marks. A runtime error's message takes the same line in the error
colour.

**`Submit` sits with the cases it checks** (U-80, U-23, D-20). `Submit` is
beside the case selector of the `Result` tab, the list it judges and the
place its verdict and chips appear, so the button and its answer are in one
place and away from `Run`. A module's `Test` sits there for the same reason.

**Three speeds** (R-26, U-60). A slider of 1 to 50 steps a second would ask
for a number a beginner has no use for. Three choices cover the uses: `Slow` (1)
to follow each step, `Normal` (4) to watch a loop go round, and `Fast` (15)
to reach a later point while still seeing the chart move; further jumps
are `Skip` and the position bar.

**A plan's end is said, not skipped** (U-83). With sections per plan,
the next row after the last course problem would place a trainee in the
first data-structure problem; `Plan complete` returns the choice to the
learner.

**A loop that has ended loses its mark** (U-109). A `for` that ends would
keep the `✓` of its last successful pass, because it never evaluates its
check as an expression, while the same loop written as a `while` shows the
`✗` of its failing compare. Emitting an event for the failed check would
change every event count of every finished loop; keeping the mark would leave a
`✓` on a check that has failed. The driver instead clears a loop's own
diamond at the first `enter` outside the loop, which needs no new event and
uses the body lists it already keeps for U-109. A loop that is the last
statement of its frame is followed by no `enter`, so its mark stays; the
narration at that point (`Finished in N steps`) already says the run is over.

**Running to a node is a click and Skip** (U-60, R-19). A learner who
wants a paused run to reach a node clicks it, presses `Skip`, and clears the
breakpoint by clicking again or with Esc. A `Run to this node` action would
have given nodes a context menu, which nothing else on the chart has, and a
modifier on the click has no touch equivalent and adds a key that works only
while running. The three actions are already specified and each is one
click.

**A labelled edge is taken by its verdict** (U-61, U-108). `taken` lists the
statements of the current pass, which places both ends of a diamond's `Yes`
and `No` edges on the path whenever the diamond was entered. The diamond's
mark says which way the check went, so a `Yes` edge is drawn as taken when
the mark is `✓`, a `No` edge when it is `✗`, and an unlabelled edge when
both its ends are on the path. A loop that has ended has lost its mark
(U-109), so once control is elsewhere its `No` edge is drawn as taken when
what it leads to is on the path, whether a statement, the next loop's
junction, or a branch's merge.

**A submission is shown until the next run** (U-86, U-106, U-60, C-15). Submit
judges every test on runners of its own, and the tab cannot show a run's
rows and a submission's in 320 px, so the submission replaces the run's
rows; the next Run, including `Watch this case`, replaces it again, and so
does a change of the program, since the verdict judged the program as it
was before. A chip
only chooses which test's rows are read: setting the Input nodes from it
would change the case under the chart, and `Watch this case` already sets
them. While running, `Submit` is disabled: a verdict arriving during
playback would replace the rows of the run being watched, and a learner who
has watched a run reaches Submit with one `Stop`.

**A refused built-in function names its module** (U-85). The refusal of a
built-in function in a `defines` problem names the module and both
remedies.

**`Next problem` wraps round the plan** (U-83). After the plan's last row,
a learner who skipped an earlier problem has not completed the plan, so
`Plan complete` would be untrue; the first unsolved problem after the
current one, counting round from the plan's start, is the one the plan
still asks for. `Plan complete` therefore means every problem is solved.

## Views

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

**V-05 states no number** (V-05). A frame-time assertion in Playwright on
CI hardware is either too permissive to be meaningful or unreliable, and an
untested number may not appear in the specification, so V-05 keeps the
implementation constraint and the target, 32 ms per drawn step, is recorded
here.
