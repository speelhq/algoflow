# Runtime decisions

Why the statements of this folder were chosen, and the alternatives
rejected (`docs/spec/README.md`, Reasons).

## Interpreter

**`bool` is not a number for arithmetic and ordering** (R-15, L-16).
Python treats `True` as `1`, but block programs never rely on it there, and
the interpreter's `E_TYPE` keeps the type model simple for learners while
ending in an error that names the operands. `==` and `in` compare a `bool`
and a number as Python does: they never fail, so a stricter rule would give
a different answer from the emitted Python without any message, against
the third commitment.

**A condition ends in its own `compare`** (R-35, R-14, U-108, U-116). The
mark and the narrated answer of a diamond need the truth of its whole
condition. The driver could infer it from the region entered next, but an
empty region is entered by no statement and a loop's exit enters whatever
follows it; the runner knows it at the moment it decides. The `compare` is
added unless the condition's last event is its own, so a condition that is
one comparison still yields one event, and the event counts of such programs
do not change. The last event decides, not any event: a call inside the
condition can reach the same diamond in another frame, whose `compare` has
the same id, and every call ends in its `return` (R-14), so that `compare`
is never the last.

**An error names the operation and what it was given** (R-09, R-34, L-63,
L-64, U-107). `E_TYPE` names two operand types, which fits an operator; used
for `random_int(5, 1)` it would read
`5 and 1 cannot be used in this operation`, and for `abs("x")`
`abs and str …`, naming neither the operation nor what is wrong. A code for
each kind of fault says both: the type a one-value operation does not take,
the text that is no number, the empty range. `op` is the block's registry
key, written as the block's label, so the message follows the locale and no
block spells a message key. A field read from a value that is no object is
`E_FIELD` with the value's type name as `cls`: the fault is a field the
value does not have, as for an object of a class without it, and `E_TYPE`
would name a second operand where there is none.

**`state` is refreshed while playing, as a copy** (R-12). The `Result` tab
must update per step at the fastest speed. A shallow copy of the frame list
would share the runner's variable maps and heap: a published `state` would
change at the next step, so a screen could neither compare two states nor
memoize on one, and a `compare` event narrated later would show a list's
current contents. A published `state` is therefore a copy of the
variables and of the heap entries; values are immutable records, so one
level is sufficient. The cost per publish is proportional to the size of
the heap. Batches publish once per batch.

**A finished runner keeps its outcome** (R-22). A runner that is called
again after its end returns the same `Done` rather than an error or an
undefined value, so a caller that drains it in batches (Submit, the
pre-run, `scripts/check.ts`) needs no guard around its last batch.
Forbidding the call instead would move that guard into every caller with
nothing to detect a caller that forgot it.

**The CPython epilogue converts values in Python** (R-20). Serialising Python
values as `Data` on the Python side (`$float`, `$int:` keys, `$cls`/`$id`)
lets the TypeScript side compare with the same `dataEquals` used for
expectations, so one equality rule (C-10) serves both engines.

**The driver publishes its projection, not only its position** (R-12,
R-30, R-31).
`taken`: U-61 colours the path of the current pass, which cannot be rebuilt
from `lastEvent` after a Seek, so the projection keeps it beside `verdicts`
and a `loop` event clears both. `pass`: `Pass 3` requires a count for each
loop since its `enter`, which only a replaying projection holds. `busy`: the
five statuses have no value for a pre-run, a Seek, or a Skip in progress,
and a program that does not terminate pre-runs for several seconds (500
timers, which browsers clamp to about 4 ms each); a sixth status would have
made every test of `status` in the screens three-way. While `busy`, Step
and Play do nothing, because taking over the runner would leave a Seek at an
arbitrary step under a position bar that shows another; Pause still cancels
a Skip, and Pause during the pre-run opens the run paused rather than being
discarded. `verdict` is judged once, on the pre-run's runner, and published
only at step `total`, so Back from the end removes it again. `Watch this
case` is `run({ watch: true })` and not a step passed in: the runners of
Submit record no print steps, so only the driver's own pre-run determines
where the differing line was printed, and an outdated difference cannot be
passed in.

**A step count includes the failing step** (R-23, R-32). A step is one call of
`next()`, and the call that fails is one; an error run therefore has
`total = events + 1`, step `total` has no event, and the last position of
the position bar is where the error is shown. A finished run is `done` on
reaching `total`, not one Step later: U-81 names that step "the last step
of the run", and the driver makes one further call of `next()` there so
that the frames have unwound.

**A comparison is narrated from the frame** (R-06, U-63). Carrying the two
operand values in the `compare` event, to fill a template sentence, was
rejected: the operands alone (`3` and `0` of `i % 15 == 0`) hide where the
3 came from. The narration writes the comparison as the chart
does with each variable replaced by its value in the shown frame, which
shows the origin, so the event carries its result only. A list keeps its
name: its items were narrated by the `read` events before the comparison.

**The driver publishes the statement to highlight** (R-12, U-39). Expression
events carry the id of an expression, and the chart, the narration, and the
`Python` tab all need the statement that contains it. The driver already
holds the owner map for its marks, so it publishes `activeId` once rather
than each screen resolving the owner again.

## Emitter

**Python stays the only generated language** (E-01). Of the other languages
considered, JavaScript and Dart, JavaScript would not preserve the third
commitment: it has no int/float distinction, `-7 % 2` is `-1`, there is no
`//`, and `in` on an array tests indices, so a faithful emitter would either
produce output differing from the chart or wrap arithmetic in helper
functions unsuitable for a learner to read. If a second language is required
later, the block language must first be narrowed or the helpers accepted.

**Modules are emitted as files, not inlined** (E-02, E-09, U-25). Inlining
a module's functions into `main.py` would make the `Python` tab state
something the chart does not (one program) and hide the module the learner
built.
`from heap import heap_push, heap_pop` plus `heap.py` in its own tab states
exactly what the chart states, keeps every file copyable into a Python
interpreter, and introduces the term the learner will need. Calls remain
unqualified (`heap_push(h, x)`), because `heap.push(h, x)` would collide
with the method syntax of G-03.

## Parser

**The parser consults the registry** (G-01). Grammar-legal forms whose block
is not registered (`[1, 2]`, `xs[i]`, `p.x`, `Cls()`) would pass the parser
and cause `unparse`, `validate`, or `run` to fail with an unknown-node
error; reporting `E_PARSE_SYNTAX` at the token keeps the failure a
diagnostic, and the registry alone decides what parses.

**No statement-level Python import** (G-01). The beginner's loop never
involves typing Python, and a learner able to type it does not need blocks;
the block language is a strict subset, so most pasted Python would fail
without a clear diagnostic. The `Python` tab, whose lines and nodes
select each other (U-25), provides the transition from chart to text. The
keys of a value line (U-93) spell operators as Python does (`==`, `*`),
but the line never shows Python text: each key is replaced at once by what
the chart writes.
