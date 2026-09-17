// U-03, U-24, U-60: the problem panel's width and collapsed state and the playback speed
// persist to localStorage under `algoflow:layout`. Values are clamped on write and validated again when read
// back, so storage never yields an out-of-range width or a non-boolean flag.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isRecord } from "@/i18n/flatten";

export const LAYOUT_STORAGE_KEY = "algoflow:layout";

/** U-03: 320 px, resizable 280–480. */
export const PANEL = { default: 320, min: 280, max: 480 } as const;

/** U-60, R-11: steps per second while playing; 3 until the learner moves the slider. */
export const SPEED = { default: 3, min: 1, max: 50 } as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type LayoutState = {
  panel: number;
  collapsed: boolean;
  speed: number;
  setPanel: (px: number) => void;
  setCollapsed: (collapsed: boolean) => void;
  setSpeed: (speed: number) => void;
};

/** A finite number rounded and clamped, else `fallback`: what a setter and a stored value both pass. */
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
    speed: size(stored.speed, SPEED.default, SPEED.min, SPEED.max),
  };
}

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      panel: PANEL.default,
      collapsed: false,
      speed: SPEED.default,
      setPanel: (px) => set((s) => ({ panel: size(px, s.panel, PANEL.min, PANEL.max) })),
      setCollapsed: (collapsed) => set({ collapsed }),
      setSpeed: (speed) => set((s) => ({ speed: size(speed, s.speed, SPEED.min, SPEED.max) })),
    }),
    {
      name: LAYOUT_STORAGE_KEY,
      version: 1,
      partialize: ({ panel, collapsed, speed }) => ({ panel, collapsed, speed }),
      merge: mergePersisted,
    },
  ),
);
