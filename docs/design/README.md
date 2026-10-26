# Design artboards

This folder holds one PNG for each current artboard, exported at the
artboard's size. An artboard shows how a screen looks, and the spec
(`docs/spec/ui/`) states how it behaves. Where they differ, the spec is the
decision, and a session proposes any option better than either
(`CLAUDE.md`, Judgment).

A screen, or a state of one, that the spec describes and no artboard draws
becomes an issue labeled `decision`, with a proposal, in the release that
builds the screen. So does a difference from its artboard that the code
can't follow. The issue is filed when that release is planned
(`/milestone`) or when its work finds the gap, and never earlier. Planning a
release finds every screen it builds that has no artboard, so an issue
filed before then would only repeat the spec and go stale. A session draws
the artboard in its Claude Design file once the developer decides the
issue.

## Claude Design file "AlgoFlow Screens"

The file holds twenty-three artboards of 1280 × 800. Each PNG is named
after its artboard in the file.

| File | Artboard title | Spec (`docs/spec/`) |
| --- | --- | --- |
| `Main.png` | 1 Problems: one section per plan | `pages.md`, Pages and routes; Problems page |
| `BuildEmpty.png` | 2 Build: first launch, an empty chart | `pages.md`, Page layout; Problem tab; First launch; `chart.md`, Editing on the chart |
| `BuildMenu.png` | 3 Build: the + menu lists statements only | `editor.md`, Block menu; `chart.md`, Shapes |
| `BuildEdit.png` | 4 Build: editing a block, choosing a variable | `editor.md`, Block editor; Name fields; Captions |
| `EditValue.png` | 4B Build: where a value is expected | `editor.md`, Value line; Value list |
| `EditTyping.png` | 4C Build: typing, and the text becomes blocks | `editor.md`, Value line; Backspace and keys |
| `EditNumber.png` | 4D Build: after a number, and a named check | `editor.md`, Value list; Captions; Explanation line |
| `EditList.png` | 4E Build: after a list, what can be done with it | `editor.md`, Value list; `blocks.md`, Menu entries |
| `EditCheck.png` | 4F Build: an unnamed check, then And or Or | `chart.md`, Shapes; `editor.md`, Value list; `blocks.md`, Notation |
| `EditItem.png` | 4G Build: set one item of a list | `editor.md`, Value list; Name fields; Explanation line |
| `Run.png` | 5 Run: the moment on the chart, the state in Result | `run.md`, Run bar; Path and marks; Narration; `pages.md`, Result tab |
| `Wrong.png` | 6 Submit: Wrong Answer, and a way to the cause | `run.md`, Submission |
| `Accepted.png` | 7 Submit: Accepted, with what comes next | `run.md`, Submission |
| `Solution.png` | 8 Solution: read-only in the canvas | `pages.md`, Problem tab |
| `FunctionRun.png` | 9 Run inside functions: the path bar is the call stack | `run.md`, Call stack |
| `Module.png` | 10 Module page: run one function, keep cases, Test | `modules.md`, Resolution; Pages; Cases |
| `PythonChart.png` | 11 Python tab: a line and its block | `pages.md`, Python tab |
| `PythonFiles.png` | 12 Python tab: a program that uses a module | `pages.md`, Python tab; `emitter.md` |
| `Playground.png` | 13 Playground: many programs, the last edited first | `pages.md`, Playground page |
| `InputMenu.png` | 14 Build: the Input node lists the problem's cases | `chart.md`, Input chart nodes |
| `Diagnostics.png` | 15 Build: a red dot, its message, and its fix | `chart.md`, Editing on the chart |
| `PlaygroundProgram.png` | 17 Playground program: a title, Run, and Export | `pages.md`, Pages and routes |
| `MenuProgram.png` | 18 Build: the + menu lists the program's own functions | `editor.md`, Block menu |

## Where the spec deviates from the artboards

- `Accepted.png` labels the count of the work done `Steps`. The spec labels
  it `Events` (`run.md`, Submission), because `step` names only what the
  position bar counts.
- `Accepted.png` shows placeholders for the counts of events and loops,
  because `heap-pop` has no challenge file yet. Any artboard of a problem
  that doesn't exist yet does the same.
- `heap.py` on `PythonFiles.png` and the `heap_pop` chart on `Module.png` are
  drafts derived from the `heap` module (`modules.md`, Built-in modules),
  not emitted code.
- `Main.png` names the first problem `Hello`. Its challenge file is
  `tutorial`, and the title is the one in that file.
- `Main.png` notes that the page scrolls on to `Build a Tiny Neural
  Network` and `More problems`. The spec has three plans, and every problem
  is in one of them (`scope.md`, Curriculum).
- `BuildEdit.png` and `EditValue.png` draw the block editor as tall as its
  list. While a list is shown, the editor is 480 px tall and its list
  scrolls inside it (`editor.md`, Block editor).
- `Main.png` puts the row that `Continue` leads to on a colored background,
  which `pages.md`, Problems page, doesn't state. Every row is drawn alike.
- `Run.png` and `Wrong.png` fold the `Output` and `Expected` columns to
  `… n more`. The `Result` tab shows every line (`pages.md`, Result tab),
  and only the `Example` in the `Problem` tab folds (`pages.md`, Problem
  tab).
- The gray sentences under the rows of `Run.png` and `Wrong.png` annotate
  the artboards and aren't part of the screen.
- `Solution.png` labels the band's buttons `Load into my chart` and
  `Back to my chart`. The spec labels them `Load into my program` and
  `Back to my program` (`pages.md`, Problem tab), because they act on the
  learner's whole program, and a chart is the flowchart of one routine.
- Every artboard that shows a chart node, a value, or the narration uses
  the notation the blocks had before `blocks.md`, Notation, set it
  (`Set i to 1`, `(remainder of i divided by 15) = 0?`, `n = 15`). The
  notation in the spec applies until the artboards are drawn again.
- The artboards use a hand-drawn typeface to mark them as drafts. The
  application uses the typeface of `src/ui/theme.css`.

## Exporting

Each artboard is one file in its Claude Design file. To export it, render
it alone in a browser at the size the file declares for it, and capture it
as a PNG named after the artboard. The Claude Design files stay the working
copies. When an artboard changes, export it again in the pull request that
changes the spec it affects. An artboard that a later artboard or the spec
has replaced has no PNG, because a PNG in the repository is read as the
source of a screen. The words "artboard" and "file" are Claude Design's
own, which leaves `canvas` free to name the page's part that holds the
chart.

| Claude Design file | Holds                                         |
| ------------------ | --------------------------------------------- |
| [AlgoFlow Screens](https://claude.ai/artifact/SD2jKu4HfkPTh4CoeS7Tpe) | the twenty-three artboards above |
| [AlgoFlow Redesign](https://claude.ai/artifact/D91141RiyMCW4XLsyJk8E5) | the flowchart and loop-notation studies; no exported artboard |

Only a file's owner and the people it is shared with can open it. The
links are kept here, next to the export steps, because whoever exports
again needs them, and a link shows nothing to anyone without access.
