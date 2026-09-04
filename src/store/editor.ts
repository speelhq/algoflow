// Editor-side UI state. M-02: the card outlined from the Python tab (U-61). Selection joins in M-03.
import { create } from "zustand";
import type { NodeId } from "@/lang/types";

export type EditorState = {
  hoveredId: NodeId | null;
  setHovered(id: NodeId | null): void;
};

export const useEditor = create<EditorState>()((set) => ({
  hoveredId: null,
  setHovered: (id) => set({ hoveredId: id }),
}));
