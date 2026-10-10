# Editor

## Block menu and node editor

U-40 The block menu lists the registered statement blocks (N-01 `shape:
"stmt"`, the method statements of N-04, not `hidden`) with a search over
`label` and `help`, grouped in the category order of N-01 (`Basic`,
`Control`, `List`, `Function`, `Dict`, `Class`), each category in a
fixed order that puts `assign`, `print`, `if`, `for`, and `while` first in
theirs; an entry reads as the block's template with each `text` slot as
the block's label in lower case and every other slot as `…` (`set … to …`,
`print …`); a block whose `requires` the connector does not meet is listed
disabled with the reason (`menu.requires.loop`, `menu.requires.function`).
The `Function` category ends with `New function…`, which prompts for a
name, creates the function, and inserts a call to it. Then follow the
program's own functions under `This program`, when any exist, and a last
row `Modules ▸` opening one group per module (D-03) titled by its name or
title, learner modules before built-in ones, each listing its functions as
calls. Choosing an item inserts it and opens its editor. Expression blocks
are not in this menu; value lines offer them (U-52).

U-41 The node editor is a popover on the right of the selected node,
within the canvas, so the panel stays readable while a block is edited:
where the canvas lacks room on the node's right, the canvas scrolls the
chart left by what is missing while the editor is open, and the editor
moves down or up only as far as it must to stay within the canvas;
clicking a slot drawn on the
node opens the editor with that slot focused. From top to bottom it holds
the node's name field (U-95), with `Duplicate` and `Delete` as icon buttons
beside it and, when the node calls a function or constructs a class,
`Open <name>`, which shows that function's or class's chart (U-30) or, for a
module's, opens its Module page (D-18); the block's sentence with its slots
editable in place: `id` and `target` slots as name fields (U-94), `expr`
slots as value lines (U-50), an optional `expr` slot left empty as
`+ value` (`editor.addValue`), which adds its value line, `exprs` slots as
value lines separated by commas, each with a remove button
(`editor.removeValue`), followed by `+ value`, which adds one, `text`
slots as inputs, `body` slots not shown;
the list of the focused slot (U-52, U-94); and the explanation line
(U-96). A separator divides each of the name field, the sentence, and the
list from the next. The slot clicked on the node, or a first slot still
to fill, takes the keyboard when the editor opens; otherwise the keyboard
stays with the chart, so Delete removes the node (U-35). An edit applies
at once; Esc or a press outside the editor closes it.

U-42 A loop's editor edits the variable and the bounds (`for`), the list
(`foreach`), or the condition (`while`); the generated nodes (U-33) follow.

## Expressions

U-50 A value line edits one expression, written as the chart writes it
(N-08): variables as bold words in the variable colour, an operator as its
symbol, a word operation (N-08) on a light underlay over its extent, and an
input still to fill as an empty field. Typed digits make a number, and a `-`
typed at an empty input before them a negative one; a digit or `.` that
would make a number Python rejects (`07`, `1..`), or that follows a value
other than a number, is not taken. A typed word, a letter or `_` followed by
letters, digits, and `_`, matches a name one of whose words starts with it,
or an entry's keys (`multiply` finds `×`, `%` finds `Remainder`): where a
value is expected, the visible variables and the entries offered there, and
after a value, every entry that takes one. While it is unfinished its
matches replace the list's groups, a whole name first and, after a value,
the entries for its kind first; Enter or a click chooses the highlighted
match, and ↑ and ↓ move the highlight. A space or any key of U-93 ends the
word: when it names a variable or an entry exactly, that is chosen and the
key then applies; otherwise the key is not taken and the word stays to be
corrected. Tab chooses a word that names one exactly before it moves on. A
word that matches nothing is underlined, and the explanation line names the
closest variable or entry, one that differs by at most one letter in three,
and at least one (`editor.didYouMean`: `Did you mean total?`). A text is
entered only through the list's `Text`, which places a text field in the
line where the text is typed without quotes; Enter, Tab, or leaving the
field ends it.

U-51 An empty required input is an empty field in the value line and a
dashed `choose a value` on the node, at any depth of the value; clicking it
on the node opens the editor focused on it. An empty name slot is drawn
with the same placeholder; an `exprs` slot with no item draws nothing
unless it is required; a diamond whose condition is empty shows the
placeholder without `?`. A value line that is one empty
field reads `type or choose` (`editor.typeHint`) while it does not have the
keyboard.

U-52 The list of a value line holds groups chosen by what is before the
caret. Where a value is expected: `Variables` (the variables visible at the
node, most recently assigned first, each with its kind, L-66), `Values` (the
entries of group `values`: `Text`, `True`, `False`, `None`, `Empty list`,
`Empty dict`), `Conditions` (`Not`), `Calculate` (`Random whole number`,
then `( )`, a pair of brackets, labelled `editor.brackets`), and `Your
functions` (the program's own functions as calls, each labelled `name(…)`,
or `name()` with no parameter, and explained by `editor.ownFunction`, and
last `Modules ▸`, which opens one group per module listing its functions as
calls, as U-40's does). After a value, the entries whose `on` holds the
kind of the expression before the caret, the largest operation with a
precedence that ends at the caret within the innermost brackets (N-01,
L-65): `Calculate` for a number,
`Conditions` for a true/false value, `Items` for a list, a dict, or an
object, and `Compare` and `Convert` for every kind; an entry with a symbol
shows it before its name (`× Multiply`). After a value of no known kind
every entry that takes a value is listed. The groups are always in the
order `Variables`, `Values`, `Conditions`, `Calculate`, `Items`, `Compare`,
`Convert`, `Your functions`, and a group with no row is not shown. The list
scrolls and ends with `Show all`, which lists in that order every entry
that can be chosen there: where a value is expected every entry, and after
a value every entry that takes one. Hovering a row highlights it, and a list
with no row reads `editor.noItems`.

U-53 An entry chosen after a value takes that value as its first input: an
entry whose block has a precedence (an operator, and `Remainder`,
`Whole-number quotient`, `Power`, `Is in a list`) stands between the value
before the caret and the next one, and binds by the precedence of E-05
within the innermost brackets; any other entry takes the expression before
the caret whose kind chose the list (U-52), so `i < n` followed by `As
text` gives `(i < n) as text`. An entry chosen where a
value is expected fills that input. The inputs a choice leaves appear as
fields in the line and the caret moves to the first of them; Tab and
Shift+Tab move between the fields of the line and, past its last or first
field, to the next or previous slot of the sentence, and → at the end of
an operation's last input leaves the operation; while no word is typed, ←
and → move the caret to the previous or next value or input, and brackets
left behind close; a click on a value puts the caret after it, and on an
input at it. A slot entered by Tab, or
open when the editor opens, has its value selected: a value typed (a
digit, a word, a `-` sign, or a bracket) replaces it, Backspace removes it,
and a key that names an entry after a value takes it as its first input
(`n` selected, `*` gives `n × …`). An entry that takes a value, chosen
where a value is expected, fills the input with its operation and the
caret moves to its first input. A call of a function with no
parameter, a variable, or a value fills the input it is chosen for.

U-54 Backspace removes what is before the caret: the last digit of a
number, a value, or an operator; on the words of an operation it removes
the operation and keeps its first input in its place; at an operation's
first input still to fill while a later input holds a value, it removes
nothing and moves the caret left; at a later input still to fill, it
removes the operation and keeps its first input when no input after the
first holds a value, and otherwise removes nothing and moves the caret to
the end of the input before it. Delete removes a selected value as
Backspace does. Clicking an operator in the line lists the other entries
of its block in its group, and choosing one replaces it (`<` to `≤`, `+`
to `Remainder`).

U-93 Keys typed in a value line insert what the chart writes; each entry
names its keys (N-01 `menu`, `keys`):

| Typed                   | Inserts                                          |
| ----------------------- | ------------------------------------------------ |
| `+` `<` `>`             | as typed                                         |
| `-`                     | `−`; at an empty input, the sign of what follows |
| `*` `/`                 | `×` `÷`                                          |
| `==` `!=` `<=` `>=`     | `=` `≠` `≤` `≥`                                  |
| `(`                     | a pair of brackets, the caret inside them         |
| `[` `,`                 | a list's pair of brackets; `,` between its items  |
| `,` in an `exprs` slot  | the next value of the slot (U-41)                |
| `%` `//` `**`           | Remainder, Whole-number quotient, Power          |
| `and` `or` `not` `in`   | And, Or, Not, Is in a list                       |

A single `=` inserts nothing; a comparison typed after a comparison is
refused and the explanation line shows the message of `E_PARSE_CHAIN`. At
an input still to fill, a key that inserts an operation after a value
inserts nothing, `-` aside; `(` opens brackets only there, and `)` closes
the innermost open pair. `**` and `//`, typed as two keys, become one
operator that binds by its own precedence: `2*3**2` multiplies 2 by 3 to
the power of 2.

U-94 An `id` or `target` slot is a name field with a list below it: the
names of the `expect.variables` of the challenge's first test under `This
problem`, in that order, then the program's other variables under
`Variables`, the inputs, the parameters, and the assigned names in program
order, each with its kind (L-66).

U-102 Typing in a name field keeps the names that begin with the text
typed, as a value line matches a name (U-50), and a typed name that
neither holds and that L-01 and L-03 allow is offered as `New variable
<name>`.

U-103 In a name field, choosing a name moves the keyboard to the next
slot; ↑ and ↓ move the highlight; Enter chooses the highlighted name, else
the name typed, and in a field not typed in keeps its name and moves to the
next slot, or closes the editor after the last one.

U-104 A name field keeps only the characters of L-01.

U-105 In a `target` slot the name list also offers, for a list variable,
`Item at a position` (`Set item … of <list> to …`), and for a dict and an
object variable the key and field forms likewise.

U-95 Every statement may carry a name in the learner's own words (L-58),
typed in the editor's name field (`editor.name`, placeholder
`editor.nameHint`: `optional`); the application never translates it and
never asks for it. A named node shows its name alone, in place of its
sentence or its question, unless a slot of it is still empty, when it shows
its sentence with the placeholder; a named counted loop shows its name on
its check, its other generated nodes keeping their text; hovering a named
node shows the sentence, and the `Python` tab writes the name as a comment
above the statement (E-11).

U-96 The explanation line at the foot of the editor explains what the list
highlights or the caret is in: an entry's name and its help (N-02), which
ends with how to type it when keys insert it (`Type %.`); the brackets'
label with `editor.bracketsHelp`; a variable's name with its kind and the
statement that first sets it (`A number variable. It is first set in: Set i
to 1.`, `editor.explain.variablePlain` when it has no kind), an input's kind
(`editor.explain.input`), a parameter (`editor.explain.parameter`), or, for
a name set nowhere yet, that choosing it creates it
(`editor.explain.newVariable`); inside an operation's input, the
operation's name and its template with every input as its value, an empty
one as `…`, and the input the caret is in underlined (`item … of dp`, its
`…` underlined); the message of a refused key (U-93); the
closest name for a word that matches nothing (U-50), or `editor.nothingLike`
when none is close; in a name field with nothing highlighted,
`editor.explain.name`; or else the block's help (`node.<key>.help`).

## Verification

U-97 The tests of `src/ui/editor` cover the block menu's entries, order,
disabled entries, and search (U-40); a value line's typing, keys,
choosing, Backspace, moving, and list (U-50, U-52, U-53, U-54, U-93); the
name list (U-94, U-102, U-104); and the explanation line (U-96).
