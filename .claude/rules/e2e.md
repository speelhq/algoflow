---
paths:
  - "e2e/**"
  - "playwright.config.ts"
---

# The end-to-end tests

The specs these tests check are in `docs/spec/ui/`, and `pages.md`,
Verification, describes the screenshot suite.

- The suite runs against `dist/`, so run `pnpm build` first.
- The tests load a finished program through storage (the restore path in
  `docs/spec/challenges/challenges.md`, Opening and bundling). Don't build
  the programs through the `+` menu instead: every test of running or
  submitting would then depend on the editor, which the editing tests
  already cover. A development-only hook for loading would add UI that no
  test covers.
