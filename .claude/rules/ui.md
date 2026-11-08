---
paths:
  - "src/ui/**"
---

# The screens

Before you change a screen, read the spec that `ARCHITECTURE.md`, Code
map, names for its part, and `pages.md`. Before you build one, also read
`docs/design/README.md` and the screen's design, through the link that
file holds. Once the screen is built, its screenshot in `e2e/screenshots/`
records how it looks.

- oxlint's `jsx-a11y` rejects mouse and click handlers on `li`, `tr`, and
  `ol`. Use one delegated listener with `data-*` attributes instead.
- oxlint's `react/set-state-in-effect` rejects `setState` inside an effect.
  Adjust the state during render instead.
- Don't add React Testing Library. Unit tests cover the stores, `t()`,
  script logic, and the editor's behavior as pure session transitions
  (`src/ui/editor/session.ts`), and Playwright exercises the components end
  to end, so a DOM testing library would be a second, slower way to test
  the same things.
- `src/ui/primitives` holds shadcn components generated on Base UI
  (`pnpm dlx shadcn add …`), and everything else under `src/ui/` is written
  by hand. Regenerate a generated file rather than editing it, with one
  exception: `shadcn add` writes `import { cn } from "cn"` and adds an npm
  package named `cn`, so change the import to `@/lib/utils` and revert
  `package.json` and the lockfile.
- Name a `data-*` attribute or a `data-testid` with the spec's word for
  what it marks, in kebab-case, such as `value-list`, so a test reads as
  the spec does, and give one thing one name. Set any other `data-*`
  attribute only where a test, a style, or a handler reads it, and leave
  `data-slot` to the shadcn and Base UI components, which name their parts
  with it.
- To inspect a chart without a screen, write `layout()`'s result as SVG
  from a temporary Vitest file and take a screenshot of it with Playwright.
