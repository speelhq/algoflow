# Design boards

One PNG per board of the design canvases, exported at the size of the board
(P-13). The spec (`docs/spec/05-ui.md`) was written from these boards and
takes precedence over them: a board shows the appearance of a screen, the spec
states its behaviour. A screen the spec describes and no board shows is an
issue labelled `decision`.

## Canvas "AlgoFlow Screens"

Twelve boards of 1280 × 800. Each file has the name of its board on the
canvas.

| File              | Board title on the canvas                              | Spec                     |
| ----------------- | ------------------------------------------------------ | ------------------------ |
| `Main.png`        | 1 Problems: one section per plan                       | U-02, U-10..U-14         |
| `BuildEmpty.png`  | 2 Build: first launch, an empty chart                  | U-03, U-21, U-34, U-90   |
| `BuildMenu.png`   | 3 Build: the + menu lists statements only              | U-40, U-33               |
| `BuildEdit.png`   | 4 Build: editing a block, names and values             | U-41, U-50..U-52         |
| `Run.png`         | 5 Run: the moment on the chart, the state in Result    | U-60..U-63, U-23, R-19   |
| `Wrong.png`       | 6 Submit: Wrong Answer, and a way to the cause         | U-81, U-82               |
| `Accepted.png`    | 7 Submit: Accepted, with what comes next               | U-83                     |
| `Solution.png`    | 8 Solution: read-only in the chart area                | U-22                     |
| `FunctionRun.png` | 9 Run inside functions: the path bar is the call stack | U-68                     |
| `Module.png`      | 10 Module page: run one function, keep cases, Test     | D-06, D-08, D-19, D-20   |
| `PythonChart.png` | 11 Python tab: a line and its block                    | U-25                     |
| `PythonFiles.png` | 12 Python tab: a program that uses a module            | U-25, E-09               |

## Canvas "AlgoFlow Redesign"

The earlier canvas, eleven boards of 1200 × 780 or 1200 × 720. One board is
exported: the study from which the loop notation of U-33 was chosen.

| File               | Board title on the canvas    | Spec       |
| ------------------ | ---------------------------- | ---------- |
| `LoopNotation.png` | Loop notation: three options | U-33, N-09 |

The other ten boards are not exported, because "AlgoFlow Screens" and the
spec supersede them: `Problems`, `Main` (Problem: Build), `Running`, `Wrong`,
`Cleared`, `FisherYates`, `FisherYatesRun`, `VariablesCard`, `FunctionBuild`,
and `FunctionRun`. They show tabs named Description, Hints, and Solution, a
floating variables card, a floating transport, a `Check` button, and
`Is i ≤ n?`, none of which the spec retains.

## Where the spec deviates from the boards

- `Accepted.png` shows placeholders for the counts of steps and loops, because
  `heap-pop` has no challenge file; the same holds for any board of a problem
  that does not exist yet.
- `heap.py` on `PythonFiles.png` and the `heap_pop` chart on `Module.png` are
  drafts derived from D-16, not emitted code.
- `Main.png` names the first problem `Hello`; its challenge file is
  `tutorial`, and the title is the one in that file.
- A diamond's text is the question of U-33 (`Is i divisible by 15?`),
  regardless of the text on a board. On `LoopNotation.png` the chosen option
  writes `Is i ≤ n?`; the generated check of a `for` is `Is i < stop?` (N-09).
- The boards use a hand-drawn typeface to mark them as drafts; the
  application uses the typeface of `src/ui/theme.css`.

## Not drawn yet

Each is an issue labelled `decision` under the milestone that needs it: the
`Result` tab with the view switch and the `tree` view on a heap (V-06,
before M-05); a built-in module's page with `Clone` (M-08); the path bar's
`▾` menu open (M-06).

## Exporting

A board is one file of its canvas. It is rendered alone in a browser at the
size the canvas declares for it and captured as a PNG under the name of the
board. The links to the canvases are in `private/PROMPTS.md`; the canvases
themselves remain the working copies, and a changed board is exported again
in the pull request that changes the spec it affects.
