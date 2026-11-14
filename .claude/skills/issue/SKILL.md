---
name: issue
description: Work one or more GitHub issues into one pull request against develop - read the issues and their spec, propose any change of approach or spec, build in vertical slices, review with the spec-reviewer agent and /code-review, and settle every finding. Use when asked to work on, fix, implement, or continue an issue, even without the slash command.
argument-hint: <issue number> [more issue numbers]
---

Work issue #$ARGUMENTS into one pull request from `develop`. Several numbers
make one pull request only when the issues are one change, as `CLAUDE.md`,
Issues and pull requests, says. Plan and judge only from files you have
read yourself, and stop for the developer where `CLAUDE.md`, Judgment;
Issues and pull requests, asks for it. Use whichever GitHub tool the
session has (`gh` or the GitHub tools). If the session ends before the
pull request, make the branch's commits final and push the branch, so the
next `/issue $ARGUMENTS` can continue from it.

## 1. Read

1. Read each issue. If an issue has no milestone, stop: it waits until a
   release takes it. Read the milestone's description for the release's
   exit criterion, and the descriptions of the later open milestones.
   Their scope isn't due yet: don't build it here, but you may shape the
   design so that it can take that scope.
2. Read `docs/spec/README.md`, and the whole spec file of every statement
   the issues cite.
3. For a screen, read `docs/design/README.md` and the screen's design.
4. Read every source file and test the change touches, in full.
5. Check that every name, path, and statement each issue treats as
   existing is still in the files, leaving out what the issue says the
   work creates. Propose an edit of the issue for each one that changed.
6. Propose removing each issue or pull request from a `Waits on` line once
   it is closed or merged. When an issue it names closed as not planned,
   propose how this issue goes on without it instead.

## 2. Decide

1. If the work would pass the size of one pull request (`CLAUDE.md`,
   Issues and pull requests), propose its sub-issues and wait, because a
   pull request that stands alone is reviewed while it is small and can be
   released as soon as it merges.
2. If the work would change an approach, the spec, or a design, or it
   conflicts with the spec, propose and wait (`CLAUDE.md`, Judgment).
   Build a screen state that no design draws when the spec settles its
   look, and show its screenshot in the pull request, where the developer
   decides its look. When the spec leaves its look open, propose and wait
   (`docs/design/README.md`, Making a design).
3. If an issue's `Waits on` line names an open issue or pull request, wait
   for it.
4. Propose a choice the spec doesn't cover as a statement, with its reason
   where `docs/spec/README.md`, Reasons, asks for one.

## 3. Build

1. Work on the branch that the session names. Otherwise continue the
   issue's branch if one exists (`git branch -a --list "*/<n>-*" "<n>-*"`
   after `git fetch`, for the first issue's number), or run
   `git switch -c <n>-<slug> origin/develop`.
2. Commit the spec statements in one commit, before any code.
3. Commit one vertical slice at a time (`CLAUDE.md`, Issues and pull
   requests). Run `pnpm check <challenge.json>` before a commit that
   changes that challenge.
4. For a screen, `e2e/screenshots.spec.ts` draws its states and
   `pnpm screenshots` writes them to `e2e/screenshots/`. Look at each image
   beside its design.

## 4. Review

Before the pull request, the change gets three reviews: yours first, then
two that run side by side and report candidates. You read first so that no
candidate steers your reading, and each review finds what the others miss.

1. Read `git diff origin/develop...HEAD` in full, against each issue's Done
   when, every statement it touches, and the patterns that `CLAUDE.md`,
   Judgment, says to avoid.
2. Then start both candidate reviews in one message:
   - the `spec-reviewer` agent, given the diff range, the issues, the file
     and heading of each statement they cite with the parts they quote,
     and the later milestones' scope
   - `/code-review` on the branch, which reports defects
3. Check every candidate against the files.
4. Settle every finding (`CLAUDE.md`, Judgment). File one as an issue
   through `github-writing`.

## 5. Finish

1. Make the branch's commits final, because a rebase merge puts each of
   them on `develop`:
   - Fold each fix into the commit it fixes: run `git commit --fixup <sha>`,
     then `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash --keep-base origin/develop`.
   - Drop a commit that a later one withdraws, together with that later
     commit.
   - Until the pull request is open, rewrite pushed commits too, and push
     them with `git push --force-with-lease`.
2. Run `git rebase --keep-base --exec "pnpm lint && pnpm test" origin/develop`,
   so each commit passes on its own, because CI tests only the branch's
   last commit.
3. Run each check that `.github/workflows/ci.yml` runs, and `pnpm size`,
   and keep the output. Run the commits check as
   `pnpm commits origin/develop..HEAD`.
4. Ask the developer to approve publishing: the pull request's title and
   body, written through `github-writing`, and each issue edit and comment
   that it brings, such as an open issue that names a function the change
   renames. Then push, open one pull request against `develop`, and make
   those edits.
5. End with a recap: the pull request, each issue's Done when with its
   evidence, every finding with its outcome, and the open proposals.
