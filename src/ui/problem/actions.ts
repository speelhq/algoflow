// The page's Run. With diagnostics present it does not start: it selects the statement that
// owns the first diagnostic and shows its message, or clears the selection for a function's. Run
// acts on the learner's program, so a shown solution gives way to the learner's program first. The
// play button's action, what a click on a chart node does in each mode, and showing the solution.
import { validate } from "@/lang/validate";
import type { NodeId } from "@/lang/types";
import { isStatement, ownerOf } from "@/lang/walk";
import { useEditor } from "@/store/editor";
import { currentMode } from "@/store/mode";
import { useProgram } from "@/store/program";
import { useProgress } from "@/store/progress";
import { useRun } from "@/store/run";
import { useSubmission } from "@/store/submission";

/** Shows the solution on the canvas, and records that the learner saw it (`challenges.md`, Progress). */
export function revealSolution(id: string): void {
  useEditor.getState().showSolution(true);
  useProgress.getState().solutionShown(id);
}

/** True when the program has no diagnostic; otherwise leads to the first one. */
function readyToRun(): boolean {
  const program = useProgram.getState().program;
  const editor = useEditor.getState();
  editor.showSolution(false);
  const [first] = validate(program);
  if (!first) return true;
  const owner = ownerOf(program, first.nodeId);
  // A function's diagnostic belongs to the function's editor, which is not built yet.
  if (isStatement(program, owner)) editor.lead(owner, first);
  else editor.select(null);
  return false;
}

export function startRun(opts?: { watch?: boolean }): void {
  if (!readyToRun()) return;
  useSubmission.getState().reset();
  useEditor.getState().setTab("result");
  void useRun.getState().run(opts);
}

/** `Replay` at the run's last step: back to step 0, playing. */
function replay(): void {
  void useRun
    .getState()
    .seek(0)
    .then(() => useRun.getState().play());
}

/**
 * The play button, also Ctrl/Cmd+Enter: `Run`, `Pause`, `Play`, or `Replay` at the run's last
 * step; nothing during the pre-run, where the button is disabled.
 */
export function togglePlay(): void {
  const run = useRun.getState();
  switch (run.status) {
    case "idle":
      if (!run.busy) startRun();
      return;
    case "playing":
      run.pause();
      return;
    case "paused":
      run.play();
      return;
    case "done":
    case "error":
      replay();
      return;
  }
}

/** Submit judges every test on its own runner and selects `Result`. */
export function startSubmit(): void {
  if (!readyToRun()) return;
  useEditor.getState().setTab("result");
  void useSubmission.getState().submit();
}

/**
 * A click on a statement's chart node, with the slot and the empty slot clicked: while running it
 * sets or clears the breakpoint, pausing first; once the run has ended it returns to build mode
 * and selects; in build mode it selects; on the shown solution it does nothing.
 */
export function clickChartNode(owner: NodeId, slot?: string, emptyId?: NodeId): void {
  // A function's `Start` opens the function's editor, which is not built yet.
  if (!isStatement(useProgram.getState().program, owner)) return;
  const run = useRun.getState();
  switch (currentMode()) {
    case "running":
      if (run.status === "playing") run.pause();
      run.setBreakpoint(run.breakpoint === owner ? null : owner);
      return;
    case "solution":
      return;
    case "ended":
      run.stop();
      break;
    case "build":
      break;
  }
  useEditor.getState().select(owner, slot, true, emptyId);
}
