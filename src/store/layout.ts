// U-01: panel sizes and their limits; U-10: palette section expansion.
// Both persist to localStorage under `algoflow:layout`. Values are clamped on
// write and validated again when read back, so storage never yields an
// out-of-range size or a malformed palette.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isRecord } from "@/i18n/flatten";
import { CATEGORIES, type Category } from "@/nodes/categories";

export const LAYOUT_STORAGE_KEY = "algoflow:layout";

export const LEFT = { default: 240, min: 200, max: 360 } as const;
export const RIGHT = { default: 320, min: 280, max: 480 } as const;
export const BOTTOM = { default: 280, min: 160, maxFraction: 0.6 } as const;

export const DEFAULT_PALETTE: Record<Category, boolean> = {
  basic: true,
  list: true,
  control: true,
  function: false,
  dict: false,
  class: false,
  math: false,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** U-01: the bottom panel ranges from 160 px to 60 % of the viewport height. */
export function bottomMax(viewportHeight: number): number {
  return Math.max(BOTTOM.min, Math.floor(viewportHeight * BOTTOM.maxFraction));
}

export type LayoutState = {
  left: number;
  right: number;
  bottom: number;
  palette: Record<Category, boolean>;
  setLeft: (px: number) => void;
  setRight: (px: number) => void;
  setBottom: (px: number, viewportHeight: number) => void;
  togglePalette: (category: Category) => void;
};

function size(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(Math.round(value), min, max)
    : fallback;
}

/** Validates a persisted snapshot; unknown or malformed fields fall back to defaults. */
export function mergePersisted(persisted: unknown, current: LayoutState): LayoutState {
  const stored = isRecord(persisted) ? persisted : {};
  const palette = { ...DEFAULT_PALETTE };
  if (isRecord(stored.palette)) {
    for (const category of CATEGORIES) {
      const open = stored.palette[category];
      if (typeof open === "boolean") palette[category] = open;
    }
  }
  const viewportMax =
    typeof window === "undefined" ? Number.POSITIVE_INFINITY : bottomMax(window.innerHeight);
  return {
    ...current,
    left: size(stored.left, LEFT.default, LEFT.min, LEFT.max),
    right: size(stored.right, RIGHT.default, RIGHT.min, RIGHT.max),
    bottom: size(stored.bottom, BOTTOM.default, BOTTOM.min, viewportMax),
    palette,
  };
}

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      left: LEFT.default,
      right: RIGHT.default,
      bottom: BOTTOM.default,
      palette: DEFAULT_PALETTE,
      setLeft: (px) => set({ left: clamp(Math.round(px), LEFT.min, LEFT.max) }),
      setRight: (px) => set({ right: clamp(Math.round(px), RIGHT.min, RIGHT.max) }),
      setBottom: (px, viewportHeight) =>
        set({ bottom: clamp(Math.round(px), BOTTOM.min, bottomMax(viewportHeight)) }),
      togglePalette: (category) =>
        set((state) => ({ palette: { ...state.palette, [category]: !state.palette[category] } })),
    }),
    {
      name: LAYOUT_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        left: state.left,
        right: state.right,
        bottom: state.bottom,
        palette: state.palette,
      }),
      merge: mergePersisted,
    },
  ),
);
