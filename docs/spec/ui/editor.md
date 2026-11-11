# Editor

The editor writes a program's blocks: the block menu inserts a statement
block at a connector, and the block editor edits that block's slots in
place. This file states the block menu, the block editor, value lines and
their lists, target slots, the name list, captions, the explanation
line, and the verification.

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
with every slot written as its hint (`blocks.md`, Notation, Drawing). For
example: `Set variable  variable ← value`, `Print  print(values)`,
`For loop  variable ← start`, `For each loop  for variable in list`.

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

Choosing an entry inserts its block and opens the block editor on it. A
slot of the block that holds an operation holds the text that a choice of
that operation writes (Value list, Choosing). For example: a method
statement holds `.append()`, and a call of a function holds `greet()`.

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

While a value list is shown (Value list), the editor and its parts keep
fixed heights:

- The editor is 480 px high, or as high as the canvas less its margins
  when the canvas is lower.
- The explanation line is four lines high, the height of the longest
  help.
- The value list takes the height that the editor's other parts leave,
  and it scrolls within that height.

The heights are fixed so that the editor, placed by its height, moves
neither when typing shortens the list nor when the highlight changes
the explanation line.

The value list scrolls a highlighted row into sight only when no part of
that row is in sight, so no row moves under the pointer.

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
- the value list of the focused slot (Value list)
- the explanation line (Explanation line)

A separator divides each of the caption field, the notation, and that
list from the next.

`Open <name>` shows the called function's chart or the constructed class's
attribute table
(`chart.md`, Charts and the path bar). For a module's function or class,
it opens the module's Module page (`modules.md`, Operations).

The notation has its slots editable in place, each as its role chooses:

- `expr`, `target`, and `exprs`: a value line (Value line; Targets)
- `body`: not shown

For example: a `for`'s init and check, `i ← 1` and `i < n + 1?`, are
edited in place.

An optional `expr` slot holds no value while its value line has no text.
An `exprs` slot's value line holds its values separated by commas, and
the slot holds no item while the line has no text.

A field is a place in the editor where the learner types: a field of the
notation, or the caption field. Each `expr`, `target`, and `exprs` slot
of the notation is one field of the notation, its value line.

A loop's editor edits the variable and the bounds of a `for`, the
variable and the list of a `foreach`, or the condition of a `while`. A
loop's variable is a target that binds, edited in a target's line
(Targets). The generated chart nodes (`chart.md`, Shapes) change with
what the editor sets.

Clicking a slot drawn on the chart node opens the editor on that slot.
When the editor opens, a field takes the keyboard:

- on a slot clicked on the chart node: that slot's field
- on a block that the block menu has just inserted: its first field, with
  the caret where a choice would put it (Value list, Choosing)
- otherwise: the first field that holds a draft

When no field takes it, the keyboard stays with the chart, so Delete
removes the block (`chart.md`, Editing on the chart).

Tab and Shift+Tab move the keyboard to the next and previous field of the
notation.

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
`Print, values`.

## Value line

A value line is a text field that edits one slot of a statement as
text. It writes the slot's value as the emitter writes it (`emitter.md`,
Expressions), and a draft as its text (`language.md`, Expressions,
Drafts). While it has the keyboard, it keeps the text as the learner
typed it, spaces included.

These editors were rejected:

- a chip editor, because it nests a box per operation. A value of three
  operations would be three levels of boxes, whereas a line reads left to
  right.
- a line that edits the value at each key and keeps the keys that are no
  value yet beside it, because every state between two values would need
  rules of its own for drawing, Backspace, the caret, and undo, while a
  text field keeps what was typed. For example: a word being typed, `=`
  before `==`, and a `)` typed too early.

Each change to the text, apart from text still being composed (Keys),
edits the program. The slot takes the value that the text writes, or the
text as a draft when the text writes no value that the slot keeps
(`parser.md`; Targets).

A value line holds one line of text. A line break pasted into it
becomes a space, as in a caption (`language.md`, Captions).

A value's slots are the places in the expressions it holds that hold an
expression: each `expr` slot, and each item of an `exprs` slot.

### Keys

A value line takes the keys of a text field: every key types its
character, and ←, →, Home, End, and a click move the caret, with Shift to
select.

Backspace and Delete remove the selected text, or else one character,
not a whole name, because a name that the learner typed is corrected by
its letters.

A key that the keyboard table names acts as the table states (`pages.md`,
Keyboard). Any other key with Ctrl or Cmd acts as a text field's. For
example: Ctrl/Cmd+V pastes.

Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo the program, not the text
field, because each change to the text edits the program, so the line's
undo is the program's undo.

A value line takes an input method's composition as a text field does,
so a learner types with a Japanese input method on.

While the input method composes, every key is the composition's, Enter,
Esc, and the arrows included. The composed text edits the program once
the composition ends.

### Selected text

When Tab enters a field that holds a value, or the editor opens on it,
the field's text is selected, except in a block that the block menu has
just inserted (Block editor). The text is selected because a field
reached by Tab already holds a value, which a caret after it would
extend. For example: a new `for` holds `0`, which would become `01`.

Every typed character replaces the selected text, as in a text field,
because a field that kept its text for some keys and replaced it for
others would leave the learner to guess which. For example: with `n`
selected, `*` gives `*`, not `n * `.

A field that holds a draft takes the keyboard with the caret at the end
of its text, except in a block that the block menu has just inserted.

### Numbers and texts

The parser reads `-1` as the negation of `1`, as Python does, so
`-3 ** 2` keeps Python's meaning.

A number that Python rejects, such as `07`, or one beyond the int range
or the largest float (`parser.md`, Grammar), is a draft with the
parser's error.

The learner types a text as Python writes it, between `"` or `'`. The
value line writes a text in double quotes, as the emitter does
(`emitter.md`, Literals).

### Words

The word being typed is the name that ends at the caret, outside a text:
a letter or `_` followed by letters, digits, and `_`. It matches a name
one of whose words starts with it, or an entry's keys, because a match
inside a word is never the name meant. For example: `multiply` matches
the entry `* Multiply`, and `i` doesn't match `first`.

A word matches these names:

- where a value is expected: the visible variables, the entries offered
  there, and every call. For example: `abs`, `str`.
- after a value: every entry that takes a value

After a value, the word follows a space. For example: `x abs`, with
`Absolute value` chosen, gives `abs(x)` (Value list, Choosing).

While a word is typed, its matches replace the value list's groups.

A name that equals the word comes first among the matches. After a value,
the entries for the value's kind come next, because Enter chooses the
first match. For example: `an` after a comparison is `And`.

Enter or a click chooses the highlighted match, which replaces the word.
↑ and ↓ move the highlight.

The line underlines a word that matches nothing, and the explanation line
names the closest variable or entry (`editor.didYouMean`). For example:
`Did you mean total?`.

The explanation line's `Did you mean` names a variable or an entry only
when it differs from the word by at most one letter in three, or by one
letter on a word of fewer than six letters, because two letters on a
short word reach unrelated names. For example: `totl` and `Not`.

### Drafts

A value line shows a draft's text as typed. Once `Run` or `Submit` leads
to the draft (`run.md`, Run bar, Starting a run), the line underlines its
text from the error's position (`parser.md`, Errors), or all of it for
`E_NOT_TARGET`. The explanation line then shows the error's message.

### Empty slots

A value line with no text shows its slot's hint (`blocks.md`, Notation,
Drawing), or `optional` for an optional slot, whether it has the
keyboard or not. For example: the two fields of an assignment read
`variable` and `value`.

`optional` is the same in every locale, for the reason that a hint is
(`blocks.md`, Notation, Drawing).

Clicking an empty slot's hint (`language.md`, Expressions, Drafts) on a
chart node opens the editor focused on its slot.

A chart node draws nothing for an `exprs` slot with no item, or for an
optional slot with no value.

A diamond whose condition is empty shows its hint without `?`.

## Value list

The value list is the list below a value line. It offers the entries that
the learner can choose at the caret, in groups chosen by what is before
the caret.

The value list reads the text before the caret, less the word being typed
(Value line, Words), from the innermost parenthesis or bracket still open
there. While text is selected, it reads the text before the selection
(Value line, Selected text). That text gives one of three places:

- where it is empty or ends with an operator or a `,`: a value is
  expected
- inside a text: the value list holds no row and reads `editor.inText`,
  which says to end the text with its quote, because no entry can be
  chosen inside a text
- anywhere else: after a value

Where a value is expected, the value list holds:

- `Variables`: the variables visible at the block, most recently assigned
  first, each with its kind (`language.md`, Kinds)
- `Values`: the entries of group `values`, which are `Text`, `True`,
  `False`, `None`, `Empty list`, and `Empty dict`
- `Conditions`: `Not`
- `Calculate`: `Random whole number`, then `( )`, a pair of parentheses
  labeled `editor.parentheses.label`
- `Your functions`: the program's own functions as calls, then
  `Modules ▸`

In `Your functions`, each function is labeled as its call, each
parameter written as its hint (`blocks.md`, Notation, Drawing), and
explained by `editor.ownFunction`. For example: `greet(name)`, `roll()`.

`Modules ▸` opens the same module groups as the block menu's `Modules ▸`
(Block menu).

After a value, the value list holds the entries whose `on` holds the kind
of the expression before the caret (`blocks.md`, Value list entries), in
these groups:

- `Calculate` for a number
- `Conditions` for a true/false value
- `Items` for a list, a dict, or an object
- `Compare` and `Convert` for every kind

The expression before the caret is the largest operation with a
precedence that ends at the caret, within the innermost parenthesis or
bracket still open before the caret.

After a value of no known kind, the value list holds every entry that
takes a value.

An entry with a symbol shows the symbol before its name. For example:
`* Multiply`.

The groups always come in this order: `Variables`, `Values`,
`Conditions`, `Calculate`, `Items`, `Compare`, `Convert`,
`Your functions`. The value list leaves out a group with no row.

The value list scrolls, and its last row is `Show all`. `Show all` lists
every entry that the learner can choose at the caret, in the order of the
groups:

- where a value is expected: every entry
- after a value: every entry that takes a value

Hovering a row highlights it.

A value list with no row reads `editor.noItems`, except inside a text.

Each group's name says what the learner does with a value, not the block
category. `Combine`, `Other`, `Totals`, `Order`, and `Functions` were
rejected as names, because they mislead or head one or two rows.

`Variables` offers no `v + 1`, because guessing it for an index or a
bound would tie the value list to two block definitions (`blocks.md`, The
block definition).

### Choosing

An entry chosen after a value takes that value into its first slot:

- An operator stands between the value before the caret and the next one.
  It binds by the precedence of `emitter.md` within the innermost
  parenthesis or bracket still open. An operator is an entry whose block
  definition has a precedence.
- An entry whose first slot binds as an atom (`blocks.md`, Notation)
  takes the value just before the caret, as Python binds it. For example:
  `Item at a position` after `i + nums` makes `i + nums[]`.
- Any other entry takes the expression before the caret whose kind chose
  the value list, because the value list offered the entry for that
  expression. For example: `i < n` followed by `As text` gives
  `str(i < n)`, and applying `As text` to `n` alone would fail when run.

The learner builds a value left to right, as it is typed and read,
because choosing `abs` first would make the learner build the value again
inside it.

A choice writes the entry, as the emitter writes it, in place of the
value it takes or of the word being typed. The value it takes goes into
the entry's first slot, and each slot that the choice doesn't fill holds
nothing. A separator that only such slots follow is left out. The caret
goes where the first slot that the choice doesn't fill is, or after the
text when there is none. For example:

- `len(nums)` after `nums`, the caret after it
- `total + ` after `total`
- `nums[]` after `nums`, the caret inside the brackets
- `random.randint()`, the caret inside the parentheses, where a value is
  expected
- `""`, the caret between the quotes, for `Text`
- `()`, the caret inside, for `( )`

While text is selected, a choice writes the entry in place of the
selection.

A learner switches an operator by typing its keys, not by clicking it,
because a click in a text field places the caret.

## Targets

A `target` slot is a value line whose text writes a target
(`language.md`, Statements, Targets). Text that writes anything else
stays a draft, which `validate()` reports as `E_NOT_TARGET`
(`language.md`, Expressions, Drafts). The line's value list leaves out
the rows whose choice would write no target.

The learner types an item as Python writes it, of a variable of any kind,
a parameter included. For example: `nums[j]`, `heap[i]`.

A list of names that offered an item form of each variable was rejected,
because it would repeat what a value line does after a value, and it
would offer the form only for a variable whose kind is known, so a
parameter would never get one.

The value list of a target's line holds:

- where the line's text is only the word being typed, or nothing, in a
  slot with `binds` set (`blocks.md`, The block definition): the name
  list (Name list)
- where the line's text is only the word being typed, or nothing, in a
  slot without `binds`: the variables visible at the block
- after the target's variable: the entries that keep a target. For
  example: `Item at a position`.
- inside the target's slots: a value line's value list, without
  `This problem`

The word typed names that `New variable <name>` row exactly.

A target's value list, where the line's text is only the word being
typed, or nothing, ends with no `Show all`, because every name it could
list is in it.

In a target's line, Enter or a click that chooses a row and leaves a
target in the line moves the keyboard to the next field. So `total`,
Enter, and the value are typed in turn. Staying in the line was rejected,
because a target is a name far more often than an item, and a second
Enter there would close the editor before its value.

## Name list

The name list is what a binding target's line offers where the line's
text is only the word being typed, or nothing (Targets). It holds:

- in `main`: the names of the `expect.variables` of the challenge's first
  test, in that order, under `This problem`, then main's other variables
  under `Variables`, which are the inputs and the names assigned in
  `main`, in program order
- in a function: the function's parameters and the names assigned in its
  body, under `Variables`

The name list offers the expected names first, because a verdict compares
`expect.variables` by name, and a learner who names `total` differently
would otherwise fail without a visible reason.

Fixed common names were rejected, because they would be read before the
names the problem needs. For example: `i`, `count`, `found`.

Each name shows its kind (`language.md`, Kinds).

The name list keeps the names that the word typed matches, as a value
line matches a name (Value line, Words). It also offers a typed name that
it doesn't hold and that `language.md`, Identifiers, allows, as
`New variable <name>`.

## Captions

Every statement block may carry a caption in the learner's own words
(`language.md`, Captions), because a condition written in symbols doesn't
say what it is for, and a caption in the learner's words does.

The learner types the caption in the editor's caption field
(`editor.caption.label`). The field's hint reads `optional`
(`editor.caption.hint`).

The application never translates the caption and never asks for it.

A chart node whose block has a caption shows the caption alone, in place
of its notation or its question. While a slot of the block holds a draft,
the chart node shows its notation instead, with each draft's text or
each empty slot's hint.

A counted loop with a caption shows it on its check, and its other
generated chart nodes keep their text.

Hovering a chart node whose block has a caption shows the text that the
caption replaces: its notation, its question, or, for a counted loop, its
check.

The `Python` tab writes the caption as a comment above the statement
(`emitter.md`). A `comment` block definition was rejected, because it
would draw Python's `#` on the chart.

## Explanation line

The explanation line at the foot of the editor explains what the value
list highlights or the caret is in:

| What it explains | What the line shows |
| --- | --- |
| an entry | its name and its help (`blocks.md`, Catalog keys), followed, when it has keys (`typed`), by how to type them (`editor.typeKeys`: `Type %.`) |
| the parentheses | their label with `editor.parentheses.help`, and how to type them |
| an input of the problem | its kind (`editor.explain.input`) |
| a parameter | `editor.explain.parameter` |
| a name set nowhere yet | that choosing it makes a new variable that gets its value there (`editor.explain.newVariable`) |
| any other variable | its name with its kind and the statement that first gives it a value (`A number variable. It first gets a value in: i ← 1.`, `editor.explain.variablePlain` when it has no kind) |
| inside an operation's slot, read from the text before the caret as the value list reads it (Value list) | the operation's name (the entry offered after the kind of the value in its first slot, `Join with another list` for `+` after a list) and its notation with every slot as the text in it, parenthesized as the chart parenthesizes it, a slot with no text as its hint (`blocks.md`, Notation, Drawing), and the slot the caret is in underlined (`dp[value]`, its `value` underlined) |
| a draft that `Run` or `Submit` led to | its error's message (Value line, Drafts) |
| a word that matches nothing | the closest name (Value line), or `editor.nothingLike` when none is close |
| anything else | the block definition's help (`block.<key>.help`) |

## Verification

The tests of `src/ui/editor` cover:

- the block menu's entries, order, disabled entries, search, and the
  functions offered
- a value line's text, drafts, keys, choosing, moving, and value list
- what a target's line takes and lists
- the name list
- the explanation line
