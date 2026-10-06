// U-30..U-33, U-38: the flowchart as SVG from `layout()`. Shapes come from `ChartNode.shape`
// and never from a block kind (N-01); generated nodes are grey. An HTML layer over the SVG,
// under the same scale, holds the parts a learner interacts with (the Input nodes' menus).
import { useEffect, useRef, useState } from "react";
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
import type { ChartEdge, ChartLayout, ChartNode } from "./layout";
import { CHART_FONT } from "./measure";
import { fitScale, zoomStep } from "./zoom";

/** Margin around the chart, in chart units. */
const PAD = 24;

type Props = {
  chart: ChartLayout;
  /** U-25, U-35: the statement outlined as selected, and the one outlined from a Python line. */
  selectedId?: NodeId | null;
  hoveredId?: NodeId | null;
  /** A click on a statement's node (or a generated node of it, U-33); absent while read-only. */
  onSelect?: (owner: NodeId) => void;
  /** U-32: the cases an Input node's menu lists, and what choosing one does; absent while read-only. */
  cases?: { labels: string[]; choose: (index: number) => void };
};

function NodeShape({ node }: { node: ChartNode }) {
  const { x, y, w, h } = node;
  switch (node.shape) {
    case "junction":
      return <circle cx={x} cy={y} r={3} className="fill-foreground" />;
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

function NodeView({ node, outline }: { node: ChartNode; outline: "selected" | "hovered" | null }) {
  return (
    <g
      data-chart-node={node.id}
      data-node-id={node.owner ?? undefined}
      data-selected={outline === "selected" || undefined}
      className={cn(
        "[&_[data-shape]]:fill-background [&_[data-shape]]:stroke-foreground [&_[data-shape]]:stroke-[1.25]",
        node.shape === "input" && "[&_[data-shape]]:fill-muted",
        node.generated && "[&_[data-shape]]:fill-muted [&_[data-shape]]:stroke-muted-foreground/60",
        node.owner !== null && "cursor-pointer",
        outline === "selected" && "[&_[data-shape]]:stroke-selection [&_[data-shape]]:stroke-[2.5]",
        outline === "hovered" &&
          "[&_[data-shape]]:stroke-selection [&_[data-shape]]:stroke-[1.5] [&_[data-shape]]:[stroke-dasharray:4_3]",
      )}
    >
      <NodeShape node={node} />
      {node.text && (
        <text
          x={node.x + node.w / 2}
          y={node.y + node.h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className={cn("fill-foreground", node.generated && "fill-muted-foreground")}
          style={{ font: CHART_FONT }}
        >
          {node.text}
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
          ▾
        </text>
      )}
    </g>
  );
}

/** U-32: clicking an Input node lists the problem's cases; choosing one sets every Input node. */
function InputMenu({ label, cases }: { label: string; cases: NonNullable<Props["cases"]> }) {
  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
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

function EdgeView({ edge }: { edge: ChartEdge }) {
  return (
    <g data-edge={edge.id}>
      <polyline
        points={edge.points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        markerEnd="url(#chart-arrow)"
        className="stroke-foreground/80"
        strokeWidth={1.25}
      />
      <EdgeLabel edge={edge} />
    </g>
  );
}

export function Chart({ chart, selectedId = null, hoveredId = null, onSelect, cases }: Props) {
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
      if (owner) onSelect(owner);
    };
    element.addEventListener("click", click);
    return () => element.removeEventListener("click", click);
  }, [onSelect]);

  const outline = (node: ChartNode) =>
    node.owner === null
      ? null
      : node.owner === selectedId
        ? "selected"
        : node.owner === hoveredId
          ? "hovered"
          : null;

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} className="absolute inset-0 overflow-auto" data-testid="chart-scroll">
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
            </defs>
            {chart.edges.map((edge) => (
              <EdgeView key={edge.id} edge={edge} />
            ))}
            {chart.nodes.map((node) => (
              <NodeView key={node.id} node={node} outline={outline(node)} />
            ))}
          </svg>
          {cases && (
            <div
              className="pointer-events-none absolute top-0 left-0 origin-top-left"
              style={{ transform: `scale(${scale}) translate(${PAD}px, ${PAD}px)` }}
            >
              {chart.nodes
                .filter((node) => node.role === "input")
                .map((node) => (
                  <div
                    key={node.id}
                    className="pointer-events-auto absolute"
                    style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
                  >
                    <InputMenu label={node.text} cases={cases} />
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
          −
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
          +
        </Button>
      </div>
    </div>
  );
}
