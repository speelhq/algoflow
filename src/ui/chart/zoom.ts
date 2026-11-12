// The chart fits its width on open, never above 100 %; `−` and `+` step by 1.25
// between 25 % and 200 %.
import { useState } from "react";
import { clamp } from "@/lib/utils";

const ZOOM = { min: 0.25, max: 2, step: 1.25 } as const;

/** The scale at which `width` fits the `canvasWidth`; 1 when it already fits. */
export function fitScale(canvasWidth: number, width: number): number {
  if (!(canvasWidth > 0) || !(width > 0)) return 1;
  return clamp(canvasWidth / width, ZOOM.min, 1);
}

/** The scale one click of `+` (1) or `−` (-1) leads to from `scale`, within 25 % and 200 %. */
export function zoomStep(scale: number, direction: 1 | -1): number {
  const next = direction > 0 ? scale * ZOOM.step : scale / ZOOM.step;
  return clamp(next, ZOOM.min, ZOOM.max);
}

/** The chart's scale, with what `+`, `−`, and `100%` do. */
export type Zoom = { scale: number; zoomIn: () => void; zoomOut: () => void; reset: () => void };

/**
 * The chart's zoom: the scale that fits `width` into the `canvasWidth`, until the learner
 * sets a scale of their own with the controls.
 */
export function useZoom(canvasWidth: number, width: number): Zoom {
  const [manualScale, setManualScale] = useState<number | null>(null);
  const scale = manualScale ?? fitScale(canvasWidth, width);
  return {
    scale,
    zoomIn: () => setManualScale(zoomStep(scale, 1)),
    zoomOut: () => setManualScale(zoomStep(scale, -1)),
    reset: () => setManualScale(1),
  };
}
