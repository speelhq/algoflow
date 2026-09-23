# Decisions

Why the choices recorded in `docs/spec/` were made. The spec states the
fact; this file keeps the reason and the alternatives that were rejected,
grouped by topic. When a decision changes, edit its entry (and the spec id)
rather than appending a new one.

## Stack and tooling

**TypeScript 7 ships the Go compiler as `tsc`** (07-plan stack table).
`typescript@7` has a single binary, `tsc`; the `tsgo` name belonged to the
`@typescript/native-preview` package. `oxlint-tsgolint` follows the same
major (P-03), so `7.0.x` pairs with `7.0.x`.

**Base UI package is `@base-ui/react`** (P-04). `@base-ui-components/react`
is deprecated in favour of the renamed package; shadcn's `--base base`
targets the new name.

**shadcn preset `nova`** (P-04). shadcn 4 offers `nova`, `vega`, `maia`,
`lyra`, `mira`, `luma`, `sera`, `rhea`; `nova` is the default appearance. The
preset's `theme.css` imports `shadcn/tailwind.css` and `tw-animate-css`, so
`shadcn` and `tw-animate-css` are runtime dependencies rather than
dependencies invoked only through `dlx`.

**Generated primitives live in `src/ui/primitives/`, `cn()` in
`src/lib/utils.ts`** (P-04, repository layout). shadcn defaults to
`src/components/ui`; the spec keeps everything visual under `src/ui/`, so
`components.json` aliases were changed before the first `shadcn add`.

**pnpm `onlyBuiltDependencies: ["esbuild"]`**. pnpm 10 refuses package
build scripts unless listed; `esbuild` (introduced transitively by `tsx`)
needs its postinstall to place the platform binary.

**Exact version pins** (P-03). `.npmrc` sets `save-exact=true` so every
`pnpm add` records an exact version; `@types/node` is pinned to the latest
22.x to match `.node-version`.

## Linting and formatting

**Rules turned off** (P-06).

- `react/react-in-jsx-scope`: the automatic JSX runtime (`jsx: react-jsx`)
  never needs `React` in scope; the rule reports every element.
- `jsx-a11y/prefer-tag-over-role`: the resize handle is an interactive
  `role="separator"` (a splitter); `<hr>` is a static separator and the
  language switch uses `<fieldset>` instead of `role="group"`.
- `no-await-in-loop` in `e2e/`: Playwright assertions in a loop are
  intentionally sequential; `Promise.all` would race the browser.

**Warnings do not fail `pnpm lint`** (P-06). The remaining warnings are
`no-unsafe-type-assertion` on `JSON.parse` results, which cannot be typed
without a validator; introducing one for four call sites is not justified.

**Oxfmt does not format `docs/`** (P-08). The spec is hand-written prose
with aligned tables; a formatter must not rewrite it.

**LF line endings** (P-08). The repository is edited on Windows; without
`.gitattributes`, git warned about CRLF on every commit and CI diffs would
contain unrelated changes.

## UI shell (M-00)

**Custom resize handle instead of `react-resizable-panels`** (P-05). U-03
states limits in pixels; the library works in percentages, and the handle
is approximately sixty lines with pointer capture. It also avoids one
dependency that P-02 does not forbid but does not require.

**Layout store `src/store/layout.ts`** (repository layout). One Zustand
`persist` store owns everything under `algoflow:layout` (the panel width
and collapsed state, U-03/U-24, and the playback speed, U-60).

**Stored values are validated on both paths**. Setters clamp, and
`mergePersisted` re-validates whatever is returned from `localStorage`: a
non-number or out-of-range size falls back to the default or the limit.
Trusting the snapshot would allow a hand-edited or stale entry to render a
5000 px panel. Because both paths validate, a snapshot written under an
older shape needs no `migrate` step: its unknown fields resolve to the
defaults, so `version` remains `1`.

**Categories live in `src/nodes/categories.ts`**. `NodeDef.category`
(03-nodes) is owned by the node registry; the block menu imports the tuple
from there rather than declaring its own copy, so adding a category cannot
leave the menu and the registry inconsistent. The file has no imports, so
`src/nodes` remains free of store and React dependencies.

**Generated primitives are added when first used** (P-04). Unreferenced
generated code would still have to track theme changes.

**Resize handle ignores secondary pointers**. `onPointerDown` returns unless
`button === 0` and `isPrimary`; a right-click would otherwise begin a drag
whose `pointerup` the context menu can suppress, and a second touch would
overwrite the drag origin during a drag.

**Stable test ids**. Panels, the chart, nodes (`data-node-id`), the
transport, the path bar, and the panel's tabs carry `data-testid`
hooks for end-to-end tests; role and label queries are used for everything
user-visible.

## i18n

**`t()` keys are typed** (U-73). `MessageKey` is derived from `en.json`
with a template-literal type, so an unknown literal key is a compile error
as well as a `scripts/i18n.ts` failure (T-08). Dynamic keys such as
`` t(`view.${view}`) `` type-check against the union and are not scanned.

**`t()` falls back to `en` and then to the key**. Until M-10 the `ja`
catalog is empty; returning the key (with a development-only warning) keeps
the UI readable if a translation is missing.

**Scan is a regex, not a parser** (T-08). The pattern matches `t("…")` and
`t('…')` while ignoring `at(`, `obj.t(`, and template literals; it also
matches inside comments, which is accepted. A parser would be more precise
but adds a dependency to a script that must remain fast and simple. Test files
are skipped because they call `t()` with deliberately unknown keys. Dynamic
keys (`node.*`, `error.*` from M-01) are covered by registry-driven checks
in their milestones, not by this scan.

**`flatten()` is shared** (`src/i18n/flatten.ts`). `t.ts` and the check
script must agree on the key scheme; a single dependency-free module keeps
one definition, and the script does not import `t.ts` because doing so
introduces `en.json` and Vite's `import.meta.env`.

**`en.json` holds only keys something renders**. Keys for later milestones
are added with the code that uses them, so wording is decided when the UI
exists and the M-10 parity check never requires translating unused strings.

**`import.meta.env` is read defensively**. `t.ts` uses `import.meta.env?.DEV`
because the module is dependency-free and scripts run with `tsx` (P-09),
where `import.meta.env` is undefined.

**Script logic lives in `scripts/lib/`**. `scripts/i18n.ts` is a minimal
command-line wrapper over `scripts/lib/i18n-check.ts` so Vitest can test the
function directly against a temporary fixture directory.

## Scripts and CI

**`pnpm check` runs only `scripts/i18n.ts` until M-01**. `scripts/check.ts`
(C-02, R-20) does not exist yet; M-01 prepends it. Python setup in CI is
deferred to the same milestone (the workflow marks the location).

**`VITE_BASE`** (P-07). Project Pages serve from `/<repo>/`; a build with
`base: "/"` would return 404 for every asset. Reading the value from the
environment keeps local builds at `/` and lets CI derive it from
`github.event.repository.name` without hard-coding the repository.

**Chromium only, 1440 × 900** (P-09). One browser keeps CI under one minute
and matches the desktop-only scope (S-02); the viewport exceeds the 1280 px
gate with margin for the default panel sizes.

**No React Testing Library**. Unit tests cover stores, `t()`, and script
logic; component behaviour is exercised end to end by Playwright (T-07 to
T-10). Installing a DOM testing library for components that are largely
placeholders would add a second, slower means of testing the same behaviour.

**Vitest environment is `node`, jsdom per file**. Only the layout store test
needs `localStorage`; a file-level `// @vitest-environment jsdom` keeps the
other suites fast (jsdom start-up accounts for most of the run time).

## Language core (M-01)

**An empty slot is an expression kind** (L-09). `create()` must return a
statement whose required slots exist; making the slot type `Expr | null`
would distribute null checks through every block and the emitter. A dedicated
`empty` kind keeps `Expr` a closed union, lets validation report
`E_EMPTY_SLOT` generically, and emits `...` so the Python tab still renders.

**NodeId generation without `nanoid`** (02 Program, P-01). `src/lang` may
not import third-party code, and `edit.ts` must mint ids for duplicates and
hoisted assignments. `crypto.getRandomValues` over the nanoid alphabet gives
the same 12-character format; the dependency was removed.

**Statements are addressed by `Place`** (L-54). Edits from the UI arrive as
a drop at index N of region R; a `{ parent, slot, index }` triple names every
region (main, a function body, a frame region) without exposing array
references. `moveStmt` counts the index after removal because a drag within
one region is the common case and the drop indicator is computed on the
list without the dragged card.

**Blocks run as generators** (R-13, R-14). Each `next()` must yield exactly
one event and leave the program suspended for Back, Step, and Play; a
generator per block composes with `yield*` and needs no explicit continuation
machinery. Signals (`break`, `continue`, `return`) travel as generator
return values, so loops and calls handle them without exceptions.

**`python()` returns `PyLine[]`** (E-08). The line map (E-01) needs to know
where a nested region starts; returning strings with pre-indented children
would require the emitter to search for them. A `{ block }` marker allows the
emitter to indent, insert `pass`, and map ids while flattening, and each block
still states its exact text per N-03.

**Comparisons are non-associative in E-05**. `(a < b) < c` and `a < (b < c)`
must both keep their parentheses: dropping them on the left would produce a
chained comparison, which G-04 refuses to parse and which Python interprets
differently.

**`in` is a comparison** (R-06). It sits at comparison precedence, yields a
boolean, and `2 in [1, 2]` is narrated (U-63) and marked on the
diamond (U-61) as any other test is; the per-element `read`s (R-04) precede
the `compare`.

**A `for` variable belongs to the enclosing region** (L-40). Python leaves
the loop variable defined after the loop, and `for` reads its bounds before
the body runs, so the variable is treated as assigned by the statement that
owns the loop, not inside its body. Names first assigned in the body still
raise `E_DECLARE_FIRST` afterwards.

**`hoistAssign` picks the default from the first inner assignment** (L-41).
The fix must be type-consistent as the learner reads it: a counter starts at
`0`, a message at `""`, a flag at `False`, a collection empty. When the first
value is not a literal the default is `None`, which any later assignment
replaces.

**Python float text** (L-29). `str()` of a float follows `repr` in CPython
(`2.0`, `1e-06`, `1e+16`); JavaScript's `toString` differs in the exponent
thresholds and format, so `floatRepr` re-implements the rule. The rule
affects the Output of the `Result` tab (U-23), the narration (U-63), and R-20
agreement.

**`bool` is not a number** (R-15). Python treats `True` as `1`, but block
programs never rely on it and the interpreter's `E_TYPE` keeps the type model
simple for learners; solutions avoid the construct so CPython agrees.

**`call` and `return` are delivered in M-01**. Validation must resolve
user-function calls (E_ARITY, E_UNKNOWN_CALL) and refuse `return` in main,
and traversal dispatches through the registry, so the two blocks exist now;
their category remains `function` and the block menu shows them from M-06.

**Block files replace `:` with `-`** (N-01). Windows file names cannot contain
a colon; `call-abs.ts` is the only legible alternative that keeps one file
per key.

**Slot roles `target` and `text`** (N-01). Registry-driven traversal needs to
know which slots hold expressions (including inside an assignment target) so
no module lists block kinds; literal fields get `text` so the node editor
(U-41) and `E_EMPTY_SLOT` can treat them uniformly.

**Variant templates use `template<Form>` keys** (N-02). `assign`, `bool`, and
`unop` have two node texts in 03-nodes; a suffixed key keeps the three
standard keys per block intact for the parity check.

**Lint rules for the core** (P-06). `require-yield`: literal and variable
runners are generators that never yield, by design. `unicorn/no-thenable`:
02-language names the `if` regions `then` and `else`. `no-redundant-type-constituents`:
`Id | "main"` and `NodeId | "main"` are written as in the spec to document
intent.

**`pnpm check` is one script**. pnpm appends command-line arguments to the end
of the script string, so `tsx scripts/check.ts && tsx scripts/i18n.ts` would
pass `challenges/x.json` to the i18n script; `check.ts` invokes the i18n check
itself instead.

**`E_DUPLICATE_ID` has a message** (U-70). The code exists in 02; the UI
table omitted it. The text is generic because the condition cannot arise
from editing, only from a corrupted import.

**Input names are checked by `scripts/check.ts`, not by `validate()`**. Inputs
have no NodeId to attach a diagnostic to and are read-only in the editor
(U-31); challenge files are the only source, so the schema check covers L-01
for them.

**Repeated objects carry the same `$id` in `toData`** (L-06). A list holding
the same object twice (micrograd `mul(a, a)`) must show identity; a second
full copy with the same `$id` is simpler to compare than a reference node,
and a cycle degrades to `{ $cls, $id }` so the conversion terminates.

**Reading an unbound variable is a runtime `E_UNDEFINED`** (R-09). L-43
makes a `for` variable visible after its loop, but a loop with no iteration
never binds it; the interpreter reports the read as a runtime error at the
`var` node instead of crashing the runner, mirroring CPython's `NameError`.

**Float `//` and `%` follow CPython's algorithms** (L-12). `Math.floor(a / b)`
differs from `float.__floordiv__` when `a / b` rounds to an integer
(`1 // 0.1` is `9.0`, not `10.0`), and the sign of a zero result must follow
the divisor; `floatMod` and `floatFloorDiv` port the C code so R-20 agrees.

**Variables may not shadow callables** (L-45). `count = 0` alongside
`def count()` runs in the interpreter (calls resolve by name) but fails in
CPython; the same holds for a function named after a builtin such as
`random_int`, whose registry key would take precedence without notice.

**The parser consults the registry** (G-01). Grammar-legal forms whose
block does not exist yet (`[1, 2]`, `xs[i]`, `p.x`, `Cls()`) would pass the
parser and cause `unparse`, `validate`, or `run` to fail with an unknown-node
error; reporting `E_PARSE_SYNTAX` at the token keeps the failure a diagnostic,
and the condition is removed as M-04/M-05 register the blocks.

**The CPython harness runs the program in its own namespace** (R-20).
Harness helpers (`sys`, `json`, `next`, …) previously shared the module
globals with the learner's variables, so `next = 0` invalidated the shim.
`exec` into a fresh dict isolates them, and a `print` hook records one entry
per call so a printed newline compares equal to the interpreter's `stdout()`.
The shimmed `random` functions come from the registry's aliases (N-05).

## Playback (M-02)

**Challenges are bundled with `import.meta.glob`** (C-14). Fetching the JSON
at run time would need a manifest, asynchronous loading, and the Pages base
path; a generated module would add a build step. The glob is typed by
`vite/client`, works under Vitest, and the check script keeps reading from
disk. The types reside in a leaf module so `tsx` never evaluates the glob.

**Storage holds the raw `Program` JSON** (L-55). A zustand `persist` wrapper
does not suit one key per challenge, and `migrate()` must validate whatever
is returned; the raw form is also what Export writes (L-53). A rejected value
resolves to an empty main rather than failing the load.

**`state` is refreshed while playing, as a copy** (R-12). The `Result` tab
must update per step at speed 50. The refresh was a shallow copy of the
frame list, which shared the runner's variable maps and heap: a published
`state` changed at the next step, so a screen could neither compare two
states nor memoize on one, and a `compare` event narrated later showed a
list's current contents. A published `state` is now a copy of the
variables and of the heap entries; values are immutable records, so one
level is sufficient. The cost per publish is proportional to the size of
the heap and is among the costs to measure (#18). Batches publish once per
batch.

**The chart highlights the owning statement** (U-39). `compare`, `read`, and
`call` events carry expression ids while the chart has nodes only for
statements; `ownerStmts()` resolves them once per program. The ✓/✗ mark is
the last `compare` under the diamond's condition, cleared on `enter`, so a
loop shows the current iteration; `not (a < b)` shows the inner compare,
which is accepted.

**Template hooks on `NodeDef`** (N-08). Selecting `templateCreate`,
`templateFalse`, or `templateNot` requires facts the slots do not carry
(`bool` has no slots; `num.raw` is not a slot), and a switch on kind in the
UI is forbidden by N-01. `form()` and `text()` keep the choice with the
block. The `empty` block receives i18n keys for the same reason: chips render
every kind through its template.

**Tests are judged on disposable runners** (C-15). The driver shows one run;
judging three tests through it would discard the learner's position. Each test
runs in R-11 batches with `setTimeout(0)` between them so a non-terminating
program cannot block the tab. `judge()` is shared with `scripts/check.ts` so
the Result tab and CI agree on C-10.

**The end-to-end tests load a solution through storage**. C-13's restore path is
the only means of placing a finished program on the page before editing
exists, and a development-only affordance would be untested UI.

**Store actions are function properties, not methods**. oxlint's
`unbound-method` flags a method signature whenever a selector extracts it
(`useRun((s) => s.seek)`); the layout store already used the property form.

**Hover and click on generated markup use delegated DOM listeners**.
`jsx-a11y` forbids mouse handlers on `ol`/`li`/`tr`; one listener on the
container reads a `data-*` attribute and satisfies the rule without
converting code lines into buttons. Used by the `Python` tab (U-25).

**Validation is memoized per Program object**. The driver, the chart
(`firstAssignments`), the run controls, and Submit all request it; a
`WeakMap<Program, Analysis>` in `validate.ts` runs the Collector once per
program identity, which also matches how diagnostics are published.

**`print` records its line before yielding**. R-03 orders the event after
the expression events; whether the runner's `stdout()` is updated before or
after the yield is unobservable in events, and updating first lets the
driver read `runner.stdout()` instead of rebuilding it from `print` events.

**A `create` template after a frame**. `if c: y = 1` followed by `y = 2`
renders both as `create y`: L-41 makes `y` invisible after the frame, so the
outer assignment is where the region gains the name.

**The CPython epilogue converts values in Python** (R-20). Serialising Python
values as `Data` on the Python side (`$float`, `$int:` keys, `$cls`/`$id`)
lets the TypeScript side compare with the same `dataEquals` used for
expectations, so one equality rule (C-10) serves both engines.

## UX redesign

The UI is designed for a person who has never programmed (S-09), around
one task, building a program as a flowchart and observing it run, and one
loop per problem (S-10): read, build, run on one input, compare, fix,
submit, proceed. The rejected alternative, cards that read as code lines
with a blocks palette, a properties panel, and tabbed run panels, kept
control flow invisible, placed values in a table separated from the program,
and placed instructor tools at the same level as the core loop. The screens
behind the ids in `05-ui.md` are on the design canvas "AlgoFlow Screens"
(the flowchart and loop notation studies are on the earlier canvas "AlgoFlow
Redesign"; both links are in `private/PROMPTS.md`). The division of the page
is described under "Screen structure" below.

**A flowchart, not sentence blocks or a node graph** (U-30). Three
directions were drawn. Scratch-style sentence blocks keep branches as
indented text and never show two paths. A free node graph (n8n, Blueprint)
requires the learner to manage edge drawing and loops manually and does not
suit a structured `Program`. The auto-laid-out flowchart shows Yes/No paths
and loop-backs graphically and keeps the AST as the source of truth.

**Loops are drawn as init, check, and step** (U-33, N-09). The JIS X 0121 /
ISO 5807 loop-limit pair is the standard form for counted loops, and a
dashed container is legible, but both conceal the check. Python's
`for i in range(...)` and JavaScript's `for (init; check; step)` both run as
init → check → body → step → check, and `while` is that shape, so one form
serves every loop and matches the execution order. The generated nodes
are grey and owned by the loop block so the program retains one `for` and the
emitter is unchanged. The check reads `Is i < stop?` with the bound as
written, not an inclusive `Repeat i from 1 to n` (emitting
`range(1, n + 1)`) and not a display-only `Is i ≤ n?` for `x + 1` bounds:
the check reads as the emitted `range` does, so the chart and the `Python`
tab agree (the third commitment of `00-conventions.md`), and a
display rule for one bound form would mix `<` and `≤` across loops.

**The catalog is its plans** (U-10..U-14, C-16). "Day 1/2/3" tabs and a
"micrograd" tab grouped problems by course logistics; ordered study plans
state which problem to attempt next instead. With 38 problems the page is one
section per plan plus `More problems`: a flat list under a filter row
(topics, difficulty, status, search) is LeetCode's response to thousands of
problems, and here its order would be the plans' order in any case. Topics
remain as tags so a problem outside the plans states what it practises. No
global progress meter and no "blocks used" column: neither assists a
beginner in choosing.

**The moment is on the chart, the state is in the panel** (U-23,
U-61..U-63). Data, Trace, and Output tabs under the program drew the
learner's attention away from it, so the current step stays on the chart:
the current node, the taken path, the `✓`/`✗` marks, and the narration beside
the node, which carries the values relevant at that step (`Pass 3: i is
3`, `"3 is divisible by 15" is false`). A badge with the loop variable
beside the loop's check was rejected: it is state, it sat beside a diamond
that is outside the viewport while a long body runs, which is when the pass
number is required, and extending it to `while` required an assumption about
which variables to show. The state does not fit on the chart: a card
positioned at the chart's top right covers the `Yes` branches that extend
rightwards, an output strip beside `End` is outside the viewport in any chart
longer than the window while the run scrolls to the current node, and a grid,
a tree, or an object graph requires substantial space. Variables and output
therefore live in the `Result` tab, beside the expected values. A trace table
(one row per event) serves instructors, not learners, and belongs to no
milestone.

**A loop pass starts with blank diamonds** (U-61). Clearing a mark only on
re-entry leaves a nested diamond that the current pass skips displaying the
previous pass's `✗`, which reads as "this condition is false now" for a
condition that was never evaluated. U-61 draws the current pass, so the
marks share that scope.

**Help is the keyboard table** (U-04). The keyboard actions have no other
surface, so a dialog holding that table plus the build → run → submit loop
is the minimal content the button can open. Directing it at the problem
description instead has no meaning on the Problems page, which has no
problem open.

**The input is a node, and Run and Submit share one view** (U-32, U-23,
C-15). A test-case panel under the chart duplicated the Input node;
choosing a case on the node is the same action as reading it. The case chosen
there has an expectation, so a Run shows `Expected` beside `Output` from
the first step and ends with that case's verdict; Submit is the same view
with one chip per case. The learner observes that Submit is Run on every
case, and the comparison step no longer waits for a submission.

**Python is opened, never shown** (U-25, U-20). A per-block Python fragment
and Python visible by default taught syntax before the flow was
understood. Python is a tab of the panel that nothing selects for the
learner; the Accepted view offers it (`See your program as Python`) because
the moment after solving is when code is worth introducing. A tab rather
than a pane to the right of the chart keeps the page at two regions at every
width; the cost, not seeing variables and code simultaneously, falls on a
reader who has chosen to view code and who still has the chart and its
narration.

**Blocks are added from the edge, edited in place** (U-34, U-41). A palette
requires a beginner to survey a vocabulary before writing; the `+` on the
edge where the block will be placed, followed by an editor popover on the
node, keeps the learner's attention on the chart. Conditions are offered as
sentence templates first (`is divisible by`, `equals`, …) with the chip
editor behind `Build my own`.

**English first** (S-03). The product is not Japan-specific; `en` is the
development locale and Japanese is a translation milestone.

**Submit, not Check**. The word matches the problem-set vocabulary learners
encounter elsewhere, and an attempt marks the problem `attempted` (C-17).

**Solution revealed on request**. A learner may view the solution; hiding
it entirely would cause self-learners to look elsewhere. Whether it was
shown is stored (C-17) only so the tab remains open after a reload, as the
number of revealed hints does.

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

## Learning loop and modules

A concept note of 2026-09-17, written without knowledge of the
project, describes an environment in which any block can be opened, its
implementation inspected, and a learner's own abstraction reused in a
larger program. The blocks of `03-nodes.md` are its lowest level and a
function is its middle level; what the spec lacked was a way to keep a
function beyond one program, the loop that makes a learner build one, and
the run-time controls that let a program be read at more than one level of
detail. The entries below record what was taken from the note and what
was not.

**The learner and the loop are spec facts** (S-09..S-11). U-50's
templates, U-72's vocabulary, and U-61's drawing of the run on the chart
all follow from "a person who has never programmed doing one loop per
problem", so the facts belong in `01-scope.md`, where every U id and every
later proposal can be judged against them. A table of users by role was
dropped: the application has no roles (S-01), a trainee and a self-learner
use the same features, and an instructor's work (challenge files, plans,
built-in modules) is repository authoring covered by `06` and `07`, not a
feature. "The environment is the core and the problems are a curriculum"
was rejected as a spec sentence because it states nothing testable.

**`submissions` and `starter` were removed** (C-17, C-01). The submission
count had no consumer once instructor observation was dropped, and no
challenge loads a starter once the neural-network plan chains through a
module.

**A module is a function that outlives its program** (08-modules). Its
semantics are a function's; the difference is ownership and lifetime: a
function belongs to one `Program`, a module belongs to the learner and is
referenced by many programs. FlutterFlow's Action Blocks are the model:
defined once per project, parameterised, called from any flow, edited in
one place with the change reaching every use. Here a `Program` is the size
of one FlutterFlow flow, so the project-level layer had to be added outside
`Program`. `Module` was chosen over `Functions` (collides with a program's
own function tabs, excludes classes, cannot group a `heap`) and `Library`
(a single flat collection, and already used in `docs/` for
dependencies); it is the Python word, the learner encounters it again as
`import`, and it groups
`heap_push`, `heap_pop`, and `heapify` the way the note's data-structure
tree does.

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

**A module uses no other module** (D-05). Module-to-module imports need
dependency order, cycle detection, and a second `from … import` layer in
E-09; nothing in the curriculum needs them, so `micrograd` is one module
rather than `engine` and `nn`. The rule can be lifted when a plan needs a
module built on another; the trigger is a challenge whose `module` would
have to call another learner module.

**A learner module shadows a built-in one** (D-02, D-11). The note's
"rebuild it from basic blocks" needs the learner's version to take
precedence under the same name, or every later problem would have to be
told which one to use. `Clone` is the entry to editing a built-in module
and makes the shadowing explicit on the Modules page; the word was chosen
over `Copy to my modules` because, like `Module`, it is one the learner
encounters again when programming.

**Modules are emitted as files, not inlined** (E-02, E-09, U-25). Inlining
a module's functions into `main.py` would make the `Python` tab state
something the chart does not (one program) and hide the module the learner
built.
`from heap import heap_push, heap_pop` plus `heap.py` in its own tab states
exactly what the chart states, keeps every file copyable into a Python
interpreter, and introduces the term the learner will need. Calls remain
unqualified (`heap_push(h, x)`), because `heap.push(h, x)` would collide
with the method syntax of G-03.

**A module call is one step; its interior is reachable by one click**
(R-16, R-11, D-18, D-06). The note's "Extract Minimum can be used as a
single operation, and opened" is taken literally: in a program's run a
module function is a block, narrated by its returned value, and
`Open <name>` shows its interior. Opening it in a second browser tab keeps
the program, even a paused run, exactly as it was, so no context is lost;
and the Module page receives that call's arguments and runs the one
function in isolation, which locates a bug in `heap_pop` more directly than
stepping through hundreds of steps of `dijkstra` to reach it. While the
learner is still building a function it belongs to the program and is
stepped into; `Move to module` is the point at which it becomes a block.
Showing the module's chart in place within the program page was rejected:
it needed a second, shared-edit mode of the same page. The position bar
counts visible steps while `Done.steps` counts every event, so
`dijkstra-heap` still shows fewer steps than `dijkstra-grid` on the
Accepted view. Costs: a `storage` listener so other tabs observe a module
edit (D-22), and two tiled windows fall below the 1280 px gate (S-02), so
the second tab is used as a tab.

**Modules have cases because a module change reaches every program**
(D-19..D-21). The absence of a challenge had been read as the absence of
tests, but a module is where tests matter most: editing `backward_step` for
the `tanh` problem can break every solved problem that uses it, and the
module is where that is detected. A case is a saved run (arguments,
returned value, arguments afterwards), the same idea as a recorded
expectation (C-20), so no test is written from an empty starting point;
`Test` is the established programming term, distinct from a problem's
`Submit`. Cases recorded from an accepted submission were rejected: no rule
selects suitable calls (the first `heap_push` of a test pushes onto an
empty heap, and a recursion produces thousands of calls), they would fix
the learner's own behaviour as correct, and they omit the act of judging a
result. Instead a learner module inherits the built-in module's cases for a
function of the same name: written by the author, with edge cases, checked
in both engines, and able to detect what the problem's tests do not.
`toValue` rebuilding one object per `$id` (L-06) is what lets an object
graph be a case argument or be transferred to the Module page.

**No editing while paused** (U-60). Replaying an edited program to the
same step count arrives at a different position in a different program, and
a rule that resynchronises by node breaks on the edited node; a learner
would interpret either outcome as the fix having moved the run. The
build/run boundary is retained, and the fix cycle is Stop, edit, Run.
`Run to this node` (a deterministic means of returning to a position of
interest) was recorded and not scheduled.

**Load the solution, then change it** (U-22). A read-only solution stops
the note's loop at "inspect"; loading it into the learner's chart as one
undoable edit continues to "modify". The same rule applies to built-in
modules (`Clone`): what the learner did not write is read-only until
copied, after which it is the learner's own. `Copy into this program`,
which copied one module function into a program where it shadowed the
module, was dropped: it was a second means of owning module code, and it
left a call that appears identical while resolving to something else
without indication. A learner's own module is edited
in place, a built-in one is cloned, and a `defines` problem is built, not
copied.

**Step over and `Open <name>`** (R-17, U-41). Reading a program at more
than one level of detail (the note's high, mid, and low levels) is a
run-time operation: Step over keeps the learner at the caller's level, and
`Open <name>` descends one level. Step (into) and Play still descend into
the program's own functions. Inline expansion of a call inside the caller's
chart was rejected: the flowchart loses legibility one level down, and a
function would have two editing locations.

**No `Make a function` from a selection**. Extracting statements into a
function needs parameter and return inference and a multi-select UI; the
existing `Add function` tab plus dragging nodes into it (U-36) achieves the
same result, and choosing the parameters manually is where a beginner
learns what a parameter is.

**Cards before bars** (V-01, V-03). Bars show the pattern of a list
immediately and are the conventional sorting representation, but course
inputs have five items, and every non-sorting problem needs the number
itself (`9 > 7`, evenness, `dp` values); converting a height back into a
number is a cost a beginner incurs at every step. Cards with the value
shown are the default up to the card limit, bars beyond it, and bars remain
a switch (V-06) for anyone who prefers the graphical representation. A
write changes a bar or card immediately: the orange highlight indicates the
change and the narration states the previous value, so a height transition
adds nothing. The swap slide is retained because it is the only feature
that distinguishes an exchange from two writes.

**The view switch lives outside the AST** (V-06, `algoflow:views`). A
view preference in `Program` would be exported, imported, and diffed with
the code; keying it by storage key and variable name in its own store
keeps L-53 and `Export` about the program only. A challenge never names a
view: the third commitment remains selection by value type, with the
learner's switch as the one override.

**T-09 removed, V-05 without a number, T-10 in two stages**. A frame-time
assertion in Playwright on CI hardware is either too permissive to be
meaningful or unreliable; `00-conventions.md` makes untested numbers
illegal in the spec, so V-05 keeps the implementation constraint and the
32 ms target is recorded here. Screenshot baselines require an update on
every UI change while the UI is still gaining pages; each milestone saves
screenshots for review and the last milestone (M-10), after which no page
is added, enables the comparison.

**Python stays the only generated language** (04-runtime). The note
lists JavaScript and Dart; JavaScript would not preserve the third
commitment: it has no int/float distinction, `-7 % 2` is `-1`, there is
no `//`, and `in` on an array tests indices, so a faithful emitter would
either produce output differing from the chart or wrap arithmetic in
helper functions unsuitable for a learner to read. If a second language is
required later, the block language must first be narrowed or the helpers
accepted.

**No statement-level Python import** (G-01). The beginner's loop never
involves typing Python, and a learner able to type it does not need blocks;
the block language is a strict subset, so most pasted Python would fail
without a clear diagnostic. Text entry remains at expression level (U-55),
and the `Python` tab, whose lines and nodes select each other (U-25),
provides the transition from chart to text.

**Playground holds many programs** (S-07, U-15, U-05). One `free` slot
made starting a new program an act of destruction; the note's "use it in
a larger program" has nowhere else to happen than Playground once a plan
ends. `Open in Playground` converts a solved problem into the start of that
larger program, with inputs fixed as the assignments E-03 already emits.

**`heap_push` and `heap_pop`** (D-16). `push`/`pop` as module functions
would appear beside the list method `pop` in the block menu and be confused
with it (`pop(h)` versus `h.pop()`); the prefixed names follow
`heapq.heappush` and keep the module's name in every call.

**The module store names no service** (D-14). `localStorage` is sufficient
for a three-day course on one machine, and export files cover
transfer between machines; a server would justify its accounts only once
sharing between learners or synchronisation across devices becomes a goal.
Keeping every read and write behind one store lets that decision be taken
later without modifying callers, and the specification does not commit to a
vendor.

**Plans `structures` and `dp`; the rest stays out of plans** (S-05). A
plan's order must be significant. The seven `structures` problems build on
one another through the list-as-stack, list-as-queue, and `heap` module;
`dijkstra-grid` then `dijkstra-heap` shows a block being swapped for a
faster one with the same answer, visible in the step count on the Accepted
card. The three `dp` problems widen the same table technique (one
dimension, two, strings), which is the same form of concept progression as
the course plan. `gcd`, `is-prime`, and `fisher-yates` are not built upon
later; `fibonacci-memo` and `hanoi` would form a two-problem recursion
plan, which is insufficient until further recursion problems are added.
Adding any of them to the course plan is the instructor's decision, since
that plan mirrors a fixed three-day course.

## Screen structure

Every part of the page was re-examined for whether the learner's loop
(S-10, S-11) needs it, with modules, Step over, many Playground programs,
and the view switch in place. The screens are on the canvas "AlgoFlow Screens"
(link under "UX redesign"), drawn at 1280 × 800, the narrowest supported
width, so that a two-region page is checked where it is tightest.

**Two regions, on every page** (U-03, U-20). Panel and chart, nothing
else: the `Result` tab absorbed the floating variables card and the output
strip, the `Python` tab absorbed the right-hand pane, and the transport is
docked under the chart. The panel may expand to half the viewport because a
grid, an object graph, or code needs the width, and with no third region
nothing competes for it. Playground and Module pages have the same panel
without the `Problem` tab, so the three editing pages share one skeleton.

**A path bar instead of tabs** (U-30, U-68). Tabs for `main`, functions,
and classes were a flat list, conveyed no call relationships,
overflowed at twenty charts, presented a trainee with a single `main` tab
beside a `+` prompting a function, and needed a second component while
running (a call-stack strip) plus a rule exchanging one for the other. One
path states the current position in both modes: in build mode the trail of
`Open <name>`, while running the call stack. It is always shown, even with
`main` alone: hiding it would remove the only place to add a first
function, would make a new component appear at the moment functions are
introduced, and would need a display condition; shown, it introduces the
term `main` that the `Python` tab's `main.py` repeats. All charts side by
side on one canvas was rejected: three charts do not fit 960 px legibly.
Observed while drawing the board: full argument text does not fit a
segment, so only numbers, texts, and booleans are shown.

**A function's own operations sit on its `Start` node** (U-31). With tabs
removed the path bar remains purely navigational; the `Start name(params)`
terminal is the function's signature, so its editor holds the name, the
parameters, `Delete function`, and `Move to module…`. This also gives
parameters an editing location, which the tabbed design never stated.

**Run knows the end before it plays** (R-11, U-60, U-81). Execution is
deterministic and inexpensive, so Run executes everything first and then
replays. That informs the learner immediately that a loop never ends (at
playback speed `E_STEP_LIMIT` is five and a half hours away at speed 50),
gives the position bar its length, and lets a Wrong Answer move directly to
the step that printed the first wrong line instead of stepping there. Only
the count, the outcome, and the steps of the prints are kept, so a backward
Seek replays from the start, as Back has always done. Observed while drawing
the board: with the position bar the transport is too long to float over the
chart's corner without covering the loop's back edge, so it is docked.

**A wrong answer marks no node** (U-81, U-82). A runtime error has a
location, so its node is outlined. A wrong answer has a differing line and
the node that printed it, which is rarely the cause: a loop started at 0
prints `FizzBuzz` from a correct block. Marking that block asserted
what the application does not know, and adding the loop variable to the
hint only mitigated an incorrect mark. Red on the chart now means a runtime
error and nothing else. The route to the cause is one button,
`▶ Watch this case`, which opens the run paused at the first difference
(the `print` of the differing line, or the end of the run when nothing
printed it, which also covers a wrong variable); from there the values are
in `Result` and Back leads to the cause. A second button with a label per
kind of difference was dropped: the narration at the arrival step states
what happened there.

**No generated hint** (U-82, U-23). A sentence classifying the first
difference as a missing line, an extra line, or a different value had no
rule behind it, and none can be given: whether `FizzBuzz` against `1` is a
wrong value or one extra line that shifted the rest can only be inferred
from the following lines, and that inference fails (`1, 2, 3` against
`2, 4, 6` is read as an extra `1`); a full line diff infers differently and
no more reliably. It is the same fault as marking a block: stating what the
application does not know. The rows constitute the entire message: output
aligned by position with blank cells, and every expected variable as a row,
blank when the program never created it, which also reveals a misnamed
variable (`total` blank beside `sum_all 55`) with no special case. `Hint`
retains one meaning, the three authored hints of a challenge.

**One breakpoint and Skip, not `Next pass`** (R-19, U-60). Stepping is one
event, Step over has no effect before functions exist, and dragging the
position bar cannot arrive exactly at the start of a given pass, so a
coarser movement was needed. `Next pass` (run to the next `loop` event) was
a special case tied to one event type, and it failed its own purpose: in
bubble sort it stops at every inner pass, whereas the instructive unit is
one outer pass putting the largest item last, and it provides no way to
specify which loop is meant. A breakpoint specifies it by location: on the
outer loop it advances an outer pass, on a `print` it advances to the next
output, and nothing about passes or events has to be learned. It is kept to
the smallest form: one at a time, set by clicking a node during a run (a
click while playing pauses first, the rule the path bar uses), removed at
Stop, never stored, with one rule: the run pauses when it arrives there.
`Skip` advances without drawing to the next pause, or to the end, which
also replaces dragging the bar to its right end. It cannot be set in build
mode, where a click edits. Step over is retained: it is tied to calls, the
level of detail the design is built on. `Breakpoint` is the term used by
every debugger the learner will encounter later, as with `Module`,
`Clone`, and `Test`.

**One way to enter a value** (U-32, U-50). A custom input was a Python
literal box, which requires a first-day learner to supply quotes and
brackets and responds with `Syntax error at character 3`. Fields chosen by
the input's type (a number field, a text field, a toggle, a literal box for
lists) were rejected as four special cases that still left the most
difficult one, a list, to raw syntax, and as a second means of entering
values beside the one blocks use. `Custom…` opens the value editor of a
slot limited to literals, so anyone able to fill a block can change an
input and conversely, lists are built as chips, and `Type as text` remains
for those who prefer to type. A value of the wrong type for an input is not
validated: the runtime error explains it. It is delivered with the editor
in M-04; the read-only M-03 lists the cases only.

**Small rules settled with the boards** (U-33, U-40, D-22, U-85). A slot
drawn on a generated loop node is the loop's slot, so the rule for slots
(U-41) already makes `Set i to 0` the route to the start value, the most
common beginner error, with no rule of its own. The menu's categories are
ordered Basic, Control, List, because a beginner needs `if` and `for`
before list blocks. A module edited in another tab does not stop a run: the
run keeps the modules it started with, nothing fails because replay is
deterministic, and the next Run adopts the change, which needs neither a
stop nor a message explaining one. The refusal of a built-in function in a
`defines` problem names the module and both remedies. hanoi prints the
disk it moves, since `src` and `dst` are lists with no name to print; the
final lists verify the moves. Proposals dropped as special cases: filling a
`for` variable with the first unused of `i j k` (an inference, and
`create()` receives no context), narrating the operations inside a
comparison that matches no template (a new mechanism for a rare case;
`"5 > 3" is true` is not incorrect), and comparing step counts across the
three sorts (an inferred relation between problems, and one more stored
field).

**Four rules removed or corrected on a pass for special cases** (U-53,
C-03, U-50, L-26). The Variables group offered `v + 1` and `v - 1` when
the slot was an `index` or a `for` bound and a `for` variable was visible:
an inference about the learner's intent, tied to two block kinds, which
made the menu branch on kind against N-01; wrapping `i` with `+` or typing
the text achieves the same result. A boundary test was one whose localized
name began with `edge:`, a flag concealed in a display string, and the name
itself was displayed nowhere (cases are shown by their inputs) while still
requiring a Japanese text in M-10; the name was dropped and the flag is
`edge: true`. The templates `is even` and `is odd` matched the same
expression as `is divisible by`, so one condition had two sentences and
needed a priority rule for the diamond and the narration;
`is divisible by 2` is sufficient. `foreach` iterated over a snapshot, so a
body that changes its list ran differently here and in the emitted Python,
without any indication, unlike the other differences from Python (a `bool`
is not a number, recursion stops at 200, `E_DECLARE_FIRST`), which are all
stricter and terminate in an error; it now visits the live list by index as
Python does, keeping the third commitment for learners' programs, which are
not checked against CPython.

**Run with diagnostics leads to the first one** (U-60). A disabled button
gives no reason; an enabled one that opens the chart holding the problem,
selects the node, and shows the message does. An empty slot is handled the
same way and is otherwise not an error (U-37): a block marked red at the
moment of insertion reports an error before the learner has finished
entering the value.

**After the run has ended, a click edits** (U-60). Once a run is `done` or
in `error` there is no position to preserve, so clicking a node leaves run
mode and opens its editor; after a runtime error that is the failing node,
one click from its correction. While paused there is a position, so leaving
requires an explicit `Stop`.

**One step is one event, and every event is narrated** (U-63). Grouping
events into one step per statement was considered; arrival followed by a
decision and arrival followed by a value change are two distinct
occurrences, consistent with the machine performing one operation at a
time, so event stepping is retained, with sentences added for `enter`,
`read`, `swap`, and the end. A comparison is narrated
with its template sentence and the values (`"3 is divisible by 15" is
false`) when the condition matches a template, because the event's own
text is the evaluated operands (`3 == 0`), which conceals the origin of the
3, and because the diamond itself is written as that sentence. Python
notation is excluded from the narration.

**The `+` menu offers statements, in a beginner's order** (U-40). Listing
every registered block placed expression blocks at positions where they
cannot be inserted. Blocks that cannot be placed at the current connector
are shown disabled with the reason rather than hidden, which conveys that
they exist and where they apply. The bare `expr` statement block is
meaningless to a beginner and is hidden; it appears as method statements
and calls. Restricting the menu per challenge was rejected: it conceals the
language and adds authoring work. Observed while drawing the board:
built-in module groups would overfill a trainee's menu, so modules are
placed behind one `Modules ▸` row.

**Names come from the problem** (U-41). A verdict compares
`expect.variables` by name, so a learner who names `total` differently
fails without a visible reason; offering the expected names first removes
that failure mode. This is the problem's own contract, not a challenge
determining the appearance of the UI, so it does not affect the views
commitment.

**The popover stays; in-node editing was rejected** (U-41, U-50). The
chart is shown fitted to its width, a diamond has little room, and nested
chips need space at full size; the popover is always at 100 %. What
changed is the cost of reaching it: a click on a slot drawn on the node
opens the editor with that slot's menu open, and the menu starts with one
field that takes a number, a quoted text, or letters to filter.

**The top bar holds only the loop's actions** (U-03, U-05). The title
is retained because it is the only indication of the learner's location
when the panel shows `Result` or is collapsed, and because Playground's
editable title and a module's name need the same slot. The difficulty badge
was removed: it assists in choosing a problem, not in solving one.
`Open in Playground`, Help, and the new `Start over` (no means of returning
to an empty chart existed other than deleting every node) are placed under
`⋯`.

**The solution is shown where a chart fits** (U-22). A flowchart with
branches does not fit a 320 px panel, so the solution occupies the chart
region, read-only, beneath a band with `Load into my chart` and
`Back to my chart`. Hints became a section under the statement rather than
a tab, because a hint refers to the statement it would hide.

**A plan's end is said, not skipped** (U-83). With sections per plan,
the next row after the last course problem would place a trainee in the
first data-structure problem; `Plan complete` returns the choice to the
learner.

**The driver publishes more than R-12 first listed** (R-11, R-12). These
fields were found necessary while the driver was built without a screen.
`taken`: U-61 colours the path of the current pass, which cannot be rebuilt
from `lastEvent` after a Seek, so the projection keeps it beside `verdicts`
and a `loop` event clears both. `pass`: `Pass 3` requires a count for each
loop since its `enter`, which only a replaying projection holds. `busy`: the
five statuses have no value for a pre-run, a Seek, or a Skip in progress,
and a program that does not terminate pre-runs for several seconds (500
timers, which browsers clamp to about 4 ms each); a sixth status would have
made every test of `status` in the screens three-way. While `busy`, Step
and Play do nothing, because taking over the runner would leave a Seek at an
arbitrary step under a position bar that shows another; Pause still cancels
a Skip, and Pause during the pre-run opens the run paused rather than being
discarded. `verdict` is judged once, on the pre-run's runner, and published
only at step `total`, so Back from the end removes it again. `Watch this
case` is `run({ watch: true })` and not a step passed in: the runners of
Submit record no print steps, so only the driver's own pre-run determines
where the differing line was printed, and an outdated difference cannot be
passed in.

**A step count includes the failing step** (R-11). A step is one call of
`next()`, and the call that fails is one; an error run therefore has
`total = events + 1`, step `total` has no event, and the last position of
the position bar is where the error is shown. A finished run is `done` on
reaching `total`, not one Step later: U-81 names that step "the last step
of the run", and the driver makes one further call of `next()` there so
that the frames have unwound.

**The `compare` event carries values, not text** (R-02, R-06). Its text was
the operands in Python's `str()` form (`3 == 0`, `True`), which the
narration could only quote. With the two values, the narration writes them
as the blocks do and fills the template of the condition from them,
whatever the blanks hold; the operator is on the node. `is divisible by` is
the one template whose blanks are not the compared operands (`a % b == 0`
compares `a % b` with `0`), so it reads a variable blank from the frame and
applies only when both blanks are variables or literals; otherwise the
comparison reads as `equals` over its operands. Every comparison matches a
template, so the former fallback to the event's text no longer exists.

**A diamond asks; a slot states** (U-33, U-50). `Is {cond}?` around a
template sentence reads `Is x is divisible by 15?`, so each template has a
question of its own beside its sentence (`Does a equal b?`). Template
sentences apply to the whole expression of a statement's slot only: inside
an expression the chips keep their symbols, because `x is less than 2 and x
is less than 9` under `Is …?` is not legible, and `Is x < 2 and x < 9?`
matches the generated `Is i < n + 1?` of a `for`. The variable block is
obtained from the parser (the block a bare name parses to), so the matcher
and the narration name no block kind (N-01).

**Showing the solution is recorded** (C-17). `solution: true` requires an
entry, and a learner who only viewed the solution has used the problem as
much as one who took a hint; the entry is `attempted`. The key holds the
bare record, as C-17 writes it, through a custom storage of the persist
middleware.

**`break` and `continue` are drawn as boxes until N-09 has a jump shape**
(U-33, N-09). Both declare `requires: "loop"`, so only the kind
distinguishes an exit from a jump to the next pass, and the spec draws
neither. They keep an ordinary edge to the next node until N-09 gains a
jump shape (#7). A `Return` is identified by `requires: "function"`: its
edge runs to `End` along one vertical line on the right, and carries the
connector after it, since no other edge leaves it. After a branch whose
regions all return there is no edge and no connector.

## Process

**The spec is tracked; only the prompts are private** (P-10). Until M-03 the
whole of `docs/` was untracked: a working spec edited freely, with no
history. Once every commit and test cited an id, a reviewer required the
spec the code was written against at that commit, and a session that
reverted a branch lost a file that had never been committed. What remains
outside the repository is what has no reader other than the person running
the sessions: the milestone prompts and the links to the design canvases.
Everything a reviewer, a contributor, or a later session needs is in git or
on GitHub.

**No handoff file** (P-14). `NEXT.md` held four kinds of text: the state of
the repository (git and the pull requests state it), what a session built
and how to use it (the code and its doc comments state it), open questions
and follow-ups (issues state them, with a milestone and a history), and
tool behaviour (`CLAUDE.md` states it, and it is loaded at every start). A
file rewritten at the end of every session and read at the start of the
next was a fifth copy of the same facts, diverged between sessions, and,
being untracked, was the one file a reset could lose. Milestone prompts
remain, in `private/PROMPTS.md`, because they are written for a person to
paste.

**Boards are exported into the repository** (P-13). The screens were drawn
on design canvases, reachable only by link. A link cannot be read by a
session, reviewed in a pull request, or diffed when a board changes. A PNG
in `docs/design/` for each board, with a README naming what each shows and
where the spec deviates, provides every reader with the same source; the
canvas remains the tool for drawing, and the spec remains the authority. A
board that a later board or the spec supersedes keeps no PNG, because a
PNG in the repository is read as the source of a screen; the README names
it so that a reader of the canvas knows it is not current.

**Issues carry the questions; the spec carries the answers** (P-12). The
spec states facts and never history, so an open question has no place in
it. `NEXT.md`'s "Open issues" and "Follow-ups" lists lost their reasons and
their age at every rewrite. An issue keeps both, is assigned to the
milestone that needs the answer, and is closed by the pull request that
writes the id, which is where the answer belongs. Four labels are
sufficient because they answer the one question a session asks of an issue:
whether it requires a decision, a fix, a merge of two copies, or a
measurement first.

**One pull request per few slices** (P-11). The commits were already
vertical slices; the pull request is the unit a review can encompass and CI
can attest to. Rebase merges retain the slices as commits on `main`, where
their messages cite the ids; a squash would discard that.

**Identifiers are stable; texts are not** (00-conventions, P-10). Commit
messages and tests cite identifiers, and a statement's text is revised as
the design is settled (R-06 changed what a `compare` event carries; R-12
gained six fields). Renumbering would break every citation; retaining the
number and revising the text breaks none, because the spec is tracked and
the revision is committed before the code, so each citation resolves
against the tree at its own commit. A withdrawn statement retains its
number for the same reason: the citations that predate the withdrawal still
name an existing statement.

**An issue states when it is done; a pull request states what it closes**
(P-11, P-12). The first issue template had three inline labels, Where, What,
and When. When repeated the Milestone field, which is one fact recorded in
two places; nothing stated the condition that closes an issue, although
P-12 defines one per label; and a `defect` mixed what the id states with
what the code does in one paragraph. The sections are now the conventional
ones: Summary, Where, Expected and actual for a `defect`, and Done when. The
pull request template gained Closes, because GitHub closes an issue on merge
only when the body names it, and Screenshots, because the pull requests from
M-03 session 2 onward change screens and T-10 requires the images. A
checklist was not added: the template asks for pasted command output, and a
ticked box is an assertion.

**The panel's upper bound is applied with the viewport, not stored** (U-03).
The store held a constant maximum of 480 px from the retired shell. Half the
viewport width is not a constant, and a store that read `window.innerWidth`
would not run under the node test environment and would keep an outdated
bound after the window is resized. The store therefore keeps the requested
width with its lower bound only, and one pure function applies the upper
bound from the viewport width given to it, both when the handle sets the
width and when the page draws it, so a stored width above the bound is drawn
at the bound without being rewritten.

