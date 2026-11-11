// The font of each span of the chart's text, and its width for `layout()`, measured in that font.
// Widths depend on the loaded fonts, so the cache is cleared each time fonts finish loading.
import { useSyncExternalStore } from "react";
import { estimatedWidth, type Measure } from "./layout";
import type { NotationSpan } from "./text";

/** The font stack every chart node's text is drawn in (`pages.md`, Typefaces), a variable of `src/ui/theme.css`. */
const CODE_STACK_VARIABLE = "--typeface-code";

/**
 * The font a chart span is drawn in: the code stack, bold for a variable's name. A style sets it
 * part by part, because the `font` shorthand would reset the feature settings that turn ligatures
 * off.
 */
export function chartSpanFont(span: NotationSpan): {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
} {
  return {
    fontFamily: `var(${CODE_STACK_VARIABLE})`,
    fontWeight: span.variable ? 600 : 400,
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

export const measureText: Measure = (span) => {
  const { fontWeight, fontSize } = chartSpanFont(span);
  const key = `${fontWeight} ${fontSize}|${span.text}`;
  const known = widths.get(key);
  if (known !== undefined) return known;
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return estimatedWidth(span);
  // A canvas reads no `var()`, so it takes the stack's value from the document. Before the
  // stylesheet applies the value is empty, and an estimate stands in, uncached.
  const family = getComputedStyle(document.documentElement).getPropertyValue(CODE_STACK_VARIABLE);
  if (family.trim() === "") return estimatedWidth(span);
  context.font = `${fontWeight} ${fontSize}px ${family}`;
  const width = context.measureText(span.text).width;
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
