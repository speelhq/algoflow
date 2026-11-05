// Editor-side UI state of a page: the panel tab, the selected node, whether its editor is
// open and the slot a click on it chose, the node outlined from a hovered Python line,
// whether the canvas shows the solution, and the diagnostic Run or Submit led to.
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
  /** The selected node's editor is open; a press outside it closes it and keeps the selection. */
  editing: boolean;
  hoveredId: NodeId | null;
  solution: boolean;
  /** Shown beside its chart node until the selection changes. */
  diagnostic: Diagnostic | null;
  setTab: (tab: PanelTab) => void;
  /** Selects a node and opens its editor, on `slot` (and `emptyId`) when clicked; `edit: false` only selects. */
  select: (id: NodeId | null, slot?: string, edit?: boolean, emptyId?: NodeId) => void;
  closeEditor: () => void;
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
  editing: false,
  hoveredId: null,
  solution: false,
  diagnostic: null,
  setTab: (tab) => set({ tab }),
  select: (id, slot, edit = true, emptyId) =>
    set({
      selectedId: id === null ? null : selectable(id),
      slot: slot ?? null,
      emptyId: emptyId ?? null,
      editing: id !== null && edit,
      diagnostic: null,
    }),
  closeEditor: () => set({ editing: false }),
  setHovered: (id) => set({ hoveredId: id }),
  showSolution: (shown) => set({ solution: shown }),
  lead: (owner, diagnostic) =>
    set({
      selectedId: selectable(owner),
      slot: null,
      emptyId: null,
      editing: true,
      diagnostic,
      solution: false,
    }),
  open: (tab) =>
    set({
      tab,
      selectedId: null,
      slot: null,
      emptyId: null,
      editing: false,
      hoveredId: null,
      solution: false,
      diagnostic: null,
    }),
}));

// An undo or a redo can remove the selected statement, and the selection then clears, so it
// always holds a statement of the open program.
useProgram.subscribe(({ program }) => {
  const { selectedId, select } = useEditor.getState();
  if (selectedId !== null && !isStatement(program, selectedId)) select(null);
});
