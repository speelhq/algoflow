// U-03, U-24: the problem panel's width and collapsed state persist to localStorage
// under `algoflow:layout`. Values are clamped on write and validated again when read
// back, so storage never yields an out-of-range width or a non-boolean flag.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isRecord } from "@/i18n/flatten";

export const LAYOUT_STORAGE_KEY = "algoflow:layout";

/** U-03: 320 px, resizable 280–480. */
export const PANEL = { default: 320, min: 280, max: 480 } as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type LayoutState = {
  panel: number;
  collapsed: boolean;
  setPanel: (px: number) => void;
  setCollapsed: (collapsed: boolean) => void;
};

function size(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(Math.round(value), min, max)
    : fallback;
}

/** Validates a persisted snapshot; unknown or malformed fields fall back to defaults. */
export function mergePersisted(persisted: unknown, current: LayoutState): LayoutState {
  const stored = isRecord(persisted) ? persisted : {};
  return {
    ...current,
    panel: size(stored.panel, PANEL.default, PANEL.min, PANEL.max),
    collapsed: typeof stored.collapsed === "boolean" ? stored.collapsed : false,
  };
}

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      panel: PANEL.default,
      collapsed: false,
      setPanel: (px) => set({ panel: clamp(Math.round(px), PANEL.min, PANEL.max) }),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: LAYOUT_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({ panel: state.panel, collapsed: state.collapsed }),
      merge: mergePersisted,
    },
  ),
);
