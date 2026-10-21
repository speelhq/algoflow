# Scope

AlgoFlow is a single-page web application. All of it runs in the browser.
This file states where it runs, who learns with it, which problems it
holds, and what every challenge's solution passes. This file governs the
whole product. This file has no code of its own.

## Product

This section states where the application runs, which languages it
offers, and how it reaches the learner.

### Platform

The application has no server, no accounts, and no roles. It needs no
roles because an instructor writes the challenge files, the study plans,
and the built-in modules in the repository rather than in the application. So
a trainee and a self-learner use the same features.

### Viewport

The application targets desktop browsers with a viewport 1280 px wide or
more. In a narrower viewport it shows `app.desktopOnly` and no editor.

### Language

The application offers English and Japanese.

When a locale exists for the browser's language, the application starts
in that language. Otherwise it starts in English.

The learner switches the language in the header. The application stores
the choice in `localStorage`.

### Deployment

Once `main` passes its checks, CI deploys the application from `main` as
static assets to Cloudflare Workers, on `*.workers.dev`.

## The learner

This section states who the learner is and how the learner works through
the problems.

The learner might never have programmed. An instructor writes every
challenge's description, hints, and solution so that the learner can
complete the problem without an instructor (`challenges.md`, Hints).

### The loop within one problem

Within one problem, the learner works in a loop:

1. Read the problem's description.
2. Build the chart.
3. Run it on one input and watch it.
4. Compare the result with the expected one.
5. Fix the chart.
6. Submit, and move on to the next problem.

This loop shapes the UI. A design of cards that read as code lines, with
a blocks palette, a properties panel, and tabbed run panels, was rejected
because it:

- keeps control flow invisible
- places values in a table apart from the program
- puts instructor tools beside the loop

### Across problems

Across problems, the learner moves functions and classes into a module
(`modules.md`, Operations). The learner then uses them in later problems
and in Playground programs (`modules.md`, Resolution).

A study plan connects its problems through modules rather than through
starter programs, because a problem that started from the previous
solution would discard the learner's own version.

A module keeps that version, so when a bug in the learner's `heap_pop`
shows up again in `dijkstra-heap`, the learner inspects the block they
rely on.

## Curriculum

This section states which problems the application holds and what the
learner solves them with.

### Study plans

The curriculum is exactly the problems of these study plans
(`challenges.md`, Study plans), in this order:

| Plan                                   | Problems, in order                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `course` 3-Day Course                  | tutorial, sum-to-n, fizzbuzz, max-of-three, countdown, list-max, count-evens, linear-search, binary-search, bubble-sort, selection-sort, insertion-sort, reverse-list |
| `structures` Build the Data Structures | stack-balance, bfs-grid, heap-push, heap-pop, dijkstra-grid, dijkstra-heap, astar-grid                                             |
| `dp` Dynamic Programming               | coin-change, knapsack, lcs                                                                                                         |

The order of a study plan's problems is part of the plan, because each
problem builds on the problems before it:

- The `course` problems follow a fixed three-day course.
- The `structures` problems go from a list as a stack, to a list as a
  queue, to the `heap` module.
- The `dp` problems go from one dimension to two, and then to strings.

The instructor decides whether to add a problem to the `course` plan.

### Blocks and modules

The learner can solve every challenge with the blocks of `blocks.md` and the
built-in modules (`modules.md`, Built-in modules), and with nothing else.

### Playground programs

A Playground program has none of these:

- a `challengeId`
- inputs
- tests
- Submit

The learner can keep any number of Playground programs. The application
stores each one under its own id (`language.md`, Storage).

## Acceptance

This section states what every challenge's solution passes.

Every built-in challenge's `solution` passes all of the challenge's tests
in the interpreter. The Python that the emitter writes for that solution
passes the same tests in CPython 3.12 or later.
