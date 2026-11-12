// How the canvas scrolls: it makes room for the editor on the edited chart node's right and
// shows it, and it keeps the current chart node of a run in view.
import { useEffect, useLayoutEffect, type RefObject } from "react";

/** The widths in px that decide the editor's room on the canvas. */
type Widths = {
  /** The width of the canvas that shows at once. */
  canvasWidth: number;
  /** The width of the canvas's content: the chart and the space that centers it. */
  contentWidth: number;
  /** The width the content needs to show the open editor; null while no editor is open. */
  widthForEditor: number | null;
};

/**
 * Adds room for the open editor where the content lacks it, and scrolls the canvas to show the
 * editor. Returns the width added to the content.
 */
export function useEditorRoom(scroller: RefObject<HTMLDivElement | null>, widths: Widths): number {
  const { canvasWidth, contentWidth, widthForEditor } = widths;
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || widthForEditor === null) return;
    const short = widthForEditor - (element.scrollLeft + canvasWidth);
    if (short > 0) element.scrollBy({ left: short, behavior: "instant" });
  }, [scroller, widthForEditor, canvasWidth]);
  return widthForEditor === null ? 0 : Math.max(0, widthForEditor - contentWidth);
}

/** Scrolls the current chart node of a run into view whenever it changes. */
export function useScrollToCurrent(svg: RefObject<SVGSVGElement | null>, current: string | null) {
  useEffect(() => {
    if (current === null) return;
    const node = svg.current?.querySelector(`[data-chart-node="${CSS.escape(current)}"]`);
    node?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [svg, current]);
}
