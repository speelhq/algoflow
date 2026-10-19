# Chart

Code: `src/ui/chart` (layout `layout.ts`, text `text.ts`, drawing
`Chart.tsx` and `paint.ts`, `drag.tsx`, `zoom.ts`, `PathBar.tsx`) and
`src/ui/problem/Canvas.tsx`. Tests: beside each file, and `e2e/`.

## Charts and the path bar

The chart is a flowchart that the application lays out top-down. Nodes are
never positioned by hand, and edges are never routed by hand. Sentence blocks
were rejected, because they keep branches as indented text and never show two
paths. A free node graph was rejected too, because it makes the learner draw
edges and loops by hand and doesn't fit a structured `Program`.

The canvas shows one chart at a time: `main`, one function, or one class (its
field table, `blocks.md`, Classes), because all charts side by side don't fit
legibly in 960 px. The path bar is always present above it, and holds two
things. The first is a `▾` button that lists `main`, every function, and every
class of the program, then `Add function` and `Add class`, with a red dot on
the button and on each listed chart that holds a diagnostic and isn't shown.
The second is the path, with one segment per chart, reading `main`,
`name(params)` for a function, or the class name. In build mode, the path is
the trail of `Open <name>` (`editor.md`, Node editor): opening appends a
segment, clicking an earlier segment returns to that chart with the opened
call node selected, and choosing from `▾` resets the path to that one chart.
`run.md`, Call stack, states the path while running. Tabs for `main`,
functions, and classes were rejected, because a flat list shows no calls,
overflows at twenty charts, and would need a call-stack strip beside it while
running, whereas one path states the position in both modes. Hiding the path
bar while `main` is the only chart was rejected, because it would take the
chart list and `Add function` off the page. There is no `Make a function` from
a selection, because extracting statements needs parameter and return
inference and a multi-select, while building an empty function and choosing
its parameters is where a beginner learns what a parameter is.

The main chart shows, in order: the `Start` terminal, one Input node per input
(`Input n ← 15`, challenges only), the statements of `main`, and the `End`
terminal. A function chart shows `Start name(params)`, its body, and `End`.
Edges are vertical, with arrowheads, and a `Return` node's edge leads to
`End`. Clicking `Start name(params)` opens the function's editor: the name,
the ordered parameters with add and remove, `Delete function`, and
`Move to module…` (`modules.md`, Operations). A class's field table carries
the same name field, `Delete class`, and `Move to module…` in its header. The
`Start` terminal is the function's signature, so its editor holds the
function's own operations, and the path bar only navigates.

## Input nodes

Clicking an Input node opens a menu of the problem's cases (`n ← 15`,
`n ← 1`, …). Choosing one sets every Input node to that case's values and
the case selector (`pages.md`, Result tab) to that case, and Run uses them.
While running, the Input nodes open no menu and the case selector is
disabled. A test-case panel under the chart was rejected, because it would
be a second copy of the Input node, and choosing a case on the node is the
same action as reading it.

## Shapes

Node shapes come from the block's `chart` field (`blocks.md`, Chart shape):

| `chart`  | Rendering                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| absent   | a rounded box with the block's notation (`blocks.md`, Node text)                                                                                                                                                          |
| `branch` | a diamond with the condition; the `yes` region to the right joined by a `Yes` edge, the `no` region below joined by a `No` edge, both merging below; an empty `no` region is a bare `No` edge                            |
| `check`  | a diamond with the condition; `Yes` leads down into the body, whose last node returns by a back edge to a junction above the diamond; `No` leads on past the loop                                                        |
| `counted`| three generated nodes around the body: `i ← start`, the diamond `i < stop?`, and `i ← i + 1` (texts of the block's `counted`, `blocks.md`, Chart shape), drawn gray; the body and the back edge as for `check` |
| `jump`   | a box with the notation whose edge leaves by the right and runs down a lane inside the extent of the innermost loop around it, in place of an edge to the next node: for `exit` past the loop, joining its `No` lane; for `next` into its next pass, at the step node of a `counted` loop and at the start of the back edge of a `check` loop; the edge carries the connector after it (Editing on the chart); outside every loop, a box as for an absent `chart` |

The `counted` form was chosen over the loop-limit pair of JIS X 0121 and
ISO 5807, which is the counted loop of Japanese textbooks and the FE exam,
and over a dashed container, because both of those hide the check. Init,
check, body, and step are the order in which a `for` runs, and `while` has
the same shape, so one form serves every loop. The check reads `i < stop?`
with the bound as written, as the emitted `range` does, not an inclusive
`Repeat i from 1 to n` or a display-only `Is i ≤ n?`, because those would
mix `<` and `≤` across loops.

A `jump` draws where it jumps, because an edge to the next node would be a
path the run never takes, which a learner reading the chart would follow,
and a node with no edge wouldn't say where control goes. Each block
declares its jump, because the chart never branches on the kind
(`blocks.md`, The block definition).

The text of a `branch` or `check` diamond is its condition as the chart writes
it (`blocks.md`, Node text), followed by `?` (`chart.condition`: `i < n + 1?`,
`i % 15 = 0?`). A named node shows its name instead (`editor.md`, Node names).
A diamond's text wider than 150 px is drawn on two lines, split at the space
that makes the longer line shortest. A space inside a variable is never a
split point, and a text without such a space stays on one line. A block with
`requires: "function"` has no edge to the next node: its edge runs to `End`
along one vertical line on the right, and carries the connector after it.
Condition templates (`is divisible by`, `equals`) were rejected, because they
name only the conditions they list, and they would write a condition in words
beside the notation that every other node uses, while the condition followed
by `?`, with no `Is` in front, reads the same in every language. A diamond is
1.4 times as wide as its text, so the split that leaves the longer line
shortest keeps the diamond near the width of the boxes around it.

Generated nodes can't be selected on their own. Clicking one selects the loop
node, whose editor holds the variable and the bounds. The slots drawn on a
generated node are the loop's slots, so clicking the start value on `i ← 0`
opens the loop's editor on that slot (`editor.md`, Node editor). The slots are
the loop's because then the rule for slots alone leads from `i ← 0` to the
start value, where beginners most often go wrong.

## Editing on the chart

A `+` connector sits on every edge: before the first node and after the
last node of every region, between nodes, and on an empty `Yes`, `No`, or
body region. Clicking it opens the block menu (`editor.md`, Block menu) and
inserts the chosen block at that edge. While `main` has no statement, its
one connector carries the label `Add your first block` beside it, clear of
the edge. Nothing flows on after a branch whose regions all end in a
`Return` or a jump, so no edge and no connector follow it. A palette was
rejected, because it makes a beginner survey a vocabulary before writing,
while a `+` where the block goes keeps attention on the chart.

A click selects one node. Delete and Backspace remove it (a loop or a
branch with its regions), Ctrl/Cmd+D duplicates it, and Esc closes the
editor and clears the selection.

A node can be dragged onto another `+` connector, within or across
regions, as one edit. A drop that produces `E_BREAK_OUTSIDE` or
`E_RETURN_OUTSIDE` is refused with a tooltip that holds that message
(`pages.md`, Messages). The connectors inside the dragged node accept no
drop and show no message, because nothing a learner could change makes
that drop valid.

A node with a diagnostic shows a red dot. Hovering it shows the message
and, when `fix` is set, a button that applies the fix, and the node's
editor shows the same message and button at its top. `E_EMPTY_SLOT` shows
no dot, because the empty slot's placeholder (`editor.md`, Value line) is
its only mark.

## Zoom and highlight

The chart fits its width on open, is never drawn above 100 %, and scrolls
vertically. `−`, `100%`, and `+` controls in the chart's corner zoom it by
a factor of 1.25 per click, between 25 % and 200 %. `100%` shows the
current scale and resets it to 100 %. Fitting never enlarges the chart,
because a chart of three nodes fitted to 960 px would draw its text larger
than anything else on the page.

The chart highlights the statement that contains the `nodeId` of the step's
event (expressions have no node of their own). An error highlights
the statement that contains the failing node.

## Verification

`layout()` places every node of every challenge solution without overlap,
and its loops and branches take the shapes above.
