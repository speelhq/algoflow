# 01 — Scope

## Product

S-01 AlgoFlow is a single-page web application running entirely in the
browser, with no server and no accounts.

S-02 The application targets desktop browsers at 1280 px width or more;
narrower viewports show `app.desktopOnly` and no editor.

S-03 The UI is available in English and, from M-10, Japanese. The
initial language is the browser language when a locale for it exists,
otherwise English; the header switches it and the choice is stored in
`localStorage`.

S-04 The application is deployed as static files to GitHub Pages from
`main` by CI.

## The learner

S-09 The learner may have never programmed; every problem, hint, and
solution is written so that a learner without an instructor can complete it
(C-22).

S-10 In one problem the learner reads the statement, builds the chart,
runs it on one input and watches it, compares the result with the expected
one, fixes the chart, submits, and moves to the next problem.

S-11 Across problems the learner moves functions and classes into a
module (D-09) and uses them from later problems and from Playground
programs (D-03).

## Curriculum

S-05 The problem set contains exactly these problems. Four study plans
(C-16) order subsets of it; the remaining problems belong to no plan and
are reached from the list by topic.

| Plan                                    | Problems, in order                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `course` 3-Day Course                   | tutorial, sum-to-n, fizzbuzz, max-of-three, countdown, list-max, count-evens, linear-search, binary-search, bubble-sort, selection-sort, insertion-sort, reverse-list |
| `structures` Build the Data Structures  | stack-balance, bfs-grid, heap-push, heap-pop, dijkstra-grid, dijkstra-heap, astar-grid                                             |
| `dp` Dynamic Programming                | coin-change, knapsack, lcs                                                                                                         |
| `micrograd` Build a Tiny Neural Network | slope, value, expression, manual-grad, local-backward, topo-backward, tanh, neuron, mlp, train                                     |
| (no plan)                               | gcd, is-prime, fibonacci-memo, fisher-yates, hanoi                                                                                 |

S-06 Every challenge is solvable with the blocks in `03-nodes.md` and the
built-in modules (D-15), and with no other means.

S-07 A Playground program has no `challengeId`, no inputs, no tests, and
no Submit; there may be any number of them, each stored under its own id
(L-53).

## Acceptance

S-08 Every built-in challenge's `solution` passes all of its tests in the
interpreter and, as emitted Python, in CPython 3.12 or later.
