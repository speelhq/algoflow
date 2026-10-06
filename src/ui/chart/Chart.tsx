// The flowchart as SVG from `layout()`. Shapes come from `ChartNode.shape`
// and never from a block kind; generated nodes are grey. An HTML layer over the SVG,
// under the same scale, holds the parts a learner interacts with (the Input nodes' menus)
// and the note beside a node (the narration, or the message of an error or a diagnostic).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { t } from "@/i18n/t";
import type { NodeId } from "@/lang/types";
import { cn } from "@/lib/utils";
import { useElementWidth } from "@/ui/hooks/useElementWidth";
import { Button } from "@/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/primitives/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/primitives/popover";
import { ChartDrag, DropZone, useNodeDrag, type Moves } from "./drag";
import { PILL, type ChartEdge, type ChartLayout, type ChartNode } from "./layout";
import { nodeFor, type Paint } from "./paint";
import { CHART_FONT } from "./measure";
import { fitScale, zoomStep } from "./zoom";

/** Margin around the chart, in chart units. */
const PAD = 24;

type Props = {
  chart: ChartLayout;
  /** The statement outlined as selected, and the one outlined from a Python line. */
  selectedId?: NodeId | null;
  hoveredId?: NodeId | null;
  /** A click on a statement's node (or a generated node of it), with the slot clicked on it. */
  onSelect?: (owner: NodeId, slot?: string) => void;
  /** The cases an Input node's menu lists, and what choosing one does; absent while read-only. */
  cases?: {
    labels: string[];
    choose: (index: number) => void;
    /** `Custom…`'s value editor for input `name`; `done` closes it. */
    custom: (name: string, done: () => void) => ReactNode;
  };
  /** The run drawn on the chart. */
  paint?: Paint;
  /** A sentence beside a chart node: the narration, or an error's or a diagnostic's message. */
  note?: Note | null;
  /** The editor anchored to the selected node; absent while nothing is edited. */
  editor?: ReactNode;
  /** What sits on an edge that carries a place (the `+` connector); absent while read-only. */
  connector?: (edge: ChartEdge & { place: NonNullable<ChartEdge["place"]> }) => ReactNode;
  /** Dragging a node onto a connector; absent while read-only. */
  moves?: Moves;
  /** Statements with a diagnostic to mark with a red dot, and what hovering one shows. */
  flags?: { owners: ReadonlySet<NodeId>; card: (owner: NodeId) => ReactNode };
};

export type Note = { node: string; text: string; tone: "narration" | "error" };

/** Width of the note beside a node, in chart units. */
const NOTE = 220;

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
    <g data-mark={mark ? "yes" : "no"} className={mark ? "text-taken" : "text-destructive"}>
      <circle cx={cx} cy={cy} r={8} className="fill-background stroke-current" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-current text-[10px] font-bold"
      >
        {t(mark ? "chart.markYes" : "chart.markNo")}
      </text>
    </g>
  );
}

/** The breakpoint mark: a dot at the node's left, its word above the node's corner. */
function BreakpointMark({ node }: { node: ChartNode }) {
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
        {t("run.breakpoint")}
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
      data-node-id={node.owner ?? undefined}
      data-selected={outline === "selected" || undefined}
      data-taken={taken || undefined}
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
      <NodeShape node={node} />
      {node.parts.map((part, i) =>
        part.empty ? (
          <rect
            // oxlint-disable-next-line react/no-array-index-key -- parts are positional
            key={`pill${i}`}
            x={node.x + part.dx + 2}
            y={node.y + node.h / 2 - 11}
            width={part.w - 4}
            height={22}
            rx={11}
            className="fill-background stroke-muted-foreground [stroke-dasharray:4_3]"
          />
        ) : null,
      )}
      {node.parts.length > 0 && (
        <text
          y={node.y + node.h / 2}
          dominantBaseline="central"
          className={cn("fill-foreground", node.generated && "fill-muted-foreground")}
          style={{ font: CHART_FONT }}
        >
          {node.parts.map((part, i) => (
            <tspan
              // oxlint-disable-next-line react/no-array-index-key -- parts are positional
              key={i}
              x={node.x + part.dx + (part.empty ? PILL : 0)}
              data-slot={part.slot}
              data-empty={part.empty || undefined}
              className={cn(part.empty && "fill-muted-foreground")}
            >
              {part.text}
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
          {t("chart.inputGlyph")}
        </text>
      )}
      {look.mark !== undefined && <Mark node={node} mark={look.mark} />}
      {look.flagged && (
        <circle
          cx={node.x + node.w - 4}
          cy={node.y + 4}
          r={5}
          className="fill-destructive stroke-background stroke-2"
          data-testid="diagnostic-dot"
        />
      )}
      {look.breakpoint && <BreakpointMark node={node} />}
    </g>
  );
}

/** Clicking an Input node lists the problem's cases; choosing one sets every Input node. */
function InputMenu(props: { label: string; name: string; cases: NonNullable<Props["cases"]> }) {
  const { label, name, cases } = props;
  const [editing, setEditing] = useState(false);
  return (
    <div className="relative size-full">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={label}
              className="size-full cursor-pointer rounded-md"
              data-testid="input-node"
            />
          }
        />
        <DropdownMenuContent>
          {cases.labels.map((text, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- a case is its index in the tests
            <DropdownMenuItem key={index} onClick={() => cases.choose(index)}>
              {text}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => setEditing(true)}>{t("chart.custom")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover open={editing} onOpenChange={setEditing}>
        <PopoverTrigger
          render={<div className="pointer-events-none absolute inset-0" aria-hidden />}
        />
        <PopoverContent side="right" align="start" className="w-72">
          {cases.custom(name, () => setEditing(false))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** A sentence beside its node, to the left where there is room, else the right. */
function NoteView({ note, node, width }: { note: Note; node: ChartNode; width: number }) {
  // Left of the node when it fits inside the chart's margin, else right when that fits.
  const leftAt = node.x - NOTE - 24;
  const rightAt = node.x + node.w + 24;
  const left = leftAt >= -PAD || rightAt + NOTE > width + PAD;
  return (
    <div
      role="status"
      data-testid={note.tone === "error" ? "chart-error" : "narration"}
      className={cn(
        "absolute -translate-y-1/2 rounded-lg border px-3 py-2 text-sm shadow-sm",
        note.tone === "error"
          ? "border-destructive/60 bg-background text-destructive"
          : "border-selection/60 bg-background",
      )}
      style={{
        width: NOTE,
        top: node.y + node.h / 2,
        left: left ? Math.max(leftAt, -PAD) : rightAt,
      }}
    >
      {note.text}
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
    <g data-edge={edge.id} data-taken={taken || undefined}>
      <polyline
        points={edge.points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        markerEnd={taken ? "url(#chart-arrow-taken)" : "url(#chart-arrow)"}
        className={taken ? "stroke-taken" : "stroke-foreground/80"}
        strokeWidth={taken ? 2 : 1.25}
      />
      <EdgeLabel edge={edge} />
    </g>
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
    note,
    connector,
    editor,
    moves,
    flags,
  } = props;
  const edited = editor && selectedId ? nodeFor(chart.nodes, selectedId) : undefined;
  const scroller = useRef<HTMLDivElement>(null);
  const region = useElementWidth(scroller);
  const [zoom, setZoom] = useState<number | null>(null);
  const scale = zoom ?? fitScale(region, chart.width + 2 * PAD);
  const width = (chart.width + 2 * PAD) * scale;
  const height = (chart.height + 2 * PAD) * scale;

  // One delegated listener: a click on any part of a node selects the statement it belongs to.
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const element = svg.current;
    if (!element || !onSelect) return;
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const owner = target?.closest<SVGGElement>("[data-node-id]")?.dataset.nodeId;
      const slot = target?.closest<SVGElement>("[data-slot]")?.dataset.slot;
      if (owner) onSelect(owner, slot);
    };
    element.addEventListener("click", click);
    return () => element.removeEventListener("click", click);
  }, [onSelect]);

  // The current node is scrolled into view.
  const current = paint?.current ?? null;
  useEffect(() => {
    if (current === null) return;
    const node = svg.current?.querySelector(`[data-chart-node="${CSS.escape(current)}"]`);
    node?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  // The node with a diagnostic under the pointer shows its card until the pointer leaves both.
  const [flagHover, setFlagHover] = useState<NodeId | null>(null);
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = useCallback((owner: NodeId | null) => {
    if (leave.current !== null) clearTimeout(leave.current);
    leave.current = null;
    if (owner !== null) setFlagHover(owner);
    else leave.current = setTimeout(() => setFlagHover(null), 250);
  }, []);
  useEffect(() => {
    const element = svg.current;
    if (!element || !flags) return;
    const over = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const owner = target?.closest<SVGGElement>("[data-node-id]")?.dataset.nodeId;
      hold(owner && flags.owners.has(owner) ? owner : null);
    };
    const out = () => hold(null);
    element.addEventListener("mouseover", over);
    element.addEventListener("mouseleave", out);
    return () => {
      element.removeEventListener("mouseover", over);
      element.removeEventListener("mouseleave", out);
    };
  }, [flags, hold]);
  const flagNode =
    flags && flagHover !== null && flags.owners.has(flagHover)
      ? nodeFor(chart.nodes, flagHover)
      : undefined;

  const look = (node: ChartNode): Look => ({
    flagged:
      node.owner !== null &&
      (flags?.owners.has(node.owner) ?? false) &&
      nodeFor(chart.nodes, node.owner)?.id === node.id,
    outline:
      node.owner === null
        ? null
        : node.owner === selectedId
          ? "selected"
          : node.owner === hoveredId
            ? "hovered"
            : null,
    taken: paint?.nodes.has(node.id) ?? false,
    current: node.id === current ? (note?.tone === "error" ? "error" : "running") : null,
    mark: paint?.marks.get(node.id),
    breakpoint: paint?.breakpoint === node.id,
  });
  const noted = note ? chart.nodes.find((node) => node.id === note.node) : undefined;

  return (
    <ChartDrag moves={moves} edges={chart.edges}>
      {({ dragged, refusal }) => (
        <div className="relative min-h-0 flex-1">
          <div
            ref={scroller}
            className="absolute inset-0 overflow-auto [scrollbar-gutter:stable]"
            data-testid="chart-scroll"
          >
            <div className="relative mx-auto" style={{ width, height }}>
              <svg
                ref={svg}
                width={width}
                height={height}
                viewBox={`${-PAD} ${-PAD} ${chart.width + 2 * PAD} ${chart.height + 2 * PAD}`}
                aria-label={t("chart.label")}
                role="img"
                data-testid="chart"
                data-scale={scale}
              >
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
                {chart.edges.map((edge) => (
                  <EdgeView key={edge.id} edge={edge} taken={paint?.edges.has(edge.id) ?? false} />
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
              {(cases || noted || connector || edited || flagNode) && (
                <div
                  className="pointer-events-none absolute top-0 left-0 origin-top-left"
                  style={{ transform: `scale(${scale}) translate(${PAD}px, ${PAD}px)` }}
                >
                  {note && noted && <NoteView note={note} node={noted} width={chart.width} />}
                  {flagNode && flags && flagHover !== null && (
                    <div
                      className="pointer-events-auto absolute w-72 rounded-lg border bg-background p-2 shadow-md"
                      style={{ left: flagNode.x + flagNode.w + 12, top: flagNode.y }}
                      data-testid="diagnostic-card"
                      onMouseEnter={() => hold(flagHover)}
                      onMouseLeave={() => hold(null)}
                    >
                      {flags.card(flagHover)}
                    </div>
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
                  {connector &&
                    chart.edges.map((edge) => {
                      const { place } = edge;
                      if (!place) return null;
                      const closed =
                        dragged !== null && moves !== undefined && !moves.accepts(dragged, place);
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
                    })}
                  {cases &&
                    chart.nodes
                      .filter((node) => node.role === "input")
                      .map((node) => (
                        <div
                          key={node.id}
                          className="pointer-events-auto absolute"
                          style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
                        >
                          <InputMenu
                            label={node.text}
                            name={node.id.slice("input:".length)}
                            cases={cases}
                          />
                        </div>
                      ))}
                </div>
              )}
            </div>
          </div>
          <div className="absolute top-3 right-4 flex gap-1" data-testid="zoom">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("chart.zoomOut")}
              onClick={() => setZoom(zoomStep(scale, -1))}
            >
              {t("chart.zoomOutGlyph")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label={t("chart.zoomReset")}
              onClick={() => setZoom(1)}
            >
              {t("chart.percent", { n: Math.round(scale * 100) })}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("chart.zoomIn")}
              onClick={() => setZoom(zoomStep(scale, 1))}
            >
              {t("chart.zoomInGlyph")}
            </Button>
          </div>
        </div>
      )}
    </ChartDrag>
  );
}
