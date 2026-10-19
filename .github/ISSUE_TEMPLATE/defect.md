---
name: Defect
about: Behavior that contradicts a statement of the spec
labels: defect
---

## Summary

<!-- In one paragraph of plain words, say what the program does that it
     shouldn't.
     Example: A list that holds itself (`xs.append(xs)`) makes `xs == xs`
     and `print(xs)` recurse until the browser's stack overflows. CPython
     answers `True` and prints `[[...]]`. -->

## Observed

<!-- Give the inputs, the actions, and what appeared, in enough detail to
     reproduce it, and the file and line that produce the behavior. Paste
     command or test output rather than describing it.
     Example: `equals()` and `writeValue()` in `src/runtime/values.ts`
     recurse into a list's items with no record of the values they are
     already visiting. -->

## Cause

<!-- Say which code produces it and why. Write `None` and the reason if the
     cause isn't established.
     Example: These functions were written for values that form a tree,
     but a list on the heap can refer to itself. -->

## Spec

<!-- Quote each statement that applies, narrowed to the clause that
     applies, with its file and heading. -->

## Done when

<!-- State the condition that closes the issue, including the test that
     covers it.
     Example: `equals()` and `writeValue()` stop on a value they are
     already visiting, as CPython does, and a test covers a list that
     holds itself. -->
