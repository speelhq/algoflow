---
name: Perf
about: A cost to measure before changing the code
labels: perf
---

## Summary

<!-- In one paragraph of plain words, say which operation may be too slow
     or too large, and under what conditions.
     If the work waits on open issues or pull requests, add one line after
     the paragraph, such as `Waits on #34 and #47.`
     Example: A run of a sorting program on a long list, such as 200
     items, takes tens of thousands of steps, and none of the costs that
     grow with a run's length has been measured. -->

## Cost

<!-- Give the cost as it stands, derived or measured, with the function
     and file that produce it. Then give the remedy under consideration
     and the cost it would have, and any target already recorded, with its
     source and what it applies to.
     Example: A backward Seek (`seek()` in `src/store/run.ts`) starts a new
     runner and advances it to the step, so pressing Back n times from
     step n costs n(n−1)/2 steps in all, each of at least one event. -->

## Spec

<!-- Cite each statement the operation implements by its file and
     heading. -->

## Done when

<!-- List the conditions that close the issue, one per item. Include
     these: the measurement is recorded here, and either the change is
     made or the issue closes with no change. -->
