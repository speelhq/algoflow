---
name: add-block
description: Add a block to src/blocks with interpreter, Python emission, i18n keys, and tests per docs/spec/blocks/blocks.md. Use when asked to add, implement, or support a block, builtin, or method.
argument-hint: [block key or description]
allowed-tools: Bash(pnpm test *) Bash(pnpm lint)
---

Add the block described in $ARGUMENTS.

1. Read `docs/spec/blocks/blocks.md` and find the block's row; read the
   Semantics heading of `docs/spec/language/language.md` that names the
   block, if one does. A block with no row is a choice the spec does not
   cover: propose the row (`CLAUDE.md`, Judgment) and wait; once agreed,
   the row, with its reason where `docs/spec/README.md`, Reasons asks for one, is
   committed before any code.
2. Read `src/blocks/registry.ts` and one existing block of the same shape.
3. Create `src/blocks/<key>.ts` exporting the block's `BlockDef` with the fields
   of `blocks.md`, The block definition, that the block needs. Its `notation()`
   equals the row's notation column, and the emitted Python equals the row's
   Python column, exactly.
4. Add `block.<key>.label`, `block.<key>.help`, and a `block.<key>.slot.<slot>`
   per slot the editor shows to `src/i18n/en.json`, and to `ja.json` if that
   file exists (`blocks.md`, Catalog keys); a named menu entry adds
   `block.<key>.<name>.label` and `.help`.
5. Register the block in `src/blocks/registry.ts`.
6. Add the tests of `blocks.md`, Verification: the exact emitted Python text,
   the interpreter's event sequence and result, one test per Semantics rule
   under the block's heading, and one test per error code the block can
   raise.
7. Run `pnpm test src/blocks src/python src/runtime` and `pnpm lint`.
8. Recap: key, emitted Python, test files.
