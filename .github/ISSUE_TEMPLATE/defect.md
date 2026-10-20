---
name: Defect
about: Behavior that contradicts a statement of the spec
labels: defect
---

## Summary

<!-- In one paragraph of plain words, say what the program does that it
     shouldn't.
     If the work waits on open issues or pull requests, add one line after
     the paragraph, such as `Waits on #34 and #47.`
     Example: A list `xs` whose item `xs[0]` is `xs` makes `xs == xs` and
     `print(xs)` recurse until the JavaScript stack overflows. CPython
     answers `True` and prints `[[...]]`. -->

## Observed

<!-- Give the inputs, the actions, and what appeared, in enough detail to
     reproduce it, and the function and file that produce the behavior.
     Paste command or test output rather than describing it, and say so
     when a fact is read from the code rather than run.
     Example: A script, pasted with its output, builds `xs = [0]` and
     `xs[0] = xs` from the registered blocks and runs `print(xs == xs)`.
     Run with `pnpm exec tsx repro.ts`, it prints
     `RangeError: Maximum call stack size exceeded`. Read from the code:
     `equals()` in `src/runtime/values.ts` recurses into the list's
     items. -->

## Cause

<!-- Say which code produces it and why. Write `None` and the reason if the
     cause isn't established.
     Example: `equals()` and `writeValue()` were written for values that
     form a tree, but a list on the heap can refer to itself. -->

## Spec

<!-- Cite each statement that applies by its file and heading. Quote the
     part of it that the behavior contradicts. -->

## Done when

<!-- List the conditions that close the issue, one per item, including
     the test that covers it.
     Example:
     - `equals()` and `writeValue()` stop on a value they are already
       visiting, as CPython does.
     - A test covers a list that holds itself. -->
