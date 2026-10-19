---
paths:
  - "package.json"
  - "pnpm-lock.yaml"
  - ".oxlintrc.json"
  - ".oxfmtrc.json"
  - "tsconfig*.json"
  - "vite.config.ts"
  - "playwright.config.ts"
  - ".github/**"
  - "scripts/**"
  - ".claude/**"
---

# Tooling

`scripts/check.ts` implements three parts of the spec. Read them before you
change it:

- `docs/spec/challenges/challenges.md`, Checks
- the CPython check in `docs/spec/runtime/interpreter.md`
- the checks in `docs/spec/ui/pages.md`, Catalogs

- Keep `@types/node` on the major version in `.node-version`. Types from a
  later major accept APIs that CI's Node lacks, and every check would
  still pass.
- `pnpm lint` type-checks (`--type-check`) and `pnpm build` doesn't, so
  each type is checked once.
- Keep `pnpm check` a single script that runs the i18n check itself. pnpm
  appends command-line arguments to the end of a script, so a second,
  chained script would receive `challenges/x.json`.
