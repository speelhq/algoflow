# Run

## Running

U-60 The run bar at the foot of the canvas holds `▶ Run` in build mode.
`Run` with diagnostics present does not start: it shows the chart of the
first node with a diagnostic, selects that node, and shows its message
(U-37); `Submit` does the same. Otherwise `Run` pre-runs the program (R-23)
with the Input nodes' values and puts the page in run mode: editing is
disabled, and the run bar holds, from its left, one play button in place
of `▶ Run` (`❚❚ Pause` while playing, `▶ Play` while paused, and `↺ Replay`
at the run's last step, which seeks to step 0 and plays), `|◀ Back`,
`Step ▶|`, `Step over` (R-17), `Skip ▶▶` (R-19), the position bar `step k
of N`, which can be dragged to any step (R-27 Seek), the speed as three
choices `Slow`, `Normal`, and `Fast` (R-26), and `■ Stop`. Playback starts
playing at the remembered speed (`Normal` at first, persisted under
`algoflow:layout`); `▶ Watch this case` (U-81) starts paused. A run whose
pre-run ends in `E_STEP_LIMIT` reports it (`run.endless`) before playback.
`Stop` returns to build mode; once the run has ended, in `done` or `error`,
clicking a node also returns to build mode and opens that node's editor.
Before that, clicking a node sets the breakpoint on it (R-19), pausing
first when the run is playing; clicking the node that holds it, or Esc,
clears it. The node shows a breakpoint mark (`run.breakpoint`), and the run
pauses each time it arrives there; `Skip` continues to the next arrival
without drawing the intervening steps, or to the end of the run when no
breakpoint is set.

U-61 While running, the edges and nodes of the current pass are drawn in
the taken-path colour, the current node has the accent outline and is
scrolled into view, and a diamond shows `✓` or `✗` after its check (from
its `compare`, or from the `loop` event of a generated check), cleared when
the diamond is entered again and when a loop containing it starts a new
pass (its `loop` event clears every diamond in its body); a loop's own
diamond is also cleared at the first `enter` of a statement outside that
loop, so a loop that has ended shows no mark once the run has moved on.

U-62 No variable's value is drawn on the chart: the current values
are in the narration (U-63), every variable is in the `Result` tab (U-23),
and the call stack is the path bar (U-68).

U-63 While running, the narration line, one line between the chart and
the run bar, describes the last event in one sentence (`run.narrate.*`): `enter` → `Checking
(remainder of i divided by 3) = 0` for a condition and the block's sentence
otherwise; `read` → `Read item 2 of nums: 5`; `compare` → the comparison
as the chart writes it (N-08), every variable that holds a number, a text,
a boolean, or none written as its value in the shown frame: for a
diamond's whole condition, its question and the answer
(`(remainder of 3 divided by 15) = 0? No`, `3 < 15 + 1? Yes`), and for any
other comparison, the comparison and its value (`3 < 10 is true`); `write`
→ `i is now 3`; `swap` → `Swapped items 1 and 2 of nums`; `loop` →
`Pass 3: i is 3`; `print` → `Printed "Fizz"`; `call` → `Calling f(2)`;
`return` → `f returned 4`, which is the sole narration of a module call
(R-11); the end of the run → `Finished in 124 steps`; an error → the
message (U-70). Values are written as the blocks write them: `true`,
`false`, `none`, a text in quotes. A named node is narrated by its
statement, not its name. A `read` of several items → `Read 3 items of
nums`; a `loop` without a variable → `Pass 3`; a field is written `next of
node`, a dict's key `counts at "a"`; a list that no variable of the frame
references is rendered as `a list` (`run.narrate.ref.*`).

U-65 A runtime error outlines the failing node in the error colour, shows
the message (U-70) in the narration line in the error colour, stops
playback, and leaves the path bar
on the failing frame's stack; an error inside a module function is shown on
the node that called it, whose `Open <name>` carries that call's arguments
(D-18).

U-68 While running, the path bar is the call stack: `main` first, one
segment per frame, the last one running; the chart shows the running
frame and follows it on every `call` and `return`, and Back and Seek show
the frame of the step they reach. A module function's frame is never a
segment: its call is one step (R-11). A segment reads `name(args)` with
numbers, texts, and booleans shown and any other argument as `…`, adjacent
ones merged; beyond `main` and the last three segments the middle
collapses to `… n`, which lists them on click. While paused, clicking a
segment shows that frame's chart with the call it awaits marked and that
frame's variables in `Result` (U-23); the next step returns to the running
frame. While playing, the click pauses first.

## Submission

U-80 `Submit`, beside the case selector of the `Result` tab (U-23), judges
every test on its own runner (C-10, C-11, C-12, C-15), records the attempt
(C-17), and selects the `Result` tab.

U-81 A failed submission shows `Wrong Answer`, `k of n cases passed`, one
chip per case (`✓`/`✗`, the first failing one selected), and for the
selected case the rows of U-23 with the first differing one marked, and
`▶ Watch this case`, which sets the Input nodes to that case and starts a
run paused at the first difference (R-27 Seek): the step of the `print`
that produced the first differing line, or the last step of the run when
no `print` produced it or a variable differs. The narration there
identifies which (`run.narrate.difference`: `This printed line 1`, shown at
that step in place of the event's sentence;
`The run ended here`); the position bar returns to step 0.

U-82 A wrong answer is shown as its rows and nothing else: no sentence is
generated about the difference, and no node is marked on the chart; only a
runtime error marks a node (U-65). `Hint` names the three authored hints of
a challenge (C-22) and nothing generated.

U-83 An accepted submission shows `Accepted`, one `✓` chip per case, the
steps and loops of the first case, `What you used` (the challenge's
`takeaway`, C-01), `Move to module <name>` when the challenge names a
module (C-19) and the program has a function or class (the D-09 operation),
`See your program as Python`, which selects the `Python` tab, `Compare with
the solution` (U-22), `Open in Playground` (U-05), and `Next problem →`
(the first unsolved problem of the current plan after this one, wrapping to
the plan's start; once every problem of the plan is solved, the next row of
its section) or, after the last problem of a plan with every problem
solved, `Plan complete` with `Back to Problems`; the problem becomes
solved (C-17).

U-86 After `Submit` the `Result` tab shows the submission in place of the
run's rows until the next `Run`, the next `▶ Watch this case`, or a change
of the program: the verdict, the case chips, and, for a wrong answer, the
rows of the selected chip's test (U-81).

U-106 A chip of a wrong answer selects which test's rows are shown and
changes neither the Input nodes nor the run (C-15); the chips of an
accepted submission select nothing.

U-84 A test that ends in a runtime error shows its message (U-70) in place
of `Output`.

U-85 A submission in which a name listed in `defines` (C-21) resolves to
a built-in module shows, in place of a verdict, `{name} comes from the
built-in module {module}. Build it in this program, or Clone the module
and build it there.` (`result.builtin`), and records nothing.

## Verification

The screenshots of U-91 (`pages.md`) cover Run, Wrong Answer, Accepted, and
Run inside a function.
