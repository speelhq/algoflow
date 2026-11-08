# Designs

A design draws how a screen, or a state of one, looks before it is built.
It records the look the developer chose and how it maps to the spec
(`docs/spec/ui/`), which states how the screen behaves. Where they differ,
the spec is the decision. A session that finds an option better than
either proposes it (`CLAUDE.md`, Judgment).

Once a screen is built, its screenshot in `e2e/screenshots/` records how
it looks, because a pull request's diff, a review bot in CI, and anyone
the Design artifact isn't shared with can't open a design. Nobody changes
a built screen's design again.

The spec, not a design, records an option the developer rejected, with
its reason (`docs/spec/README.md`, Reasons), because the spec is read in a
pull request's diff and stands beside the statement a reader would
change.

## The Design artifact

Every design lives in one claude.ai Artifact of the Design type,
[AlgoFlow Screens](https://claude.ai/artifact/SD2jKu4HfkPTh4CoeS7Tpe),
called the Design artifact. Only this file holds its link, so a change of
address is made in one place. Only its owner and the people it is shared
with can open it.

A session reads a design through this link, with its Artifact tool.

The Design artifact holds these pages:

| Page                 | Holds                                                     |
| -------------------- | --------------------------------------------------------- |
| `Screens`            | a design of each screen and state, in the table below     |
| `Block editor lines` | the block editor's lines, one per statement block definition |
| `Redesign studies`   | the first drafts of the screens, and the studies of the loop notation, the variables card, and functions |

An issue or the spec names a design by its page and its title. For
example: the design `5 Run: the moment on the chart, the state in Result`
on the page `Screens`.

## Making a design

A session makes a design in these steps:

1. Write what the learner does on the screen, and what the learner must
   be able to tell on it at a glance.
2. List what a learner already knows from everyday applications that
   applies to the screen, such as a field that takes typing, gray text in
   an empty field, and a red border with its reason. Name the component
   of `src/ui/primitives` that already draws each one.
3. Find how other tools solve the same problem, from each tool's own
   documentation or screens rather than from memory, and write what to
   take from each and what not, with the reason.
4. Judge the screen as it is built now, from its screenshot and its code,
   against what step 1 wrote.
5. Draw each option in the same set of states.
6. Before showing an option, check it against step 1, the words the
   catalog already holds, and the spec.
7. The developer decides.
8. Propose the change to the spec, file the issues the work needs, and
   edit each open issue whose body the decision changes.

A session that finds a better step proposes it to the developer
(`CLAUDE.md`, Judgment).

A session draws each option it proposes as a design in the Design
artifact, on a page named for the part of the screen. Once the spec
states the reasons of the options the developer rejected, the session
removes their designs, so a design shows only the chosen look.

A state that no design draws, and whose look the spec settles, is built
without a design. Its pull request shows its screenshot, and the
developer decides its look there. Drawing such a state first was
rejected, because the designs drawn that way fell behind the app.

A look that the spec leaves open goes through the steps above before it
is built (`CLAUDE.md`, Judgment).

## Screens

Each design on the page `Screens` is drawn at 1280 × 800, the size at
which `e2e/screenshots.spec.ts` draws each screenshot.

| Design                                                         | Screenshot               | Spec (`docs/spec/`) |
| -------------------------------------------------------------- | ------------------------ | ------------------- |
| 1 Problems: one section per plan                               | `problems.png`           | `pages.md`, Pages and routes; Problems page |
| 2 Build: first launch, an empty chart                          | `first-launch.png`       | `pages.md`, Page layout; Problem tab; First launch; `chart.md`, Editing on the chart |
| 3 Build: the + menu lists statements only                      | `block-menu.png`         | `editor.md`, Block menu; `chart.md`, Shapes |
| 4 Build: editing a block, choosing a variable                  | `editor-name.png`        | `editor.md`, Block editor; Name list; Captions |
| 4B Build: where a value is expected                            | `editor-value.png`       | `editor.md`, Value line; Value list |
| 4C Build: typing, and the text becomes blocks                  | `editor-typing.png`      | `editor.md`, Value line; Backspace and keys |
| 4D Build: after a number, and a named check                    | `editor-number.png`      | `editor.md`, Value list; Captions; Explanation line |
| 4E Build: after a list, what can be done with it               | `editor-list.png`        | `editor.md`, Value list; `blocks.md`, Value list entries |
| 4F Build: an unnamed check, then And or Or                     | `editor-check.png`       | `chart.md`, Shapes; `editor.md`, Value list; `blocks.md`, Notation |
| 4G Build: set one item of a list                               | `editor-item.png`        | `editor.md`, Value list; Name list; Explanation line |
| 5 Run: the moment on the chart, the state in Result            | `run.png`                | `run.md`, Run bar; Path and marks; Narration; `pages.md`, Result tab |
| 6 Submit: Wrong Answer, and a way to the cause                 | `wrong.png`              | `run.md`, Submission |
| 7 Submit: Accepted, with what comes next                       | `accepted.png`           | `run.md`, Submission |
| 8 Solution: read-only in the canvas                            | `solution.png`           | `pages.md`, Problem tab |
| 9 Run inside functions: the path bar is the call stack         |                          | `run.md`, Call stack |
| 10 Module page: run one function, keep cases, Test             |                          | `modules.md`, Resolution; Pages; Cases |
| 11 Python tab: a line and its block                            | `python.png`             | `pages.md`, Python tab |
| 12 Python tab: a program that uses a module                    |                          | `pages.md`, Python tab; `emitter.md` |
| 13 Playground: many programs, the last edited first            | `playground.png`         | `pages.md`, Playground page |
| 14 Build: the Input node lists the problem's cases             | `input-menu.png`         | `chart.md`, Input chart nodes |
| 15 Build: a red dot, its message, and its fix                  | `diagnostic.png`         | `chart.md`, Editing on the chart |
| 17 Playground program: a title, Run, and Export                | `playground-program.png` | `pages.md`, Pages and routes |
| 18 Build: the + menu lists the program's own functions         |                          | `editor.md`, Block menu |

A design with no screenshot draws a screen that isn't built yet.

The designs on this page use a hand-drawn typeface, so they read as
drafts. The application uses the typeface of `src/ui/theme.css`.
