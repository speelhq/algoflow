// U-30: text widths for `layout()`, measured with the font the chart draws in. Widths depend
// on the loaded font, so the cache is keyed by the document's font status.
import { useSyncExternalStore } from "react";
import type { Measure } from "./layout";

export const CHART_FONT = '13px "Geist Variable", sans-serif';

let context: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();
let cachedFor = "";

function fontStatus(): string {
  return typeof document === "undefined" ? "none" : document.fonts.status;
}

export const measureText: Measure = (text) => {
  const status = fontStatus();
  if (status !== cachedFor) {
    widths.clear();
    cachedFor = status;
  }
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
  document.fonts.addEventListener("loadingdone", onChange);
  void document.fonts.ready.then(onChange);
  return () => document.fonts.removeEventListener("loadingdone", onChange);
}

/** Changes when fonts finish loading, so a layout measured before then is redone. */
export function useFontStatus(): string {
  return useSyncExternalStore(subscribe, fontStatus);
}
