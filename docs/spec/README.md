# Specification

## Files

One folder per area. Each folder holds its specification files and
`decisions.md`, the reasons for its statements (Reasons below).

| Folder        | File             | Ids | Defines                                                         |
| ------------- | ---------------- | --- | --------------------------------------------------------------- |
| `scope/`      | `scope.md`       | S   | product scope, the learner, curriculum, acceptance              |
| `language/`   | `language.md`    | L   | AST types, data model, semantics, validation, edits, kinds      |
| `nodes/`      | `nodes.md`       | N   | every block: slots, Python output, sentence, chart, menu entries |
| `runtime/`    | `interpreter.md` | R   | runner, events, runtime errors, driver, CPython check           |
|               | `emitter.md`     | E   | the Python emitter                                              |
|               | `parser.md`      | G   | the expression parser                                           |
| `ui/`         | `pages.md`       | U   | pages, panel, first launch, keyboard, messages and i18n         |
|               | `chart.md`       | U   | the chart                                                       |
|               | `editor.md`      | U   | the block menu, the node editor, value lines                    |
|               | `run.md`         | U   | running and submission                                          |
|               | `views.md`       | V   | the views of the `Result` tab                                   |
| `challenges/` | `challenges.md`  | C   | challenge schema, study plans, every built-in challenge         |
| `modules/`    | `modules.md`     | D   | modules: schema, resolution, pages, operations, storage, built-in modules |

## Language of the specification

All specification text, identifiers, sentences, and example strings are
English, and English (`en.json`, `en` fields) is the development locale.
Japanese is a translation: it exists only in `src/i18n/ja.json` and in the
`ja` fields of challenge, plan, and module files, and the specification
refers to it by key. Labels quoted in `ui/` are `en.json` texts; `ja.json`
holds the same keys with Japanese texts (U-71).

The specification states what the application must be, not when it is
built: a statement the code does not yet meet belongs to the scope of a
GitHub milestone. Why: a schedule here would be a second copy of the
milestones and go stale whenever work moves. The specification records
facts, never history.

## Requirement identifiers

Every normative statement has an identifier `X-NN` and is one testable
rule. A statement is a paragraph that opens with its identifier and a
space, after a blank line, a heading, or a code fence, or a table row
whose first cell holds its identifier alone; an identifier anywhere else
cites it. An identifier links a statement to the tests that establish it
(a test names the identifiers it verifies) and lets a document, an issue,
a pull request, or a review point at one statement. Only Markdown files
and tests (`*.test.*` files and `e2e/`) cite identifiers; code, data, and
commit messages cite none. Why: an id in code is a second map from
statements to code that nothing checks, so it goes stale silently; data
(challenges, modules, the string catalogs) is shown to the learner; and an
id in a commit message repeats the pull request's Why.

Statements use the present indicative ("The emitter writes 4-space
indentation") and are mandatory. "May" marks an option.

- One rule per identifier: a statement that holds several rules is split,
  one identifier per rule, when it is next changed. Why: a test, an issue,
  or a finding then points at exactly the rule it concerns.
- Changing a statement keeps its identifier; deleting a statement deletes
  its identifier and every citation of it in the repository.
- A citation writes each identifier out, never a range of them. Why: a
  search for one identifier then finds every citation of it.
- A new statement takes the number after the highest one its prefix has in
  the specification, whichever file holds it. Identifiers are never
  renumbered. Why: a deleted statement takes its citations with it, so no
  list of withdrawn numbers is kept; an old issue that cites a number later
  given to a new statement is read as the record of its own time.
- A change to the specification is committed before the code that
  implements it.

A file whose statements a test suite establishes ends with `Verification`:
the tests that establish its statements, so a test obligation sits beside
the statements it covers.

## Reasons

A folder's `decisions.md` records why its statements were chosen and the
alternatives rejected: one entry per choice, a bold sentence naming the
choice followed by the ids it explains. An entry stays only while a
plausible change would otherwise undo a deliberate choice: a rejected
alternative, or a constraint the code, the configuration, and the statement
itself do not show. What they show, what fails at once when broken,
history, and progress have no entry.

- A choice the specification does not cover becomes a new statement in the
  area's file and an entry in its `decisions.md`, committed before the code.
- When a statement changes, every entry that names its id, in any folder's
  `decisions.md` (`grep -rnw "<id>" docs/spec/*/decisions.md`), is updated in
  the same commit; an entry whose statements are all deleted is deleted
  with them. An entry sits in the folder of the statements it chiefly
  explains and may name ids of other folders.

The reasons for the code's structure are in `ARCHITECTURE.md`, those for
the process in `CONTRIBUTING.md`, and those for a tool setting beside the
setting.

## Terms

| Term            | Definition                                                                      |
| --------------- | ------------------------------------------------------------------------------- |
| program         | one `Program` AST (`language.md`)                                               |
| block           | a `NodeDef` in `src/nodes/` and its entry in the block menu (`nodes.md`)        |
| node            | chart rendering of one statement (a box, a diamond, or a terminal)              |
| generated node  | a node the chart draws for a loop's init, check, or step; it belongs to the loop |
| region          | an ordered list of statements inside a branch or loop, or at top level          |
| slot            | one editable field of a block                                                   |
| value line      | the one-line editor of an expression slot (`editor.md`, U-50)                   |
| word operation  | an expression written in words around its inputs (`nodes.md`, N-08)            |
| connector       | the `+` insertion point on an edge                                              |
| event           | one record produced by the interpreter (`interpreter.md`)                       |
| step            | one call to `Runner.next()`; a visible step is one the driver stops on (R-11)   |
| ref             | a location in the state: variable, list index, dict key, object field           |
| view            | rendering of one variable in the `Result` tab (`views.md`)                      |
| panel           | the left region of a page, holding the `Problem`, `Result`, and `Python` tabs   |
| canvas          | the right region of a page: the path bar, the chart, the narration line, and the run bar (U-03) |
| run bar         | the bar at the foot of the canvas holding `Run` and, while running, the run's controls (U-60) |
| path bar        | the line above the chart naming the chart shown and, while running, the call stack |
| case            | one set of inputs with its expectation: a challenge test, or a module function's saved run (D-19) |
| challenge       | a JSON file in `challenges/` (`challenges.md`); shown to learners as a problem  |
| study plan      | a named ordered subset of the challenges (`challenges/plans.json`)              |
| module          | a named set of functions and classes stored outside any program (`modules.md`); a program uses it by name |
| built-in module | a module shipped as `modules/<name>.json`                                       |
| learner module  | a module the learner created or copied, stored under D-14                       |
| artboard        | one screen drawn in Claude Design, exported to `docs/design/`                   |

## Commitments

Three commitments: one small block language that is a Python subset; views
chosen by value type only; generated Python as the reference for behaviour.
