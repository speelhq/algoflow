# Language decisions

Why the statements of this folder were chosen, and the alternatives
rejected (`docs/spec/README.md`, Reasons).

**An empty slot is an expression kind** (L-09). `create()` must return a
statement whose required slots exist; making the slot type `Expr | null`
would distribute null checks through every block and the emitter. A dedicated
`empty` kind keeps `Expr` a closed union, lets validation report
`E_EMPTY_SLOT` generically, and emits `...` so the Python tab still renders.

**Statements are addressed by `Place`** (L-54). Edits from the UI arrive as
a drop at index N of region R; a `{ parent, slot, index }` triple names every
region (main, a function body, a frame region) without exposing array
references. `moveStmt` counts the index after removal because a drag within
one region is the common case and the drop indicator is computed on the
list without the dragged card.

**A `for` variable belongs to the enclosing region** (L-43). Python leaves
the loop variable defined after the loop, and `for` reads its bounds before
the body runs, so the variable is treated as assigned by the statement that
owns the loop, not inside its body. Names first assigned in the body still
raise `E_DECLARE_FIRST` afterwards.

**`hoistAssign` picks the default from the first inner assignment** (L-44).
The fix must be type-consistent as the learner reads it: a counter starts at
`0`, a message at `""`, a flag at `False`, a collection empty. When the first
value is not a literal the default is `None`, which any later assignment
replaces.

**Repeated objects carry the same `$id` in `toData`** (L-06). A list holding
the same object twice (micrograd `mul(a, a)`) must show identity; a second
full copy with the same `$id` is simpler to compare than a reference node,
and a cycle degrades to `{ $cls, $id }` so the conversion terminates.

**Variables may not shadow callables** (L-45). `count = 0` alongside
`def count()` runs in the interpreter (calls resolve by name) but fails in
CPython; the same holds for a function named after a builtin such as
`random_int`, whose registry key would take precedence without notice.

**Typing is one step of history** (L-52). A value typed into a line
changes the chart with every key (U-41); one history entry per key would
spend the 100 entries on one word and make undo remove a letter at a time.
A field that changed only on leaving it would keep the chart behind the
editor.

**A save also happens when the page is hidden** (L-53). The 500 ms delay
spares storage a write per key, but a tab closed within it would lose the
last edit; the browser's `pagehide` is the last moment a page may write.

**Playground programs have an index** (L-57). The stored value is the
`Program` itself (L-55), which has no field for the time of its last edit,
and a Playground row needs that time (U-15); adding a field to `Program`
would put a storage concern into every export and every challenge file. A
key holding the ids and their times also gives the Playground page its list
without scanning every key of the origin, and the `play-` prefix keeps a
Playground id from ever reading as a challenge id.

**Storage holds the raw `Program` JSON** (L-55). A zustand `persist` wrapper
does not suit one key per challenge, and `migrate()` must validate whatever
is returned; the raw form is also what Export writes (L-53). A rejected value
resolves to an empty main rather than failing the load.

**`foreach` visits the live list** (L-26). `foreach` iterated over a
snapshot, so a body that changes its list ran differently here and in the
emitted Python, without any indication, unlike the other differences from
Python (a `bool` is not a number, recursion stops at 200,
`E_DECLARE_FIRST`), which are all stricter and terminate in an error; it
now visits the live list by index as Python does, keeping the third
commitment for learners' programs, which are not checked against CPython.
