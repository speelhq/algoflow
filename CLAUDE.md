# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AlgoFlow

Block-based algorithm learning tool (browser only; English UI, Japanese added last)
whose blocks are a fixed Python subset; functions and classes can be moved into
modules and reused across programs (`docs/spec/08-modules.md`). Specs in
`docs/spec/` are normative; every statement has an id like `L-20`, assigned
once and never renumbered (00-conventions). Read
`docs/spec/00-conventions.md`
first (its Terms table names the process terms too), then the file for the
area you change. Cite ids in tests and commit
messages. If a task conflicts with a spec, stop and report the conflict.

## Commands

```
pnpm dev · pnpm test [path] · pnpm lint · pnpm format · pnpm build
pnpm check [challenge.json]   # schema, interpreter, CPython, i18n
pnpm test:e2e                 # after build
gh issue list --milestone <M-xx> · gh pr list · gh pr checks <n>
```

Run `pnpm lint` and the relevant `pnpm test <path>` after each set of edits.
`pnpm check` needs CPython 3.12 or later, run as `python3` from PATH or as
named by the `PYTHON` variable.

## Fixed choices

- TypeScript 7 (its Go compiler is the `tsc` binary), Oxlint with
  `oxlint-tsgolint`, and Oxfmt; never add ESLint, Prettier, or TypeScript
  earlier than 7.
- shadcn/ui on Base UI (not Radix); dnd-kit; Zustand; no graph/flow/editor libraries.
- `src/lang`, `src/runtime`, `src/python` have no third-party imports.
- One block per file in `src/nodes/`; nothing else branches on block kind or name.
- Every user-visible string comes from `src/i18n/en.json` (and `ja.json` once it exists).
- `int` and `float` are distinct values; lists, dicts, and objects reside on the heap.

## Architecture

Data flows one way, and nothing below `src/store` depends on React:

- `src/lang` — the `Program` AST (`types.ts`), `validate()` → `Diagnostic[]` run
  after every edit and before every run, pure edit functions returning a new
  `Program` (`edit.ts`), and `Data` ⇄ `Value`/heap conversion (`data.ts`).
- `src/nodes` — one `NodeDef` per block owning its slots, `create()`, `run`
  (interpreter behaviour), `python()` (exact emitted text), and `chart` (N-09).
  `index.ts` is the only registry; the interpreter, the emitter, the chart,
  the block menu, and the node editor dispatch through it (N-01).
- `src/runtime` — `run(program, inputs, seed)` returns a `Runner`; each `next()`
  yields one `Event` (`enter`, `read`, `write`, `swap`, `compare`, `loop`, `call`,
  `return`, `print`). Events are the contract the UI consumes for highlights and
  step counts. Randomness is mulberry32 seeded per run, so the same
  program, inputs and seed replay identically; Seek is a fresh runner advanced `k` times.
- `src/python` — `emit()` produces the Python file plus a NodeId → line map;
  `parse()` turns typed expression text back into `Expr`; `unparse(parse(s))` is a
  fixed point (G-05). Emitted Python is the behavioural reference, not the interpreter.
- `src/challenges` — the schema, the judge shared with `scripts/check.ts`
  (C-10), and the `Result` rows (U-23, U-81).
- `src/store` — Zustand stores: `program` (the program, its undo history,
  and its persistence, L-50..L-55), `editor` (the hovered and the selected
  node, U-25, U-35), `run` (the pre-running, timer-driven driver, R-11),
  `tests` (submission verdicts), `progress` (per-problem status under
  `algoflow:progress`), `layout` (panel width, collapse, and playback speed
  under `algoflow:layout`).
- `src/ui/primitives` — shadcn components generated on Base UI (`pnpm dlx shadcn add …`);
  `src/lib/utils.ts` holds `cn()`. Everything else under `src/ui/` is hand-written.
- `src/ui` — React. The chart is an SVG flowchart with computed layout
  (`src/ui/chart/layout.ts`, U-30, N-09); node text and narration are plain
  strings from `src/ui/chart/text.ts` and `src/ui/run/narrate.ts`; variable
  views are chosen by value type only (V-01), never by block or challenge.
- `challenges/<id>.json` — inputs, ≥3 tests (one with `edge: true`), 3 hints, solution.
  `scripts/check.ts` runs every solution in the interpreter and in CPython (with a
  shim replaying `draws()`) and compares both (R-20). "Recorded" expectations are
  captured once from the solution and inserted into the file (C-20).

Work proceeds by milestone (`docs/spec/07-plan.md`); a milestone closes only
when its listed tests pass.

## Verification

Each block: codegen test with exact text and interpreter test (T-02).
Each error code: a test. `pnpm check` passes before a milestone closes.
Report command output, not summaries of it.

## Working style

Targeted edits over rewrites. Stay within the task; list unrelated findings
as follow-ups. Batch independent reads. One line before starting; a
standalone recap at the end (changed files, evidence, remaining work).
A turn does not end on a plan, a question, or a status report while the
session's next step is an edit, a test run, a commit, or an issue; it ends
on a conflict with the spec, or on a step that needs the user's permission
(`git push`, `rm`), and then names what is ready and what waits.
When compacting keep: changed files, current milestone exit criteria, test
commands, decisions not yet in `docs/spec/`.

## Sources of truth (P-10..P-14)

- `docs/spec/` states what must be; the code states what is; the open GitHub
  milestone, its issues, and the open pull requests determine what is next. There
  is no handoff file. `docs/decisions.md` holds the reasons, grouped by
  topic; the spec states facts, never history.
- `docs/design/` holds one PNG per board (P-13); read the board
  before building its screen. `docs/design/README.md` names them and lists
  where the spec deviates; the spec takes precedence.
- `private/PROMPTS.md` (ignored by git) holds the milestone prompts the user
  pastes; nothing else is private.
- Issues: `decision` (the spec lacks an id), `defect`, `debt`, `perf`, or no
  label for a task; each under the milestone that needs it (P-12). A body has
  the sections Summary, Where, Expected and actual (a `defect` only), and
  Done when. `gh issue create --body` does not apply the template, so write
  those sections in the body, and set the milestone with `--milestone`.

A session starts with the milestone's line in `docs/spec/07-plan.md` and
`gh issue list --milestone <M-xx>`. When you make a choice the spec does not
cover, add the fact as a new id in the spec file for that area and the reason
to `docs/decisions.md`, in a commit before the code. A session ends by
opening its pull requests and filing every finding it did not fix as an
issue. Before a milestone closes: `/code-review`, then a subagent review of
the diff against `docs/spec` that reports only violations of an id and
behaviour no id requires (with id and file:line); fix or file each finding.

## Commits and pull requests

Branch from `main` per pull request. Commit one vertical slice at a time, at
the moment `pnpm lint && pnpm test` passes: a node plus its i18n keys and
both tests, a challenge, a view. Commit cross-cutting type, event, or spec
changes separately, before the code that uses them.

Conventional Commits, imperative subject under 50 chars, scope from src/
(lang, nodes, runtime, python, ui, challenges, i18n; `docs` and `ci` for
those). A body only when the reason is not evident from the subject. No
trailers. Never mention
Claude, the session, or the prompt.

Keep pull requests under approximately 600 changed lines; divide a milestone
into reviewable parts. `main` takes rebase merges only, after CI. The body follows
`.github/pull_request_template.md`: What / Why (spec ids and milestone) /
Closes (`Closes #n` per issue resolved) / Verification (the command output,
pasted) / Screenshots (when a screen changes) / Notes (deviations, and the
issue of every review finding not resolved here).

## Tooling notes

- oxlint: a store's state type declares its actions as function properties
  (`seek: (step) => …`), never as method signatures (`unbound-method`);
  `jsx-a11y` rejects mouse and click handlers on `li`/`tr`/`ol` (use one
  delegated listener with `data-*`); `react/set-state-in-effect` rejects
  `setState` inside effects (adjust state during render); `no-base-to-string`
  rejects `String(unknown)`; `no-await-in-loop` is a warning the batch loops
  accept.
- Hooks: a PostToolUse hook runs oxfmt on every written file under `src/`
  and `challenges/` but not `scripts/` (run `pnpm exec oxfmt scripts`
  manually; `pnpm lint` does not check formatting); re-read a file before a
  follow-up Edit. A PreToolUse hook runs `pnpm lint` before `git commit`.
- oxfmt keeps a JSON object on one line only if it already was: edit
  challenge files by line, never by `JSON.stringify`.
- Vitest fake timers give a timeout created during a tick a delay of 1 ms,
  so an R-11 batch loop needs `advanceTimersByTimeAsync(1)` per batch
  (`settle()` in `src/store/run.test.ts`). Stores that persist need
  `// @vitest-environment jsdom`.
- `MessageKey` is derived from `en.json`, so a removed key fails type-check;
  T-08 flags unknown literal keys only, never unused or template-literal ones.
- `validate()`, `firstAssignments()`, and `nodesById()` are memoized per
  `Program` object: never mutate a `Program` in place.
- Multi-line edit scripts: write them to the scratchpad and run the file;
  a heredoc passed to the Bash tool turns `\\` into `\`.
- The end-to-end suite runs against `dist/`, so build first. A chart can be
  inspected without a screen: write `layout()`'s result as SVG from a
  temporary Vitest file and capture a screenshot with Playwright.

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

Skills: `/add-node`, `/add-challenge`.
