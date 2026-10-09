# Modules decisions

Why the statements of this folder were chosen, and the alternatives
rejected (`docs/spec/README.md`, Reasons).

A concept note of 2026-09-17, written without knowledge of the
project, describes an environment in which any block can be opened, its
implementation inspected, and a learner's own abstraction reused in a
larger program. The blocks of `nodes.md` are its lowest level and a
function is its middle level; what the spec lacked was a way to keep a
function beyond one program, the loop that makes a learner build one, and
the run-time controls that let a program be read at more than one level of
detail. The entries below record what was taken from the note and what
was not; those on the plans are under Scope, and those on Step over and on
editing while paused under UI.

**A module is a function that outlives its program** (D-01, D-03). Its
semantics are a function's; the difference is ownership and lifetime: a
function belongs to one `Program`, a module belongs to the learner and is
referenced by many programs: defined once, parameterised, called from any
program, and edited in one place with the change reaching every use. A
`Program` holds one program only, so that layer is added outside
`Program`. `Module` was chosen over `Functions` (collides with the block
menu's `Function` category and a program's own functions, excludes classes,
cannot group a `heap`) and `Library` (a single flat collection, and already
used in `docs/` for dependencies); it is the Python word, the learner
encounters it again as `import`, and it groups `heap_push`, `heap_pop`, and
`heapify` the way the note's data-structure tree does.

**A module uses no other module** (D-05). Module-to-module imports need
dependency order, cycle detection, and a second `from … import` layer in
E-09; nothing in the curriculum needs them, so `micrograd` is one module
rather than `engine` and `nn`. The rule can be lifted when a plan needs a
module built on another; the trigger is a challenge whose `module` would
have to call another learner module.

**A learner module shadows a built-in one** (D-02, D-11). The note's
"rebuild it from basic blocks" needs the learner's version to take
precedence under the same name, or every later problem would have to be
told which one to use. `Clone` is the entry to editing a built-in module
and makes the shadowing explicit on the Modules page; the word was chosen
over `Copy to my modules` because, like `Module`, it is one the learner
encounters again when programming.

**A module call is one step; its interior is reachable by one click**
(R-16, R-11, D-18, D-06). The note's "Extract Minimum can be used as a
single operation, and opened" is taken literally: in a program's run a
module function is a block, narrated by its returned value, and
`Open <name>` shows its interior. Opening it in a second browser tab keeps
the program, even a paused run, exactly as it was, so no context is lost;
and the Module page receives that call's arguments and runs the one
function in isolation, which locates a bug in `heap_pop` more directly than
stepping through hundreds of steps of `dijkstra` to reach it. While the
learner is still building a function it belongs to the program and is
stepped into; `Move to module` is the point at which it becomes a block.
Showing the module's chart in place within the program page was rejected:
it needed a second, shared-edit mode of the same page. The position bar
counts visible steps while `Done.steps` counts every event, so
`dijkstra-heap` still shows fewer steps than `dijkstra-grid` on the
Accepted view. Costs: a `storage` listener so other tabs observe a module
edit (D-22), and two tiled windows fall below the 1280 px gate (S-02), so
the second tab is used as a tab.

**Modules have cases because a module change reaches every program**
(D-19, D-20, D-21). The absence of a challenge had been read as the absence
of
tests, but a module is where tests matter most: editing `backward_step` for
the `tanh` problem can break every solved problem that uses it, and the
module is where that is detected. A case is a saved run (arguments,
returned value, arguments afterwards), the same idea as a recorded
expectation (C-20), so no test is written from an empty starting point;
`Test` is the established programming term, distinct from a problem's
`Submit`. Cases recorded from an accepted submission were rejected: no rule
selects suitable calls (the first `heap_push` of a test pushes onto an
empty heap, and a recursion produces thousands of calls), they would fix
the learner's own behaviour as correct, and they omit the act of judging a
result. Instead a learner module inherits the built-in module's cases for a
function of the same name: written by the author, with edge cases, checked
in both engines, and able to detect what the problem's tests do not.
`toValue` rebuilding one object per `$id` (L-06) is what lets an object
graph be a case argument or be transferred to the Module page.

**`heap_push` and `heap_pop`** (D-16). `push`/`pop` as module functions
would appear beside the list method `pop` in the block menu and be confused
with it (`pop(h)` versus `h.pop()`); the prefixed names follow
`heapq.heappush` and keep the module's name in every call.

**The module store names no service** (D-14). `localStorage` is sufficient
for a three-day course on one machine, and export files cover
transfer between machines; a server would justify its accounts only once
sharing between learners or synchronisation across devices becomes a goal.
Keeping every read and write behind one store lets that decision be taken
later without modifying callers, and the specification does not commit to a
vendor.

**A module edited in another tab does not stop a run** (D-22). The run
keeps the modules it started with, nothing fails because replay is
deterministic, and the next Run adopts the change, which needs neither a
stop nor a message explaining one.
