// Dragging a node onto a connector: the nodes of statements are draggable, the connectors are
// drop targets, and the page decides whether a drop applies (`onMove` returns the reason a
// drop is refused). A refused drop shows its reason beside the connector for a moment.
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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

export type Moves = {
  /** Moves `owner` to `place`; the reason it is refused, or null when it applied. */
  onMove: (owner: NodeId, place: Place) => string | null;
  /** False for a place inside the dragged statement, which accepts no drop. */
  accepts: (owner: NodeId, place: Place) => boolean;
};

type Dragged = { owner: NodeId; text: string };
type Refusal = { edge: string; text: string };

/** The listeners that make a node draggable, and the ref they need; inert when disabled. */
export function useNodeDrag(node: ChartNode, enabled: boolean) {
  const { setNodeRef, listeners } = useDraggable({
    id: node.id,
    data: { owner: node.owner, text: node.text },
    disabled: !enabled || node.owner === null,
  });
  return {
    setRef: (element: SVGGElement | null) => setNodeRef(element as unknown as HTMLElement | null),
    listeners: enabled ? listeners : undefined,
  };
}

/** A connector as a drop target; it accepts nothing while `disabled`. */
export function DropZone(props: { edge: ChartEdge; disabled: boolean; children: ReactNode }) {
  const { edge, disabled, children } = props;
  const { setNodeRef, isOver } = useDroppable({
    id: edge.id,
    data: { place: edge.place },
    disabled,
  });
  return (
    <div ref={setNodeRef} className={cn("rounded-full", isOver && "ring-2 ring-selection")}>
      {children}
    </div>
  );
}

const placeOf = (data: unknown): Place | undefined =>
  data && typeof data === "object" && "place" in data ? (data.place as Place) : undefined;

/** The drag context of one chart, with the ghost of the dragged node and a refusal's note. */
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
    if (data?.owner) setDragged({ owner: data.owner, text: data.text ?? "" });
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
      onDragStart={start}
      onDragEnd={end}
      onDragCancel={() => setDragged(null)}
    >
      {children({ dragged: dragged?.owner ?? null, refusal })}
      <DragOverlay dropAnimation={null}>
        {dragged && (
          <div className="rounded-lg border bg-background px-3 py-2 text-sm whitespace-nowrap shadow-md">
            {dragged.text}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
