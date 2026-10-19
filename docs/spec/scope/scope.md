# Scope

This file governs the whole product and has no code of its own.

## Product

AlgoFlow is a single-page web application that runs entirely in the browser.
It has no server, no accounts, and no roles. It needs no roles, because an
instructor writes their work (challenge files, plans, and built-in modules) in
the repository, not in the application, so a trainee and a self-learner use
the same features.

The application targets desktop browsers 1280 px wide or more. A narrower
viewport shows `app.desktopOnly` and no editor.

The UI is available in English and Japanese. The initial language is the
browser's language when a locale exists for it, and English otherwise. The
header switches the language, and the application stores the choice in
`localStorage`.

CI deploys the application as static assets to Cloudflare Workers, on
`*.workers.dev`, from `main` once `main` passes its checks.

## The learner

The learner might never have programmed. Every problem, hint, and solution
is written so that a learner can complete it without an instructor
(`challenges.md`, Hints).

In one problem the learner reads the problem's description, builds the chart,
runs it on one input and watches it, compares the result with the expected
one, fixes the chart, submits, and moves on to the next problem. The UI is
built around this loop. A design of cards that read as code lines, with a
blocks palette, a properties panel, and tabbed run panels, was rejected,
because it keeps control flow invisible, places values in a table apart from
the program, and puts instructor tools beside the loop.

Across problems, the learner moves functions and classes into a module
(`modules.md`, Operations) and uses them in later problems and in
Playground programs (`modules.md`, Resolution). A plan connects its
problems through modules, not through starter programs, because a problem
that started from the previous solution would discard the learner's own
version, while a module keeps it. So when a bug in the learner's
`heap_pop` shows up again in `dijkstra-heap`, the learner inspects the
block they rely on.

## Curriculum

The problem set is exactly the problems of these study plans
(`challenges.md`, Study plans), in this order:

| Plan                                   | Problems, in order                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `course` 3-Day Course                  | tutorial, sum-to-n, fizzbuzz, max-of-three, countdown, list-max, count-evens, linear-search, binary-search, bubble-sort, selection-sort, insertion-sort, reverse-list |
| `structures` Build the Data Structures | stack-balance, bfs-grid, heap-push, heap-pop, dijkstra-grid, dijkstra-heap, astar-grid                                             |
| `dp` Dynamic Programming               | coin-change, knapsack, lcs                                                                                                         |

A plan's problems build on the ones before them, so the order is part of
the plan. The `structures` problems go from a list as a stack, to a list as
a queue, to the `heap` module. The `dp` problems go from one dimension to
two, and then to strings. The `course` plan follows a fixed three-day
course, and adding a problem to it is the instructor's decision.

A learner can solve every challenge with the blocks in `blocks.md` and the
built-in modules (`modules.md`, Built-in modules), and with nothing else.

A Playground program has no `challengeId`, no inputs, no tests, and no
Submit. There may be any number of them, each stored under its own id
(`language.md`, Storage).

## Acceptance

Every built-in challenge's `solution` passes all of its tests in the
interpreter and, as emitted Python, in CPython 3.12 or later.
