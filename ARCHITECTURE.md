# Architecture

AlgoFlow is a block-based tool for learning algorithms, and it runs entirely
in the browser (`docs/spec/scope/`). Its blocks cover a fixed subset of
Python. Functions and classes can be moved into modules and reused across
programs (`docs/spec/modules/`).

## Fixed choices

These choices are settled. Change one only through a proposal to the
developer (`CLAUDE.md`, Judgment).

- Use TypeScript 7, whose Go compiler is the `tsc` binary, with Oxlint
  (`oxlint-tsgolint`) and Oxfmt. Don't add ESLint or Prettier, and don't use a
  TypeScript earlier than 7.
- The app uses shadcn/ui on Base UI (not Radix), dnd-kit, and Zustand.
- Don't add a graph, flow, or editor library. The app lays the chart out
  from the `Program` and nothing is positioned by hand
  (`docs/spec/ui/chart.md`), so a library for freely placed chart nodes and
  edges would have nothing to do.
- `src/lang`, `src/runtime`, `src/python`, and `src/blocks` import only from
  one another: through `@/` across folders and `./` within one, never
  `../`. Their tests may also import `vitest` and `@/i18n`. `.oxlintrc.json`
  enforces this.
- Each block definition lives in its own file in `src/blocks/`, and no
  other code branches on a block's kind or name (`docs/spec/blocks/`).
  Every consumer reads the block definition's declarations instead, so a
  new block definition works in the menu, the chart, and the editor with
  no other change.
- Every user-visible string comes from `src/i18n/en.json`, so adding
  Japanese means adding one more catalog with the same keys.
- `int` and `float` are distinct values, and lists, dicts, and objects live
  on the heap (`docs/spec/language/`).

## Code map

Each layer depends only on the layers below it: `src/ui` on `src/store`,
and `src/store` on the core (`src/lang`, `src/blocks`, `src/runtime`,
`src/python`, `src/challenges`, and `src/i18n`). Nothing below `src/store`
depends on React, so the core runs under Vitest and in `scripts/check.ts`
without a browser.

- `src/lang`: the `Program` AST (`types.ts`), `validate()`, pure edit
  functions that return a new `Program` (`edit.ts`), and the conversion
  between `Data` and `Value`, which places lists, dicts, and objects on the
  heap (`data.ts`). `validate()` returns `Diagnostic[]` and runs after every
  edit and before every run. Never change a `Program` in place:
  `validate()`, `refusedDefinitions()`, and `nodesById()` are memoized per
  `Program` object, and the undo history keeps earlier programs.
- `src/blocks`: one block definition (`BlockDef`) per file. It owns its slots,
  `create()`, `run` (what the interpreter does), `python()` (the exact
  Python it emits), and `chart` (`docs/spec/blocks/`). `registry.ts` is the
  only registry, and the interpreter, the emitter, the chart, the block
  menu, and the block editor all reach block definitions through it.
- `src/runtime`: `run()` returns a `Runner` whose `next()` returns one event
  at a time, then `Done`, which counts the events
  (`docs/spec/runtime/interpreter.md`). Each event records one thing the run
  did, in the order Python would do it, and a run is deterministic. The
  driver groups events into the visible steps the UI shows
  (`src/store/steps.ts`).
- `src/python`: `emit()` produces the Python file and a map from each
  `NodeId` to its line. `parse()` turns typed expression text back into an
  `Expr`, and `unparse(parse(s))` is a fixed point
  (`docs/spec/runtime/parser.md`). The emitted Python, not the interpreter,
  is the reference for how a program behaves.
- `src/challenges`: the challenge schema, the bundled challenges and study
  plans, and the judge (`judge.ts`), which `scripts/check.ts` also uses.
- `src/store`: the Zustand stores, and the modules that work with them.
  - `program`: the open program, its undo history, and its persistence.
  - `playground`: the index of Playground programs.
  - `editor`: the hovered and the selected node.
  - `run`: the driver, which runs ahead and then plays back on a timer.
  - `tests`: the submission verdicts.
  - `progress`: each problem's status.
  - `layout`: the panel width, collapse, and playback speed.

  Each module below is the only place for its rule, so change the rule
  there:
  - `mode.ts` derives the page's mode (build, solution, running, ended)
    from `run` and `editor`, and every check of what the page allows reads
    it.
  - `batches.ts` is the one loop that works through a run in batches.
  - `steps.ts` reads a run one visible step at a time and groups the two
    writes of a swap into one step.
  - `open.ts` is the one way to open a page's program.
  - `storage.ts` holds every read and write of `localStorage`.

- `src/ui/primitives`: shadcn components generated on Base UI. Regenerate
  them as `.claude/rules/ui.md` describes. `src/lib/utils.ts` holds `cn()`
  and `clamp()`.
- `src/ui/app`: the page shell. `route.ts` parses the four hash routes by
  hand, each with at most one parameter, in one function with one
  `hashchange` listener that React reads through `useSyncExternalStore`. A
  router library would bring nested layouts, loaders, and history modes
  that a single page addressed by its hash doesn't use. The listener opens
  a route's program before it notifies React, so a page never renders with
  the previous page's program. The panel's resize handle is the app's own
  `ResizeHandle.tsx` rather than `react-resizable-panels`, which works in
  percentages where the spec gives sizes in pixels.
- The rest of `src/ui`: React components. The chart is an SVG flowchart
  with a computed layout (`src/ui/chart/layout.ts`). Chart node text and
  the narration are plain strings from `src/ui/chart/text.ts` and
  `src/ui/run/narrate.ts`, and `text.ts` is the only code that splits a
  notation into its pieces. The block editor's state is a session that
  changes only through pure transitions (`src/ui/editor/session.ts`). A
  variable's view is chosen by the type of its value alone, never by block
  or challenge (`docs/spec/ui/views.md`).
- `challenges/<id>.json`: one file per challenge. `scripts/check.ts` runs
  every solution in both the interpreter and CPython and compares the
  results (`docs/spec/challenges/`).
