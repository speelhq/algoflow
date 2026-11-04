---
paths:
  - "src/store/**"
---

# The stores

Before you change a store, read the spec it implements:

- `run.ts`, `steps.ts`, and `batches.ts`: `docs/spec/runtime/interpreter.md`,
  Driver, and, for what the run shows, `docs/spec/ui/run.md`.
- `program.ts` and `playground.ts`: `docs/spec/language/language.md`, Edits;
  Storage.
- `progress.ts` and `tests.ts`: `docs/spec/challenges/challenges.md`,
  Progress; Judging. `tests.ts` also follows `docs/spec/ui/run.md`,
  Submission.
- `layout.ts`: `docs/spec/ui/pages.md`.
- `storage.ts`: the spec that names each `algoflow:` key it reads or
  writes.

When you change a store or its tests:

- Declare the store's actions in its state type as function properties
  (`seek: (step) => …`), not as method signatures, which oxlint's
  `unbound-method` rejects.
- Vitest's fake timers give a timeout created during a tick a delay of
  1 ms, so a test of a batch loop needs `advanceTimersByTimeAsync(1)` per
  batch (`settle()` in `src/store/testing.ts`).
- Test a store that persists under `// @vitest-environment jsdom`.
