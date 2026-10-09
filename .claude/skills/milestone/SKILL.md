---
name: milestone
description: Plan or close one release milestone (vX.Y.Z) - split its Scope into issues and check its artboards, or confirm its exit criterion on main, tag it, and publish the release. Use when asked to plan, start, or finish a release or milestone.
argument-hint: <vX.Y.Z> [close]
---

Plan the release $ARGUMENTS, or close it when the arguments end in `close`.
The work on each of its issues runs through `/issue <n>`, one pull request
per issue (`CONTRIBUTING.md`, How work proceeds).

Plan and judge from the files this session reads itself (`CLAUDE.md`,
Judgement).

Each GitHub write (an issue, a milestone change, a tag, a release) waits
for approval (`CLAUDE.md`, Working style). Quote every `gh api` path:
PowerShell reads an unquoted `{owner}` as a script block.

## Plan

1. `gh api "repos/{owner}/{repo}/milestones?state=all" --jq '.[] | select(.title == "<vX.Y.Z>")'`:
   its description states the goal and the exit criterion, and a `Scope`
   paragraph while the scope is not yet split.
2. `gh issue list --milestone "<vX.Y.Z>" --state all --limit 200`, then
   `gh issue view <n>` for every open one. Read the descriptions of the
   later open milestones: their scope is not yet due.
3. Read `docs/spec/README.md`, every spec statement the scope and the open
   issues cite, every entry of `docs/spec/*/decisions.md` that names those
   ids, and, for a screen, `docs/design/README.md` and its artboard.
4. Every screen, and every state of one (an open menu, a card, a dialog),
   that the release builds has its artboard in `docs/design/`; a missing
   one is handled as `docs/design/README.md` states. A better option than
   the spec, a decision, or an artboard is proposed (CONTRIBUTING,
   Proposals) before any issue that depends on it is worked.
5. While the description has a paragraph starting `Scope:`, split it: one
   issue per part a person can see working, each sized for one pull request
   (CONTRIBUTING, Issues), with the sections of
   `.github/ISSUE_TEMPLATE/task.md` (or `challenge.md` for problems), the ids of the part under Spec, and its share of the exit
   criterion under Done when; a choice the scope needs first is a
   `decision` issue. Check that every item of `Scope` is in exactly one
   issue, then replace the paragraph with `Split into the issues of this
   milestone.` (`gh api -X PATCH "repos/{owner}/{repo}/milestones/<number>" -f description=…`).
6. Recap: the issues in the order to work them, the decisions they wait
   on, and the open proposals.

## Close

1. Every issue of the milestone is closed; an open one stops the close
   until the user moves it to a later release or it is closed. With a clean
   working tree, `git fetch origin main` and `git switch --detach
   origin/main`; note the commit (`git rev-parse HEAD`). Run
   `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test`, `pnpm check`, `pnpm build`, and
   `pnpm test:e2e` there, and walk the exit criterion in the running
   application; keep the output.
2. After approval, tag that same commit: `git tag -a <vX.Y.Z> <commit> -m "<vX.Y.Z>"` and
   `git push origin <vX.Y.Z>`; `gh release create <vX.Y.Z> --verify-tag
   --title <vX.Y.Z> --notes …` listing the closed issues; close the
   milestone (`gh api -X PATCH "repos/{owner}/{repo}/milestones/<number>" -f state=closed`).
3. Recap: the tag, the release, the exit criterion with its evidence, and
   the issues left for later releases.
