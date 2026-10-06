// Editor-side UI state of a page: the panel tab (U-20), the selected node and the node
// outlined from a hovered Python line (U-25), and whether the chart region shows the
// solution (U-22). Editing joins in M-04.
import { create } from "zustand";
import type { NodeId } from "@/lang/types";

export type PanelTab = "problem" | "result" | "python";

export type EditorState = {
  tab: PanelTab;
  selectedId: NodeId | null;
  hoveredId: NodeId | null;
  solution: boolean;
  setTab: (tab: PanelTab) => void;
  select: (id: NodeId | null) => void;
  setHovered: (id: NodeId | null) => void;
  showSolution: (shown: boolean) => void;
  /** U-20: a page opens on its first tab, with nothing selected and its own chart shown. */
  open: (tab: PanelTab) => void;
};

export const useEditor = create<EditorState>()((set) => ({
  tab: "problem",
  selectedId: null,
  hoveredId: null,
  solution: false,
  setTab: (tab) => set({ tab }),
  select: (id) => set({ selectedId: id }),
  setHovered: (id) => set({ hoveredId: id }),
  showSolution: (shown) => set({ solution: shown }),
  open: (tab) => set({ tab, selectedId: null, hoveredId: null, solution: false }),
}));
