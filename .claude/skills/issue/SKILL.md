---
name: issue
description: Work one GitHub issue into one pull request against main - read its spec, propose where a better option exists, spec-first commits, the author's review, a spec review and /code-review as candidates, every finding settled. Use when asked to work on, fix, implement, or continue an issue.
argument-hint: <issue number>
---

Work issue #$ARGUMENTS into one pull request from `main` (`CONTRIBUTING.md`,
How work proceeds). Each GitHub write (a push, the pull request, an issue)
waits for approval (`CLAUDE.md`, Working style). When a session ends before
the pull request, push the branch; the next `/issue $ARGUMENTS` continues it.

Plan and judge from the files this session reads itself (`CLAUDE.md`,
Judgement).

## 1. Read

1. `gh issue view $ARGUMENTS`; an issue no release takes waits until one
   does. The description of its milestone for the release's exit
   criterion, and the descriptions of the later open
   milestones: their scope is not yet due and is left alone.
2. `docs/spec/README.md`; every statement the issue cites, with the whole
   spec file and `decisions.md` of its folder; every entry of
   `docs/spec/*/decisions.md` that names those ids
   (`grep -rnw "<id>" docs/spec/*/decisions.md`).
3. For a screen, `docs/design/README.md` and the screen's artboard.
4. Every source file and test the change touches, whole.

## 2. Decide

1. When the issue is too large for one pull request (CONTRIBUTING,
   Issues), propose a split and wait.
2. Where the spec, a decision, or an artboard has a better option, and on a
   conflict with the spec, propose and wait (CONTRIBUTING, Proposals).
   A screen state no artboard draws, or a difference from its artboard the
   code cannot follow, is handled as `docs/design/README.md` states and is
   not built before it is settled.
3. An issue whose Spec waits on an open `decision` issue waits for it.
4. A choice the spec does not cover is proposed as a statement; once agreed,
   it is a new id with its `decisions.md` entry (`docs/spec/README.md`).

## 3. Build

1. Continue the issue's branch when one exists
   (`git branch -a --list "*/$ARGUMENTS-*" "$ARGUMENTS-*"` after `git fetch`);
   otherwise `git switch -c $ARGUMENTS-<slug> origin/main`.
2. The spec statements and their `decisions.md` entries in one commit,
   before any code.
3. One vertical slice per commit, each when `pnpm lint && pnpm test` passes;
   `pnpm check <challenge.json>` before a commit that changes that
   challenge.
4. A screen's states are saved by `e2e/screenshots.spec.ts` (U-91); look at
   each image beside its artboard.

## 4. Review

1. Read `git diff origin/main...HEAD` whole, as CONTRIBUTING's Reviews
   states, before any candidate arrives.
2. Then, in one message, start both candidate reviews:
   - a subagent given the diff range, the ids the issue cites, the later
     milestones' scope, and the spec review's brief from CONTRIBUTING's
     Reviews, asked for the id, `file:line`, and a concrete scenario of each
     candidate;
   - `/code-review` on the branch.
3. Check every candidate as CONTRIBUTING's Reviews states.
4. Settle every finding (CONTRIBUTING, Findings); a filed one takes its
   template's sections and label.

## 5. Finish

1. Run and keep the output: `pnpm lint`, `pnpm test`, `pnpm check`,
   `pnpm build`, `pnpm test:e2e`.
2. After approval, push and open one pull request against `main` whose body
   follows `.github/pull_request_template.md` (CONTRIBUTING, Commits and
   pull requests), with `Closes #$ARGUMENTS`.
3. Recap: the pull request, the Done when with its evidence, every finding
   with its outcome, and the open proposals.
