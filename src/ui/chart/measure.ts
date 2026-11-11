// The font of each part of the chart's text, and its width for `layout()`, measured in that font.
// Widths depend on the loaded fonts, so the cache is cleared each time fonts finish loading.
import { useSyncExternalStore } from "react";
import { estimatedWidth, type Measure } from "./layout";
import type { Part } from "./text";

/**
 * The font stack of a part's typeface, a variable of `src/ui/theme.css`: code in JetBrains Mono
 * and words in Geist (`pages.md`, Typefaces).
 */
function typeface(part: Part): "--typeface-words" | "--typeface-code" {
  return part.words ? "--typeface-words" : "--typeface-code";
}

/**
 * The font a part is drawn in: its typeface, and bold for a variable's name. A style sets it part
 * by part, because the `font` shorthand would reset the feature settings that turn ligatures off.
 */
export function chartFont(part: Part): {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
} {
  return {
    fontFamily: `var(${typeface(part)})`,
    fontWeight: part.variable ? 600 : 400,
    fontSize: 13,
  };
}

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

export const measureText: Measure = (part) => {
  const { fontWeight, fontSize } = chartFont(part);
  const stack = typeface(part);
  const key = `${stack} ${fontWeight} ${fontSize}|${part.text}`;
  const known = widths.get(key);
  if (known !== undefined) return known;
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return estimatedWidth(part);
  // A canvas reads no `var()`, so it takes the stack's value from the document.
  const family = getComputedStyle(document.documentElement).getPropertyValue(stack);
  context.font = `${fontWeight} ${fontSize}px ${family}`;
  const width = context.measureText(part.text).width;
  widths.set(key, width);
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
