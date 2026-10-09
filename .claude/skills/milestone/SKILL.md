---
name: milestone
description: Run one GitHub milestone (M-xx) from its scope to one pull request against main - task issues, spec-first commits, both reviews, filed findings. Use when asked to start, continue, or finish a milestone.
argument-hint: <M-xx>
---

Run milestone $ARGUMENTS. A milestone is one pull request from `main`.
When a session ends before that pull request, push the branch (ask first);
the next `/milestone $ARGUMENTS` continues it.

Quote every `gh api` path: PowerShell reads an unquoted `{owner}` as a
script block.

## 1. Read the scope

1. `gh api "repos/{owner}/{repo}/milestones?state=all" --jq '.[] | select(.title == "$ARGUMENTS")'`:
   its description states the goal and the exit criterion, and a `Scope`
   paragraph while the scope is not yet split.
2. `gh issue list --milestone "$ARGUMENTS" --state all --limit 200`, then
   `gh issue view <n>` for every open one.
3. While the description has a paragraph starting `Scope:`, split it before anything
   else: one task issue per part a person can see working, with the
   sections of `.github/ISSUE_TEMPLATE/task.md`, the spec ids of the part
   under Spec, and its share of the exit criterion under Done when. Check
   that every item of `Scope` is in exactly one issue, then replace the
   paragraph with `Split into the task issues of this milestone.`
   (`gh api -X PATCH "repos/{owner}/{repo}/milestones/<number>" -f description=…`).
4. Read every spec statement the open issues cite, the `docs/decisions.md`
   entries that name those ids, and, for a screen, its artboard in
   `docs/design/` (README first).
5. Read the descriptions of the later open milestones: statements in their
   scope are not yet due and are left alone.
6. The artboards are drawn before a milestone starts: every screen, and every
   state of one (an open menu, a card, a dialog), that the milestone builds
   has its artboard in `docs/design/`. When one has none, or an open issue
   says an artboard is missing, stop and report it to the user before
   building anything.

## 2. Build

1. Continue the milestone's branch when one exists
   (`git branch -a -i --list "*$ARGUMENTS*"` after
   `git fetch`); otherwise `git switch -c <m-xx>-<slug> origin/main`.
2. Settle each `decision` issue first: the spec statement and its
   `docs/decisions.md` entry in one commit, before any code.
3. Work through the task issues. A choice the spec does not cover is a new
   id with its reason, committed before the code. Commit each vertical
   slice when `pnpm lint && pnpm test` passes.
4. A screen's states are saved by `e2e/screenshots.spec.ts` (U-91); look at
   each image beside its artboard before committing it. The code follows the
   artboard; a difference the code cannot follow, or a state the artboard
   does not draw, is reported to the user and not built. A session never
   draws or changes an artboard.

## 3. Review

1. `/code-review` on the branch; fix each finding or file it.
2. A subagent reviews `git diff origin/main...HEAD` against `docs/spec` and
   reports only (a) a violation of an id and (b) behaviour no id requires,
   each with id, file:line, and a concrete scenario. Give it the later
   milestones' scope so it does not report what is not yet due. Fix each
   finding, the spec first when the spec was wrong, or file it.
3. A filed finding is an issue with its template's sections, its label, and
   the milestone that first needs it.

## 4. Finish

1. Run and keep the output: `pnpm lint`, `pnpm test`, `pnpm check`,
   `pnpm build`, `pnpm test:e2e`.
2. Ask before `git push`. Open one pull request against `main` with
   `.github/pull_request_template.md`: Why names $ARGUMENTS and the ids;
   Closes lists every issue the branch resolves; Notes lists deviations and
   the issue of every finding not fixed here.
3. Recap: the pull request, the exit criterion with its evidence, the issues
   filed, and what the user does next (merge, then close the milestone).
