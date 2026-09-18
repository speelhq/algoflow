# 00 — Conventions

## Documents

| File               | Defines                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `01-scope.md`      | product scope, the learner, curriculum, out of scope                 |
| `02-language.md`   | AST types, data model, semantics, validation                         |
| `03-nodes.md`      | every block: slots, Python output, sentence, chart                   |
| `04-runtime.md`    | interpreter, events, emitter, parser, CPython check                  |
| `05-ui.md`         | pages, chart, editing, running, submission, strings                  |
| `06-challenges.md` | challenge schema, study plans, every built-in challenge              |
| `07-plan.md`       | stack, repository layout, tests, milestones                          |
| `08-modules.md`    | modules: schema, resolution, pages, operations, storage, built-in modules |

## Language of the specification

All specification text, identifiers, sentences, and example strings are
English, and English (`en.json`, `en` fields) is the development locale
built from M-00. Japanese is a translation added in M-10: it exists only
in `src/i18n/ja.json` and in the `ja` fields of challenge, plan, and
module files, and the specification refers to it by key.

## Requirement identifiers

Every normative statement has an identifier `X-NN` and is one testable
sentence. Tests and commit messages reference identifiers.

| Prefix        | File                                              |
| ------------- | ------------------------------------------------- |
| `S`           | 01-scope                                          |
| `L`           | 02-language                                       |
| `N`           | 03-nodes                                          |
| `R`, `E`, `G` | 04-runtime (interpreter, emitter, grammar/parser) |
| `U`, `V`      | 05-ui (UI, views)                                 |
| `C`           | 06-challenges                                     |
| `P`, `T`, `M` | 07-plan (plan constraints, tests, milestones)     |
| `D`           | 08-modules                                        |

Statements use the present indicative ("The emitter writes 4-space
indentation") and are mandatory. "May" marks an option.

## Terms

| Term            | Definition                                                                      |
| --------------- | ------------------------------------------------------------------------------- |
| program         | one `Program` AST (`02-language.md`)                                            |
| block           | a `NodeDef` in `src/nodes/` and its entry in the block menu (`03-nodes.md`)     |
| node            | chart rendering of one statement (a box, a diamond, or a terminal)              |
| generated node  | a node the chart draws for a loop's init, check, or step; it belongs to the loop |
| region          | an ordered list of statements inside a branch or loop, or at top level          |
| slot            | one editable field of a block                                                   |
| chip            | rendering of one expression node inside a slot                                  |
| connector       | the `+` insertion point on an edge                                              |
| event           | one record produced by the interpreter (`04-runtime.md`)                        |
| step            | one call to `Runner.next()`; a visible step is one the driver stops on (R-11)   |
| ref             | a location in the state: variable, list index, dict key, object field           |
| view            | rendering of one variable in the `Result` tab (`05-ui.md`)                      |
| panel           | the left region of a page, holding the `Problem`, `Result`, and `Python` tabs   |
| path bar        | the line above the chart naming the chart shown and, while running, the call stack |
| case            | one set of inputs with its expectation: a challenge test, or a module function's saved run (D-19) |
| challenge       | a JSON file in `challenges/` (`06-challenges.md`); shown to learners as a problem |
| study plan      | a named ordered subset of the challenges (`challenges/plans.json`)              |
| module          | a named set of functions and classes stored outside any program (`08-modules.md`); a program uses it by name |
| built-in module | a module shipped as `modules/<name>.json`                                       |
| learner module  | a module the learner created or copied, stored under D-14                       |

## Rationale (informative)

Three commitments: one small block language that is a Python subset; views
chosen by value type only; generated Python as the reference for behaviour.

The reasons behind individual statements, and the alternatives rejected,
live in `docs/decisions.md`, grouped by topic. The specification records
facts, not history.
