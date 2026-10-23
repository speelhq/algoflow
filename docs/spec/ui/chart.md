# Chart

The chart is the flowchart of the program on the canvas: the application
lays it out from the `Program`, and the learner builds the program on it.
This file states which chart the canvas shows and how the path bar names
it, the Input nodes, the shape of every node, how the learner edits on
the chart, zoom and the run's highlight, and the verification.

Code: `src/ui/problem/Canvas.tsx`, and `src/ui/chart`, which holds the
layout (`layout.ts`), the text (`text.ts`), the drawing (`Chart.tsx`,
`paint.ts`), `drag.tsx`, `zoom.ts`, and `PathBar.tsx`. Tests: beside
each file, and `e2e/`.

## Charts and the path bar

The canvas shows one chart, and the path bar above it lists every
chart and shows the path to the one shown.

The application lays each chart out top-down as a flowchart, and it
positions every node and routes every edge, so nothing is placed by
hand. Sentence blocks were rejected, because they keep branches as
indented text and never show two paths. A free node graph was rejected
too, because it makes the learner draw edges and loops by hand and
doesn't fit a structured `Program`.

### One chart at a time

The canvas shows one chart at a time: `main`, one function, or one
class, whose chart is its field table (`blocks.md`, Classes). It shows
one, because all charts side by side don't fit legibly in 960 px.

The main chart shows, in order:

- the `Start` terminal
- one Input node per input, on a Problem page only (Input nodes)
- the statements of `main`
- the `End` terminal

A function chart shows `Start name(params)`, its body, and `End`.

Edges are vertical and carry arrowheads. A `Return` node's edge leads
to `End`.

### Functions and classes

Clicking `Start name(params)` opens the function's editor, which holds:

- the name
- the ordered parameters, with controls that add and remove one
- `Delete function`
- `Move to module…` (`modules.md`, Operations)

The `Start` terminal is the function's signature, so its editor holds
the function's own operations, and the path bar only navigates.

A class's field table carries in its header:

- the same name field
- `Delete class`
- `Move to module…`

A `Make a function` command on a selection was rejected, because
extracting statements needs parameter and return inference and a
multi-select, while building an empty function and choosing its
parameters is where a beginner learns what a parameter is.

### The path bar

The path bar is always present above the chart. Hiding it while `main`
is the only chart was rejected, because it would take the `▾` list,
with `Add function`, off the page.

The path bar holds two things:

- a `▾` button, which lists `main`, every function, and every class of
  the program, then `Add function` and `Add class`
- the path, with one segment per chart. A segment reads `main`,
  `name(params)` for a function, or the class name.

Each listed chart that holds a diagnostic and isn't shown carries a
red dot, and so does the button while such a chart exists.

In build mode, the path is the trail of `Open <name>` (`editor.md`, Node
editor):

- `Open <name>` appends a segment
- clicking an earlier segment returns to that chart with the opened
  call node selected
- choosing from `▾` resets the path to that one chart

`run.md`, Call stack, states the path while running.

Tabs for `main`, functions, and classes were rejected, because a flat
list shows no calls, overflows at twenty charts, and would need a
call-stack strip beside it while running, whereas one path states the
position in both modes.

## Input nodes

An Input node shows one input with its value. For example:
`Input n ← 15`. The Input nodes are where the learner chooses the
case. Clicking an Input node opens a menu of the problem's cases. For
example: `n ← 15`, `n ← 1`, and so on. A test-case panel under the
chart was rejected, because it would be a second copy of the Input
node, and choosing a case on the node is the same action as reading
it.

Choosing a case from the menu sets every Input node to that case's
values and the case selector (`pages.md`, Panel, Result tab) to that
case, and the next run uses those values. While running, an Input node
opens no menu and the page disables the case selector.

## Shapes

A node's shape comes from its block's `chart` field (`blocks.md`, Chart
shape):

| `chart`  | Rendering                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| absent   | a rounded box with the block's notation (`blocks.md`, Node text)                                                                                                                                                          |
| `branch` | a diamond with the condition; the `yes` region to the right joined by a `Yes` edge, the `no` region below joined by a `No` edge, both merging below; an empty `no` region is a bare `No` edge                            |
| `check`  | a diamond with the condition; `Yes` leads down into the body, whose last node returns by a back edge to a junction above the diamond; `No` leads on past the loop                                                        |
| `counted`| three generated nodes around the body: `i ← start`, the diamond `i < stop?`, and `i ← i + 1` (texts of the block's `counted`, `blocks.md`, Chart shape), drawn gray; the body and the back edge as for `check` |
| `jump`   | a box with the notation whose edge leaves by the right and runs down a lane inside the extent of the innermost loop around it, in place of an edge to the next node: for `exit` past the loop, joining its `No` lane; for `next` into its next pass, at the update node of a `counted` loop and at the start of the back edge of a `check` loop; the edge carries the connector after it (Editing on the chart); outside every loop, a box as for an absent `chart` |

### Loops

Init, check, body, and update are the order in which a `for` runs, and
`while` has the same shape without the init and the update, so one
form serves every loop. The `counted` form draws a `for` in that
order. The loop-limit pair of JIS X 0121 and ISO 5807, the counted
loop of Japanese textbooks and the FE exam, was rejected, and so was a
dashed container, because both hide the check.

The check reads `i < stop?` and shows the bound as the learner wrote
it, as the emitted `range` does. An inclusive `Repeat i from 1 to n`
and a display-only `Is i ≤ n?` were rejected, because they would mix
`<` and `≤` across loops.

### Jumps and `Return`

The chart draws a `jump`'s edge to where it jumps, because an edge to
the next node would be a path the run never takes, and a learner
reading the chart would follow it, while a node with no edge wouldn't
say where control goes.

Each block declares its jump, because the chart never branches on a
block's kind (`blocks.md`, The block definition).

A block with `requires: "function"` has no edge to the next node: its
edge runs to `End` along one vertical line on the right, and carries
the connector after it.

### Diamonds

The text of a `branch` or `check` diamond is its condition as the chart
writes it (`blocks.md`, Node text), followed by `?` (`chart.condition`).
For example: `i < n + 1?`, `i % 15 = 0?`. A named node shows its name
instead (`editor.md`, Node names). A condition template writes a
condition in words. For example: `is divisible by`, `equals`.
Condition templates were rejected, because they name only the
conditions they list, and they would write a condition in words beside
the notation that every other node uses, while the condition followed
by `?`, with no `Is` in front, reads the same in every language.

A diamond is 1.4 times as wide as its text. When its text is wider
than 150 px, the chart draws it on two lines. The chart splits the
text only at a space, and a space inside a variable is never a split
point, so a text without a split point stays on one line. The chart
splits the text where the longer line is shortest, because that split
keeps the diamond near the width of the boxes around it.

## Editing on the chart

The learner builds the program on the chart: inserts a block at a
connector, selects a node, drags it, and reads its diagnostics.

### Connectors

A `+` connector sits on every edge:

- before the first node and after the last node of every region
- between nodes
- on an empty `Yes`, `No`, or body region

Clicking a connector opens the block menu (`editor.md`, Block menu) and
inserts the chosen block at that edge. A palette was rejected, because
it makes a beginner survey a vocabulary before writing, while a `+`
where the block goes keeps attention on the chart.

While `main` has no statement, its one connector carries the label
`Add your first block` beside it, clear of the edge.

No edge and no connector follow a branch whose regions all end in a
`Return` or a jump, because nothing flows on after it.

### Selection and keys

A click selects one node. These keys work on the selection:

- Delete and Backspace remove it, and a compound statement goes with
  its regions
- Ctrl/Cmd+D duplicates it
- Esc closes the editor and clears the selection

Generated nodes can't be selected on their own: clicking one selects
the loop node, whose editor holds the variable and the bounds. The
slots drawn on a generated node are the loop's slots, so clicking the
start value on `i ← 0` opens the loop's editor on that slot
(`editor.md`, Node editor). The slots are the loop's, because then one
rule, that clicking a slot opens the editor on it, leads from `i ← 0`
to the start value, where beginners most often go wrong.

### Dragging

The learner may drag a node onto a `+` connector, within or across
regions, as one edit. The chart refuses a drop that produces
`E_BREAK_OUTSIDE` or `E_RETURN_OUTSIDE`, with a tooltip that holds that
message (`pages.md`, Messages). The connectors inside the dragged node
accept no drop and show no message, because nothing a learner could
change makes that drop valid.

### Diagnostics

A node with a diagnostic shows a red dot. Hovering the node shows the
message and, when `fix` is set, a button that applies the fix. The
node's editor shows the same message and button at its top. A node
shows no dot for `E_EMPTY_SLOT`, because the empty slot's placeholder
(`editor.md`, Value line) is its only mark.

## Zoom and highlight

The chart fits its width to the canvas, and the learner zooms it. The
chart highlights the statement of the step, or of the error.

The chart fits its width on open, at 100 % at most, and scrolls
vertically. Fitting never enlarges the chart, because a chart of three
nodes fitted to 960 px would draw its text larger than anything else
on the page.

The controls in the chart's corner:

- `−` and `+` zoom the chart by a factor of 1.25 per click, between
  25 % and 200 %
- `100%` shows the current scale, and clicking it resets the scale to
  100 %

The chart highlights the node of the statement that contains the
`nodeId` of the step's event (`run.md`, Path and marks), because an
expression has no node of its own. On an error, the chart highlights
the node of the statement that contains the failing node (`run.md`,
Errors).

## Verification

A test lays out every challenge solution and checks that no two nodes
overlap and that the solution's loops and branches take the shapes
that Shapes states.
