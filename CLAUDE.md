# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AlgoFlow

Block-based algorithm learning tool (browser only; English UI, Japanese added last)
whose blocks are a fixed Python subset; functions and classes can be moved into
modules and reused across programs (`docs/spec/08-modules.md`). Specs in
`docs/spec/` are normative; every statement has an id like `L-20`. Read
`docs/spec/00-conventions.md`
first, then the file for the area you change. Cite ids in tests and commit
messages. If a task conflicts with a spec, stop and report the conflict.

## Commands

```
pnpm dev · pnpm test [path] · pnpm lint · pnpm format · pnpm build
pnpm check [challenge.json]   # schema, interpreter, CPython, i18n
pnpm test:e2e                 # after build
```

Run `pnpm lint` and the relevant `pnpm test <path>` after each set of edits.
`pnpm check` shells out to `python3` and needs CPython 3.12 or later on PATH.

## Fixed choices

- TypeScript 7 (`tsgo`), Oxlint + Oxfmt; never add ESLint, Prettier, or TS < 7.
- shadcn/ui on Base UI (not Radix); dnd-kit; Zustand; no graph/flow/editor libraries.
- `src/lang`, `src/runtime`, `src/python` have no third-party imports.
- One block per file in `src/nodes/`; nothing else branches on block kind or name.
- Every user-visible string comes from `src/i18n/en.json` (and `ja.json` once it exists).
- `int` and `float` are distinct values; lists, dicts, objects live on the heap.

## Architecture

Data flows one way, and nothing below `src/store` depends on React:

- `src/lang` — the `Program` AST (`types.ts`), `validate()` → `Diagnostic[]` run
  after every edit and before every run, pure edit functions returning a new
  `Program` (`edit.ts`), and `Data` ⇄ `Value`/heap conversion (`data.ts`).
- `src/nodes` — one `NodeDef` per block owning its slots, `create()`, `run`
  (interpreter behaviour) and `python()` (exact emitted text). `index.ts` is the
  only registry; interpreter, emitter, block menu, chart and node editor all dispatch through it.
- `src/runtime` — `run(program, inputs, seed)` returns a `Runner`; each `next()`
  yields one `Event` (`enter`, `read`, `write`, `swap`, `compare`, `loop`, `call`,
  `return`, `print`). Events are the contract the UI consumes for highlights and
  step counts. Randomness is mulberry32 seeded per run, so the same
  program, inputs and seed replay identically; Back is a fresh runner advanced `step-1` times.
- `src/python` — `emit()` produces the Python file plus a NodeId → line map;
  `parse()` turns typed expression text back into `Expr`; `unparse(parse(s))` is a
  fixed point (G-05). Emitted Python is the behavioural reference, not the interpreter.
- `src/store` — Zustand stores: `program` (with 100-entry undo history and 500 ms
  localStorage persistence), `editor` (selection), `run` (the timer-driven driver),
  `tests` (submission verdicts), `progress` (per-problem status under `algoflow:progress`),
  `layout` (problem panel width and collapse under `algoflow:layout`).
- `src/ui/primitives` — shadcn components generated on Base UI (`pnpm dlx shadcn add …`);
  `src/lib/utils.ts` holds `cn()`. Everything else under `src/ui/` is hand-written.
- `src/ui` — React. The chart is an SVG flowchart with computed layout (U-30, N-09);
  variable views are chosen by value type only (V-01), never by
  block or challenge.
- `challenges/<id>.json` — inputs, ≥3 tests (one with `edge: true`), 3 hints, solution.
  `scripts/check.ts` runs every solution in the interpreter and in CPython (with a
  shim replaying `draws()`) and compares both (R-20). "Recorded" expectations are
  captured once from the solution and pasted into the file (C-20).

Work proceeds by milestone M-00 → M-10 (`docs/spec/07-plan.md`), one per session;
a milestone closes only when its listed tests pass.

## Verification

Each block: codegen test with exact text and interpreter test (T-02).
Each error code: a test. `pnpm check` green before a milestone closes.
Report command output, not summaries of it.

## Working style

Targeted edits over rewrites. Stay within the task; list unrelated findings
as follow-ups. Batch independent reads. One line before starting; a
standalone recap at the end (changed files, evidence, remaining work).
When compacting keep: changed files, current milestone exit criteria, test
commands, decisions not yet in `docs/spec/`.

## Commits and PRs

Commit one vertical slice at a time, at the moment `pnpm lint && pnpm test` is
green: a node plus its i18n keys and both tests, a challenge, a view. Land
cross-cutting type or event changes as their own commit before the code that
uses them.

Conventional Commits, imperative subject under 50 chars, scope from src/
(lang, nodes, runtime, python, ui, challenges, i18n). Body only when the
"why" is not obvious. Never mention Claude, the session, or the prompt.

Keep PRs under ~600 changed lines; split a milestone into reviewable pieces.
PR body: What / Why (spec section and milestone) / Verification (paste real
command output, not a claim) / Notes (deviations and follow-ups).

## Spec index

| File                          | Ids              |
| ----------------------------- | ---------------- |
| `docs/spec/00-conventions.md` | terms, id scheme |
| `docs/spec/01-scope.md`       | S                |
| `docs/spec/02-language.md`    | L                |
| `docs/spec/03-nodes.md`       | N                |
| `docs/spec/04-runtime.md`     | R, E, G          |
| `docs/spec/05-ui.md`          | U, V             |
| `docs/spec/06-challenges.md`  | C                |
| `docs/spec/07-plan.md`        | P, T, M          |
| `docs/spec/08-modules.md`     | D                |

Rationale for recorded choices: `docs/decisions.md`, grouped by topic. When
you make a choice the spec does not cover, add the fact as a new id in the
spec file for that area and the reason to `docs/decisions.md`; the spec
states facts, never history.

Skills: `/add-node`, `/add-challenge`. The session handoff `private/NEXT.md`
and the kickoff prompts `private/PROMPTS.md` are ignored by git (P-10): read
them, update them, never commit them. `docs/` is tracked: a spec change lands
in its own commit before the code that implements it.
