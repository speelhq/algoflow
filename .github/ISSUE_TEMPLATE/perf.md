---
name: Perf
about: A cost to measure before changing the code
labels: perf
---

## Summary

<!-- In one paragraph of plain words, say which operation may be too slow
     or too large, and under what conditions.
     Example: A run of a sorting problem takes tens of thousands of steps,
     and none of the costs that grow with a run's length has been
     measured. -->

## Cost

<!-- Give the cost as it stands, derived or measured, with the file and
     line that produce it. Then give the remedy under consideration and the
     cost it would have, and any target already recorded, with its source
     and what it applies to.
     Example: A backward Seek (`seek()` in `src/store/run.ts`) starts a new
     runner and advances it to the step, so pressing Back n times from
     step n costs n(n−1)/2 events in all. -->

## Spec

<!-- Quote each statement the operation implements, with its file and
     heading. -->

## Done when

<!-- State the condition that closes the issue. Include these: the
     measurement is recorded here, and either the change is made or the
     issue closes with no change. -->
