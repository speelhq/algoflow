# CLAUDE.md

@ARCHITECTURE.md

@CONTRIBUTING.md

## Before changing an area

Read `docs/spec/README.md`, then the area's folder under `docs/spec/`: the
spec files and their `decisions.md`, and every entry of another folder's
`decisions.md` that names an id you change. Before building a screen, read
`docs/design/README.md` and the screen's artboard.

## Judgement

A plan and every judgement are made from files the session reads itself.
An agent may locate code, run a reproduction, or report review candidates
(CONTRIBUTING, Reviews); nothing it returns is used before the session
checks it against the files. Why: an agent reads excerpts, and its summary
looks like a reading of the whole code.

## Working style

Targeted edits over rewrites. Stay within the task; settle each finding as
CONTRIBUTING states. Batch independent reads. One line before starting; a
standalone recap at the end (changed files, evidence, remaining work).
A turn does not end on a plan, a question, or a status report while the
session's next step is an edit, a test run, or a commit; it ends
on a proposal, a conflict with the spec, or a step that needs the user's
permission (`git push`, `rm`, a GitHub write), and then names what is ready
and what waits. When compacting keep: changed files, the current issue and
its Done when, open findings and proposals, test commands, decisions not
yet in `docs/spec/`.

Skills: `/issue`, `/milestone`, `/add-node`, `/add-challenge`.

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
  so an R-24 batch loop needs `advanceTimersByTimeAsync(1)` per batch
  (`settle()` in `src/store/run.test.ts`). Stores that persist need
  `// @vitest-environment jsdom`.
- `MessageKey` is derived from `en.json`, so a removed key fails type-check;
  `scripts/lib/i18n-check.ts` flags unknown literal keys only, never unused or
  template-literal ones.
- Multi-line edit scripts: write them to the scratchpad and run the file;
  a heredoc passed to the Bash tool turns `\\` into `\`.
- The end-to-end suite runs against `dist/`, so build first. A chart can be
  inspected without a screen: write `layout()`'s result as SVG from a
  temporary Vitest file and capture a screenshot with Playwright.
