// U-03, P-05: drag handles between panels. The parent decides the sign of the delta.
import { useRef, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** A vertical handle sits between columns and resizes a width; a horizontal one resizes a height. */
  orientation: "vertical" | "horizontal";
  label: string;
  testId: string;
  /** Current size of the panel this handle controls, captured at drag start. */
  size: number;
  /** Receives the size at drag start and the pointer delta along the axis since then. */
  onResize: (startSize: number, delta: number) => void;
};

export function ResizeHandle({ orientation, label, testId, size, onResize }: Props) {
  const drag = useRef<{ origin: number; size: number } | null>(null);
  const axis = (event: PointerEvent<HTMLDivElement>) =>
    orientation === "vertical" ? event.clientX : event.clientY;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { origin: axis(event), size };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !event.isPrimary) return;
    onResize(drag.current.size, axis(event) - drag.current.origin);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      data-testid={testId}
      className={cn(
        "shrink-0 touch-none select-none bg-border transition-colors hover:bg-ring",
        orientation === "vertical" ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
