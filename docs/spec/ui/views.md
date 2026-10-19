# Views

Code: the variables of the `Result` tab (`src/ui/problem/ResultTab.tsx`),
the view choice persisted through `src/store/storage.ts`. Tests: the
screenshots of `pages.md`, Verification.

The `Result` tab chooses one view per variable by value:

| Value                       | View                                       |
| --------------------------- | ------------------------------------------ |
| int, float, str, bool, none | inline text                                |
| list of lists ≤ 30 × 30     | grid                                       |
| list of ≤ 40 values         | cards, each value as inline text           |
| other list                  | summary: `length N`, first five, last five |
| dict ≤ 50 entries           | key/value table                            |
| larger dict                 | summary                                    |
| obj                         | object card: class name and fields         |

A list is drawn as cards, not bars, because every problem needs the numbers
themselves (`9 > 7`, evenness, `dp` values), and no list of the curriculum is
longer than the card limit, although bars are the usual picture of sorting.

When any variable of the shown frame references an object, the tab also
shows one graph of all objects reachable from the frame: one card per
object (class name, scalar fields), one edge per reference-valued field or
list element, laid out top-down by longest path from the roots. Above 200
objects, the graph shows objects touched by the last 20 events and
`N objects`.

The refs of `lastEvent` are highlighted for 300 ms: blue for `read`, and
orange for `write`. A `swap` slides the two cards past each other in
200 ms, while a `write` changes a card without a transition, so only the
slide tells an exchange apart from two writes.

Views are drawn with CSS transforms keyed by index, and they re-render only
the variables that the last step changed. The aim of 32 ms per drawn step
isn't a requirement and needs no test, because a frame-time assertion on CI
hardware is either too loose to mean anything or unreliable.

The learner may switch a list variable's view among `cards`, `grid` (lists
of lists only), and `tree`. The choice persists under the `localStorage`
key `algoflow:views`, keyed by the program's storage key (`language.md`,
Storage) and the variable name. `tree` draws item `i` as a node whose
children are items `2i + 1` and `2i + 2`, laid out top-down by level, and
each node shows its index and the item as inline text. The choice is kept
outside `Program`, because `Program` would export and diff it with the
code. A challenge never names a view, because views are chosen by value
type, with the learner's switch as the one override.
