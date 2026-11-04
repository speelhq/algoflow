# Specification

The spec states what must be true of AlgoFlow and of its code. The code,
the tests, the issues, and the skills cite it. `CLAUDE.md`, Sources of
truth, asks whoever changes an area to read the area's file first.
This file says how the spec is organized and written: which file holds
which area, which language the spec uses, what a statement is and how one
refers to another, how a file is laid out, when a statement carries a
reason, and which commitments the spec keeps.

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
and what the file states.

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

A reason names a rejected alternative in the past tense: "X was rejected,
because …".

The reason follows the statement it explains, in the same sentence or the
next, and ends the paragraph. Only an example of the statement may follow
the reason. For a table row, the reason stands after the table and names
the row.

A reason does none of these:

- restate the statement
- tell how the statement came about
- defend what a test or a check already enforces

When a statement changes, its reason changes with it.

## Commitments

The spec keeps three commitments:

- the block language is small, and it is a subset of Python
- the type of a value alone chooses its view
- the generated Python is the reference for behavior
