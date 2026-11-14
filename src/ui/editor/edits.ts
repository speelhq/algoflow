// Every edit the page makes goes through `apply` or `applyTyped`. Both edit the learner's own
// program, and only in build mode. `insertBlock` selects the block it inserts.
import { EditError, insertStmt } from "@/lang/edit";
import type { Place, Program, Stmt } from "@/lang/types";
import { useEditor } from "@/store/editor";
import { currentMode, canEdit } from "@/store/mode";
import { useProgram } from "@/store/program";

/**
 * Applies `change` to the program and hands the result to `record`. Returns false when editing
 * is disabled or the edit does not apply.
 */
function applyWith(
  change: (program: Program) => Program,
  record: (next: Program) => void,
): boolean {
  if (!canEdit(currentMode())) return false;
  try {
    record(change(useProgram.getState().program));
    return true;
  } catch (error) {
    if (error instanceof EditError) return false;
    throw error;
  }
}

/**
 * Applies `change` to the program as a history entry of its own. Returns false when editing is
 * disabled or the edit does not apply.
 */
export function apply(change: (program: Program) => Program): boolean {
  return applyWith(change, (next) => useProgram.getState().edit(next));
}

/**
 * Applies `change`, typed into `field`, to the program through `typeInto`. Returns false when
 * editing is disabled or the edit does not apply.
 */
export function applyTyped(change: (program: Program) => Program, field: string): boolean {
  return applyWith(change, (next) => useProgram.getState().typeInto(next, field));
}

/**
 * Inserts a block at a connector's place and opens its editor, its first field's caret at `caret`
 * (`editor.md`, Block editor).
 */
export function insertBlock(stmt: Stmt, place: Place, caret: number): void {
  if (apply((program) => insertStmt(program, stmt, place))) {
    useEditor.getState().selectInserted(stmt.id, caret);
  }
}
