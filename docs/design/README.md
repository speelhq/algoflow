# Design boards

One PNG for each current board, exported at the size of the board.
The spec (`docs/spec/05-ui.md`) was written from these boards and takes
precedence over them: a board shows the appearance of a screen, the spec
states its behaviour. A screen the spec describes and no board shows is an
issue labelled `decision`.

## Canvas "AlgoFlow Screens"

Twenty-three boards of 1280 × 800. Each file has the name of its board on the
canvas.

| File                    | Board title on the canvas                              | Spec                   |
| ----------------------- | ------------------------------------------------------ | ---------------------- |
| `Main.png`              | 1 Problems: one section per plan                       | U-02, U-10..U-14       |
| `BuildEmpty.png`        | 2 Build: first launch, an empty chart                  | U-03, U-21, U-34, U-90 |
| `BuildMenu.png`         | 3 Build: the + menu lists statements only              | U-40, U-33             |
| `BuildEdit.png`         | 4 Build: editing a block, choosing a variable          | U-41, U-94, U-95       |
| `EditValue.png`         | 4B Build: where a value is expected                    | U-50, U-52             |
| `EditTyping.png`        | 4C Build: typing, and the text becomes blocks          | U-50, U-93             |
| `EditNumber.png`        | 4D Build: after a number, and a named check            | U-52, U-95, U-96       |
| `EditList.png`          | 4E Build: after a list, what can be done with it       | U-52, N-11             |
| `EditCheck.png`         | 4F Build: an unnamed check, then And or Or             | U-33, U-53, N-08       |
| `EditItem.png`          | 4G Build: set one item of a list                       | U-53, U-94, U-96       |
| `Run.png`               | 5 Run: the moment on the chart, the state in Result    | U-60..U-63, U-23, R-19 |
| `Wrong.png`             | 6 Submit: Wrong Answer, and a way to the cause         | U-81, U-82             |
| `Accepted.png`          | 7 Submit: Accepted, with what comes next               | U-83                   |
| `Solution.png`          | 8 Solution: read-only in the chart area                | U-22                   |
| `FunctionRun.png`       | 9 Run inside functions: the path bar is the call stack | U-68                   |
| `Module.png`            | 10 Module page: run one function, keep cases, Test     | D-06, D-08, D-19, D-20 |
| `PythonChart.png`       | 11 Python tab: a line and its block                    | U-25                   |
| `PythonFiles.png`       | 12 Python tab: a program that uses a module            | U-25, E-09             |
| `Playground.png`        | 13 Playground: many programs, the last edited first    | U-15                   |
| `InputMenu.png`         | 14 Build: the Input node lists the problem's cases     | U-32                   |
| `Diagnostics.png`       | 15 Build: a red dot, its message, and its fix          | U-37                   |
| `PlaygroundProgram.png` | 17 Playground program: a title, Run, and Export        | U-01                   |
| `MenuProgram.png`       | 18 Build: the + menu lists the program's own functions | U-40                   |

## Where the spec deviates from the boards

- `Accepted.png` shows placeholders for the counts of steps and loops, because
  `heap-pop` has no challenge file; the same holds for any board of a problem
  that does not exist yet.
- `heap.py` on `PythonFiles.png` and the `heap_pop` chart on `Module.png` are
  drafts derived from D-16, not emitted code.
- `Main.png` names the first problem `Hello`; its challenge file is
  `tutorial`, and the title is the one in that file.
- The boards use a hand-drawn typeface to mark them as drafts; the
  application uses the typeface of `src/ui/theme.css`.

## Exporting

A board is one file of its canvas. It is rendered alone in a browser at the
size the canvas declares for it and captured as a PNG under the name of the
board. The canvases remain the working copies, and a changed board is
exported again in the pull request that changes the spec it affects.

| Canvas             | Holds                                         |
| ------------------ | --------------------------------------------- |
| [AlgoFlow Screens](https://claude.ai/artifact/SD2jKu4HfkPTh4CoeS7Tpe) | the twenty-three boards above |
| [AlgoFlow Redesign](https://claude.ai/artifact/D91141RiyMCW4XLsyJk8E5) | the flowchart and loop-notation studies; no exported board |

The canvases open only for their owner and the people it is shared with.
