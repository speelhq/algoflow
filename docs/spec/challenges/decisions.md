# Challenges decisions

Why the statements of this folder were chosen, and the alternatives
rejected (`docs/spec/README.md`, Reasons).

**Input names are checked by `scripts/check.ts`, not by `validate()`**. Inputs
have no NodeId to attach a diagnostic to and are read-only in the editor
(U-31); challenge files are the only source, so the schema check covers L-01
for them.

**Tests are judged on disposable runners** (C-15). The driver shows one run;
judging three tests through it would discard the learner's position. Each test
runs in R-11 batches with `setTimeout(0)` between them so a non-terminating
program cannot block the tab. `judge()` is shared with `scripts/check.ts` so
the Result tab and CI agree on C-10.

**Plans grow with the files** (C-18). C-16 makes `pnpm check` fail on an id
without a file, and a plan with no members would render an inert U-12 card
(`0 of 0 solved`, `Start` with no destination), so a plan enters
`plans.json` with its first member and lists the members that exist. The
plans are bundled by a static import in `src/challenges/plans.ts` rather
than the challenge glob of `index.ts`, which lets the glob exclude
`plans.json` with a negated pattern. Membership and order are not checked
against the S-05 table by code: copying the table into `scripts/` would
duplicate a spec fact, and making `plans.json` the authority would remove
the curriculum from the spec. `pnpm check` prints `in no plan: …` after
the plans line so an omitted entry is visible on every run.

**The tutorial prints two values** (S-05, C-22, L-29). `"Hello, " + name`
made the first action combine a text, an operator applied to a value,
and a variable, and its second hint explained wrapping before any problem had
introduced an operator. `print("Hello,", name)` prints the same line for
every test, because `print` joins its values with one space, and its first
action adds a second value to a slot that already holds one; `+` on text is
left to a later problem whose subject is operators. The instructor chose
it: the order in which a course introduces ideas is course content.

**Showing the solution is recorded** (C-17). `solution: true` requires an
entry, and a learner who only viewed the solution has used the problem as
much as one who took a hint; the entry is `attempted`. The key holds the
bare record, as C-17 writes it, through a custom storage of the persist
middleware.
