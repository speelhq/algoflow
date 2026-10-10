# Scope decisions

Why the statements of this folder were chosen, and the alternatives
rejected (`docs/spec/README.md`, Reasons).

**The application has no roles** (S-01, S-09). A table of users by role
(trainee, self-learner, instructor) was dropped: a trainee and a
self-learner use the same features, and an instructor's work (challenge
files, plans, built-in modules) is authoring in the repository, not a
feature of the application. "The environment is the core and the problems
are a curriculum" was rejected as a statement because it states nothing
testable.

**Plans chain through modules, not starters** (S-05, C-19, C-21). A
starter chain (each problem starts from the previous solution) discards
the learner's own version; a module chain keeps it, and a bug in the
learner's `heap_pop` surfacing in `dijkstra-heap` is the note's "inspect
the block you rely on", not a defect. A built-in module with the same
names lets a learner who skipped a problem, or a self-learner, start
anywhere (the note's "predefined blocks as shortcuts, still inspectable"),
but it would let every problem after the first be passed without building
anything; `defines` (C-21) refuses a submission whose named function
resolves to a built-in module, so the exercise is retained while the
shortcut remains available for later problems.

**Playground holds many programs** (S-07, U-15, U-05). One `free` slot
made starting a new program an act of destruction; the note's "use it in
a larger program" has nowhere else to happen than Playground once a plan
ends. `Open in Playground` converts a solved problem into the start of that
larger program, with inputs fixed as the assignments E-03 already emits.

**Plans `structures` and `dp`** (S-05). A plan's order must be
significant. The seven `structures` problems build on one another through
the list-as-stack, list-as-queue, and `heap` module; `dijkstra-grid` then
`dijkstra-heap` shows a block being swapped for a faster one with the same
answer, visible in the step count on the Accepted card. The three `dp`
problems widen the same table technique (one dimension, two, strings),
which is the same form of concept progression as the course plan. Adding a
problem to the course plan is the instructor's decision, since that plan
mirrors a fixed three-day course.

**Every problem is in a plan** (S-05, C-25). A problem in no plan would
need a section of its own, an order by title, and a rule of its own for
`Next problem`, and would give the learner no next step after it. A
problem that no plan takes yet waits as a `challenge` issue
(CONTRIBUTING), so the catalog holds plans only.
