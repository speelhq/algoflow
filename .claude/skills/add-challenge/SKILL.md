---
name: add-challenge
description: Create a challenge JSON with tests, hints, and solution per docs/spec/06-challenges.md and verify it with pnpm check. Use when asked to add a challenge, exercise, task, or problem for learners.
argument-hint: [challenge id]
allowed-tools: Bash(pnpm check *) PowerShell(pnpm check *)
---

Create the challenge described in $ARGUMENTS.

1. Read `docs/spec/06-challenges.md` (schema and the challenge's row) and
   `challenges/fizzbuzz.json` as the reference file.
2. Write `challenges/<id>.json` with: English title and description (add Japanese
   texts only if `src/i18n/ja.json` exists), difficulty, topics, inputs, at least
   three tests of which one is a boundary case marked `"edge": true` (C-03; tests
   have no name and are shown by their inputs), three hints,
   a `takeaway`, and a complete `solution`.
   If the problem belongs to a study plan, add its id to `challenges/plans.json`.
3. For expectations the spec marks as "recorded", run the solution once with the
   stated seed and paste the resulting values into the file.
4. Run `pnpm check challenges/<id>.json`.
5. Recap: id, plan (if any), number of tests, and the solution's emitted Python.
