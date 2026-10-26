# Specification

The spec states what must be true of AlgoFlow and of its code. The code,
the tests, the issues, and the skills cite it. `CLAUDE.md`, Sources of
truth, asks whoever changes an area to read the area's file first.
This file says how the spec is organized and written: which file holds
which area, which language the spec uses, what a statement is and how one
refers to another, how a file is laid out, when a statement carries a
reason, which terms every file uses, and which commitments the spec keeps.

## Files

The spec has one folder per area, and each folder holds that area's files:

| Folder        | File             | Defines                                                         |
| ------------- | ---------------- | --------------------------------------------------------------- |
| `scope/`      | `scope.md`       | product scope, the learner, curriculum, acceptance              |
| `language/`   | `language.md`    | AST types, data model, semantics, validation, edits, kinds      |
| `blocks/`     | `blocks.md`      | every block definition: slots, Python output, notation, chart, menu entries |
| `runtime/`    | `interpreter.md` | runner, events, runtime errors, driver, CPython check           |
|               | `emitter.md`     | the Python emitter                                              |
|               | `parser.md`      | the expression parser                                           |
| `ui/`         | `pages.md`       | pages, panel, first launch, keyboard, messages and i18n         |
|               | `chart.md`       | the chart                                                       |
|               | `editor.md`      | the block menu, the block editor, value lines                   |
|               | `run.md`         | running and submission                                          |
|               | `views.md`       | the views of the `Result` tab                                   |
| `challenges/` | `challenges.md`  | challenge schema, study plans, every built-in challenge         |
| `modules/`    | `modules.md`     | modules: schema, resolution, pages, operations, storage, built-in modules |

## Language of the specification

This section states which language the spec uses and how it writes a
label.

### English and Japanese

The spec uses English for its text, its identifiers, its sentences, and
its example strings. English is the development locale: `en.json` and the
`en` fields hold it.

Japanese is a translation of the English. It exists in three places only:

- `src/i18n/ja.json`
- the glossary `src/i18n/glossary.json` (`pages.md`, Catalogs)
- the `ja` fields of challenge, plan, and module files

The spec refers to a Japanese text by its key, and to a glossary word by
its English term.

### Labels

When a `ui/` file quotes a label, it quotes an `en.json` text. `ja.json`
holds the same key with the Japanese text (`pages.md`, Catalogs).

The spec writes a control's label in one of two ways:

- When a sentence lists what the screen shows, it writes the label in
  full, with its symbol. For example: `▶ Run`.
- Any other sentence names the control without its symbol. For example:
  `Run`.

## Statements

A statement is a paragraph, a list item, or a table row under a heading.
Every statement has these properties:

- It is in the present indicative. For example: "The emitter writes
  4-space indentation".
- It is mandatory. The word "may" marks an option.
- A new statement states one rule that one test can establish.
- It names no release, schedule, or status, and it records no history.
- It follows `CLAUDE.md`, Writing.

### Form

A paragraph holds one rule with its exceptions.

These are parallel statements:

- the cases of a rule
- the fields of a record
- the controls of a bar
- the steps of a procedure

Parallel statements are a list or a table, because a reader scans
parallel items and reads a rule as prose.

An example follows its rule as a sentence or a code block of its own,
because an example inside a sentence makes the reader hold the rule open
while reading the example. A parenthesis holds only a reference or a key.

Statements carry no numbers, because a quoted sentence reads on its own,
and a handle (References) finds the statement, the code, and the tests in
one search. A number would make the spec's writer keep it in step with
all three.

### References

A statement refers to another statement in one of three forms:

- When both are in one file: by the other statement's heading.
- When the other statement is in another file: by its file and its
  heading. For example: (`language.md`, Scope).
- When it refers to a whole file: by the file alone.

A paragraph refers to a statement once, in the first sentence that rests
on it.

The spec punctuates a reference in three ways:

- A comma separates a heading from the heading it sits under. For
  example: (`language.md`, Semantics, Lists).
- A semicolon separates two references. For example: (`views.md`;
  `run.md`, Narration).
- A reference inside a sentence takes a comma after its heading, because
  nothing else marks where a heading of several words ends. For example:
  as `pages.md`, Values on one line, states.

A handle is a name that the code, the tests, and the spec share. For
example: an error code, a block key, a message key, or a function or type
name. The spec, and every document that cites it, refers to a handle by the
handle alone.

A reference names a heading without the handles in parentheses that end
it. For example: (`language.md`, Semantics, Lists) names the heading
Lists (`swap`, `method:copy`).

A heading in a reference ends at a comma, a semicolon, a colon, a
period, a closing parenthesis, or the end of a table cell or a line.

`pnpm check` fails on a reference to a heading that the cited file
doesn't hold. It reads two forms as references:

- in a Markdown or TypeScript file, a spec file's name followed by a
  comma and a word that begins with a capital letter. Each heading after
  a further comma sits under the one before it, and a heading after a
  semicolon is in the same file.
- in a spec file's prose, outside code, a parenthesis that opens with a
  capital letter, as a reference to a heading of that file.

### Citations from outside the spec

When a pull request or a review finding cites a statement, it quotes the
statement's sentence and names its file and heading.

An issue cites each statement it rests on by its file and heading, because
an issue waits while the spec changes, and a quote would be a copy that
goes stale.

An issue quotes only three things, because a reader decides or checks
from the quoted words, and a heading alone doesn't find a part inside a
table row:

- the part of a statement that a defect contradicts
- the statements and recorded reasons that constrain a decision
- the statements that the work changes

## File layout

Each file opens with one paragraph. The paragraph says what the area is
and what the file states, and then names the code and the tests that the
file governs.

A `##` section states one part of the area and opens with what that part
is for.

When a part has several pieces, its section splits into `###` sections,
one per piece, under its `##` heading, so every citation of that heading
by the code, the tests, and the issues stays valid.

When a file's statements carry test obligations of their own, the file
ends with a `Verification` section. That section states only those
obligations.

## Reasons

A statement carries a reason in two cases only:

- A reader would otherwise plausibly change the statement to an
  alternative that was rejected. The reason names that alternative.
- The statement rests on a constraint that the code, the configuration,
  and the statement itself don't show. The reason names that constraint.

The reason follows the statement it explains, in the same sentence or the
next, and ends the paragraph. For a table row, the reason stands after
the table and names the row.

A reason does none of these:

- restate the statement
- tell how the statement came about
- defend what a test or a check already enforces

When a statement changes, its reason changes with it.

## Terms

The spec uses these terms:

| Term            | Definition                                                                      |
| --------------- | ------------------------------------------------------------------------------- |
| program         | one `Program` AST (`language.md`)                                               |
| node            | a block, a function, or a class: anything that carries a `NodeId` (`language.md`, Program) |
| block           | a statement or an expression that the learner places, made from a block definition. It is a `Block` (`Stmt` or `Expr`) in the code (`language.md`, Statements; Expressions). A function is not a block. |
| block definition | the kind that blocks are made from: a `BlockDef` in `src/blocks/` and its entry in the block menu (`blocks.md`) |
| routine         | `main` or a function: a unit with its own statements and variables              |
| name            | the name of a variable, function, parameter, class, or field (`language.md`, Identifiers). `Name` in the code. |
| caption         | the one line of text that the learner gives a statement, which the chart shows in place of its notation or its question (`language.md`, Captions) |
| region          | an ordered list of statements inside a branch or loop, or at top level          |
| compound statement | a branch or a loop, as Python names it: a statement that holds a region in a slot of role `body` (`blocks.md`, The block definition) |
| slot            | one editable field of a block                                                   |
| value line      | the one-line editor of an expression slot (`editor.md`, Value line)             |
| notation        | a block's text, the same in every locale (`blocks.md`, Notation)                |
| chart           | the flowchart of one routine, which the canvas draws. The canvas draws a class as a field table, which is not a chart. |
| chart node      | a thing that the chart draws and joins with edges: a terminal, an Input chart node, the box or the diamond of a statement block, a generated chart node, or a junction |
| Input chart node | the chart node that shows one input with its value, where the learner chooses the case (`chart.md`, Input chart nodes) |
| generated chart node | a chart node the chart draws for a loop's init, check, or update. It belongs to the loop block. |
| owner           | the node that a chart node belongs to, whose `NodeId` the chart node carries: a statement block, and for a generated chart node its loop |
| edge            | a line between two chart nodes, with a `Yes` or `No` label after a diamond      |
| shape           | the form of a chart node: terminal, input, box, diamond, or junction (`chart.md`, Shapes) |
| mark            | the `✓` or `✗` that a diamond shows after its check (`run.md`, Path and marks)   |
| icon            | a small figure, a character or an SVG, that the screen draws for a thing: a mark, a problem's status, a button's face |
| connector       | the `+` insertion point on an edge                                              |
| event           | one record the runner emits (`interpreter.md`, Events). `Done` counts them.     |
| step            | a visible step, which the driver stops on and the position bar counts: an event, an exchange of two writes, a module call, or the call that fails (`interpreter.md`, Steps and batches). On screen, `step` names nothing else. |
| ref             | a location in the state: variable, list index, dict key, object field           |
| target          | an expression that names where a value is stored: a variable, an item, a key, or a field (`language.md`, Statements) |
| view            | rendering of one variable in the `Result` tab (`views.md`)                      |
| panel           | the left part of a page, holding the `Problem`, `Result`, and `Python` tabs   |
| canvas          | the right part of a page: the path bar, the chart or field table, the narration line, and the run bar (`pages.md`, Page layout) |
| run bar         | the bar at the foot of the canvas holding `▶ Run` and, while running, the run's controls (`run.md`, Run bar) |
| path bar        | the line above the chart that names the chart or field table shown and, while running, the call stack |
| case            | one set of inputs with its expectation: a challenge test, or a module function's saved run (`modules.md`, Cases) |
| challenge       | a JSON file in `challenges/` (`challenges.md`), shown to learners as a problem  |
| study plan      | a named ordered subset of the challenges (`challenges/plans.json`)              |
| module          | a named set of functions and classes stored outside any program (`modules.md`). A program uses it by name. |
| built-in module | a module shipped as `modules/<name>.json`                                       |
| learner module  | a module the learner created or copied, kept by the module store (`modules.md`, Storage) |
| artboard        | one screen drawn in Claude Design, exported to `docs/design/`                   |

Three words keep one meaning each, because each names more than one
thing otherwise:

- "node" alone is a block, a function, or a class. What the chart draws is
  always a "chart node".
- "block" alone is a placed statement or expression. A kind is always a
  "block definition".
- "id" is never alone. It is a node id, a chart node id, a heap id, or a
  storage id (a challenge id or a Playground id).

## Commitments

The spec keeps three commitments:

- the block language is small, and it is a subset of Python
- the type of a value alone chooses its view
- the generated Python is the reference for behavior
