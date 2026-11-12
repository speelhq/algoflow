// Dragging a chart node onto a connector: the chart nodes of statements are draggable, the connectors are
// drop targets, and the page decides whether a drop applies (`onMove` returns the reason a
// drop is refused). A refused drop shows its reason beside the connector for a moment.
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useState, type ReactNode } from "react";
import type { NodeId, Place } from "@/lang/types";
import { cn } from "@/lib/utils";
import type { ChartEdge, ChartNode } from "./layout";
import { spanStyle } from "./style";
import { chartSpanFont } from "./measure";
import type { NotationSpan } from "./text";

export type Moves = {
  /** Moves `owner` to `place`; the reason it is refused, or null when it applied. */
  onMove: (owner: NodeId, place: Place) => string | null;
  /** False for a place inside the dragged statement, which accepts no drop. */
  accepts: (owner: NodeId, place: Place) => boolean;
};

/** The dragged chart node: its owner, and its text and grayness, which its ghost draws. */
type Dragged = { owner: NodeId; spans: NotationSpan[]; generated: boolean };
type Refusal = { edge: string; text: string };

/** The listeners that make a chart node draggable, and the ref they need; inert when disabled. */
export function useNodeDrag(node: ChartNode, enabled: boolean) {
  const { setNodeRef, listeners } = useDraggable({
    id: node.id,
    data: { owner: node.owner, spans: node.spans, generated: node.generated },
    // Only a statement's chart node moves: a function chart's `Start` has an owner, but stays.
    disabled: !enabled || node.owner === null || node.shape === "terminal",
  });
  return {
    setRef: (element: SVGGElement | null) => setNodeRef(element as unknown as HTMLElement | null),
    listeners: enabled ? listeners : undefined,
  };
}

/**
 * A connector as a drop target: a circle centered on the edge's anchor, where the `+` is drawn
 * (the box of the `+` and its label is not), accepting nothing while `disabled`.
 */
export function DropZone(props: { edge: ChartEdge; disabled: boolean; children: ReactNode }) {
  const { edge, disabled, children } = props;
  const { setNodeRef, isOver } = useDroppable({
    id: edge.id,
    data: { place: edge.place },
    disabled,
  });
  return (
    <>
      <div
        ref={setNodeRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-3 -left-3 size-6 rounded-full",
          isOver && "ring-2 ring-selection",
        )}
      />
      {children}
    </>
  );
}

const placeOf = (data: unknown): Place | undefined =>
  data && typeof data === "object" && "place" in data ? (data.place as Place) : undefined;

/** The drag context of one chart, with the ghost of the dragged chart node and a refusal's note. */
export function ChartDrag(props: {
  moves: Moves | undefined;
  edges: readonly ChartEdge[];
  children: (state: { dragged: NodeId | null; refusal: Refusal | null }) => ReactNode;
}) {
  const { moves, edges, children } = props;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  useEffect(() => {
    if (!refusal) return;
    const timer = setTimeout(() => setRefusal(null), 2500);
    return () => clearTimeout(timer);
  }, [refusal]);

  const start = (event: DragStartEvent) => {
    const data = event.active.data.current as Partial<Dragged> | undefined;
    if (data?.owner) {
      setDragged({
        owner: data.owner,
        spans: data.spans ?? [],
        generated: data.generated ?? false,
      });
    }
  };
  const end = (event: DragEndEvent) => {
    const owner = dragged?.owner;
    setDragged(null);
    const place = placeOf(event.over?.data.current);
    if (!owner || !place || !moves || !event.over) return;
    const reason = moves.onMove(owner, place);
    const edge = edges.find((e) => e.id === event.over?.id);
    if (reason && edge) setRefusal({ edge: edge.id, text: reason });
  };

  return (
    <DndContext
      sensors={sensors}
      // The connector under the pointer takes the drop, not the one the ghost covers most.
      collisionDetection={pointerWithin}
      onDragStart={start}
      onDragEnd={end}
      onDragCancel={() => setDragged(null)}
    >
      {children({ dragged: dragged?.owner ?? null, refusal })}
      <DragOverlay dropAnimation={null}>
        {dragged && (
          // A generated chart node's ghost is gray, as the chart node is (`chart.md`, Shapes).
          <div
            data-testid="drag-ghost"
            className={cn(
              "rounded-lg border px-3 py-2 whitespace-pre font-mono shadow-md",
              dragged.generated
                ? "border-muted-foreground/60 bg-muted text-muted-foreground"
                : "bg-background text-foreground",
            )}
          >
            {dragged.spans.map((nodeSpan, i) => (
              <span
                // oxlint-disable-next-line react/no-array-index-key -- spans are positional
                key={i}
                className={spanStyle(nodeSpan).colorClass}
                style={chartSpanFont(nodeSpan)}
              >
                {nodeSpan.text}
              </span>
            ))}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
