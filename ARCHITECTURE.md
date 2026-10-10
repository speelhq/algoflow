# Architecture

AlgoFlow is a block-based algorithm learning tool that runs entirely in the
browser (S-01). Its blocks are a fixed Python subset; functions and classes
can be moved into modules and reused across programs (`docs/spec/modules/`).

## Fixed choices

- TypeScript 7 (its Go compiler is the `tsc` binary), Oxlint with
  `oxlint-tsgolint`, and Oxfmt; never ESLint, Prettier, or a TypeScript
  earlier than 7.
- shadcn/ui on Base UI (not Radix), dnd-kit, and Zustand.
- No graph, flow, or editor library. Why: the chart is laid out from the
  `Program` by the application and never positioned by hand (U-30), which
  leaves nothing for a library of freely placed nodes and edges to do.
- `src/lang`, `src/runtime`, `src/python`, and `src/nodes` import only each
  other: through `@/` across folders and `./` within one, never `../`; tests
  may add `vitest` and `@/i18n`. Why: it is a lint rule (`.oxlintrc.json`)
  because a rule a machine checks needs no reviewer; it covers `src/nodes`
  because the other three import it, so a package reaching `src/nodes`
  would reach them all.
- One block per file in `src/nodes/`; nothing else branches on block kind
  or name (N-01, N-14). Why: a block is added in one file, and every consumer
  reads its declarations, so a block added later works in the menu, the
  chart, and the editor with no other change.
- Every user-visible string comes from `src/i18n/en.json`. Why: Japanese
  is then one more catalog of the same keys (U-71).
- `int` and `float` are distinct values; lists, dicts, and objects reside
  on the heap (L-07, L-24).

## Code map

Data flows one way, and nothing below `src/store` depends on React, so the
core runs under Vitest and in `scripts/check.ts` without a browser.

- `src/lang` — the `Program` AST (`types.ts`), `validate()` → `Diagnostic[]`
  run after every edit and before every run, pure edit functions returning a
  new `Program` (`edit.ts`), and `Data` ⇄ `Value`/heap conversion
  (`data.ts`). A `Program` is never mutated in place: `validate()`,
  `firstAssignments()`, and `nodesById()` are memoized per `Program` object,
  and the undo history holds earlier programs.
- `src/nodes` — one `NodeDef` per block owning its slots, `create()`, `run`
  (interpreter behaviour), `python()` (exact emitted text), and `chart`
  (N-09). `index.ts` is the only registry; the interpreter, the emitter, the
  chart, the block menu, and the node editor dispatch through it (N-01).
- `src/runtime` — `run()` returns a `Runner` whose `next()` yields one
  event, or `Done` at the end (R-01, R-02). Events are the contract the UI
  consumes for highlights and step counts, and a run is deterministic
  (R-10).
- `src/python` — `emit()` produces the Python file plus a NodeId → line map;
  `parse()` turns typed expression text back into `Expr`; `unparse(parse(s))`
  is a fixed point (G-05). Emitted Python is the behavioural reference, not
  the interpreter.
- `src/challenges` — the schema types (`types.ts`), the bundled challenges
  and plans (`index.ts`, `plans.ts`), the judge shared with
  `scripts/check.ts` (`judge.ts`, C-10, C-15), the `Result` rows (`rows.ts`,
  U-23, U-81), and the next problem (`next.ts`, U-83). The challenge files
  are bundled with `import.meta.glob`. Why: fetching them at run time would
  need a manifest, asynchronous loading, and the deployment's base path, and
  a generated module would add a build step; the glob is typed by
  `vite/client` and works under Vitest. Only Vite resolves the glob, and
  `scripts/check.ts` runs under `tsx` without Vite and reads the files from
  disk (C-14), so no module it imports (`types.ts`, `judge.ts`) imports
  `index.ts`.
- `src/store` — Zustand stores: `program` (the open program, its undo
  history, and its persistence, L-50, L-51, L-52, L-53, L-54, L-55),
  `playground` (the Playground programs' index, L-57), `editor` (the hovered and the selected node, U-25,
  U-35), `run` (the pre-running, timer-driven driver, R-23, R-26), `tests`
  (submission verdicts), `progress` (per-problem status under
  `algoflow:progress`), and `layout` (panel width, collapse, and playback
  speed under `algoflow:layout`); `storage.ts` holds every read and write of
  `localStorage`.
- `src/ui/primitives` — shadcn components generated on Base UI
  (`pnpm dlx shadcn add …`); `src/lib/utils.ts` holds `cn()`. Everything else
  under `src/ui/` is hand-written. A generated file is regenerated, never
  edited, except that `shadcn add` writes `import { cn } from "cn"` and adds
  an npm package `cn`: correct the import to `@/lib/utils` and revert
  `package.json` and the lockfile.
- `src/ui/app` — the page shell. Routes are parsed by hand (`route.ts`): six
  hash routes with at most one parameter are one function and a
  `hashchange` subscription through `useSyncExternalStore`. Why: a router
  would bring nested layouts, loaders, and history modes that a
  hash-addressed single page does not use. The panel's resize handle is
  `ResizeHandle.tsx`. Why: U-03 states its limits in pixels while
  `react-resizable-panels` works in percentages, and the handle is a small
  component with pointer capture, one dependency fewer.
- `src/ui` — React. The chart is an SVG flowchart with computed layout
  (`src/ui/chart/layout.ts`, U-30, N-09); node text and narration are plain
  strings from `src/ui/chart/text.ts` and `src/ui/run/narrate.ts`; variable
  views are chosen by value type only (V-01), never by block or challenge.
- `challenges/<id>.json` — one file per challenge (C-01), checked by
  `scripts/check.ts` (C-02), which runs every solution in the interpreter
  and in CPython and compares both (R-20).
