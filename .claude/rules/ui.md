---
paths:
  - "src/ui/**"
---

# The screens

Before you change a screen, read its file in `docs/spec/ui/` and
`pages.md`. Before you build one, also read `docs/design/README.md` and
the screen's artboard, the exported PNG. Work from the PNG because the
Claude Design files open only for the people they are shared with, and a
pull request can't review or diff them.

- oxlint's `jsx-a11y` rejects mouse and click handlers on `li`, `tr`, and
  `ol`. Use one delegated listener with `data-*` attributes instead.
- oxlint's `react/set-state-in-effect` rejects `setState` inside an effect.
  Adjust the state during render instead.
- Don't add React Testing Library. Unit tests cover the stores, `t()`,
  script logic, and the editor's behavior as pure session steps
  (`src/ui/editor/session.ts`), and Playwright exercises the components end
  to end, so a DOM testing library would be a second, slower way to test
  the same things.
- `src/ui/primitives` holds shadcn components generated on Base UI
  (`pnpm dlx shadcn add …`), and everything else under `src/ui/` is written
  by hand. Regenerate a generated file rather than editing it, with one
  exception: `shadcn add` writes `import { cn } from "cn"` and adds an npm
  package named `cn`, so change the import to `@/lib/utils` and revert
  `package.json` and the lockfile.
- To inspect a chart without a screen, write `layout()`'s result as SVG
  from a temporary Vitest file and take a screenshot of it with Playwright.
