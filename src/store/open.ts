// Opening a program: a problem's under its challenge id, a Playground program's under its id.
// The program is loaded, the first case chosen (which discards any run), and the page opens on
// its first tab with nothing selected.
import { panelTabs, useEditor } from "./editor";
import { useProgram } from "./program";
import { useRun } from "./run";

export function openProgram(id: string): void {
  useProgram.getState().load(id);
  useRun.getState().selectCase(0);
  const [first] = panelTabs(useProgram.getState().program.challengeId !== undefined);
  useEditor.getState().open(first);
}
