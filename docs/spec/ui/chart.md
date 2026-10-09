# Chart

U-30 The chart is a flowchart laid out top-down by the application; nodes
are never positioned manually and edges are never routed manually. The
canvas shows one chart at a time: `main`, one function, or one class
(its field table, N-06). Above it the path bar is always present: a `▾`
button listing `main`, every function, and every class of the program,
then `Add function` and `Add class`, with a red dot on the button
and on each listed chart that holds a diagnostic and is not shown; and the
path, one segment per chart, reading `main`, `name(params)` for a
function, or the class name. In build mode the path is the trail of
`Open <name>` (U-41): opening appends a segment, clicking an earlier
segment returns to that chart with the call node that was opened selected,
and choosing from `▾` resets the path to that one chart. U-68 states the
path while running.

U-31 The main chart shows, in order: the `Start` terminal, one Input node
per input (`Input n = 15`, challenges only), the statements of `main`, and
the `End` terminal; a function chart shows `Start name(params)`, its body,
and `End`. Edges are vertical with arrowheads; a `Return` node's edge leads
to `End`. Clicking `Start name(params)` opens the function's editor: the
name, the ordered parameters with add and remove, `Delete function`, and
`Move to module…` (D-09); a class's field table carries the same name
field, `Delete class`, and `Move to module…` in its header.

U-32 Clicking an Input node opens a menu of the problem's cases (`n = 15`,
`n = 1`, …); choosing one sets every Input node to that case's values and
the case selector (U-23) to that case, and Run uses them. While running,
the Input nodes open no menu and the case selector is disabled.

U-33 Node shapes come from the block's `chart` field (N-09):

| `chart`  | Rendering                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| absent   | a rounded box with the block's sentence (N-02)                                                                                                                                                                            |
| `branch` | a diamond with the condition; the `yes` region to the right joined by a `Yes` edge, the `no` region below joined by a `No` edge, both merging below; an empty `no` region is a bare `No` edge                            |
| `check`  | a diamond with the condition; `Yes` leads down into the body, whose last node returns by a back edge to a junction above the diamond; `No` leads on past the loop                                                        |
| `counted`| three generated nodes around the body: `Set i to start`, the diamond `i < stop?`, and `Set i to i + 1` (texts `node.<key>.init/check/step`, N-09), drawn grey; the body and the back edge as for `check`             |
| `jump`   | a box with the sentence whose edge leads, in place of the next node, to the innermost loop around it: for `exit` past the loop, joining its `No` edge; for `next` into its next pass, at the step node of a `counted` loop and at the start of the back edge of a `check` loop; the edge carries the connector after it (U-34); outside every loop, a box as for an absent `chart` |

The text of a `branch` or `check` diamond is its condition as the chart
writes it (N-08) followed by `?` (`chart.condition`: `i < n + 1?`,
`(remainder of i divided by 15) = 0?`); a named node shows its name
instead (U-95). A diamond's text wider than 150 px is drawn on two lines,
split at the space that makes the longer line shortest; a space inside a
variable or an empty slot is never one, and a text without such a space
stays on one line. A block with `requires: "function"` has no edge to
the next node: its edge leads to `End` (U-31) and carries the connector
after it (U-34).

Generated nodes are not selectable on their own: clicking one selects the
loop node, whose editor holds the variable and bounds. The slots drawn on
a generated node are the loop's slots, so clicking the start value on
`Set i to 0` opens the loop's editor on that slot (U-41).

U-34 A `+` connector sits on every edge: before the first node and after
the last node of every region, between nodes, and on an empty `Yes`, `No`,
or body region. Clicking it opens the block menu (U-40) and inserts the
chosen block at that edge. While `main` has no statement its one connector
carries the label `Add your first block` beside it, clear of the edge. After
a branch whose regions all end in
a `Return` or a jump nothing flows on, so no edge and no connector follow
it.

U-35 Click selects one node; Delete and Backspace remove it (a loop or
branch with its regions); Ctrl/Cmd+D duplicates it; Esc closes the editor
and clears the selection.

U-36 A node can be dragged onto another `+` connector, within or across
regions, as one edit; a drop producing `E_BREAK_OUTSIDE` or
`E_RETURN_OUTSIDE` is refused with a tooltip holding that message (U-70),
and the connectors inside the dragged node accept no drop.

U-37 A node with a diagnostic shows a red dot; hovering shows the message
and, when `fix` is set, a button applying it, and the node's editor (U-41)
shows the same message and button at its top. `E_EMPTY_SLOT` shows no dot:
the empty slot's placeholder (U-51) is its only mark.

U-38 The chart fits its width on open, never drawn above 100 %, and
scrolls vertically; `−`, `100%`, and `+` controls in the chart's corner
zoom it by a factor of 1.25 per click between 25 % and 200 %, `100%`
showing the current scale and resetting it to 100 %.

U-39 The chart highlights the statement containing an event's `nodeId`
(expressions have no node of their own); an error highlights the statement
containing the failing node.

## Verification

U-92 `layout()` places every node of every challenge solution without
overlap, and its loops and branches match U-33.
