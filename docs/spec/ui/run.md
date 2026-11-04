# Run

A run plays the program on the chart, and a submission judges the
program against every test of its challenge. This file states the run
bar, the path and marks on the chart, the narration, how a runtime error
shows, the call stack, and the submission.

## Run bar

The run bar at the foot of the canvas holds the run's controls, because
they are too long to float over the chart's corner without covering a
loop's back edge.

In build mode, the run bar holds `▶ Run`.

### Starting a run

With diagnostics present, neither `Run` nor `Submit` starts. Instead,
each:

- shows the chart of the first node with a diagnostic
- selects that node's statement
- shows its message (`chart.md`, Editing on the chart)

An empty slot is reported only this way, because a block drawn red when
inserted would report an error before the learner had finished its value.

`Run` is never disabled for a diagnostic, because a disabled button gives
no reason.

When no diagnostic is present, `Run` pre-runs the program
(`interpreter.md`, Steps and batches) with the Input chart nodes' values
and puts the page in run mode.

Run mode disables editing. Editing stays disabled while paused, because
an edited program replayed to the same step arrives somewhere else, and
resynchronizing by node id breaks on the edited block.

Playback starts at the remembered speed. The speed is `Normal` at first
and persists under `algoflow:layout`.

A run starts playing, except that a run started by `Watch this case`
starts paused (Submission, Watching a case).

A run whose pre-run ends in `E_EVENT_LIMIT` reports it before playback.
`run.endless` says that the run was stopped before it reached its end. A
notice that the run never reached its end was rejected, because a run
that is only long would send the learner looking for a loop that doesn't
end.

`run.endless` is followed by the error's message (`pages.md`, Messages).
The message holds the hint, so the catalog holds the hint once.

### Controls in run mode

In run mode, the run bar holds, from its left:

- one play button in place of `▶ Run`: `❚❚ Pause` while playing,
  `▶ Play` while paused, and `↺ Replay` at the run's last step, which
  seeks to step 0 and plays
- `|◀ Back`, `Step ▶|`, `Step over`, and `Skip ▶▶` (`interpreter.md`,
  Controls)
- the position bar `step k of N`, which the learner can drag to any step
- the speed, as three choices: `Slow`, `Normal`, and `Fast`
- `■ Stop`

`Run` and `Play` are one button because both start playback, so the
button pressed to start is the one that pauses.

`Stop` returns to build mode.

Once the run has ended, in `done` or `error`, clicking a chart node also
returns to build mode and opens its owner's editor. A click edits after
the end because a finished run has no position to keep, so the failing
chart node of an error is one click from its correction.

### Breakpoint

Before the run has ended, clicking a chart node sets the breakpoint on it
(`interpreter.md`, Controls). A `Run to this block` action was rejected,
because it would give chart nodes a context menu, which nothing else on
the chart has, and a modifier on the click has no touch equivalent.

When the run is playing, a click on a chart node pauses the run first.

Before the run has ended, clicking the chart node that holds the
breakpoint, or pressing Esc, clears the breakpoint.

The chart node that holds the breakpoint shows it (`run.breakpoint`).

The run pauses each time it arrives at the breakpoint.

`Skip` continues to the next arrival without drawing the steps in
between. When no breakpoint is set, `Skip` continues to the end of the
run.

In build mode, a click edits and sets no breakpoint.

## Path and marks

In run mode, the chart shows the path and the marks of the shown
frame's current pass.

A diamond's mark is the `✓` or `✗` that it shows after its check.

### The path

The path is the chart nodes and edges of the running frame's current
pass. The path holds these edges:

- a `Yes` edge, when its diamond's mark is `✓`
- a `No` edge, when its diamond's mark is `✗`
- an unlabeled edge, when both its ends are on the path
- once control has left a loop that has ended, the loop's `No` edge, when
  what it leads to is on the path: a statement, the next loop's junction,
  or a branch's merge

The marks decide the labeled edges because the path holds both ends of a
diamond's `Yes` and `No` edges whenever the diamond was entered.

In run mode, the chart draws the path in the taken-path color.

A `call` starts the called chart with no path and no marks, as a loop's
new pass does (Clearing a mark). A `return` gives back the caller's path
and marks as they were.

A frame shown by a click on its segment (Call stack) shows its own path
and marks.

In run mode, the chart outlines the current chart node in the selection
color and scrolls it into view.

### What a mark shows

A diamond's mark is the result of one of these:

- the `compare` of its whole condition (`interpreter.md`, Events)
- the `loop` event of a generated check

A mark is never the result of a comparison inside the condition, because
the last inner compare of `not (a < b)` or `a < b and c < d` isn't the
answer, and `found` holds no comparison at all.

### Clearing a mark

The driver clears a diamond's mark:

- when the diamond is entered again
- when a loop containing it starts a new pass: the loop's `loop` event
  clears every diamond in its body

A new pass clears the mark because clearing a mark only on re-entry would
leave a diamond that the current pass skipped showing the previous pass's
`✗`, which reads as false now for a condition never evaluated.

The driver also clears the mark of a loop's own diamond at the first
`enter` of a statement outside that loop, so a loop that has ended shows
no mark once the run has moved on. A loop that is the last statement of
its frame is followed by no `enter` and keeps its mark. An event for a
`for`'s failed check was rejected, because it would change the event
count of every finished loop.

### No values on the chart

The chart draws no variable's value, because the current values are in
the narration (Narration), every variable is in the `Result` tab
(`pages.md`, Result tab), and the call stack is the path bar (Call
stack). These alternatives were rejected:

- tabs of data, trace, and output under the program, because they draw
  attention away from it
- a badge with the loop variable beside a loop's check, because it would
  be out of view while a long body runs and, for a `while`, would need a
  guess of what to show
- a card at the chart's top right, because it covers `Yes` branches
- an output strip beside `End`, because it is out of view in a long chart
- a trace table, because it serves instructors, not learners

## Narration

In run mode, the narration line describes the event of the step
(`lastEvent`) in one sentence (`run.narrate.*`):

| What happened | Sentence |
| --- | --- |
| `enter` | `Checking i % 3 = 0` for a condition, and otherwise `Running` and its notation (`Running total ← total + i`) |
| `read` | `Read nums[2]: 5`, or for several items `Read 3 items of nums` |
| `compare` | the comparison as the chart writes it (`blocks.md`, Notation), with every variable that holds a number, a text, a boolean, or none written as its value in the frame the event ran in, then `is` and the comparison's value (`3 < 10 is True`); for a diamond's whole condition, its question and answer (below) |
| `write` | `i is now 3` |
| `swap` | `Swapped nums[1] and nums[2]` |
| `loop` | `Pass 3: i is 3`, or without a variable `Pass 3` |
| `print` | `Printed "Fizz"` |
| `call` | `Calling f(2)` |
| `return` | `f returned 4`, which is the only narration of a module call (`interpreter.md`, Steps and batches) |
| the end of the run | `Finished in 124 steps` |
| an error | the message (`pages.md`, Messages) |

The narration line is one line between the chart and the run bar. A
tooltip beside the current chart node was rejected, because it would
move with every step, cover the chart node it describes, and leave the
view near an edge.

Values are written as `pages.md`, Values on one line, states.

A block with a caption is narrated by its statement, not its caption.

### Conditions

The `compare` of a diamond's whole condition is narrated as the diamond's
question and the label of the edge taken, because `is false, so No` would
say a third time what the mark and the edge show, with a word found
nowhere on the chart.

The narration writes the condition as it writes a comparison
(Narration). For example: `3 % 15 = 0? No`, `3 < 15 + 1? Yes`.

A condition that is one variable instead keeps its name, because its
value in its place would drop the question. For example: `found? Yes`,
not `True? Yes`.

### Locations

The narration names a location by the variable that holds it in the
frame the event ran in. It writes the location as the chart writes it:

- an item as `nums[2]`
- a field as `node.next`
- a dict's key as `counts["a"]`

A list that no variable of that frame references is `a list`
(`run.narrate.ref.*`).

## Errors

A runtime error:

- outlines the failing chart node in the error color
- shows the message (`pages.md`, Messages) in the narration line, in the
  error color
- stops playback
- leaves the path bar on the failing frame's stack

The chart shows an error inside a module function on the chart node of
the statement that called it. That chart node's `Open <name>` carries that
call's arguments (`modules.md`, Operations).

## Call stack

In run mode, the path bar is the call stack: one segment per frame,
with `main` first and the running frame last.

The chart shows the running frame and follows it on every `call` and
`return`. Expanding a call inline in the caller's chart was rejected
because the flowchart becomes hard to read one level down, and the
learner would have two places to edit a function.

Back and Seek show the frame of the step they reach.

A module function's frame is never a segment, because its call is one
step (`interpreter.md`, Steps and batches).

A segment reads `name(args)`, with numbers, texts, and booleans shown and
any other argument written as `…`. Adjacent `…` are merged into one.

Beyond `main` and the last three segments, the middle segments collapse
to `… n`. A click on `… n` lists them.

While paused, clicking a segment shows that frame:

- its chart, with the call it awaits highlighted
- its variables in `Result` (`pages.md`, Result tab)

The next step returns to the running frame.

While playing, a click on a segment pauses first.

## Submission

`Submit`, beside the case selector of the `Result` tab (`pages.md`,
Result tab), judges every test on its own runner (`challenges.md`,
Judging). It records the attempt (`challenges.md`, Progress) and selects
the `Result` tab.

In run mode, `Submit` is disabled, because a verdict arriving during
playback would replace the rows being watched.

A change of the program while `Submit` is judging abandons the
submission: no verdict is shown and no attempt is recorded
(`challenges.md`, Progress).

A submission in which a name listed in `defines` (`challenges.md`,
Modules and definitions) resolves to a built-in module records nothing.
In place of a verdict, it shows `{name} comes from the built-in module
{module}. Build it in this program, or Clone the module and build it
there.` (`result.builtin`).

### The submission in the `Result` tab

After `Submit`, the `Result` tab shows the submission instead of the
run's rows, because the tab can't show a run's rows and a submission's in
320 px.

The tab shows the submission until one of these:

- the next `Run`
- the next `Watch this case`
- a change of the program

A change of the program ends the submission's display because a changed
program is no longer the one judged.

### Wrong Answer

A failed submission shows:

- `Wrong Answer`
- `k of n cases passed`
- one chip per case, `✓` or `✗`, with the first failing one selected
- for the selected case, the rows of the `Result` tab, with the first
  differing one highlighted
- `▶ Watch this case`

A chip of a wrong answer selects which test's rows are shown. It changes
neither the Input chart nodes nor the run (`challenges.md`, Judging).
Setting the Input chart nodes is left to `Watch this case`, so a chip
never changes the case under the chart.

A test that ends in a runtime error shows its message (`pages.md`,
Messages) in place of `Output`.

A wrong answer is shown as its rows and nothing else.

The chart node that printed a differing line is rarely the cause. For
example: a loop started at 0 prints `FizzBuzz` from a correct block.

So the application points to no chart node, because pointing to that
chart node would assert what the application doesn't know.

`Watch this case` and Back lead to the cause instead. Only a runtime
error points to a chart node (Errors).

The application generates no sentence about the difference, because a
sentence that classes the difference as a missing line, an extra line, or
a different value has no rule behind it. For example: `1, 2, 3` against
`2, 4, 6` reads as an extra `1`.

`Hint` names the three authored hints of a challenge (`challenges.md`,
Hints) and nothing generated.

### Watching a case

`Watch this case` sets the Input chart nodes to the selected case and
starts a run paused at the first difference (`interpreter.md`, Controls).

The first difference is one of these steps, and the narration there says
which (`run.narrate.difference`):

- the step of the `print` that produced the first differing line, where
  `This printed line 1` takes the place of the event's sentence
- the last step of the run, when no `print` produced it or a variable
  differs, where the narration says `The run ended here`

The position bar returns to step 0.

### Accepted

An accepted submission shows:

- `Accepted`
- one `✓` chip per case
- the events and loops of the first case
- `What you used`: the challenge's `takeaway` (`challenges.md`, Schema)
- `Move to module <name>`, when the challenge names a module
  (`challenges.md`, Modules and definitions) and the program has a
  function or class (`modules.md`, Operations)
- `See your program as Python`, which selects the `Python` tab
- `Compare with the solution` (`pages.md`, Problem tab)
- `Open in Playground` (`pages.md`, Help and `⋯`)
- either `Next problem →`, or `Plan complete` with `Back to Problems`

The chips of an accepted submission select nothing.

The problem becomes solved (`challenges.md`, Progress).

The count of events includes every event (`Done`), a module's included.
The count is the work done, not the visible steps of the position bar,
so `dijkstra-heap` shows fewer events than `dijkstra-grid`, although each
heap call is one visible step.

The count is named `Events`, because `step` names only what the position
bar counts (`interpreter.md`, Steps and batches).

`Next problem` leads to the first unsolved problem of the current plan
after this one. It wraps to the plan's start, because a skipped problem
is one the plan still asks for.

Once every problem of the plan is solved, `Next problem` leads to the
next row of its section.

After the last problem of a plan with every problem solved,
`Plan complete` with `Back to Problems` takes the place of
`Next problem`. `Plan complete` returns the choice to the learner,
because the next row after the last `course` problem would put a trainee
into the first data-structure problem.
