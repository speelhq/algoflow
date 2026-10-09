# Contributing

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

## Sources of truth

- `docs/spec/` states what must be; the code states what is; the open GitHub
  milestone, its issues, and the open pull requests determine what is next.
  There is no handoff file. Why: a file rewritten at the end of every
  session repeated what git, the code, and the issues state, diverged from
  them, and, being untracked, was the one file a reset could lose.
- `docs/spec/README.md` states how the spec is changed: its ids, where a
  statement's reason is recorded, and the spec committed before the code.
  If a task conflicts with the spec, stop and report the conflict.
- `docs/design/` holds one PNG per artboard; read the artboard before
  building its screen. Its `README.md` names them and lists where the spec
  deviates; the spec takes precedence. Why: the Claude Design files open
  only for the people they are shared with and cannot be reviewed or diffed
  in a pull request.

## How work proceeds

Work proceeds by GitHub milestone: its description states the goal, the
exit criterion, and, until `/milestone <M-xx>` splits it into task issues,
the scope (a paragraph starting `Scope:`), which the split replaces with a
pointer to the issues. Why: one task issue per part a person can see
working gives the milestone its progress and lets a pull request close each
part by number, while issues written months ahead would describe screens
whose artboards are not settled; replacing the paragraph keeps the scope in
one place.

Milestone work runs through `/milestone`, which holds its start, its two
reviews, and its pull request. Why: the procedure is tracked and reviewed
like the code instead of a prompt pasted at each start, and the two
reviews, `/code-review` for defects and a subagent reading the diff against
the spec, each find what the other does not.

`gh issue create --body` applies no template: copy the sections of
`.github/ISSUE_TEMPLATE/<kind>.md` into the body, and set its label with
`--label` and the milestone with `--milestone`. A problem's title states
the problem as a fact; a task's title names the work. Every finding not
fixed where it was found becomes an issue. Why: the spec states facts and
never history, so an open question has no place in it; an issue keeps it
with its reasons under the milestone that needs the answer, and the pull
request that writes the id closes it. The four labels, `decision`,
`defect`, `debt`, and `perf`, say whether an issue needs a decision, a fix,
a merge of two copies, or a measurement first. Each kind has its template:
Summary, its own sections, Spec (sentences ending in their ids), and Done
when; the title and Summary carry no id, and a section that does not apply
says `None` and why. Why: one template had no place for a decision's
options, a debt's copies, or a cost; an issue list without ids states its
problems in words; and an omitted section reads like a forgotten one.

## Commits and pull requests

Branch from `main` per pull request. Commit one vertical slice at a time, at
the moment `pnpm lint && pnpm test` passes: a node plus its i18n keys and
both tests, a challenge, a view. Commit cross-cutting type, event, or spec
changes separately, before the code that uses them.

Conventional Commits, imperative subject under 50 chars, scope from src/
(lang, nodes, runtime, python, ui, challenges, i18n; `docs` and `ci` for
those). A body only when the reason is not evident from the subject. No
trailers. Never mention Claude, the session, or the prompt.

A milestone is one pull request from `main`; pull requests are never
stacked, and only a part that does not depend on the rest gets its own pull
request from `main`. `main` takes rebase merges only, after CI. Why: a
milestone's exit criterion is a path through the running application, so a
pull request that ends halfway cannot be judged, and pull requests split by
size had to be stacked and retargeted; the commits keep the granularity.

The body follows `.github/pull_request_template.md`: What / Why (spec ids
and milestone) / Closes (`Closes #n` per issue resolved) / Verification
(the command output, pasted) / Screenshots (when a screen changes) / Notes
(deviations, and the issue of every review finding not resolved here). Why:
GitHub closes an issue on merge only when the body names it, and pasted
output is evidence where a ticked checklist is an assertion.

## Verification

Each block: codegen test with exact text and interpreter test (N-10).
Each error code: a test. `pnpm check` passes before a milestone closes.
Report command output, not summaries of it.

## Tools

- `@types/node` stays on the major of `.node-version`. Why: types from a
  later major accept APIs that CI's Node lacks while every check passes.
- Warnings do not fail `pnpm lint`. Why: most are
  `no-unsafe-type-assertion` where something the type checker cannot follow
  establishes a value's shape (the registry's slot list, a check after
  `JSON.parse`), and expressing each in the types is not justified.
- No React Testing Library. Why: unit tests cover stores, `t()`, and script
  logic, and Playwright exercises components end to end; a DOM testing
  library would be a second, slower means of testing the same behaviour.
- `pnpm check` is one script that runs the i18n check itself. Why: pnpm
  appends command-line arguments to the end of a script, so a chained second
  script would receive `challenges/x.json`.
- The end-to-end tests load a finished program through storage (C-13's
  restore path). Why: building each through the `+` menu would make every
  test of running or submitting depend on the editor, which the editing
  tests cover, and a development-only affordance would be untested UI.
