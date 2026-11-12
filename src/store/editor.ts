// Editor-side UI state of a page: the panel tab, the selected node, whether its editor is
// open and the slot a click on it chose, the node outlined from a hovered Python line,
// whether the canvas shows the solution, the diagnostic Run or Submit led to, and the statement
// whose editor has a field with the keyboard.
import { create } from "zustand";
import type { Diagnostic, NodeId } from "@/lang/types";
import { isStatement } from "@/lang/walk";
import { useProgram } from "./program";

export type PanelTab = "problem" | "result" | "python";

/** The panel's tabs, in order: `Problem` only on a page with a challenge. */
export function tabsOf(challenge: boolean): readonly [PanelTab, ...PanelTab[]] {
  return challenge ? ["problem", "result", "python"] : ["result", "python"];
}

export type EditorState = {
  tab: PanelTab;
  selectedId: NodeId | null;
  /** The slot the editor opens focused on: the one clicked on the chart node. */
  slot: string | null;
  /** The empty slot clicked on the chart node, inside that slot. */
  emptyId: NodeId | null;
  /**
   * In a block that the block menu has just inserted, where its first field's caret goes: where a
   * choice of the operation it holds puts it (`editor.md`, Block editor).
   */
  insertedCaret: number | null;
  /** The selected node's editor is open; a press outside it closes it and keeps the selection. */
  editing: boolean;
  hoveredId: NodeId | null;
  solution: boolean;
  /**
   * The diagnostic `Run` or `Submit` led to (`run.md`, Run bar, Starting a run), shown in its
   * owner's editor until the selection changes.
   */
  ledDiagnostic: Diagnostic | null;
  /**
   * The statement a field of whose notation has the keyboard, which the learner hasn't finished
   * (`chart.md`, Editing on the chart, Diagnostics).
   */
  typing: NodeId | null;
  setTab: (tab: PanelTab) => void;
  /** Selects a node and opens its editor, on `slot` (and `emptyId`) when clicked; `edit: false` only selects. */
  select: (id: NodeId | null, slot?: string, edit?: boolean, emptyId?: NodeId) => void;
  closeEditor: () => void;
  /** Selects the block the block menu has just inserted and opens its editor, its caret at `caret`. */
  selectInserted: (id: NodeId, caret: number) => void;
  setTyping: (id: NodeId | null) => void;
  setHovered: (id: NodeId | null) => void;
  showSolution: (shown: boolean) => void;
  /** Selects `owner`, the statement holding the diagnostic, and shows its message. */
  lead: (owner: NodeId, diagnostic: Diagnostic) => void;
  /** A page opens on its first tab, with nothing selected and its own chart shown. */
  open: (tab: PanelTab) => void;
};

/**
 * `id`, when it is a statement of the open program; the selection holds a statement only
 * (`chart.md`, Editing on the chart, Selection and keys), so any other node id throws.
 */
function selectable(id: NodeId): NodeId {
  if (!isStatement(useProgram.getState().program, id)) throw new Error(`${id} is no statement`);
  return id;
}

export const useEditor = create<EditorState>()((set) => ({
  tab: "problem",
  selectedId: null,
  slot: null,
  emptyId: null,
  insertedCaret: null,
  editing: false,
  hoveredId: null,
  solution: false,
  ledDiagnostic: null,
  typing: null,
  setTab: (tab) => set({ tab }),
  select: (id, slot, edit = true, emptyId) =>
    set({
      selectedId: id === null ? null : selectable(id),
      slot: slot ?? null,
      emptyId: emptyId ?? null,
      insertedCaret: null,
      editing: id !== null && edit,
      ledDiagnostic: null,
    }),
  selectInserted: (id, caret) =>
    set({
      selectedId: selectable(id),
      slot: null,
      emptyId: null,
      insertedCaret: caret,
      editing: true,
      ledDiagnostic: null,
    }),
  closeEditor: () => set({ editing: false }),
  setTyping: (id) => set({ typing: id }),
  setHovered: (id) => set({ hoveredId: id }),
  showSolution: (shown) => set({ solution: shown }),
  lead: (owner, diagnostic) =>
    set({
      selectedId: selectable(owner),
      slot: null,
      emptyId: null,
      insertedCaret: null,
      editing: true,
      ledDiagnostic: diagnostic,
      solution: false,
    }),
  open: (tab) =>
    set({
      tab,
      selectedId: null,
      slot: null,
      emptyId: null,
      insertedCaret: null,
      editing: false,
      hoveredId: null,
      solution: false,
      ledDiagnostic: null,
    }),
}));

// An undo or a redo can remove the selected statement, and the selection then clears, so it
// always holds a statement of the open program.
useProgram.subscribe(({ program }) => {
  const { selectedId, select } = useEditor.getState();
  if (selectedId !== null && !isStatement(program, selectedId)) select(null);
});
