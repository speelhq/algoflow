---
name: issue
description: Work one GitHub issue into one pull request against main - read its spec, propose any change of approach or spec, commit the spec first, review the change yourself and with a spec review and /code-review, and settle every finding. Use when asked to work on, fix, implement, or continue an issue.
argument-hint: <issue number>
---

Work issue #$ARGUMENTS into one pull request from `main` (`CLAUDE.md`,
Issues and commits). Ask for approval before each write to GitHub: a push,
the pull request, or an issue (`CLAUDE.md`, Working style). Use whichever
GitHub tool the session has (`gh` or the GitHub tools). If the session ends
before the pull request, make the branch's commits final (`CLAUDE.md`,
Issues and commits) and push the branch, so the next `/issue $ARGUMENTS`
can continue from it.

Plan and judge only from files you have read yourself (`CLAUDE.md`,
Judgment).

## 1. Read

1. Read the issue. If the issue has no milestone, stop: it waits
   until a release takes it. Read the milestone's description for the
   release's exit criterion, and the descriptions of the later open
   milestones. Their scope isn't due yet: don't build it in this issue, but
   you may shape the design so that it can take that scope.
2. Read `docs/spec/README.md`, and the whole spec file of every statement
   the issue quotes.
3. For a screen, read `docs/design/README.md` and the screen's artboard.
4. Read every source file and test the change touches, in full.

## 2. Decide

1. If the issue is too large for one pull request (`CLAUDE.md`, Issues and
   commits), propose a split and wait, because a pull request that stands
   alone is never stacked or retargeted, is reviewed while it is small, and
   can be released as soon as it merges.
2. If the work would change an approach, the spec, or an artboard, or it
   conflicts with the spec, propose and wait (`CLAUDE.md`, Judgment).
   Handle a screen state that no artboard draws, or a difference from the
   artboard that the code can't follow, as `docs/design/README.md`
   describes, and don't build it until that is settled.
3. If the issue's Spec waits on an open `decision` issue, wait for it.
4. Propose a choice the spec doesn't cover as a statement, with its reason
   where `docs/spec/README.md`, Reasons, asks for one.

## 3. Build

1. Continue the issue's branch if one exists
   (`git branch -a --list "*/$ARGUMENTS-*" "$ARGUMENTS-*"` after
   `git fetch`). Otherwise run `git switch -c $ARGUMENTS-<slug> origin/main`.
2. Commit the spec statements in one commit, before any code.
3. Commit one vertical slice at a time, each once `pnpm lint && pnpm test`
   passes. Run `pnpm check <challenge.json>` before a commit that changes
   that challenge.
4. For a screen, `e2e/screenshots.spec.ts` draws its states and
   `pnpm screenshots` writes them to `e2e/screenshots/`. Look at each image
   beside its artboard.

## 4. Review

Before the pull request, the change gets three reviews: yours first, then
two that run side by side and report candidates. You read first so that no
candidate steers your reading. The spec review checks the diff only against the
statements, so it reports no preferences, and each review finds what the
others miss.

1. Read `git diff origin/main...HEAD` in full, against the issue's Done
   when section, every statement it touches, and the patterns that `CLAUDE.md`,
   Judgment, says to avoid. Do this before any candidate arrives.
2. Then start both candidate reviews in one message:
   - A subagent given the diff range, the statements the issue quotes, and
     the later milestones' scope. It reports only a statement the diff
     violates or behavior that no statement requires, each with the
     statement quoted with its file and heading, `file:line`, and a
     concrete scenario.
   - `/code-review` on the branch, which reports defects.
3. Check every candidate against the files.
4. Settle every finding (`CLAUDE.md`, Judgment). When you file one as an
   issue, give it its template's sections and label (`CLAUDE.md`, Issues
   and commits).

## 5. Finish

1. Make the branch's commits final (`CLAUDE.md`, Issues and commits).
2. Run each check that `.github/workflows/ci.yml` runs, and keep its
   output. Run its commits check as `pnpm commits origin/main..HEAD`.
3. After approval, push and open one pull request against `main`. Title it
   as a commit subject, and write its body from
   `.github/pull_request_template.md` (`CLAUDE.md`, Issues and commits):
   - one sentence on what the pull request does
   - What changes: a bold label and a sentence per change, in the terms of
     the spec
   - Why: the statements, the issue, and the milestone
   - Closes: `Closes #$ARGUMENTS`
   - Testing: the output of the commands in step 2, pasted
   - Screenshots: the images if a screen changes, otherwise `None`
   - Notes: deviations, open proposals, and the issue for each finding left
     for later, otherwise `None`
4. End with a recap: the pull request, the Done when section with its
   evidence, every finding with its outcome, and the open proposals.
