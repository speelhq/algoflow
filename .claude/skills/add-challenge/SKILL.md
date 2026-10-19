---
name: add-challenge
description: Create a challenge JSON with tests, hints, and solution per docs/spec/challenges/challenges.md and verify it with pnpm check. Use when asked to add a challenge, exercise, task, or problem for learners.
argument-hint: [challenge id]
allowed-tools: Bash(pnpm check *)
---

Create the challenge described in $ARGUMENTS.

1. Read `docs/spec/challenges/challenges.md` (the schema and the
   challenge's row), the curriculum in `docs/spec/scope/scope.md`, and
   `challenges/fizzbuzz.json`, which serves as the reference file.
2. Write `challenges/<id>.json` with:
   - an English title and description, and Japanese texts only if
     `src/i18n/ja.json` exists
   - the difficulty, topics, and inputs
   - at least three tests, one of them a boundary case marked
     `"edge": true` (`challenges.md`, Checks). Tests have no name and are
     shown by their inputs.
   - three hints, a `takeaway`, and a complete `solution`
3. Add the id to its plan in `challenges/plans.json`, at its place in the
   curriculum. Every problem belongs to exactly one plan.
4. Run `pnpm check challenges/<id>.json`.
5. End with a recap: the id, the plan, the number of tests, and the
   solution's emitted Python.
