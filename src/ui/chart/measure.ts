// U-30: text widths for `layout()`, measured with the font the chart draws in. Widths depend
// on the loaded font, so the cache is cleared each time fonts finish loading.
import { useSyncExternalStore } from "react";
import type { Measure } from "./layout";

export const CHART_FONT = '13px "Geist Variable", sans-serif';

let context: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();
/** Bumped whenever fonts finish loading: widths measured before then are stale. */
let loads = 0;
const listeners = new Set<() => void>();

function fontsLoaded(): void {
  loads += 1;
  widths.clear();
  for (const listener of listeners) listener();
}

if (typeof document !== "undefined") {
  document.fonts.addEventListener("loadingdone", fontsLoaded);
  void document.fonts.ready.then(fontsLoaded);
}

export const measureText: Measure = (text) => {
  const known = widths.get(text);
  if (known !== undefined) return known;
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return text.length * 7.2;
  context.font = CHART_FONT;
  const width = context.measureText(text).width;
  widths.set(text, width);
  return width;
};

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Changes each time fonts finish loading, so a layout measured before then is redone. */
export function useFontLoads(): number {
  return useSyncExternalStore(subscribe, () => loads);
}
