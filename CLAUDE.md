# CLAUDE.md

@ARCHITECTURE.md

## Commands

```
pnpm dev · pnpm test [path] · pnpm lint · pnpm format · pnpm build
pnpm check [challenge.json]   # schema, interpreter, CPython 3.12+ (python3 or $PYTHON), i18n
pnpm commits <base>..<head>   # each commit's message, as CI checks a pull request
pnpm test:e2e · pnpm screenshots   # after build; screenshots rewrites e2e/screenshots/
```

After each set of edits, run `pnpm lint` and the tests for the code you
changed (`pnpm test <path>`). Every pull request must pass `pnpm check` and
the other checks CI runs (`.github/workflows/ci.yml`).

When you report a result, show the command output rather than describing
it, so the developer can see what happened without running the command
again.

## Sources of truth

`docs/spec/` states what must be true of the app and its code, and
`docs/spec/README.md` explains how the spec is written. Each file in
`.claude/rules/` names the spec for one area of the code. Read that spec
before you change the area.

To find what to work on next, read the open milestone, its issues, and the
open pull requests. Don't write a handoff file for the next session,
because it would repeat what GitHub already records and fall out of date.

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
rely on it, because an agent reads excerpts. Its summary can still sound as
if it had read all of the code.

Leave decisions that change an approach, the spec, or an artboard to the
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

## Working style

Make targeted edits rather than rewriting files. Before you start, say in
one line what you are going to do. When you finish, write a recap that
makes sense on its own: the files you changed, the evidence that the
change works, and what remains.

Keep going while the next step is an edit, a test run, or a commit. Don't
stop there to present a plan, ask a question, or report status. Stop when
you have a proposal for the developer, a conflict with the spec, or a step
that needs permission (`git push`, `rm`, or a write to GitHub), and say
what is ready and what is waiting.

When compacting, keep:

- the changed files
- the current issue and its Done when section
- open findings and proposals
- the test commands
- any decision not yet recorded in `docs/spec/`

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

## Issues and commits

An issue becomes one pull request from `main`. Keep it to about 1,500
changed lines at most, and leave `main` releasable when it merges. Split a
larger issue before you start it. File each issue from the template for
its kind in `.github/ISSUE_TEMPLATE/` (`.claude/rules/github.md`).

Commit one vertical slice at a time, once `pnpm lint && pnpm test` passes.
Commit a cross-cutting change to a type, an event, or the spec first, on
its own.

Write commit messages in Conventional Commits form:

- an imperative subject under 50 characters that names the concrete
  change, such as `fix(ui): keep the spaces a text holds`
- a scope that is a folder of `src/`, or `scripts`, `docs`, or `ci`
- a body only when the reason isn't evident from the subject
- no trailers, including `Co-Authored-By`

In CI, `pnpm commits` checks the type, the scope, the subject's length,
trailers, and fixup commits left unfolded.

Title a pull request in the same form as a commit subject. Open its body
with one sentence on what it does, then fill in the sections of
`.github/pull_request_template.md`.

`main` accepts only rebase merges, after CI passes, so every commit of a
pull request ends up on `main`. A commit that a later commit undoes would
then mislead `git blame` and `git bisect`. Keep the branch's commits final:

- Fold each fix into the commit it fixes: run `git commit --fixup <sha>`,
  then `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash --keep-base origin/main`.
- Drop a commit that a later one withdraws, together with that later
  commit.

Until the pull request is open, only you use the branch, so do this to
pushed commits too and push the result with `git push --force-with-lease`.
Once the pull request is open, rewrite its commits only to rebase onto
`main`.

## Tooling notes

- `pnpm lint` treats every warning as an error. Fix the code, turn the rule
  off in `.oxlintrc.json` with the reason beside it, or disable it for one
  line with `// oxlint-disable-next-line <rule> -- <reason>`. The
  `no-base-to-string` rule rejects `String(unknown)`.
- A hook runs oxfmt on every file you write in the repository, except under
  `docs/`. It can change the file after your edit, so re-read the file
  before you edit it again. Files that a script writes aren't formatted, so
  run `pnpm format` on them.
- A hook runs `pnpm lint` before each `git commit` and blocks the commit if
  lint fails.
- In Markdown, oxfmt unindents a list item's continuation line that falls
  inside a code span, so keep each code span on one line.
- Write a multi-line edit script to a file in the scratchpad and run that
  file. A heredoc passed to the Bash tool turns `\\` into `\`.
