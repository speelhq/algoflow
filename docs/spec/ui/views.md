# Views

V-01 The `Result` tab chooses one view per variable by value:

| Value                       | View                                       |
| --------------------------- | ------------------------------------------ |
| int, float, str, bool, none | inline text                                |
| list of lists ≤ 30 × 30     | grid                                       |
| list of ≤ 40 values         | cards, each value as inline text           |
| other list                  | summary: `length N`, first five, last five |
| dict ≤ 50 entries           | key/value table                            |
| larger dict                 | summary                                    |
| obj                         | object card: class name and fields         |

V-02 When any variable of the shown frame references an object, the tab
also shows one graph of all objects reachable from the frame: one card per
object (class name, scalar fields), one edge per reference-valued field or
list element, laid out top-down by longest path from the roots. Above 200
objects, the graph shows objects touched by the last 20 events and
`N objects`.

V-03 Refs of `lastEvent` are highlighted for 300 ms: `read` blue,
`write` orange. A `swap` slides the two cards past each other in 200 ms;
a `write` changes a card without a transition.

V-05 Views are drawn with CSS transforms keyed by index and re-render only
the variables changed by the last event.

V-06 The learner may switch a list variable's view among `cards`, `grid`
(lists of lists only), and `tree`; the choice persists under
`localStorage` `algoflow:views` keyed by the program's storage key (L-53)
and the variable name. `tree` draws item `i` as a node whose children are
items `2i + 1` and `2i + 2`, laid out top-down by level, each node showing
its index and the item as inline text.

## Verification

U-91 (`pages.md`) saves one screenshot per view (V-01, V-02, V-06).
