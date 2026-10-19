# Specification

## Files

The spec has one folder per area, and each folder holds that area's files.

| Folder        | File             | Defines                                                         |
| ------------- | ---------------- | --------------------------------------------------------------- |
| `scope/`      | `scope.md`       | product scope, the learner, curriculum, acceptance              |
| `language/`   | `language.md`    | AST types, data model, semantics, validation, edits, kinds      |
| `blocks/`     | `blocks.md`      | every block: slots, Python output, notation, chart, menu entries |
| `runtime/`    | `interpreter.md` | runner, events, runtime errors, driver, CPython check           |
|               | `emitter.md`     | the Python emitter                                              |
|               | `parser.md`      | the expression parser                                           |
| `ui/`         | `pages.md`       | pages, panel, first launch, keyboard, messages and i18n         |
|               | `chart.md`       | the chart                                                       |
|               | `editor.md`      | the block menu, the node editor, value lines                    |
|               | `run.md`         | running and submission                                          |
|               | `views.md`       | the views of the `Result` tab                                   |
| `challenges/` | `challenges.md`  | challenge schema, study plans, every built-in challenge         |
| `modules/`    | `modules.md`     | modules: schema, resolution, pages, operations, storage, built-in modules |

## Language of the specification

All of the spec is in English: its text, identifiers, sentences, and example
strings. English (`en.json` and the `en` fields) is the development locale.
Japanese is a translation. It exists only in `src/i18n/ja.json`, in the
glossary `src/i18n/glossary.json` (`ui/pages.md`, Catalogs), and in the `ja`
fields of challenge, plan, and module files. The spec refers to a Japanese
text by its key, and to a glossary word by its English term. Labels quoted in
`ui/` are `en.json` texts, and `ja.json` holds the same keys with Japanese
texts (`ui/pages.md`, Catalogs). A sentence that lists what the screen shows
quotes a control's label in full, with its symbol (`▶ Run`), and any other
sentence names the control without its symbol (`Run`).

## Statements

A statement is a paragraph or a table row under a heading. Statements use
the present indicative ("The emitter writes 4-space indentation"), and they
are mandatory. "May" marks an option. A new statement states one rule that
one test can establish. A statement names no release, schedule, or status,
and it records no history. Statements follow `CLAUDE.md`, Writing, except
that a statement is a paragraph or a table row, never a list item.

A statement refers to another by its heading. When the heading is in another
file, the reference names the file too: (`language.md`, Scope). A comma
separates a heading from the heading it sits under (`language.md`, Semantics,
Lists), and a semicolon separates two references (`views.md`; `run.md`,
Narration). A reference inside a sentence also takes a comma after its
heading, because nothing else marks where a heading of several words ends: as
`pages.md`, Values on one line, states. A reference to a whole file names the
file alone. A handle that the code, the tests, and the spec share, such as an
error code, a block key, a message key, or a function or type name, is cited
alone. An issue, a pull request, or a review finding that points at a
statement quotes its sentence and names its file and heading. Statements carry
no numbers, because a quoted sentence reads on its own and a handle finds the
statement, the code, and the tests in one search, while numbers would have to
be kept in step with all three.

Each file opens with the code and the tests it governs. A file whose
statements carry a test obligation of their own ends with a `Verification`
section, which states only those obligations.

## Reasons

A statement carries a reason only in two cases: when a reader would
otherwise plausibly change it to an alternative that was rejected, or when
it rests on a constraint that the code, the configuration, and the
statement don't show. The reason names that alternative or constraint. It
stands in the statement's paragraph, or, for a table row, after the table
with the row named. A reason doesn't restate the statement, tell how the
statement came about, or defend what a test or a check already enforces.
When a statement changes, its reason changes with it.

## Terms

| Term            | Definition                                                                      |
| --------------- | ------------------------------------------------------------------------------- |
| program         | one `Program` AST (`language.md`)                                               |
| block           | a `BlockDef` in `src/blocks/` and its entry in the block menu (`blocks.md`)     |
| node            | chart rendering of one statement (a box, a diamond, or a terminal)              |
| generated node  | a node the chart draws for a loop's init, check, or update. The node belongs to the loop. |
| `Node`, `NodeId` | in the code, a statement or an expression of a program (`language.md`, Statements; Expressions), and the id it carries. A function and a class carry a `NodeId` too (`language.md`, Program), and a statement's node on the chart carries its statement's `NodeId`. |
| region          | an ordered list of statements inside a branch or loop, or at top level          |
| slot            | one editable field of a block                                                   |
| value line      | the one-line editor of an expression slot (`editor.md`, Value line)             |
| notation        | a block's text on its node, the same in every locale (`blocks.md`, Node text)    |
| connector       | the `+` insertion point on an edge                                              |
| event           | one record the runner emits (`interpreter.md`, Events). `Done` counts them.     |
| step            | a visible step, which the driver stops on and the position bar counts: an event, an exchange of two writes, a module call, or the call that fails (`interpreter.md`, Steps and batches). On screen, `step` names nothing else. |
| ref             | a location in the state: variable, list index, dict key, object field           |
| target          | an expression that names where a value is stored: a variable, an item, a key, or a field (`language.md`, Statements) |
| view            | rendering of one variable in the `Result` tab (`views.md`)                      |
| panel           | the left part of a page, holding the `Problem`, `Result`, and `Python` tabs   |
| canvas          | the right part of a page: the path bar, the chart, the narration line, and the run bar (`pages.md`, Page layout) |
| run bar         | the bar at the foot of the canvas holding `▶ Run` and, while running, the run's controls (`run.md`, Run bar) |
| path bar        | the line above the chart that names the chart shown and, while running, the call stack |
| case            | one set of inputs with its expectation: a challenge test, or a module function's saved run (`modules.md`, Cases) |
| challenge       | a JSON file in `challenges/` (`challenges.md`), shown to learners as a problem  |
| study plan      | a named ordered subset of the challenges (`challenges/plans.json`)              |
| module          | a named set of functions and classes stored outside any program (`modules.md`). A program uses it by name. |
| built-in module | a module shipped as `modules/<name>.json`                                       |
| learner module  | a module the learner created or copied, kept by the module store (`modules.md`, Storage) |
| artboard        | one screen drawn in Claude Design, exported to `docs/design/`                   |

## Commitments

The spec keeps three commitments: one small block language that is a
subset of Python, views chosen by value type only, and the generated Python
as the reference for behavior.
