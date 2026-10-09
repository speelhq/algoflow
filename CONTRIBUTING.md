# Contributing

## Commands

```
pnpm dev · pnpm test [path] · pnpm lint · pnpm format · pnpm build
pnpm check [challenge.json]   # schema, interpreter, CPython, i18n
pnpm test:e2e                 # after build
gh issue list --milestone <vX.Y.Z> · gh pr list · gh pr checks <n>
```

Run `pnpm lint` and the relevant `pnpm test <path>` after each set of edits.
`pnpm check` needs CPython 3.12 or later, run as `python3` from PATH or as
named by the `PYTHON` variable.

## Sources of truth

- `docs/spec/` states what must be; the code states what is; the open GitHub
  milestone, its issues, and the open pull requests determine what is next.
  There is no handoff file. Why: it would repeat what git, the code, and
  the issues state, and drift from them.
- `docs/spec/README.md` states how the spec is changed: its ids, where a
  statement's reason is recorded, and the spec committed before the code.
- `docs/design/` holds one PNG per current artboard; read the artboard before
  building its screen. Its `README.md` names them and lists where the spec
  deviates; the spec is the decision where they differ. Why: the Claude
  Design files open only for the people they are shared with and cannot be
  reviewed or diffed in a pull request.

## How work proceeds

**Releases.** A milestone is a release named `vX.Y.Z`. Its description
states the goal, the exit criterion, and, until `/milestone <vX.Y.Z>`
splits it into issues, the scope (a paragraph starting `Scope:`), which the
split replaces with a pointer to the issues. A release closes when its exit
criterion holds on `main`, which is then tagged `vX.Y.Z` with a GitHub
release. Why: issues written months ahead would describe screens whose
artboards are not settled; replacing the paragraph keeps the scope in one
place and marks the split, which an unrelated issue filed under the
milestone earlier does not; a tag names the code a release shipped.

**Issues.** One issue is one pull request from `main`, of at most about
1,500 changed lines, that leaves `main` releasable; an issue too large for
that is split before work starts. Issue work runs through `/issue <n>`.
Why: a pull request that stands alone is never stacked or retargeted, is
reviewed while it is small, and lets any merge be released; the skill keeps
the procedure tracked and reviewed like the code.

A problem idea is an issue labelled `challenge`, with no milestone until a
release takes it. Why: the label finds every idea without promising it to
a release.

`gh issue create --body` applies no template: copy the sections of
`.github/ISSUE_TEMPLATE/<kind>.md` into the body, and set the template's
label and the release that takes the issue, if any. A problem's title states
the problem as a fact; a task's title names the work. The labels
`decision`, `defect`, `debt`, `perf`, and `challenge` say whether an issue
needs a decision, a fix, a merge of two copies, a measurement first, or is
a problem idea. Each kind has its template: Summary, its own sections, Spec
(sentences ending in their ids), and Done when; the title and Summary carry
no id, and a section that does not apply says `None` and why. The milestone
is the issue's Milestone field and is not repeated in the body. Why: the
spec states facts and never history, so an open question waits in an issue
until the pull request that writes its id closes it; a single template has
no place for a decision's options, a debt's copies, or a cost; an issue list
without ids states its problems in words; and an omitted section reads like
a forgotten one.

**Proposals.** Where the spec, a decision, or an artboard has a better
option, the contributor proposes it: the current choice and its reason, the
alternative, and why it is better. The developer decides, and nothing is
built on a proposal before then. A task that conflicts with the spec stops,
and the conflict is reported with a proposal. Why: the spec records
decisions that can be improved, and a conflict reported without a proposal
leaves the developer to find the better option alone.

**Findings.** A finding, from a review or noticed in passing, is fixed in
the pull request, dropped with its reason, or filed as an issue when it
needs action later; until it is settled it is a task of the session. Why:
an issue per finding fills the tracker with items no release takes, and a
finding kept only in a conversation is lost.

**Reviews.** Before its pull request a change is reviewed three times. First
its author reads the whole diff against the issue's Done when, every id it
touches, and the shapes below. Then two reviews report candidates, side by
side: a subagent reads the diff against the spec and reports only a violated
id or behaviour no id requires (a missing id), and `/code-review` reports
defects. The author checks each candidate against the files and settles it
as Findings states. A change takes none of these shapes: an optional
parameter or default that silently changes a result; hidden state or a side
map; a second copy of a rule or a lookup; a helper kept on an old model to
spare test changes; a branch left for a removed case; positional coupling; a
renamed concept left under its old name. Why: each shape hides a rule or a
value where the next reader does not look; the author reads first so that no
candidate steers the reading; the narrow spec brief keeps preferences out;
and each review finds what the others do not.

## Commits and pull requests

Branch from `main` per pull request. Commit one vertical slice at a time, at
the moment `pnpm lint && pnpm test` passes: a node plus its i18n keys and
both tests, a challenge, a view. Commit cross-cutting type, event, or spec
changes separately, before the code that uses them.

Conventional Commits, imperative subject under 50 chars, scope from src/
(lang, nodes, runtime, python, ui, challenges, i18n; `docs` and `ci` for
those). A body only when the reason is not evident from the subject. No
trailers. Never mention Claude, the session, or the prompt.

`main` takes rebase merges only, after CI. The body follows
`.github/pull_request_template.md`: What / Why (spec ids, issue, and
milestone) / Closes (`Closes #n`) / Verification (the command output,
pasted) / Screenshots (when a screen changes) / Notes (deviations, open
proposals, and the issue of each finding left for later). Why:
GitHub closes an issue on merge only when the body names it, and pasted
output is evidence where a ticked checklist is an assertion.

## Verification

Each block: codegen test with exact text and interpreter test (N-10).
Each error code: a test. `pnpm check` passes on every pull request.
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
