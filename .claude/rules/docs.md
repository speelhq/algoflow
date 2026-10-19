---
paths:
  - "docs/**"
---

# The specification and the artboards

Before you change the spec, read `docs/spec/README.md`, which explains how
to write a statement and its reason and how one statement refers to
another. Before you change `docs/design/`, read its `README.md`.

- Wrap Markdown under `docs/` by hand. Oxfmt skips `docs/`
  (`.oxfmtrc.json`) because it would rewrite the TypeScript blocks that the
  spec writes compactly (a union on two lines would become one member per
  line, and aligned comments would lose their columns), and it would
  unindent a list item's line that continues a code span.
