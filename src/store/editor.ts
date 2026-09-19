// Editor-side UI state: the node outlined from a hovered Python line (U-25). Selection joins in M-04.
import { create } from "zustand";
import type { NodeId } from "@/lang/types";

export type EditorState = {
  hoveredId: NodeId | null;
  setHovered: (id: NodeId | null) => void;
};

export const useEditor = create<EditorState>()((set) => ({
  hoveredId: null,
  setHovered: (id) => set({ hoveredId: id }),
}));
