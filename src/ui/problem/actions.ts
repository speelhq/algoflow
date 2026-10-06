// U-60, U-27: the page's Run. With diagnostics present it does not start: it selects the
// first diagnostic's statement and shows its message (U-37). Run acts on the learner's
// program, so a shown solution gives way to the learner's chart first.
import { validate } from "@/lang/validate";
import { ownerStmts } from "@/lang/walk";
import { useEditor } from "@/store/editor";
import { useProgram } from "@/store/program";
import { useRun } from "@/store/run";
import { useTests } from "@/store/tests";

/** U-60: true when the program has no diagnostic; otherwise leads to the first one. */
export function readyToRun(): boolean {
  const program = useProgram.getState().program;
  const editor = useEditor.getState();
  editor.showSolution(false);
  const [first] = validate(program);
  if (!first) return true;
  editor.lead(ownerStmts(program).get(first.nodeId) ?? first.nodeId, first);
  return false;
}

export function startRun(opts?: { watch?: boolean }): void {
  if (!readyToRun()) return;
  useTests.getState().reset();
  useEditor.getState().setTab("result");
  void useRun.getState().run(opts);
}
