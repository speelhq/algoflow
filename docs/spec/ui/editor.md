# Editor

Code: `src/ui/editor` (the block menu `menu.ts` and `BlockMenu.tsx`, the
node editor `NodeEditor.tsx` with its session `session.ts`, the value line
`line.ts` and `ValueLine.tsx`, names `names.ts`, the explanation line
`explain.ts`). Tests: beside each file, and `e2e/`.

## Block menu

The block menu lists the registered statement blocks (blocks of
`shape: "stmt"` and the method statements, `blocks.md`, not `hidden`) with a
search over `label` and `help`, grouped in the category order of `blocks.md`,
The block definition (`Basic`, `Control`, `List`, `Function`, `Dict`,
`Class`), each category in a fixed order that puts `assign`, `print`, `if`,
`for`, and `while` first in theirs; an entry reads as the block's label
followed by its notation with every slot as `…` (`Set variable  … ← …`,
`Print  print(…)`, `For loop  … ← …`, `For each loop  for … in …`);
a block whose `requires`
the connector does not meet is listed disabled with the reason
(`menu.requires.loop`, `menu.requires.function`). The `Function` category
ends with `New function…`, which prompts for a name, creates the function,
and inserts a call to it. Then follow the program's own functions under
`This program`, when any exist, and a last row `Modules ▸` opening one group
per module (`modules.md`, Resolution) titled by its name or title, learner
modules before built-in ones, each listing its functions as calls. Choosing
an item inserts it and opens its editor. Expression blocks are not in this
menu; value lines offer them (Value list). A block that cannot go at the
connector is disabled rather than hidden, which says that it exists and
where it applies. Restricting the menu per challenge was rejected: it hides
the language and adds authoring work. The modules sit behind one
`Modules ▸` row so as not to overfill a trainee's menu, and the categories
run Basic, Control, List because a beginner needs `if` and `for` before list
blocks.

The block menu's `This program` and the value list's `Your functions` list
only the program's functions a call can name: a function whose name a
diagnostic refuses is left out, and the diagnostic on its `Start` node says
why (`chart.md`, Editing on the chart): a row for a function named `for` or
`abs` would insert a call that validation refuses, or a call of the
builtin.

## Node editor

The node editor is a popover on the right of the selected node, within the
canvas, so the panel stays readable while a block is edited: where the
canvas lacks room on the node's right, the canvas scrolls the chart left by
what is missing while the editor is open, and the editor moves down or up
only as far as it must to stay within the canvas; clicking a slot drawn on
the node opens the editor with that slot focused. The editor is drawn at
100 % whatever the chart's zoom; in-node editing was rejected, as the chart
is fitted to its width, a diamond has little room, and a value being built
needs space at full size. Placed against the viewport, the editor would
flip over the panel and hide the statement the learner builds from, and
turned below or above the node it would cover the nodes built from.

While a list is shown (Value list, Name fields), the editor is 480 px high,
or as high as the canvas less its margins when the canvas is lower, its
explanation line keeps the height of four lines, the longest help's, and
its list scrolls within what the rest leaves, scrolling a highlighted row
into sight only when none of it is in sight: placed by that height, the
editor moves neither when typing shortens the list nor when the highlight
changes the explanation line, and no row moves under the pointer. In a
canvas lower than the rest and a few rows, the editor scrolls within its
height. Scrolling the
chart up to make room below the node, as it is scrolled left, was rejected:
with an editor that high it would scroll for nearly every node and hide the
statements above the one being built.

From top to bottom the editor holds the node's name field (Node names),
with `Duplicate` and `Delete` as icon buttons beside it and, when the node
calls a function or constructs a class, `Open <name>`, which shows that
function's or class's chart (`chart.md`, Charts and the path bar) or, for a module's, opens its
Module page (`modules.md`, Operations); the block's notation with its slots
editable in place (a `for`'s init and check, `i ← 1` and `i < n + 1?`): `id` slots as name fields (Name fields),
`expr` and `target` slots as value lines (Value line; Targets), an optional `expr` slot left
empty as `+ value` (`editor.addValue`), which adds its value line, `exprs`
slots as value lines separated by commas, each with a remove button
(`editor.removeValue`), followed by `+ value`, which adds one, `body` slots
not shown; the list of the focused slot (Value list, Name fields); and the
explanation line (Explanation line). A separator divides each of the name
field, the notation, and the list from the next. The slot clicked on the
node, or a first slot still to fill, takes the keyboard when the editor
opens; otherwise the keyboard stays with the chart, so Delete removes the
node (`chart.md`, Editing on the chart). An edit applies at once; Esc or a
press outside the editor closes it.

The editor is placed by its node without a control on the node: nothing
there takes the keyboard or announces a popup.

A field of the editor's notation is named, for assistive technology, by
the block's label and the slot's name (`block.<key>.slot.<slot>`, `blocks.md`,
Catalog keys): `Set variable, value`. The symbols before a field (`←`,
`print(`) name nothing a screen reader can say.

A loop's editor edits the variable and the bounds (`for`), the list
(`foreach`), or the condition (`while`); the generated nodes (`chart.md`,
Shapes) follow.

## Value line

A value line edits one expression, written as the chart writes it
(`blocks.md`, Node text): variables as bold words in the variable colour, an
operator as its symbol, and an input still to fill as an empty field. A chip editor was
rejected: it nests a box per operation, so a value of three operations is
three levels of boxes, where a line reads left to right as the chart writes
it.

Typed digits make a number, and a `-` typed at an empty input before them a
negative one; a digit or `.` that would make a number Python rejects (`07`,
`1..`), or that follows a value other than a number, is not taken. The sign
is typed rather than chosen from a group, as `found = -1` is the commonest
negative a learner types; the parser reads it as the negation of `1`, as
Python does, so `-3 ** 2` keeps Python's meaning.

A typed word, a letter or `_` followed by letters, digits, and `_`, matches a
name one of whose words starts with it, or an entry's keys (`multiply` finds
`×`, `%` finds `Remainder`): where a value is expected, the visible
variables, the entries offered there, and every call (`abs`, `str`), and
after a value, every entry that takes one. A call is typed where a value is
expected as the chart writes it (`abs(x)`), and after a value as the value
is built (`x` then `abs`); offering it only after its value would refuse
what a learner copies from the chart. While it is unfinished its matches replace the list's groups, a
whole name first and, after a value, the entries for its kind first; Enter
or a click chooses the highlighted match, and ↑ and ↓ move the highlight. A
space or any key of the key table (Backspace and keys) ends the word: when it
names a variable or an entry exactly, that is chosen and the key then
applies; otherwise, or when the line refuses that choice, the key is not
taken and the word stays to be corrected.
Tab chooses a word that names one exactly before it moves on. A word that
matches nothing is underlined, and the explanation line names the closest
variable or entry, one that differs by at most one letter in three, and at
least one (`editor.didYouMean`: `Did you mean total?`). A match inside a
word (`i` in `first`) is never the name meant, and Enter takes the first
match, so the kind's entries come first (`an` after a comparison is `And`).
A word that names nothing holds the key typed after it, so `totl+` does not
become a `+` with nothing before it. `Did you mean` allows one letter in
three, as two letters on a short word reach unrelated names (`totl` and
`Not`).

A text is entered only through the list's `Text`, which places a text field
in the line where the text is typed without quotes; Enter, Tab, or leaving
the field ends it, so no quote is typed and none can be left out. A click
on a text in the line opens its field again, holding the text, and
Backspace in an empty text field removes the text, leaving its input to
fill.

A digit that would make an int outside the int range (`language.md`,
Run-time values), or a float beyond the largest float, is not taken
(`parser.md`).

A value line takes the keys typed without Ctrl or Cmd, and the characters
AltGr makes; every other key acts as the keyboard table (`pages.md`,
Keyboard) states, as it does outside the editor: unlike a text field, a value
line edits the program at each key, so its undo is the program's. AltGr is
how several keyboard layouts type `[` and `{`.

An empty required input is an empty field in the value line and a dashed
`…` on the node, at any depth of the value; clicking it on the
node opens the editor focused on it. An empty name slot is drawn with the
same placeholder; an `exprs` slot with no item draws nothing unless it is
required; a diamond whose condition is empty shows the placeholder without
`?`. A value line that is one empty field reads `type or choose`
(`editor.typeHint`) while it does not have the keyboard.

## Value list

The list of a value line holds groups chosen by what is before the caret.
Where a value is expected: `Variables` (the variables visible at the node,
most recently assigned first, each with its kind, `language.md`, Kinds),
`Values` (the entries of group `values`: `Text`, `True`, `False`, `None`,
`Empty list`, `Empty dict`), `Conditions` (`Not`), `Calculate`
(`Random whole number`, then `( )`, a pair of brackets, labelled
`editor.brackets`), and `Your functions` (the program's own functions as
calls, each labelled `name(…)`, or `name()` with no parameter, and explained
by `editor.ownFunction`, and last `Modules ▸`, which opens one group per
module listing its functions as calls, as the block menu's does). After a
value, the entries whose `on` holds the kind of the expression before the
caret, the largest operation with a precedence that ends at the caret
within the innermost brackets (`blocks.md`, Menu entries): `Calculate` for a
number, `Conditions` for a true/false value, `Items` for a list, a dict, or
an object, and `Compare` and `Convert` for every kind; an entry with a
symbol shows it before its name (`× Multiply`). After a value of no known
kind every entry that takes a value is listed. The groups are always in the
order `Variables`, `Values`, `Conditions`, `Calculate`, `Items`, `Compare`,
`Convert`, `Your functions`, and a group with no row is not shown. The list
scrolls and ends with `Show all`, which lists in that order every entry
that can be chosen there: where a value is expected every entry, and after
a value every entry that takes one. Hovering a row highlights it, and a list
with no row reads `editor.noItems`. Groups are named by what is done with a
value, not by block category; `Combine`, `Other`, `Totals`, `Order`, and
`Functions` were rejected as names that mislead or head one or two rows.
`Variables` offers no `v + 1`: guessing it for an index or a bound would tie
the list to two block kinds (`blocks.md`, The block definition).

An entry chosen after a value takes that value as its first input: an
entry whose block has a precedence (an operator) stands between the value
before the caret and the next one, and binds by the precedence of
`emitter.md` within the innermost brackets; any other entry takes the
expression before the caret whose kind chose the list, so `i < n` followed
by `As text` gives `str(i < n)`, and an entry whose first input binds as
an atom (`Item at a position`, `blocks.md`, Node text) takes the value just
before the caret, as Python binds it (`i + nums[…]`), whether chosen or
typed. An entry chosen where a value is
expected fills that input. The inputs a choice leaves appear as fields in
the line and the caret moves to the first of them; Tab and Shift+Tab move
between the fields of the line and, past its last or first field, to the
next or previous slot of the notation, and → at the end of an operation's
last input leaves the operation; while no word is typed, ← and → move the
caret to the previous or next value or input, and brackets left behind
close; a click on a value puts the caret after it, and on an input at it. A
slot entered by Tab, or open when the editor opens, has its value selected:
a value typed (a digit, a word, a `-` sign, or a bracket) replaces it,
Backspace removes it, and a key that names an entry after a value takes it
as its first input (`n` selected, `*` gives `n × …`). An entry that takes a
value, chosen where a value is expected, fills the input with its operation
and the caret moves to its first input. A call of a function with no
parameter, a variable, or a value fills the input it is chosen for. A value
is built left to right, as it is typed and read; choosing `abs` first and
rebuilding the value inside it would cost two steps for one thought. An
entry with no precedence takes the expression the list was chosen for,
since the list offered `As text` after `i < n` for the comparison, and
applying it to `n` alone would fail when run. A selected value is replaced
by what is typed because a slot reached by Tab already holds one, `0` in a
new `for`, which a caret after it would extend (`01`).

## Backspace and keys

Backspace removes what is before the caret: the last character of a value
typed by its characters, a number's digit (a one-digit number goes whole) or
a text's character as the text's field counts one, the field opening on the
rest, empty or not; a value chosen whole (a name), a text with no character,
or an operator; on an operator, the name of a call, or the brackets
or dot of an item, a key, or a field it removes the operation and keeps its
first input in its place; at an operation's first
input still to fill while a later input holds a value, it removes nothing
and moves the caret left; at a later input still to fill, it removes the
operation and keeps its first input when no input after the first holds a
value, and otherwise removes nothing and moves the caret to the end of the
input before it. A name goes whole rather than by its letters, as a name is
replaced far more often than corrected, and a correction is chosen from
the list. Delete removes a selected value as Backspace does.
Clicking an operator in the line lists the other entries of its block in
its group, and choosing one replaces it (`<` to `≤`, `+` to `Remainder`).
Removing the operation also removes the values of its other inputs, so
Backspace removes it only when no input after the first holds a value
(`f(a, b, …)` keeps `b`).

Keys typed in a value line insert what the chart writes; each entry names
its keys (`keys`, `blocks.md`, Menu entries), and a key two entries name
inserts, of the entries that apply at the caret, the first the slot keeps
(Targets), the entry that fills an input before the one that takes a value,
a selected value counting as both. Typing any refused key again as if the
caret were after the selected value was rejected: a selected `0` then `.`
would give `0.`, which replacing a selected value avoids (Value list). So
`[` is `Empty list` where a value is expected and in place of a selected
value, and `Item at a position` after a value and on a target's selected
value, as the slot keeps no list:

| Typed                   | Inserts                                          |
| ----------------------- | ------------------------------------------------ |
| `+` `<` `>`             | as typed                                         |
| `-`                     | `−`; at an empty input, the sign of what follows |
| `*` `/`                 | `×` `÷`                                          |
| `==` `!=` `<=` `>=`     | `=` `≠` `≤` `≥`                                  |
| `(`                     | a pair of brackets, the caret inside them; after a call's name, the call's own |
| `[` `,` `]`             | a list's pair of brackets; `,` between its items; `]` leaves it; after a value, `[` an item of it (`nums[…]`) |
| `,` in a call           | the call's next input                            |
| `,` in an `exprs` slot  | the next value of the slot (Node editor)         |
| `%` `//` `**`           | as typed                                         |
| `and` `or` `not` `in`   | as typed                                         |

A single `=` inserts nothing; a comparison typed after a comparison is
refused and the explanation line shows the message of `E_PARSE_CHAIN`. At an
input still to fill, a key that inserts an operation after a value inserts
nothing, `-` aside; `(` opens brackets only there. `)` leaves the innermost
call around the caret when no pair is open or the call begins inside the
innermost open pair, and otherwise closes that pair, so `2*(abs(i)-1)` keeps
both. A `,` after the last input a call holds is refused: inside a call's
brackets a `,` separates its arguments, as in Python, never the values
around the call. `[` at an input still to fill inserts a list with one item
to fill and puts the caret at it; after a value it inserts an item of that
value at a position to fill (`Item at a position`), binding to the value
just before it as Python does (`i + nums[…]`), so `nums[i]` is typed as the
chart writes it. In a
list, `,` adds an item to fill after the one the caret is in; `]` leaves the
innermost list or item around the caret, a list's item still to fill at its
end removed first, so `[` then `]` makes an empty list; a `,` acts on the
innermost call or list around the caret. With the caret after a field's
whole value, a key that begins the words the notation writes after that
field, and that the line does not take, moves the keyboard to the next
field: `)` after the last value of `print(…)` goes on.
Backspace at an item still to fill
of a list, other than its first, removes that item and puts the caret at the
end of the item before it; after a list it removes from the end of its last
item, and after an empty list the list: removing the list there would lose
the items typed before. `**` and
`//`, typed as two keys, become one operator that binds by its own
precedence: `2*3**2` multiplies 2 by 3 to the power of
2. A single `=` is Python's assignment, so it is never read as a
comparison; every operator has a key where Python has one, so the
`Python` tab later shows keys the learner has typed. Brackets are not
stored, so none is ever left unclosed.

## Targets

A `target` slot is a value line that keeps a target (`language.md`,
Statements): a key or a choice is taken only when the line's value stays a
target or an input still to fill, and its list leaves out only the rows
whose choice would leave neither, a row refused for another reason listed
and refused as in a value line; a key that would leave neither shows
`editor.notTarget` on the explanation line.
Inside a target's own inputs (the position of `nums[…]`) the line takes any
value. So `nums[j]` is typed as the chart writes it, and `[` after a
variable of any kind makes an item of it, a parameter's (`heap[i]`) among
them. A name field offering an item form of a variable was rejected: it
repeated what a value line does after a value, and offered the form only
for a variable whose kind is told, so a parameter never got one.

Where the whole target is still to fill, the list of a slot that `binds`
(`blocks.md`, The block definition) holds the names a name field offers
(Name fields), `This problem` first, and a typed name that neither holds
and that Identifiers allows (`language.md`) as `New variable <name>`, which
the word names exactly; the list of a slot that does not bind holds the
variables visible at the node. Either list of names ends with no `Show all`,
as every name it could list is in it. After the target's variable the list
offers the entries that keep a target (`Item at a position`); inside the
target's inputs the lists are a value line's, `This problem` not among them.

In a target's line, Enter or a click that chooses a row and leaves the
target with no input still to fill moves the keyboard to the next slot, as
choosing a name in a name field does, so `total`, Enter, and the value are
typed in turn; `[` typed after a name makes its item, and so does `[` on
the target's selected value, the entry the slot keeps of the two `[`
names (Backspace and keys). Staying
in the line was rejected: a target is a name far more often than an item,
and a second Enter there would close the editor before its value.

## Name fields

An `id` slot is a name field with a list below it. In `main`
the list holds the names of the `expect.variables` of the challenge's first
test under `This problem`, in that order, then main's other variables under
`Variables`: the inputs and the names assigned in `main`, in program order;
in a function it holds the function's parameters and the names assigned in
its body, under `Variables`. Each name shows its kind (`language.md`,
Kinds). A verdict compares `expect.variables` by name, so a learner who
names `total` differently would fail without a visible reason; offering
the expected names first removes that failure, and fixed common names
(`i`, `count`, `found`) would be read before the names the problem needs.

Typing in a name field keeps the names that begin with the text typed, as a
value line matches a name (Value line), and a typed name that neither holds
and that Identifiers allows (`language.md`) is offered as
`New variable <name>`.

In a name field, choosing a name moves the keyboard to the next slot; ↑ and
↓ move the highlight; Enter chooses the highlighted name, else the name
typed, and in a field not typed in keeps its name and moves to the next
slot, or closes the editor after the last one. A name is set when chosen,
not with every key, which would give `t`, `to`, and `tot` values on the way
to `total`.

A name field keeps only the characters a name may hold (`language.md`,
Identifiers).

## Node names

Every statement may carry a name in the learner's own words (`language.md`,
Statement names), typed in the editor's name field (`editor.name`,
placeholder `editor.nameHint`: `optional`); the application never
translates it and never asks for it. A named node shows its name alone, in
place of its notation or its question, unless a slot of it is still empty,
when it shows its notation with the placeholder; a named counted loop shows
its name on its check, its other generated nodes keeping their text;
hovering a named node shows what it draws without its name, its notation or its question, a named counted loop its check, and the `Python` tab writes the
name as a comment above the statement (`emitter.md`). A condition written in
symbols does not say what it is for, which a name in the learner's words
does; a `comment` block was rejected, as it would draw Python's `#` on the
chart.

## Explanation line

The explanation line at the foot of the editor explains what the list
highlights or the caret is in: an entry's name and its help (`blocks.md`,
Catalog keys), followed, when keys insert it, by how to type them
(`editor.typeKeys`: `Type %.`); the brackets' label with `editor.bracketsHelp`
and how to type them; a variable's
name with its kind and the statement that first gives it a value (`A number
variable. It first gets a value in: i ← 1.`, `editor.explain.variablePlain`
when it has no kind), an input's kind (`editor.explain.input`), a parameter
(`editor.explain.parameter`), or, for a name set nowhere yet, that choosing
it makes a new variable that gets its value there
(`editor.explain.newVariable`); inside an operation's input, the operation's
name (the entry offered after the kind of its first input, `Join with
another list` for `+` after a list) and its notation with every input as
its value, bracketed as the chart brackets it, an empty one as `…`, and the
input the caret is in underlined (`dp[…]`, its `…` underlined); the message
of a refused key (Backspace and keys); the closest name for a word that
matches nothing (Value line), or `editor.nothingLike` when none is close;
in a name field with nothing highlighted, `editor.explain.name`; or else the
block's help (`block.<key>.help`). An input is shown by its value, not named
in words (`position`), which would need a name for every input of every
operation in every language.

## Verification

The tests of `src/ui/editor` cover the block menu's entries, order, disabled
entries, search, and the functions offered; a value line's typing, keys,
choosing, Backspace, moving, and list; what a target's line takes and
lists; the name list and what a name field keeps; and the explanation line.
