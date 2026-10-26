---
name: add-block
description: Add a block definition to src/blocks with interpreter, Python emission, i18n keys, and tests per docs/spec/blocks/blocks.md. Use when asked to add, implement, or support a block, builtin, or method.
argument-hint: [block key or description]
allowed-tools: Bash(pnpm test *) Bash(pnpm lint)
---

Add the block definition described in $ARGUMENTS.

1. Read `docs/spec/blocks/blocks.md` and find the block definition's row.
   If a Semantics heading in `docs/spec/language/language.md` names the
   block definition, read it too. If the block definition has no row, the
   spec doesn't cover it yet: propose the row (`CLAUDE.md`, Judgment) and
   wait. Once the developer agrees, commit the row before any code, with
   its reason where `docs/spec/README.md`, Reasons, asks for one.
2. Read `src/blocks/registry.ts` and one existing block definition of the
   same shape.
3. Create `src/blocks/<key>.ts`, exporting the block definition's
   `BlockDef` with the fields from `blocks.md`, The block definition, that
   the block definition needs. Its `notation()` must equal the row's
   notation column, and the Python it emits must equal the row's Python
   column, exactly.
4. Add `block.<key>.label`, `block.<key>.help`, and one
   `block.<key>.slot.<slot>` for each slot the editor shows to
   `src/i18n/en.json`, and to `ja.json` if that file exists (`blocks.md`,
   Catalog keys). A named menu entry also needs `block.<key>.<name>.label`
   and `.help`.
5. Register the block definition in `src/blocks/registry.ts`.
6. Add the tests that `blocks.md`, Verification, requires: the exact
   emitted Python, the interpreter's event sequence and result, one test
   for each Semantics rule under the block definition's heading, and one
   test for each error code the block definition can raise.
7. Run `pnpm test src/blocks src/python src/runtime` and `pnpm lint`.
8. End with a recap: the key, the emitted Python, and the test files.
