# Views

A view is the rendering of one variable in the `Result` tab
(`pages.md`, Panel, Result tab). This file states how the tab chooses a view,
what the object graph draws, how a view shows what the current step
read and wrote, how the tab draws views, and which views the learner
may switch a list to.

Code: the variables of the `Result` tab (`src/ui/problem/ResultTab.tsx`),
and the learner's choice of a view, persisted through
`src/store/storage.ts`. Tests: the screenshots of `pages.md`,
Verification.

## Choosing a view

The `Result` tab chooses one view per variable by its value:

| Value                       | View                                       |
| --------------------------- | ------------------------------------------ |
| int, float, str, bool, none | inline text                                |
| list of lists ≤ 30 × 30     | grid                                       |
| list of ≤ 40 values         | cards, each value as inline text           |
| other list                  | summary: `length N`, first five, last five |
| dict ≤ 50 entries           | key/value table                            |
| larger dict                 | summary                                    |
| obj                         | object card: class name and fields         |

Inline text is a value written on one line (`pages.md`, Values on one
line).

The tab draws a list as cards, not as bars, although bars are the
usual picture of sorting, because every problem needs the numbers
themselves, and no list of the curriculum holds more than 40 values.
For example: a problem compares `9 > 7`, tests evenness, or reads `dp`
values.

A challenge never names a view, because the type of a value chooses
its view, and the learner's switch (Switching a view) is the one
override.

## Object graph

When any variable of the shown frame references an object, the tab also
draws one graph of every object reachable from the frame. The graph
holds:

- one card per object, with its class name and its scalar fields
- one edge per field or list item whose value is a reference

The tab lays the graph out top-down and places each object at the depth
of its longest path from the roots.

When the graph holds more than 200 objects, the tab draws only the
objects that the last 20 events touched, and it shows `N objects`.

## Highlight

The tab highlights the refs that `lastEvent` read or wrote, for
300 ms, in a color that the type of `lastEvent` chooses:

- a `read`: blue
- a `write`: orange

The tab shows a written card by the type of `lastEvent`:

- a `swap` step: the two cards slide past each other in 200 ms
- a `write` step: the written card changes with no transition, so only
  the slide tells an exchange apart from two writes

## Drawing

This section states how the tab draws each step's views.

The tab draws views with CSS transforms keyed by index.

The tab re-renders only the variables that the current step changed.

The tab aims to draw each step in 32 ms. The aim isn't a requirement
and needs no test, because a frame-time assertion on CI hardware is
either too loose to mean anything or unreliable.

## Switching a view

The learner may switch a list variable's view to one of these views:

- `cards`
- `grid`, for a list of lists only
- `tree`

`tree` draws item `i` as a box whose children are the boxes of items
`2i + 1` and `2i + 2`. It lays the boxes out top-down by level. Each box
shows its index and its item as inline text.

The choice persists under the `localStorage` key `algoflow:views`.
That entry holds one choice per pair of a program's storage key
(`language.md`, Storage, Where a program is stored) and a variable's
name. The choice lives outside `Program`, because a program's export
and its diff would then carry the choice with the code.
