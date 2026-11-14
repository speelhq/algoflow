---
name: milestone
description: Plan or close one release milestone (vX.Y.Z) - split its Scope into issues and check its designs, or confirm its exit criterion on develop, move main to it, tag it, and publish the release. Use when asked to plan, start, or finish a release or milestone.
argument-hint: <vX.Y.Z> [close]
---

Plan the release $ARGUMENTS, or close it if the arguments end in `close`.
Its issues are worked through `/issue`, each in a pull request of its own,
or several in one when they are one change (`CLAUDE.md`, Issues and pull
requests).

A milestone is a release named `vX.Y.Z`. Its description states the goal
and the exit criterion. Until the plan below splits it into issues, the
description also holds the scope, in a paragraph that starts with
`Scope:`, and the split replaces that paragraph with a pointer to the
issues, because replacing the paragraph keeps the scope in one place and
shows that the split is done. The issues wait for the plan because issues
written months ahead would describe screens whose designs aren't settled.
A release closes when its exit criterion holds on `develop`. That commit
then becomes `main`, whose CI deploys it, and is tagged `vX.Y.Z` with a
GitHub release.

Plan and judge only from files you have read yourself (`CLAUDE.md`,
Judgment).

Ask the developer to approve, as one list, the issues that the plan files
and the change to the milestone, and, to close a release, the tag and the
release. Use whichever GitHub tool the session has (`gh` or the GitHub
tools). If no tool can make a change to a milestone, give the developer
the text to enter in the GitHub UI.

## Plan

1. Read the milestone's description.
2. List the milestone's issues, open and closed, and read every open one.
   Read the descriptions of the later open milestones too: their scope
   isn't due yet.
3. Read `docs/spec/README.md`, the whole spec file of every statement that
   the scope and the open issues cite, and, for a screen,
   `docs/design/README.md` and the screen's design.
4. Note each screen the release builds, and each state of one (an open
   menu, a card, a dialog), that no design draws. When the spec leaves its
   look open, it goes through Making a design before its issue starts;
   otherwise its pull request shows its screenshot
   (`docs/design/README.md`). Propose any change to an approach, the spec,
   or a design (`CLAUDE.md`, Judgment) before work starts on an issue that
   depends on it.
5. While the description has a paragraph that starts with `Scope:`, split
   it into issues: one for each part a person can see working, each sized
   for one pull request (`CLAUDE.md`, Issues and pull requests). Write each
   through `github-writing`, from `.github/ISSUE_TEMPLATE/task.md` (or
   `challenge.md` for problems), with the part's statements cited under
   Spec and its share of the exit criterion under Done when. File a choice
   that the scope needs first as a `decision` issue. End the Summary of
   each issue that waits on another issue, such as a `decision` issue from
   this step, with the line `Waits on #n.` (`github-writing`). Check that
   every item of `Scope` is in exactly one issue, then replace the
   paragraph with `Split into the issues of this milestone.`
6. End with a recap: the issues in the order to work them, the issues
   they wait on, and the open proposals.

## Close

1. Check that every issue of the milestone is closed. If one is open, stop
   until the developer moves it to a later release or it is closed.
2. With a clean working tree, run `git fetch origin develop main` and
   `git switch --detach origin/develop`, and note the commit
   (`git rev-parse HEAD`). Run `pnpm install --frozen-lockfile` and each
   check of the `verify` job in `.github/workflows/ci.yml` there, walk
   through the exit criterion in the running app, and keep the output.
3. After approval, move `main` to that same commit as a fast-forward
   (`git push origin <commit>:main`, without `--force`, because `main`
   only ever moves ahead to a commit of `develop`), so its CI deploys it.
   Tag the commit (`git tag -a <vX.Y.Z> <commit> -m "<vX.Y.Z>"`, then
   `git push origin <vX.Y.Z>`), publish a GitHub release of the tag titled
   `<vX.Y.Z>` that lists the closed issues, and close the milestone.
4. End with a recap: the tag, the release, the exit criterion with its
   evidence, and the issues left for later releases.
