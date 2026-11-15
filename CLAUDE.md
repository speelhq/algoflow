# CLAUDE.md

Guidance for Claude Code in this repository: a block-based tool for
learning algorithms that runs entirely in the browser (`README.md`). Each
area's rules load from `.claude/rules/` when you read or edit its files,
and the skills hold the procedures.

## Commands

```
pnpm dev · pnpm test [path] · pnpm lint · pnpm format · pnpm build
pnpm check [challenge.json]   # schema, interpreter, CPython 3.12+ (python3 or $PYTHON), i18n, references
pnpm commits <base>..<head>   # each commit's message, as CI checks a pull request
pnpm size [base]              # the lines a branch changes since develop, without generated files
pnpm test:e2e · pnpm screenshots   # after build; screenshots rewrites e2e/screenshots/
```

After each set of edits, run `pnpm lint` and the tests for the code you
changed (`pnpm test <path>`). Every pull request must pass `pnpm check` and
the other checks CI runs (`.github/workflows/ci.yml`).

When you report a result, show the command output rather than describing
it, so the developer can see what happened without running the command
again.

## Sources of truth

- `docs/spec/` states what must be true of the app and its code, and
  `docs/spec/README.md` explains how the spec is written. Read an area's
  spec before you change the area. The area's rule in `.claude/rules/`
  names it.
- `docs/design/README.md` says how a screen's design is made and where
  each design is.
- `ARCHITECTURE.md` maps the code: what each folder owns and which spec it
  follows. Read it before a change that crosses folders.

To find what to work on next, read the open milestone, its issues, and the
open pull requests. Don't write a handoff file for the next session,
because it would repeat what GitHub already records and fall out of date.

## Fixed choices

These choices are settled. Change one only through a proposal to the
developer (Judgment).

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
  other code branches on a block's type or name (`docs/spec/blocks/`).
  Every consumer reads the block definition's declarations instead, so a
  new block definition works in the menu, the chart, and the editor with
  no other change.
- Every user-visible string comes from `src/i18n/en.json`, so adding
  Japanese means adding one more catalog with the same keys.
- `int` and `float` are distinct values, and lists, dicts, and objects live
  on the heap (`docs/spec/language/`).

## Judgment

When a decision involves a tradeoff, weigh what is best for the learner
first, what keeps the design consistent as a whole second, and what is
cheapest to build third. Weigh review findings the same way. The spec, the
issues, and past decisions serve the first two, so they can change. When
you find something better, propose the change instead of working around
them.

Before you fix a problem where it shows up, check whether its cause lies
elsewhere and whether the same problem exists in other places. If a fix
needs a special case or an exception, question the design before you add
it. Change only what the task needs, and settle anything you find outside
it as a finding (below). Don't add generality or complexity that no
planned work needs.

Make plans and decisions from files you have read yourself. Use an agent
only to find code, run a reproduction, or list review candidates
(`/issue`, Review), and check what it returns against the files before you
rely on it, because an agent reads excerpts, and its summary can still
sound as if it had read all of the code.

Leave decisions that change an approach, the spec, or a design to the
developer, and propose them instead: what is done now and why, the
alternatives, and the one you recommend and why. Build nothing that
depends on a proposal until the developer decides. If a task conflicts
with the spec, stop and report the conflict together with a proposal, so
the developer doesn't have to work out the options alone.

Settle every finding, whether it came from a review or you noticed it
while working: fix it in the current change if the task covers it, drop it
with a reason, or file an issue. Until then it is part of your task, because a
finding that exists only in the conversation is lost when the session
ends. Fix a fault your own change introduced in that same change. If the
fix needs a decision first, hold the change until the decision is made
rather than shipping it with the fault.

Keep every change free of the following patterns. Each one hides a rule or
a value where the next reader won't look for it:

- an optional parameter or default that silently changes a result
- hidden state or a side map
- a second copy of a rule or a lookup
- a helper kept on an old data model so that tests don't have to change
- a branch left in for a case that no longer exists
- positional coupling
- a renamed concept still called by its old name somewhere
- a fix to a symptom that leaves its structural cause in place, unless you
  record where and why that structure should change

## Writing

People and agents act on what these files say, so write every document,
commit message, pull request, and issue this way:

- Put one idea in each sentence, with a concrete subject and an active
  verb.
- Give a reason with "because" or "so", next to the rule it explains.
- Use a list for items a reader scans, such as steps, options, or fields,
  and prose for a rule and its reason.
- Use plain words. Avoid aphorisms, invented phrases, and emphasis in
  capitals.
- Spell in American English, as the code's identifiers do (`Localized`,
  `color`).

## Issues and pull requests

`develop` is the default branch, and every change reaches it through a
pull request. `main` holds the latest release, which its CI deploys, and
`/milestone` moves it to `develop` when a release closes.

A pull request is one logical change from `develop`, and it leaves
`develop` releasable when it merges. It usually resolves one issue. It
resolves several when they are one change:

- one change completes the Done when of each, such as a feature and the
  test that a decision asks for
- the issues share one cause
- separate pull requests would change the same lines

Issues that are only near each other get a pull request each, because a
pull request that mixes them is harder to review and to revert.

A pull request changes at most 2,000 lines, as `pnpm size` counts them.
Split a larger issue into sub-issues of a parent issue before you start
it, each sized for one pull request. A mechanical change made by a tool,
such as a rename through the language service, may pass the limit when
the developer allows it in the issue.

Write the text of each issue, pull request, and comment through
`github-writing`. A pull request names in its body each issue that it
resolves. Close an issue that a change only makes moot as not planned,
with a comment that names the change, because `Closes` records an issue
as completed.

When a merged pull request leaves a fault, fix it in a new pull request
or file it as a new issue that names the merged one, rather than reopen
the issue it closed, because `Closes` records that issue as completed by
that pull request.

`develop` accepts only rebase merges, after CI passes, so every commit of
a pull request ends up on `develop`, and then on `main`. There, a commit
that a later commit undoes would mislead `git blame` and `git bisect`, so:

- Commit one vertical slice at a time, once `pnpm lint && pnpm test`
  passes. Commit a change to the spec, a type, or an event first, on its
  own.
- Keep the branch's commits final (`/issue`, Finish). Once the pull
  request is open, rewrite them only to rebase onto `develop`.

Write commit messages in Conventional Commits form:

- an imperative subject that names the concrete change, such as
  `fix(ui): keep the spaces a text holds`, in about 50 characters and at
  most 72, because GitHub cuts a longer subject short in its lists
- a scope that is a folder of `src/`, or `scripts`, `docs`, or `ci`
- a body only when the reason isn't evident from the subject
- no trailers, including `Co-Authored-By`

`pnpm commits` checks each message as CI does. Title a pull request in the
same form as a commit subject.

Before you publish, ask the developer to approve, as one list, the pull
request and the issues it files or edits and the comments it adds. Merge
only when the developer asks. A push to the session's own branch needs no
approval, and only `/milestone` pushes to `main`.

## Working style

Make targeted edits rather than rewriting files. Before you start, say in
one line what you are going to do. When you finish, write a recap that
makes sense on its own: the files you changed, the evidence that the
change works, and what remains.

Keep going while the next step is an edit, a test run, or a commit. Don't
stop there to present a plan, ask a question, or report status. Stop when
you have a proposal for the developer, a conflict with the spec, or a step
that needs approval (Issues and pull requests), and say what is ready and
what is waiting.

When compacting, keep:

- the changed files
- the current issue and its Done when section
- open findings and proposals
- the test commands
- any decision not yet recorded in `docs/spec/`

## Things that will bite you

- A hook runs oxfmt on every file you write in the repository, except under
  `docs/`. It can change the file after your edit, so re-read the file
  before you edit it again. Files that a script writes aren't formatted, so
  run `pnpm format` on them.
- A hook runs `pnpm lint` before each `git commit` and blocks the commit if
  lint fails.
- Write a multi-line edit script to a file in the scratchpad and run that
  file. A heredoc passed to the Bash tool turns `\\` into `\`.
