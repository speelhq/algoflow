// Editor-side UI state of a page: the panel tab (U-20), the selected node and the node
// outlined from a hovered Python line (U-25), whether the chart region shows the solution
// (U-22), and the diagnostic Run or Submit led to (U-60). Editing joins in M-04.
import { create } from "zustand";
import type { Diagnostic, NodeId } from "@/lang/types";

export type PanelTab = "problem" | "result" | "python";

export type EditorState = {
  tab: PanelTab;
  selectedId: NodeId | null;
  hoveredId: NodeId | null;
  solution: boolean;
  /** U-60: shown beside its node until the selection changes. */
  diagnostic: Diagnostic | null;
  setTab: (tab: PanelTab) => void;
  select: (id: NodeId | null) => void;
  setHovered: (id: NodeId | null) => void;
  showSolution: (shown: boolean) => void;
  /** U-60: selects `owner`, the statement holding the diagnostic, and shows its message. */
  lead: (owner: NodeId, diagnostic: Diagnostic) => void;
  /** U-20: a page opens on its first tab, with nothing selected and its own chart shown. */
  open: (tab: PanelTab) => void;
};

export const useEditor = create<EditorState>()((set) => ({
  tab: "problem",
  selectedId: null,
  hoveredId: null,
  solution: false,
  diagnostic: null,
  setTab: (tab) => set({ tab }),
  select: (id) => set({ selectedId: id, diagnostic: null }),
  setHovered: (id) => set({ hoveredId: id }),
  showSolution: (shown) => set({ solution: shown }),
  lead: (owner, diagnostic) => set({ selectedId: owner, diagnostic, solution: false }),
  open: (tab) => set({ tab, selectedId: null, hoveredId: null, solution: false, diagnostic: null }),
}));
