// The flowchart as SVG from `layout()`. Shapes come from `ChartNode.shape`
// and never from a block type; generated chart nodes are gray. An HTML layer over the SVG,
// under the same scale, holds the parts a learner interacts with (the Input chart nodes' menus,
// the connectors, the editor) and a diagnostic's message beside its chart node.
import { useMemo, useRef, type ReactNode } from "react";
import { t } from "@/i18n/t";
import type { NodeId } from "@/lang/types";
import { cn } from "@/lib/utils";
import { EDITOR_GAP, EDITOR_WIDTH } from "@/ui/editor/size";
import { useElementWidth } from "@/ui/hooks/useElementWidth";
import { Button } from "@/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/primitives/dropdown-menu";
import { ChartDrag, DropZone, useNodeDrag, type DragState, type Moves } from "./drag";
import type { ChartEdge, ChartLayout, ChartNode } from "./layout";
import { nodeFor, type Paint } from "./paint";
import { spanStyle } from "./style";
import { chartSpanFont } from "./measure";
import { useHoverMessage, useClickToSelect, type OnSelect } from "./pointer";
import { useEditorRoom, useScrollToCurrent } from "./scroll";
import { useZoom, type Zoom } from "./zoom";

/** Margin around the chart, in chart units. */
const PAD = 24;

type Props = {
  chart: ChartLayout;
  /** The statement outlined as selected, and the owner outlined from a Python line. */
  selectedId?: NodeId | null;
  hoveredId?: NodeId | null;
  onSelect?: OnSelect;
  /** The cases an Input chart node's menu lists, and what choosing one does; absent while read-only. */
  cases?: {
    labels: string[];
    choose: (index: number) => void;
  };
  /** The run drawn on the chart. */
  paint?: Paint;
  /** The current chart node is where the run failed: it is outlined in the error color. */
  failed?: boolean;
  /** The editor anchored to the selected chart node; absent while nothing is edited. */
  editor?: ReactNode;
  /** What sits on an edge that carries a place (the `+` connector); absent while read-only. */
  connector?: (edge: ChartEdge & { place: NonNullable<ChartEdge["place"]> }) => ReactNode;
  /** Dragging a chart node onto a connector; absent while read-only. */
  moves?: Moves;
  /** Statements with a diagnostic to mark with a red dot, and what hovering one shows. */
  flags?: { owners: ReadonlySet<NodeId>; message: (owner: NodeId) => ReactNode };
};

function NodeShape({ node }: { node: ChartNode }) {
  const { x, y, w, h } = node;
  switch (node.shape) {
    case "junction":
      return <circle cx={x} cy={y} r={3} className="fill-foreground" data-junction />;
    case "diamond":
      return (
        <polygon
          points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`}
          data-shape
        />
      );
    case "terminal":
      return <rect x={x} y={y} width={w} height={h} rx={h / 2} data-shape />;
    case "input":
      return <rect x={x} y={y} width={w} height={h} rx={6} data-shape />;
    case "box":
      return <rect x={x} y={y} width={w} height={h} rx={8} data-shape />;
  }
}

type Look = {
  flagged: boolean;
  outline: "selected" | "hovered" | null;
  taken: boolean;
  current: "running" | "error" | null;
  mark: boolean | undefined;
  breakpoint: boolean;
};

/** ✓ or ✗ at a diamond's upper right. */
function Mark({ node, mark }: { node: ChartNode; mark: boolean }) {
  const cx = node.x + node.w * 0.75 + 14;
  const cy = node.y + 4;
  return (
    <g className={mark ? "text-taken" : "text-destructive"}>
      <circle cx={cx} cy={cy} r={8} className="fill-background stroke-current" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-current text-[10px] font-bold"
      >
        {t(mark ? "chart.mark.yes" : "chart.mark.no")}
      </text>
    </g>
  );
}

/** The breakpoint: a dot at the chart node's left, its word above the chart node's corner. */
function Breakpoint({ node }: { node: ChartNode }) {
  return (
    <g data-testid="breakpoint">
      <circle cx={node.x - 9} cy={node.y + node.h / 2} r={5} className="fill-destructive" />
      <text
        x={node.x - 14}
        y={node.y - 4}
        textAnchor="start"
        dominantBaseline="auto"
        className="fill-muted-foreground text-[11px]"
      >
        {t("chart.breakpoint")}
      </text>
    </g>
  );
}

function NodeView({ node, look, draggable }: { node: ChartNode; look: Look; draggable: boolean }) {
  const { outline, taken, current } = look;
  const { setRef, listeners } = useNodeDrag(node, draggable);
  return (
    <g
      ref={setRef}
      {...listeners}
      data-chart-node={node.id}
      data-owner={node.owner ?? undefined}
      data-selected={outline === "selected" || undefined}
      data-current={current ?? undefined}
      className={cn(
        "[&_[data-shape]]:fill-background [&_[data-shape]]:stroke-foreground [&_[data-shape]]:stroke-[1.25]",
        node.shape === "input" && "[&_[data-shape]]:fill-muted",
        node.generated && "[&_[data-shape]]:fill-muted [&_[data-shape]]:stroke-muted-foreground/60",
        node.owner !== null && "cursor-pointer",
        outline === "selected" && "[&_[data-shape]]:stroke-selection [&_[data-shape]]:stroke-[2.5]",
        outline === "hovered" &&
          "[&_[data-shape]]:stroke-selection [&_[data-shape]]:stroke-[1.5] [&_[data-shape]]:[stroke-dasharray:4_3]",
        taken && "[&_[data-shape]]:stroke-taken [&_[data-junction]]:fill-taken",
        current === "running" && "[&_[data-shape]]:stroke-selection [&_[data-shape]]:stroke-[3]",
        current === "error" && "[&_[data-shape]]:stroke-destructive [&_[data-shape]]:stroke-[3]",
      )}
    >
      {node.title !== undefined && <title>{node.title}</title>}
      <NodeShape node={node} />
      {node.spans.length > 0 && (
        // `font-mono` holds the feature settings that each span inherits; each span sets its own font.
        <text
          y={node.y + node.h / 2}
          dominantBaseline="central"
          className={cn(
            "fill-current font-mono",
            node.generated ? "text-muted-foreground" : "text-foreground",
          )}
          style={{ whiteSpace: "pre" }}
        >
          {node.spans.map((span, i) => (
            <tspan
              // oxlint-disable-next-line react/no-array-index-key -- spans are positional
              key={i}
              x={node.x + span.dx}
              y={node.y + node.h / 2 + span.dy}
              data-block-slot={span.slot}
              className={cn("fill-current", spanStyle(span).colorClass)}
              style={chartSpanFont(span)}
            >
              {span.text}
            </tspan>
          ))}
        </text>
      )}
      {node.role === "input" && (
        <text
          x={node.x + node.w - 10}
          y={node.y + node.h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground text-[10px]"
        >
          {t("chart.input.icon")}
        </text>
      )}
      {look.mark !== undefined && <Mark node={node} mark={look.mark} />}
      {look.flagged && (
        <circle
          cx={node.x + node.w - 4}
          cy={node.y + 4}
          r={5}
          className="fill-destructive stroke-background stroke-2"
          data-testid="red-dot"
        />
      )}
      {look.breakpoint && <Breakpoint node={node} />}
    </g>
  );
}

/** Clicking an Input chart node lists the problem's cases; choosing one sets every Input chart node. */
function InputMenu(props: { label: string; cases: NonNullable<Props["cases"]> }) {
  const { label, cases } = props;
  return (
    <div className="relative size-full">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={label}
              className="size-full cursor-pointer rounded-md"
              data-testid="input-chart-node"
            />
          }
        />
        <DropdownMenuContent>
          {cases.labels.map((text, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- a case is its index in the tests
            <DropdownMenuItem key={index} className="font-mono" onClick={() => cases.choose(index)}>
              {text}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** A `Yes` / `No` label beside the first segment of its edge. */
function EdgeLabel({ edge }: { edge: ChartEdge }) {
  const [a, b] = edge.points;
  if (!edge.label || !a || !b) return null;
  const across = a.y === b.y;
  return (
    <text
      x={across ? (a.x + b.x) / 2 : a.x + 6}
      y={across ? a.y - 6 : (a.y + b.y) / 2}
      textAnchor={across ? "middle" : "start"}
      dominantBaseline={across ? "auto" : "central"}
      className="fill-muted-foreground text-[11px]"
    >
      {t(edge.label === "yes" ? "chart.yes" : "chart.no")}
    </text>
  );
}

function EdgeView({ edge, taken }: { edge: ChartEdge; taken: boolean }) {
  return (
    <>
      <polyline
        points={edge.points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        markerEnd={taken ? "url(#chart-arrow-taken)" : "url(#chart-arrow)"}
        className={taken ? "stroke-taken" : "stroke-foreground/80"}
        strokeWidth={taken ? 2 : 1.25}
      />
      <EdgeLabel edge={edge} />
    </>
  );
}

/** The arrowheads of the edges: one for an edge the run hasn't taken, one for a taken edge. */
function Arrowheads() {
  return (
    <defs>
      <marker
        id="chart-arrow"
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" className="fill-foreground/80" />
      </marker>
      <marker
        id="chart-arrow-taken"
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" className="fill-taken" />
      </marker>
    </defs>
  );
}

/** A flagged chart node's diagnostic message beside it, held open while the pointer is over it. */
function HoverMessage(props: {
  node: ChartNode;
  owner: NodeId;
  hover: (owner: NodeId | null) => void;
  children: ReactNode;
}) {
  const { node, owner, hover, children } = props;
  return (
    <div
      className="pointer-events-auto absolute w-72 rounded-lg border bg-background p-2 shadow-md"
      style={{ left: node.x + node.w + 12, top: node.y }}
      data-testid="diagnostic-message"
      onMouseEnter={() => hover(owner)}
      onMouseLeave={() => hover(null)}
    >
      {children}
    </div>
  );
}

/**
 * The connector of every edge that carries a place, closed to a drop it doesn't accept, with a
 * refused drop's reason beside its connector.
 */
function Connectors(props: {
  edges: readonly ChartEdge[];
  connector: NonNullable<Props["connector"]>;
  moves: Moves | undefined;
  drag: DragState;
}) {
  const { edges, connector, moves, drag } = props;
  const { dragged, refusal } = drag;
  return edges.map((edge) => {
    const { place } = edge;
    if (!place) return null;
    const closed = dragged !== null && moves !== undefined && !moves.accepts(dragged, place);
    return (
      <div
        key={edge.id}
        className="pointer-events-auto absolute"
        style={{ left: edge.anchor.x, top: edge.anchor.y }}
      >
        <DropZone edge={edge} disabled={closed}>
          {connector({ ...edge, place })}
        </DropZone>
        {refusal?.edge === edge.id && (
          <div
            role="status"
            data-testid="drop-refused"
            className="absolute top-3 left-3 w-56 rounded-md border border-destructive/60 bg-background px-2 py-1 text-sm text-destructive shadow-sm"
          >
            {refusal.text}
          </div>
        )}
      </div>
    );
  });
}

/** The menu of cases over each Input chart node. */
function InputMenus(props: { nodes: readonly ChartNode[]; cases: NonNullable<Props["cases"]> }) {
  const { nodes, cases } = props;
  return nodes
    .filter((node) => node.role === "input")
    .map((node) => (
      <div
        key={node.id}
        className="pointer-events-auto absolute"
        style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      >
        <InputMenu label={node.text} cases={cases} />
      </div>
    ));
}

/** `−`, the current scale, and `+` in the chart's corner. */
function ZoomControls({ zoom }: { zoom: Zoom }) {
  return (
    <div className="absolute top-3 right-4 flex gap-1" data-testid="zoom">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t("chart.zoomOut.label")}
        onClick={zoom.zoomOut}
      >
        {t("chart.zoomOut.icon")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        aria-label={t("chart.zoomReset.label")}
        onClick={zoom.reset}
      >
        {t("chart.zoomReset.text", { n: Math.round(zoom.scale * 100) })}
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t("chart.zoomIn.label")}
        onClick={zoom.zoomIn}
      >
        {t("chart.zoomIn.icon")}
      </Button>
    </div>
  );
}

export function Chart(props: Props) {
  const {
    chart,
    selectedId = null,
    hoveredId = null,
    onSelect,
    cases,
    paint,
    failed = false,
    connector,
    editor,
    moves,
    flags,
  } = props;
  const edited = editor && selectedId ? nodeFor(chart.nodes, selectedId) : undefined;
  const scroller = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const canvasWidth = useElementWidth(scroller);
  // The chart's size in chart units, with its margin.
  const paddedSize = { width: chart.width + 2 * PAD, height: chart.height + 2 * PAD };
  const zoom = useZoom(canvasWidth, paddedSize.width);
  const { scale } = zoom;
  const width = paddedSize.width * scale;
  const height = paddedSize.height * scale;
  // The chart is centered, and the canvas grows on its right while the editor needs the room.
  const offset = Math.max(0, (canvasWidth - width) / 2);
  const editorRoom = useEditorRoom(scroller, {
    canvasWidth,
    contentWidth: offset + width,
    widthForEditor: edited
      ? offset + (PAD + edited.x + edited.w) * scale + EDITOR_WIDTH + 2 * EDITOR_GAP
      : null,
  });
  useClickToSelect(svg, onSelect);
  const current = paint?.current ?? null;
  useScrollToCurrent(svg, current);
  const { messageOwner, hover } = useHoverMessage(svg, flags?.owners);
  const messageNode = messageOwner === null ? undefined : nodeFor(chart.nodes, messageOwner);

  // The chart node that carries each flagged statement's dot.
  const flaggedNodes = useMemo(
    () =>
      new Set([...(flags?.owners ?? [])].flatMap((owner) => nodeFor(chart.nodes, owner)?.id ?? [])),
    [flags, chart],
  );

  const look = (node: ChartNode): Look => ({
    flagged: flaggedNodes.has(node.id),
    outline:
      node.owner === null
        ? null
        : node.owner === selectedId
          ? "selected"
          : node.owner === hoveredId
            ? "hovered"
            : null,
    taken: paint?.takenNodes.has(node.id) ?? false,
    current: node.id === current ? (failed ? "error" : "running") : null,
    mark: paint?.marks.get(node.id),
    breakpoint: paint?.breakpoint === node.id,
  });

  return (
    <ChartDrag moves={moves} edges={chart.edges}>
      {(drag) => (
        <div className="relative min-h-0 flex-1">
          <div
            ref={scroller}
            className="absolute inset-0 overflow-auto [scrollbar-gutter:stable]"
            data-testid="chart-scroll"
          >
            <div style={{ width: offset + width + editorRoom, height }}>
              <div className="relative" style={{ marginLeft: offset, width, height }}>
                <svg
                  ref={svg}
                  width={width}
                  height={height}
                  viewBox={`${-PAD} ${-PAD} ${paddedSize.width} ${paddedSize.height}`}
                  aria-label={t("chart.label")}
                  role="img"
                  data-testid="chart"
                >
                  <Arrowheads />
                  {chart.edges.map((edge) => (
                    <EdgeView
                      key={edge.id}
                      edge={edge}
                      taken={paint?.takenEdges.has(edge.id) ?? false}
                    />
                  ))}
                  {chart.nodes.map((node) => (
                    <NodeView
                      key={node.id}
                      node={node}
                      look={look(node)}
                      draggable={moves !== undefined}
                    />
                  ))}
                </svg>
                {(cases || connector || edited || messageNode) && (
                  <div
                    className="pointer-events-none absolute top-0 left-0 origin-top-left"
                    style={{ transform: `scale(${scale}) translate(${PAD}px, ${PAD}px)` }}
                  >
                    {messageNode && flags && messageOwner !== null && (
                      <HoverMessage node={messageNode} owner={messageOwner} hover={hover}>
                        {flags.message(messageOwner)}
                      </HoverMessage>
                    )}
                    {edited && (
                      <div
                        className="absolute"
                        style={{ left: edited.x, top: edited.y, width: edited.w, height: edited.h }}
                        data-testid="editor-anchor"
                      >
                        {editor}
                      </div>
                    )}
                    {connector && (
                      <Connectors
                        edges={chart.edges}
                        connector={connector}
                        moves={moves}
                        drag={drag}
                      />
                    )}
                    {cases && <InputMenus nodes={chart.nodes} cases={cases} />}
                  </div>
                )}
              </div>
            </div>
          </div>
          <ZoomControls zoom={zoom} />
        </div>
      )}
    </ChartDrag>
  );
}
