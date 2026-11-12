// The chart's delegated pointer listeners, one per event on the SVG: a click selects a chart
// node's owner, and hovering a chart node with a diagnostic shows its message.
import { useCallback, useEffect, useState, useRef, type RefObject } from "react";
import type { NodeId } from "@/lang/types";

/**
 * A click on a chart node that has an owner, a generated chart node included: its owner, with the
 * slot clicked.
 */
export type OnSelect = (owner: NodeId, slot?: string) => void;

/** The element an event happened on; undefined for a target that isn't an element. */
const findTargetElement = (event: MouseEvent): Element | undefined =>
  event.target instanceof Element ? event.target : undefined;

/** The owner of the chart node that holds `target`, read from its `data-owner`. */
const findOwner = (target: Element | undefined): NodeId | undefined =>
  target?.closest<SVGGElement>("[data-owner]")?.dataset.owner;

/** A click on any part of a chart node selects its owner, with the slot clicked. */
export function useClickToSelect(
  svg: RefObject<SVGSVGElement | null>,
  onSelect: OnSelect | undefined,
) {
  useEffect(() => {
    const element = svg.current;
    if (!element || !onSelect) return;
    const handleClick = (event: MouseEvent) => {
      const target = findTargetElement(event);
      const owner = findOwner(target);
      const span = target?.closest<SVGElement>("[data-block-slot]");
      if (owner) onSelect(owner, span?.dataset.blockSlot);
    };
    element.addEventListener("click", handleClick);
    return () => element.removeEventListener("click", handleClick);
  }, [svg, onSelect]);
}

/**
 * The flagged owner whose diagnostic message shows: the one whose chart node is under the
 * pointer, until the pointer has left both that chart node and the message for 250 ms. The
 * message's own pointer events call `hover` with its owner, or with null when the pointer leaves.
 */
export function useHoverMessage(
  svg: RefObject<SVGSVGElement | null>,
  owners: ReadonlySet<NodeId> | undefined,
) {
  const [owner, setOwner] = useState<NodeId | null>(null);
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hover = useCallback((hoveredOwner: NodeId | null) => {
    if (leave.current !== null) clearTimeout(leave.current);
    leave.current = null;
    if (hoveredOwner !== null) setOwner(hoveredOwner);
    else leave.current = setTimeout(() => setOwner(null), 250);
  }, []);
  useEffect(() => {
    const element = svg.current;
    if (!element || !owners) return;
    const handleMouseOver = (event: MouseEvent) => {
      const found = findOwner(findTargetElement(event));
      hover(found && owners.has(found) ? found : null);
    };
    const handleMouseLeave = () => hover(null);
    element.addEventListener("mouseover", handleMouseOver);
    element.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      element.removeEventListener("mouseover", handleMouseOver);
      element.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [svg, owners, hover]);
  const messageOwner = owners && owner !== null && owners.has(owner) ? owner : null;
  return { messageOwner, hover };
}
