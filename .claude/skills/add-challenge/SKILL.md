---
name: add-challenge
description: Create a challenge JSON with tests, hints, and solution per docs/spec/06-challenges.md and verify it with pnpm check. Use when asked to add a challenge, exercise, task, or problem for learners.
argument-hint: [challenge id]
allowed-tools: Bash(pnpm check *)
---

Create the challenge described in $ARGUMENTS.

1. Read `docs/spec/06-challenges.md` (schema and the challenge's row) and
   `challenges/bubble-sort.json` as the reference file.
2. Write `challenges/<id>.json` with: track, order, English title and description
   (add Japanese texts only if `src/i18n/ja.json` exists), inputs, at least three
   tests of which one has an English name starting with `edge:`, three hints, and a
   complete `solution` (plus `starter` for the micrograd track).
3. For expectations the spec marks as "recorded", run the solution once with the
   stated seed and paste the resulting values into the file.
4. Run `pnpm check challenges/<id>.json`.
5. Recap: id, track, number of tests, and the solution's emitted Python.
