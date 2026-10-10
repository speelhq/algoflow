---
name: add-node
description: Add a block to src/nodes with interpreter, Python emission, i18n keys, and tests per docs/spec/nodes/nodes.md. Use when asked to add, implement, or support a block, builtin, or method.
argument-hint: [block key or description]
allowed-tools: Bash(pnpm test *) Bash(pnpm lint) PowerShell(pnpm test *) PowerShell(pnpm lint)
---

Add the block described in $ARGUMENTS.

1. Read `docs/spec/nodes/nodes.md` and find the block's row. If there is no row,
   add one first and state so in the recap.
2. Read `src/nodes/registry.ts` and one existing block of the same shape.
3. Create `src/nodes/<key>.ts` with `key`, `shape`, `category`, `slots`, `create`,
   `run`, `python`. The emitted Python must equal the row's Python column exactly.
   An expression block also declares `kind` (L-65) and its `menu` entries from the
   N-11 table.
4. Add `node.<key>.label`, `node.<key>.template`, `node.<key>.help` to
   `src/i18n/en.json`, and to `ja.json` if that file exists; a named menu entry adds
   `node.<key>.<name>.label` and `.help`.
5. Register the block in `src/nodes/registry.ts`.
6. Add tests: the exact emitted Python text; the interpreter's event sequence and
   result; one error case if the block can fail.
7. Run `pnpm test src/nodes src/python src/runtime` and `pnpm lint`.
8. Recap: key, emitted Python, test files.
