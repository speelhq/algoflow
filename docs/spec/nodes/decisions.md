# Nodes decisions

Why the statements of this folder were chosen, and the alternatives
rejected (`docs/spec/README.md`, Reasons).

**Categories live in `src/nodes/categories.ts`** (N-01, U-40).
`NodeDef.category`
(N-01) is owned by the node registry; the block menu (U-40) takes the
order from there rather than declaring its own copy, so adding a category
cannot leave the menu and the registry inconsistent. The file has no
imports, so `src/nodes` remains free of store and React dependencies.

**Blocks declare their menu entries** (N-11). The value list groups by
purpose, and one block can serve several groups (`binop` is `Add`,
`Equals`, and `And`), so a block lists its entries, each with its group,
the kinds it applies to, its symbol, and its keys; the editor reads them
and names no block, as N-14 requires, and a block added later brings its
entries with it.

**A kind is given only where the inputs settle it** (N-12). `and` and
`or` return the deciding operand (L-17), so their kind is known only when
both inputs have the same one; `+` on two true/false values fails (R-15),
and `+` on a number and a text fails (L-14), so neither has a kind; `*`
repeats a list or a text as Python does. A wrong kind would hide the
entries that apply, while no kind lists every entry (U-52). `list`,
`dict`, and `new` give the kind of what they make, which their block alone
settles.

**A `create` template after a frame** (N-08, L-41). `if c: y = 1` followed
by `y = 2` renders both as `create y`: L-41 makes `y` invisible after the
frame, so the outer assignment is where the region gains the name.

**A new `for` guesses no variable** (N-01). Filling a `for` variable with
the first unused of `i j k` was dropped as a special case: an inference,
and `create()` receives no context.
