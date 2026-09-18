# Design boards

One PNG per board of the design canvases, exported at 1280 × 800 (P-13).
The spec (`docs/spec/05-ui.md`) was written from these boards and takes
precedence over them: a board shows the appearance of a screen, the spec
states its behaviour. A screen
the spec describes and no board shows is an issue labelled `decision`.

## Canvas "AlgoFlow Screens"

| File                              | Board                | Shows                                                                 |
| --------------------------------- | -------------------- | --------------------------------------------------------------------- |
| `screens-problems.png`            | Problems             | one section per plan, progress marks, `Continue` (U-10..U-14)          |
| `screens-build-1.png`             | Build 1              | the Problem page in build mode, `Problem` tab, the chart (U-03, U-21)  |
| `screens-build-2.png`             | Build 2              | the `+` menu and a node editor open (U-40, U-41)                       |
| `screens-build-3.png`             | Build 3              | the condition template row and the chip editor (U-50..U-52)            |
| `screens-run.png`                 | Run                  | run mode: the transport, the position bar, the narration (U-60..U-63)  |
| `screens-wrong-answer.png`        | Wrong Answer         | `Result` after a failed submission, the rows, `▶ Watch this case` (U-81) |
| `screens-accepted.png`            | Accepted             | the Accepted card and its actions (U-83)                               |
| `screens-solution.png`            | Solution             | the solution shown in the chart region under its band (U-22)           |
| `screens-run-in-function.png`     | Run inside functions | the path bar as the call stack (U-68)                                  |
| `screens-module.png`              | Module               | a Module page with cases and `Test` (D-08, D-19, D-20)                 |
| `screens-python-1.png`            | Python 1             | the `Python` tab with line highlights (U-25)                           |
| `screens-python-2.png`            | Python 2             | the file row of a program using a module (U-25, E-09)                  |

## Canvas "AlgoFlow Redesign"

| File                              | Board                | Shows                                                                 |
| --------------------------------- | -------------------- | --------------------------------------------------------------------- |
| `redesign-flowchart.png`          | Flowchart study      | the shapes of U-33: boxes, diamonds, generated loop nodes, back edges |
| `redesign-loop-notation.png`      | Loop notation study  | how a counted loop is drawn as init, check, and step                  |

Only the chart drawing itself is current on this canvas. Its tabs, floating
variables card, output strip, `Check` button, right drawer, and `Is i ≤ n?`
are superseded by "AlgoFlow Screens" and by the spec.

## Where the spec deviates from the boards

- The heap-pop and hanoi boards show `[n]` for step counts because those
  problems have no challenge file yet; the counts are placeholders.
- `heap.py` and the `heap_pop` chart on the Module board are sketches from
  D-16, not emitted code.
- A diamond's text is the question of U-33 (`Is i divisible by 15?`),
  regardless of the text on a board.

## Not drawn yet

Each is an issue labelled `decision` under the milestone that needs it: the
`Result` tab with the view switch and the `tree` view on a heap (V-06,
before M-05); a built-in module's page with `Clone` (M-08); the path bar's
`▾` menu open (M-06).

## Exporting

Export each board from the canvas as PNG at 1280 × 800 into this folder
under the file name above. The links to the canvases are in
`private/PROMPTS.md`; the canvases themselves remain the working copies, and
a changed board is re-exported in the pull request that changes the spec
it affects.
