# Editor

The editor writes a program's blocks: the block menu inserts a statement
block at a connector, and the block editor edits that block's slots in
place. This file states the block menu, the block editor, value lines and
their lists, what Backspace removes and what keys insert, target
slots, name fields, captions, the explanation line, and the verification.

## Block menu

The block menu lists the statement block definitions, except those marked
`hidden`, with a search over their `label` and `help`. Restricting the
menu per challenge was rejected, because it hides the language and adds
authoring work.

A statement block definition has `shape: "stmt"` or is a method
statement (`blocks.md`).

The menu groups the block definitions by category, in this order:
`Basic`, `Control`, `List`, `Function`, `Dict`, `Class`. The order puts
`Basic` and `Control` before `List`, because a beginner needs `if` and
`for` before the block definitions of `List`.

Each category keeps a fixed order, with `assign`, `print`, `if`, `for`,
and `while` first in their categories.

An entry reads as the block definition's label followed by its notation,
with every slot written `…`. For example: `Set variable  … ← …`,
`Print  print(…)`, `For loop  … ← …`, `For each loop  for … in …`.

The menu lists a block definition whose `requires` the connector doesn't
meet as disabled, with the reason (`menu.requires.loop`,
`menu.requires.function`). The menu disables the entry rather than hiding
it, because a disabled entry says that the block definition exists and
where it applies.

The `Function` category ends with `New function…`, which prompts for a
name, creates the function, and inserts a call to it.

After the categories, the menu holds:

- `This program`: the program's own functions, as calls, when any exist
- `Modules ▸`: a last entry that opens one group per module (`modules.md`,
  Resolution)

The modules sit behind one `Modules ▸` entry so that they don't overfill a
trainee's menu.

A module's group shows the module's name or title and lists the module's
functions as calls.

Learner modules come before built-in ones.

Choosing an entry inserts its block and opens the block editor on it.

Expression block definitions aren't in this menu: value lines offer them
(Value list).

The block menu's `This program` and the value list's `Your functions` list
only the program's functions that a call can name. They leave out a
function whose name a diagnostic refuses, because its entry would insert
a call that validation refuses, or a call of the builtin. For example: a
function named `for` or `abs`.

The diagnostic on that function's `Start` chart node says why (`chart.md`,
Editing on the chart).

## Block editor

The block editor is a popover on the right of the selected block's chart
node, within the canvas, so the panel stays readable while a block is
edited.

Three other placements were rejected:

- against the viewport, because the editor would flip over the panel and
  hide the problem's description that the learner builds from
- below or above the chart node, because the editor would cover the chart
  nodes that the learner builds from
- inside the chart node, because the chart is fitted to its width, a
  diamond has little room, and a value being built needs space at full
  size

Where the canvas lacks room on the chart node's right, the canvas scrolls
the chart left by the width that is missing while the editor is open.

The editor moves down or up only as far as it must to stay within the
canvas. Scrolling the chart up to make room below the chart node was rejected,
because with an editor 480 px high, the canvas would scroll for nearly
every chart node and hide the statements above the one being built.

The canvas draws the editor at 100 % whatever the chart's zoom.

While a list is shown (Value list; Name fields), the editor and its parts
keep fixed heights:

- The editor is 480 px high, or as high as the canvas less its margins
  when the canvas is lower.
- The explanation line is four lines high, the height of the longest
  help.
- The list takes the height that the editor's other parts leave, and it
  scrolls within that height.

The heights are fixed so that the editor, placed by its height, moves
neither when typing shortens the list nor when the highlight changes the
explanation line.

The list scrolls a highlighted row into sight only when no part of that
row is in sight, so no row moves under the pointer.

In a canvas lower than the editor's other parts and a few rows, the
editor scrolls within its height.

From top to bottom, the editor holds:

- the block's diagnostics, each with its message and, when `fix` is set,
  the button that applies the fix (`chart.md`, Editing on the chart,
  Diagnostics)
- the block's caption field (Captions), with `Duplicate` and `Delete` as
  icon buttons beside it, and `Open <name>` when the block calls a
  function or constructs a class
- the block's notation, with its slots editable in place
- the list of the focused slot (Value list; Name fields)
- the explanation line (Explanation line)

A separator divides each of the caption field, the notation, and the
list from the next.

`Open <name>` shows the called function's chart or the constructed class's
field table
(`chart.md`, Charts and the path bar). For a module's function or class,
it opens the module's Module page (`modules.md`, Operations).

The notation has its slots editable in place, each as its role chooses:

- `name`: a name field (Name fields)
- `expr` and `target`: a value line (Value line; Targets)
- an optional `expr` left empty: `+ value` (`editor.addValue`), which adds
  its value line
- `exprs`: value lines separated by commas, each with a remove button
  (`editor.removeValue.label`), followed by `+ value`, which adds one
- `body`: not shown

For example: a `for`'s init and check, `i ← 1` and `i < n + 1?`, are
edited in place.

A loop's editor edits the variable and the bounds of a `for`, the list of
a `foreach`, or the condition of a `while`. The generated chart nodes
(`chart.md`, Shapes) change with what the editor sets.

Clicking a slot drawn on the chart node opens the editor with that slot
focused. When the editor opens otherwise, the first slot still to fill
takes the keyboard. When there is none, the keyboard stays with the
chart, so Delete removes the block (`chart.md`, Editing on the chart).

An edit applies at once.

Esc or a press outside the editor closes it.

The chart node holds no control for the editor: nothing there takes the
keyboard or announces a popup.

For assistive technology, the editor names each field of its notation by
the block definition's label and the slot's name
(`block.<key>.slot.<slot>`, `blocks.md`, Catalog keys), because the
symbols before a field name nothing a screen reader can say. For example:
the field after `←` in a `Set variable` block is named
`Set variable, value`, and the field after `print(` is named
`Print, value`.

## Value line

A value line edits one expression and writes it as the chart writes it
(`blocks.md`, Notation):

- a variable as a bold word in the variable color
- an operator as its symbol
- an input still to fill as an empty field

A chip editor was rejected, because it nests a box per operation. A value
of three operations would be three levels of boxes, whereas a line reads
left to right as the chart writes it.

### Numbers

Typed digits make a number.

A `-` typed at an empty input before the digits makes the number
negative. The sign is typed rather than chosen from the value list,
because `found = -1` is the most common negative a learner types.

The parser reads `-1` as the negation of `1`, as Python does, so
`-3 ** 2` keeps Python's meaning.

A digit or `.` isn't taken in these cases:

- when it would make a number that Python rejects. For example: `07`,
  `1..`.
- when it follows a value other than a number
- for a digit (`parser.md`), when it would make an int outside the int
  range (`language.md`, Run-time values) or a float beyond the largest
  float

### Texts

The learner enters a text only through the list's `Text`, which places a
text field in the line. Enter, Tab, or leaving the field ends the text,
so the learner types the text without quotes and can't leave one out.

A click on a text in the line opens its field again, holding the text.

Backspace in an empty text field removes the text and leaves its input
to fill.

### Words

A typed word is a letter or `_` followed by letters, digits, and `_`. It
matches a name one of whose words starts with it, or an entry's keys,
because a match inside a word is never the name meant. For example:
`multiply` matches the entry `× Multiply`, and `i` doesn't match
`first`.

A word matches these names:

- where a value is expected: the visible variables, the entries offered
  there, and every call. For example: `abs`, `str`.
- after a value: every entry that takes a value

The learner can type a call in two places:

- where a value is expected: as the chart writes it. For example:
  `abs(x)`.
- after a value: as the value is built. For example: `x` then `abs`.

Offering a call only after its value was rejected, because it would
refuse what a learner copies from the chart.

While the word is unfinished, its matches replace the list's groups.

A name that equals the word comes first among the matches. After a value,
the entries for the value's kind come next, because Enter chooses the
first match. For example: `an` after a comparison is `And`.

Enter or a click chooses the highlighted match, and ↑ and ↓ move the
highlight.

A space or any key of the key table (Backspace and keys, Keys) ends the
word:

- When the word names a variable or an entry exactly, that variable or
  entry is chosen, and the key then applies.
- When the word names nothing exactly, or when the line refuses that
  choice, the key isn't taken, and the word stays to be corrected.

So `totl+` doesn't become a `+` with nothing before it.

Tab first chooses a word that names a variable or an entry exactly, and
then moves the caret (Moving the caret).

The line underlines a word that matches nothing, and the explanation line
names the closest variable or entry (`editor.didYouMean`). For example:
`Did you mean total?`.

The explanation line's `Did you mean` names a variable or an entry only
when it differs from the word by at most one letter in three, or by one
letter on a word of fewer than six letters, because two letters on a
short word reach unrelated names. For example: `totl` and `Not`.

### Modifier keys

A value line takes the keys typed without Ctrl or Cmd. It also takes the
characters that AltGr makes, because AltGr is how several keyboard
layouts type `[` and `{`.

Every other key acts as the keyboard table states (`pages.md`, Keyboard),
as it does outside the editor, because a value line, unlike a text field,
edits the program at each key, so the line's undo is the program's undo.

### Empty inputs

The value line and the chart node draw an empty required input at any
depth of the value:

- in the value line: an empty field
- on the chart node: a dashed `…`

Clicking an empty input on the chart node opens the editor focused on it.

A chart node draws an empty name slot with the same placeholder.

A chart node draws nothing for an `exprs` slot with no item, unless the
slot is required.

A diamond whose condition is empty shows the placeholder without `?`.

A value line that is one empty field reads `type or choose`
(`editor.valueLine.hint`) while it doesn't have the keyboard.

## Value list

The value list is the list below a value line. It offers the entries that
the learner can choose at the caret, in groups chosen by what is before
the caret.

Where a value is expected, the list holds:

- `Variables`: the variables visible at the block, most recently assigned
  first, each with its kind (`language.md`, Kinds)
- `Values`: the entries of group `values`, which are `Text`, `True`,
  `False`, `None`, `Empty list`, and `Empty dict`
- `Conditions`: `Not`
- `Calculate`: `Random whole number`, then `( )`, a pair of parentheses
  labeled `editor.parentheses.label`
- `Your functions`: the program's own functions as calls, then
  `Modules ▸`

In `Your functions`, each function is labeled `name(…)`, or `name()` when
it has no parameter, and explained by `editor.ownFunction`.

`Modules ▸` opens the same module groups as the block menu's `Modules ▸`
(Block menu).

After a value, the list holds the entries whose `on` holds the kind of
the expression before the caret (`blocks.md`, Value list entries), in these
groups:

- `Calculate` for a number
- `Conditions` for a true/false value
- `Items` for a list, a dict, or an object
- `Compare` and `Convert` for every kind

The expression before the caret is the largest operation with a
precedence that ends at the caret, within the innermost parentheses.

After a value of no known kind, the list holds every entry that takes a
value.

An entry with a symbol shows the symbol before its name. For example:
`× Multiply`.

The groups always come in this order: `Variables`, `Values`,
`Conditions`, `Calculate`, `Items`, `Compare`, `Convert`,
`Your functions`. The list leaves out a group with no row.

The list scrolls, and its last row is `Show all`. `Show all` lists every
entry that the learner can choose at the caret, in the order of the
groups:

- where a value is expected: every entry
- after a value: every entry that takes a value

Hovering a row highlights it.

A list with no row reads `editor.noItems`.

Each group's name says what the learner does with a value, not the block
category. `Combine`, `Other`, `Totals`, `Order`, and `Functions` were
rejected as names, because they mislead or head one or two rows.

`Variables` offers no `v + 1`, because guessing it for an index or a
bound would tie the list to two block definitions (`blocks.md`, The block
definition).

### Choosing

An entry chosen after a value takes that value as its first input:

- An operator stands between the value before the caret and the next one.
  It binds by the precedence of `emitter.md` within the innermost
  parentheses. An operator is an entry whose block definition has a
  precedence.
- An entry whose first input binds as an atom (`blocks.md`, Notation)
  takes the value just before the caret, as Python binds it, whether
  chosen or typed. For example: `Item at a position` makes
  `i + nums[…]`.
- Any other entry takes the expression before the caret whose kind chose
  the list, because the list offered the entry for that expression. For
  example: `i < n` followed by `As text` gives `str(i < n)`, and applying
  `As text` to `n` alone would fail when run.

The learner builds a value left to right, as it is typed and read,
because choosing `abs` first would make the learner build the value again
inside it.

An entry chosen where a value is expected fills that input:

- An entry that takes a value fills the input with its operation.
- A call of a function with no parameter, a variable, or a value fills
  the input.

The inputs that a choice leaves appear as fields in the line, and the
caret moves to the first of them.

Clicking an operator in the line lists the other entries of its block
definition in its group, and choosing one replaces it. For example: `<`
to `≤`, `+` to `Remainder`.

### Moving the caret

The caret moves:

- with Tab and Shift+Tab, between the fields of the line and, past its
  last or first field, to the next or previous slot of the notation
- with → at the end of an operation's last input, out of the operation
- with ← and →, while no word is typed, to the previous or next value or
  input
- with a click, after the value clicked or at the input clicked

Parentheses that the caret leaves behind close.

### Selected values

When Tab enters a slot, or the editor opens on it, the slot's value is
selected:

- A typed value replaces it: a digit, a word, a `-` sign, a parenthesis,
  or a bracket.
- Backspace removes it.
- A key that names an entry after a value takes the selected value as the
  entry's first input. For example: with `n` selected, `*` gives
  `n × …`.

A typed value replaces a selected value, because a slot reached by Tab
already holds a value, which a caret after it would extend. For example:
a new `for` holds `0`, which would become `01`.

## Backspace and keys

Backspace removes what is before the caret. Keys typed in a value line
insert what the chart writes.

### Backspace

Backspace removes:

- a value typed by its characters: its last character
- a name or another value chosen whole, or a text with no character: the
  value
- an operator, the name of a call, the brackets of an item or of a dict's
  key, or the dot of an object's field: the operation, and its first
  input stays in its place

The last character of a value typed by its characters is:

- of a number: a digit
- of a text: one character as the text field counts characters

Backspace removes a one-digit number whole.

After Backspace removes a text's character, the text field opens on the
rest, empty or not.

Backspace removes a name whole rather than by its letters, because a name
is replaced far more often than corrected, and a correction is chosen
from the list.

Backspace removes an operation only when no input after the first holds a
value, because removing the operation would also remove those values. For
example: `f(a, b, …)` keeps `b`.

At an input still to fill, Backspace acts this way:

- at an operation's first input, while a later input holds a value: it
  removes nothing and moves the caret left
- at a later input, when no input after the first holds a value: it
  removes the operation and keeps its first input
- at a later input, when an input after the first holds a value: it
  removes nothing and moves the caret to the end of the input before it

In and after a list, Backspace acts this way:

- at an item still to fill, other than the first: it removes that item
  and puts the caret at the end of the item before it
- after a list that holds an item: it removes from the end of the list's
  last item, because removing the list there would lose the items typed
  before
- after an empty list: it removes the list

Delete removes a selected value as Backspace does.

### Keys

Each entry names its keys (`typed`, `blocks.md`, Value list entries):

| Typed                   | Inserts                                          |
| ----------------------- | ------------------------------------------------ |
| `+` `<` `>`             | as typed                                         |
| `-`                     | `−`; at an empty input, the sign of what follows |
| `*` `/`                 | `×` `÷`                                          |
| `==` `!=` `<=` `>=`     | `=` `≠` `≤` `≥`                                  |
| `(`                     | a pair of parentheses, the caret inside them; after a call's name, the call's own |
| `[` `,` `]`             | a list's pair of brackets; `,` between its items; `]` leaves it; after a value, `[` an item of it (`nums[…]`) |
| `,` in a call           | the call's next input                            |
| `,` in an `exprs` slot  | the next value of the slot (Block editor)        |
| `%` `//` `**`           | as typed                                         |
| `and` `or` `not` `in`   | as typed                                         |

When two entries name a key, the key inserts the first entry that applies
at the caret and that the slot keeps (Targets). The entry that fills an
input comes before the one that takes a value, and a selected value
counts as both. Typing a refused key again as if the caret were after the
selected value was rejected, because a selected `0` then `.` would give
`0.`, which replacing a selected value avoids (Value list, Selected
values).

So `[` is `Empty list` where a value is expected and in place of a
selected value. It is `Item at a position` after a value, and on a
target's selected value, because a target slot keeps no list.

A single `=` inserts nothing, so the line never reads Python's assignment
as a comparison.

The line refuses a comparison typed after a comparison, and the
explanation line shows the message of `E_PARSE_CHAIN`.

At an input still to fill, a key that inserts an operation after a value
inserts nothing, except `-`.

`(` opens parentheses only at an input still to fill.

`)` leaves the innermost call around the caret when no pair is open or
the call begins inside the innermost open pair. Otherwise, it closes that
pair. For example: in `2*(abs(i)-1)`, the first `)` leaves the call and
the second closes the pair.

A `,` acts on the innermost call or list around the caret:

- in a list: `,` adds an item to fill after the one the caret is in
- in a call, after its last input: the line refuses `,`, because inside a
  call's parentheses a `,` separates its arguments, as in Python, never
  the values around the call

`[` at an input still to fill inserts a list with one item to fill and
puts the caret at it.

After a value, `[` inserts an item of that value at a position to fill
(`Item at a position`), which binds as Value list, Choosing, states. So
`nums[i]` is typed as the chart writes it.

`]` leaves the innermost list or item around the caret. It first removes
a list's item still to fill at the list's end, so `[` then `]` makes an
empty list.

With the caret after the whole value of a field, a key that begins the
notation's text after that field, and that the line doesn't take, moves
the keyboard to the next field. For example: `)` after the last value of
`print(…)` moves to the next field.

`**` and `//`, typed as two keys, become one operator that binds by its
own precedence. For example: `2*3**2` multiplies 2 by 3 to the power
of 2.

Every operator has a key where Python has one, so the `Python` tab later
shows keys that the learner has typed.

Parentheses aren't stored, so none is ever left unclosed.

## Targets

A `target` slot is a value line that keeps a target (`language.md`,
Statements). It takes a key or a choice only when the line's value stays
a target or an input still to fill:

- Its list leaves out only the rows whose choice would leave neither a
  target nor an input still to fill. It lists a row refused for another
  reason, and it refuses that row as a value line does.
- A key that would leave neither shows `editor.notTarget` on the
  explanation line.
- Inside a target's own inputs, the line takes any value. For example:
  the position of `nums[…]`.

So the learner types `nums[j]` as the chart writes it, and `[` after a
variable of any kind makes an item of it, a parameter included. For
example: `heap[i]`.

A name field offering an item form of a variable was rejected, because it
would repeat what a value line does after a value, and it would offer the
form only for a variable whose kind is known, so a parameter would never
get one.

The list of a target's line holds:

- where the whole target is still to fill, in a slot with `binds` set
  (`blocks.md`, The block definition): the names a name field offers,
  `This problem` first, with `New variable <name>` (Name fields)
- where the whole target is still to fill, in a slot without `binds`: the
  variables visible at the block
- after the target's variable: the entries that keep a target. For
  example: `Item at a position`.
- inside the target's inputs: a value line's lists, without
  `This problem`

The word typed names that `New variable <name>` row exactly.

A target's list of names, where the whole target is still to fill, ends
with no `Show all`, because every name it could list is in it.

In a target's line, Enter or a click that chooses a row and leaves the
target with no input still to fill moves the keyboard to the next slot,
as choosing a name in a name field does. So `total`, Enter, and the
value are typed in turn. Staying in the line was rejected, because a
target is a name far more often than an item, and a second Enter there
would close the editor before its value.

## Name fields

A `name` slot is a name field with a list below it. The list holds:

- in `main`: the names of the `expect.variables` of the challenge's first
  test, in that order, under `This problem`, then main's other variables
  under `Variables`, which are the inputs and the names assigned in
  `main`, in program order
- in a function: the function's parameters and the names assigned in its
  body, under `Variables`

The list offers the expected names first, because a verdict compares
`expect.variables` by name, and a learner who names `total` differently
would otherwise fail without a visible reason.

Fixed common names were rejected, because they would be read before the
names the problem needs. For example: `i`, `count`, `found`.

Each name shows its kind (`language.md`, Kinds).

Typing in a name field keeps the names that the text typed matches, as a
value line matches a name (Value line, Words). The list also offers a
typed name that it doesn't hold and that `language.md`, Identifiers,
allows, as `New variable <name>`.

In a name field:

- ↑ and ↓ move the highlight.
- Choosing a name moves the keyboard to the next slot.
- Enter chooses the highlighted name, or else the name typed.
- In a field not typed in, Enter keeps its name and moves to the next
  slot, or closes the editor after the last one.

The name field sets a name when it is chosen, not with every key, because
setting it with every key would give `t`, `to`, and `tot` values on the
way to `total`.

A name field keeps only the characters a name may hold (`language.md`,
Identifiers).

## Captions

Every statement block may carry a caption in the learner's own words
(`language.md`, Captions), because a condition written in symbols doesn't
say what it is for, and a caption in the learner's words does.

The learner types the caption in the editor's caption field
(`editor.caption.label`). The field's hint reads `optional`
(`editor.caption.hint`).

The application never translates the caption and never asks for it.

A chart node whose block has a caption shows the caption alone, in place
of its notation or its question. While a slot of the block is still
empty, the chart node shows its notation with the placeholder instead.

A counted loop with a caption shows it on its check, and its other
generated chart nodes keep their text.

Hovering a chart node whose block has a caption shows the text that the
caption replaces: its notation, its question, or, for a counted loop, its
check.

The `Python` tab writes the caption as a comment above the statement
(`emitter.md`). A `comment` block definition was rejected, because it
would draw Python's `#` on the chart.

## Explanation line

The explanation line at the foot of the editor explains what the list
highlights or the caret is in:

| What it explains | What the line shows |
| --- | --- |
| an entry | its name and its help (`blocks.md`, Catalog keys), followed, when keys insert it, by how to type them (`editor.typeKeys`: `Type %.`) |
| the parentheses | their label with `editor.parentheses.help`, and how to type them |
| an input of the problem | its kind (`editor.explain.input`) |
| a parameter | `editor.explain.parameter` |
| a name set nowhere yet | that choosing it makes a new variable that gets its value there (`editor.explain.newVariable`) |
| any other variable | its name with its kind and the statement that first gives it a value (`A number variable. It first gets a value in: i ← 1.`, `editor.explain.variablePlain` when it has no kind) |
| inside an operation's input | the operation's name (the entry offered after the kind of its first input, `Join with another list` for `+` after a list) and its notation with every input as its value, parenthesized as the chart parenthesizes it, an empty one as `…`, and the input the caret is in underlined (`dp[…]`, its `…` underlined) |
| a refused key | its message (Backspace and keys) |
| a word that matches nothing | the closest name (Value line), or `editor.nothingLike` when none is close |
| a name field with nothing highlighted | `editor.explain.name` |
| anything else | the block definition's help (`block.<key>.help`) |

The line shows an input by its value rather than naming it in words,
because naming an input would need a name for every input of every
operation in every language. For example: the line shows `dp[…]` with its
`…` underlined, not the word `position`.

## Verification

The tests of `src/ui/editor` cover:

- the block menu's entries, order, disabled entries, search, and the
  functions offered
- a value line's typing, keys, choosing, Backspace, moving, and list
- what a target's line takes and lists
- the name list and what a name field keeps
- the explanation line
