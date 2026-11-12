// The chart's layout, computed and never placed by hand. Every statement
// becomes a fragment around a vertical axis with a left and a right extent; a region stacks
// its fragments on one axis, a branch puts its Yes column to the right of its whole No
// column, and a loop keeps a lane on its left for the back edge and one on its right for the
// No edge. A fragment's lanes lie inside its own extents, so nested lanes never collide.
// A `Return` and a jump leave by the right: a `Return` for `End`, a jump for its loop, whose
// `next` lane and `No` lane take it to the next pass or past the loop.
// Reads `def.chart`, `def.requires`, and the regions of a statement, never a type.
import { inputValue } from "@/lang/data";
import type { Data, Name, NodeId, Place, Program, RegionParent, Routine, Stmt } from "@/lang/types";
import { findRoutine, regionsOf, routineStmts } from "@/lang/walk";
import { getBlockDef, keyOf } from "@/blocks/registry";
import {
  CHART_TEXT,
  generatedSpans,
  holdsDraft,
  inputSpans,
  joinSpans,
  questionSpans,
  notationSpans,
  type NotationSpan,
  SEPARATOR,
  filledSpans,
} from "./text";

export type Point = { x: number; y: number };
export type Shape = "terminal" | "input" | "box" | "diamond" | "junction";
export type ChartNode = {
  /**
   * A statement's id, `<id>:init|check|update|top|merge|exit|next` for its other chart nodes,
   * `start`, `end`, or `input:<name>`.
   */
  id: string;
  /**
   * Its owner, the statement or function that stands for it (`chart.md`, Shapes): a function
   * chart's `Start` has its function; `main`'s `Start`, `End`, and inputs have none.
   */
  owner: NodeId | null;
  role:
    | "start"
    | "end"
    | "input"
    | "stmt"
    | "init"
    | "check"
    | "update"
    | "top"
    | "merge"
    | "exit"
    | "next";
  shape: Shape;
  /** Drawn gray, not selectable on its own. */
  generated: boolean;
  text: string;
  /** What the chart node draws without its caption, shown on hover where it shows its caption instead. */
  title?: string;
  /**
   * The text in spans, each at `dx` from the chart node's left with width `w`; a slot's span names
   * it.
   */
  spans: PlacedSpan[];
  /** Top-left corner; a junction is a point (`w = h = 0`). */
  x: number;
  y: number;
  w: number;
  h: number;
};
export type ChartEdge = {
  /** `<from>><to>`, with `:<label>` when labeled. */
  id: string;
  from: string;
  to: string;
  label?: "yes" | "no";
  /** An orthogonal polyline from the border of `from` to the border of `to`. */
  points: Point[];
  /** Where a block inserted on this edge goes; null where none can. */
  place: Place | null;
  /** Where the `+` connector and the label sit: the middle of a vertical segment of the edge. */
  anchor: Point;
};
/**
 * A span at `dx` from the chart node's left with width `w`, `dy` from its middle (a second line).
 */
export type PlacedSpan = NotationSpan & { dx: number; dy: number; w: number };
export type ChartLayout = { nodes: ChartNode[]; edges: ChartEdge[]; width: number; height: number };
/** The width of a span's text in px, in the typeface and weight the chart draws it in. */
export type Measure = (span: NotationSpan) => number;
export type LayoutOptions = {
  routine: Routine;
  /** The values the Input chart nodes show: the chosen case's. */
  inputs: Readonly<Record<Name, Data>>;
  measure: Measure;
};

const GAP_Y = 36;
const GAP_X = 32;
const LANE = 24;
const JOIN = 20; // a loop's top to the diamond below it
const HEIGHT: Record<Shape, number> = {
  terminal: 36,
  input: 40,
  box: 40,
  diamond: 60,
  junction: 0,
};

/** A width estimated from the length of the text, where no font can measure it. */
export const estimatedWidth: Measure = (span) => span.text.length * 7.2;
/** A diamond's text wider than this is drawn on two lines, as the designs draw it. */
const WRAP = 150;
/** The distance between the two lines of a diamond's text. */
export const LINE = 16;

const BREAK: NotationSpan = { text: " " };

/**
 * Spans split into two lines at the space that makes the longer line shortest; a space inside
 * a variable is never one. One line when there is no space to split at.
 */
function inTwo(spans: NotationSpan[], width: (span: NotationSpan) => number): NotationSpan[][] {
  let best: { lines: NotationSpan[][]; longest: number } | undefined;
  spans.forEach((span, p) => {
    if (span.variable) return;
    for (let k = span.text.indexOf(" "); k >= 0; k = span.text.indexOf(" ", k + 1)) {
      const head = span.text.slice(0, k).trimEnd();
      const rest = span.text.slice(k + 1).trimStart();
      // The space stays at the end of the first line, drawn with no width, so the text reads on.
      const first = [...spans.slice(0, p), ...(head ? [{ ...span, text: head }] : []), BREAK];
      const second = [...(rest ? [{ ...span, text: rest }] : []), ...spans.slice(p + 1)];
      if (first.length === 1 || second.length === 0) continue;
      const sum = (line: NotationSpan[]) => line.reduce((total, each) => total + width(each), 0);
      const longest = Math.max(sum(first), sum(second));
      if (!best || longest < best.longest) best = { lines: [first, second], longest };
    }
  });
  return best?.lines ?? [spans];
}

/** Where a flow that leaves its region goes: `End`, past its loop, or into the loop's next pass. */
type Leave = "end" | "exit" | "next";
/** A flow that still needs its target: the points so far, and the place its edge will carry. */
type Stub = {
  from: string;
  label?: "yes" | "no";
  points: Point[];
  place: Place | null;
  /** For a flow leaving its region, where it goes. */
  to?: Leave;
};
type Frag = {
  left: number;
  right: number;
  height: number;
  nodes: ChartNode[];
  edges: ChartEdge[];
  /** The chart node an incoming edge ends on, at the fragment's (0, 0); null for an empty region. */
  entry: string | null;
  /** Falls through to whatever follows; null when nothing does (a `Return`). */
  out: Stub | null;
  /** Flows that leave the region (for `End`, or for a loop), each ending on its right boundary. */
  escapes: Stub[];
};
/** The slot of a region: `main`, or a compound statement's body slot. */
type RegionSlot = Place["slot"];

function emptyFrag(): Frag {
  return {
    left: 0,
    right: 0,
    height: 0,
    nodes: [],
    edges: [],
    entry: null,
    out: null,
    escapes: [],
  };
}

const last = (points: Point[]): Point => points[points.length - 1] ?? { x: 0, y: 0 };

function shiftPoints(points: Point[], dx: number, dy: number): void {
  for (const point of points) {
    point.x += dx;
    point.y += dy;
  }
}

function shift(frag: Frag, dx: number, dy: number): Frag {
  for (const node of frag.nodes) {
    node.x += dx;
    node.y += dy;
  }
  for (const line of frag.edges) {
    shiftPoints(line.points, dx, dy);
    shiftPoints([line.anchor], dx, dy);
  }
  if (frag.out) shiftPoints(frag.out.points, dx, dy);
  for (const escape of frag.escapes) shiftPoints(escape.points, dx, dy);
  return frag;
}

/**
 * The middle of the first or last vertical segment; of the first segment when there is none,
 * and for `start` (a flow leaving sideways, whose vertical segment is far from its chart node).
 */
function anchorOf(points: Point[], which: "first" | "last" | "start"): Point {
  const vertical: Array<[Point, Point]> = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b && a.x === b.x && a.y !== b.y) vertical.push([a, b]);
  }
  const segment =
    which === "start" ? undefined : which === "first" ? vertical[0] : vertical[vertical.length - 1];
  const [a, b] = segment ?? [points[0] ?? { x: 0, y: 0 }, points[1] ?? last(points)];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function edge(
  stub: Stub,
  to: string,
  rest: Point[],
  opts: { anchor?: "first" | "last" | "start" } = {},
): ChartEdge {
  const points: Point[] = [];
  for (const point of [...stub.points, ...rest]) {
    const before = points[points.length - 1];
    if (!before || before.x !== point.x || before.y !== point.y) points.push({ ...point });
  }
  const made: ChartEdge = {
    id: `${stub.from}>${to}${stub.label ? `:${stub.label}` : ""}`,
    from: stub.from,
    to,
    points,
    place: stub.place,
    anchor: anchorOf(points, opts.anchor ?? "last"),
  };
  if (stub.label) made.label = stub.label;
  return made;
}

class Builder {
  /** Loops around the statement being placed: a jump outside every loop is an ordinary box. */
  private depth = 0;

  constructor(
    private readonly program: Program,
    private readonly measure: Measure,
  ) {}

  node(
    id: string,
    owner: NodeId | null,
    role: ChartNode["role"],
    shape: Shape,
    unplaced: NotationSpan[],
    y: number,
  ): ChartNode {
    const measured = (span: NotationSpan) => (span === BREAK ? 0 : this.measure(span));
    const whole = unplaced.reduce((sum, span) => sum + measured(span), 0);
    const lines = shape === "diamond" && whole > WRAP ? inTwo(unplaced, measured) : [unplaced];
    const lineWidths = lines.map((line) => line.reduce((sum, span) => sum + measured(span), 0));
    const width = Math.max(0, ...lineWidths);
    const padded =
      shape === "diamond"
        ? Math.max(120, width * 1.4 + 56)
        : shape === "terminal"
          ? Math.max(72, width + 40)
          : shape === "junction"
            ? 0
            : Math.max(96, width + 32);
    const w = 2 * Math.ceil(padded / 2);
    const generated = role === "init" || role === "check" || role === "update";
    const spans = lines.flatMap((line, index) => {
      let dx = (w - (lineWidths[index] ?? 0)) / 2;
      const dy = (index - (lines.length - 1) / 2) * LINE;
      return line.map((span) => {
        const placed: PlacedSpan = { ...span, dx, dy, w: measured(span) };
        dx += placed.w;
        return placed;
      });
    });
    const text = joinSpans(unplaced);
    return { id, owner, role, shape, generated, text, spans, x: -w / 2, y, w, h: HEIGHT[shape] };
  }

  /**
   * A statement's chart node: its caption alone when it has one and holds no draft,
   * with `spans`, what it draws without its caption, as the title; otherwise `spans`.
   */
  private captioned(
    stmt: Stmt,
    id: string,
    role: ChartNode["role"],
    shape: Shape,
    spans: NotationSpan[],
    y: number,
  ): ChartNode {
    if (stmt.caption === undefined || holdsDraft(stmt)) {
      return this.node(id, stmt.id, role, shape, spans, y);
    }
    const node = this.node(id, stmt.id, role, shape, [{ text: stmt.caption }], y);
    return { ...node, title: joinSpans(spans) };
  }

  /** Places `region` with its entry at `at` and joins `stub` to it; returns what flows out. */
  private enter(stub: Stub, region: Frag, at: Point, into: Frag, parent: NodeId, slot: RegionSlot) {
    const first: Place = { parent, slot, index: 0 };
    if (region.entry === null) return { ...stub, place: first };
    shift(region, at.x, at.y);
    into.nodes.push(...region.nodes);
    into.edges.push(edge({ ...stub, place: first }, region.entry, [at]), ...region.edges);
    return region.out;
  }

  region(stmts: Stmt[], parent: RegionParent, slot: RegionSlot): Frag {
    const frag = emptyFrag();
    let y = 0;
    let out: Stub | null = null;
    for (const [index, stmt] of stmts.entries()) {
      const child = shift(this.statement(stmt), 0, y);
      if (out && child.entry !== null) {
        frag.edges.push(
          edge({ ...out, place: { parent, slot, index } }, child.entry, [{ x: 0, y }]),
        );
      }
      frag.entry ??= child.entry;
      frag.nodes.push(...child.nodes);
      frag.edges.push(...child.edges);
      // Nothing falls out of a Return, so its edge to End carries the place after it.
      if (child.out === null && child.escapes.length === 1 && child.nodes.length === 1) {
        const [escape] = child.escapes;
        if (escape) escape.place = { parent, slot, index: index + 1 };
      }
      frag.escapes.push(...child.escapes);
      frag.left = Math.max(frag.left, child.left);
      frag.right = Math.max(frag.right, child.right);
      frag.height = y + child.height;
      out = child.out;
      y += child.height + GAP_Y;
    }
    frag.out = out && { ...out, place: { parent, slot, index: stmts.length } };
    for (const escape of frag.escapes)
      escape.points.push({ x: frag.right, y: last(escape.points).y });
    return frag;
  }

  private regionOf(stmt: Stmt, slot: string): Frag {
    const stmts = regionsOf(stmt).find((region) => region.slot === slot)?.stmts ?? [];
    return this.region(stmts, stmt.id, slot as RegionSlot);
  }

  statement(stmt: Stmt): Frag {
    const def = getBlockDef(keyOf(stmt));
    const chart = def.chart;
    if (!chart) return this.box(stmt, def.requires === "function" ? "end" : null);
    if ("jump" in chart) return this.box(stmt, this.depth > 0 ? chart.jump : null);
    if ("branch" in chart) return this.branch(stmt, chart.branch);
    return "checked" in chart
      ? this.loop(stmt, chart.checked.body, false)
      : this.loop(stmt, chart.counted.body, true);
  }

  /** A box; `leaves` names where its edge goes when it is not to the next chart node. */
  private box(stmt: Stmt, leaves: Leave | null): Frag {
    const spans = notationSpans(stmt, this.program);
    const node = this.captioned(stmt, stmt.id, "stmt", "box", spans, 0);
    const half = node.w / 2;
    return {
      left: half,
      right: half,
      height: node.h,
      nodes: [node],
      edges: [],
      entry: node.id,
      out: leaves ? null : { from: node.id, points: [{ x: 0, y: node.h }], place: null },
      // A Return's or a jump's edge leaves by the chart node's right side.
      escapes: leaves
        ? [{ from: node.id, points: [{ x: half, y: node.h / 2 }], place: null, to: leaves }]
        : [],
    };
  }

  private diamond(stmt: Stmt, y: number): ChartNode {
    return this.captioned(stmt, stmt.id, "stmt", "diamond", questionSpans(stmt, this.program), y);
  }

  /** `branch`: Yes to the right, No below on the axis, both merging below. */
  private branch(stmt: Stmt, slots: { yes: string; no: string }): Frag {
    const d = this.diamond(stmt, 0);
    const no = this.regionOf(stmt, slots.no);
    const yes = this.regionOf(stmt, slots.yes);
    const frag: Frag = {
      left: Math.max(d.w / 2, no.left),
      right: 0,
      height: 0,
      nodes: [d],
      edges: [],
      entry: d.id,
      out: null,
      escapes: [],
    };
    const top = d.h + GAP_Y;
    // The No column's flows to End run down a lane between the two columns.
    const lane = Math.max(d.w / 2, no.right) + LANE / 2;
    const xYes =
      Math.max(d.w / 2, no.right + (no.escapes.length > 0 ? LANE : 0)) + GAP_X + yes.left;
    const yMerge = top + Math.max(no.height, yes.height) + GAP_Y;
    frag.right = xYes + Math.max(yes.right, LANE / 2);

    const noStub: Stub = { from: d.id, label: "no", points: [{ x: 0, y: d.h }], place: null };
    const yesStub: Stub = {
      from: d.id,
      label: "yes",
      points: [
        { x: d.w / 2, y: d.h / 2 },
        { x: xYes, y: d.h / 2 },
      ],
      place: null,
    };
    const noOut = this.enter(noStub, no, { x: 0, y: top }, frag, stmt.id, slots.no as RegionSlot);
    const yesOut = this.enter(
      yesStub,
      yes,
      { x: xYes, y: top },
      frag,
      stmt.id,
      slots.yes as RegionSlot,
    );

    if (noOut || yesOut) {
      const merge = this.node(`${stmt.id}:merge`, stmt.id, "merge", "junction", [], yMerge);
      frag.nodes.push(merge);
      if (noOut) frag.edges.push(edge(noOut, merge.id, [{ x: 0, y: yMerge }]));
      if (yesOut) {
        const down = [
          { x: xYes, y: yMerge },
          { x: 0, y: yMerge },
        ];
        frag.edges.push(edge(yesOut, merge.id, down, { anchor: "first" }));
      }
      frag.out = { from: merge.id, points: [{ x: 0, y: yMerge }], place: null };
    }
    frag.height = yMerge;
    const row = yMerge + LANE / 2;
    for (const escape of no.escapes) {
      const from = last(escape.points);
      escape.points.push({ x: lane, y: from.y }, { x: lane, y: row }, { x: frag.right, y: row });
      frag.height = yMerge + LANE;
    }
    for (const escape of yes.escapes)
      escape.points.push({ x: frag.right, y: last(escape.points).y });
    frag.escapes.push(...no.escapes, ...yes.escapes);
    return frag;
  }

  /**
   * `checked` and `counted`: the loop's top, a junction above the diamond, Yes down into the
   * body, a back edge up the left lane, No down the right lane and on past the loop. A counted
   * loop adds its generated init before the top and its update after the body.
   */
  private loop(stmt: Stmt, slot: string, counted: boolean): Frag {
    const frag = emptyFrag();
    let y = 0;
    let widest = 0;
    if (counted) {
      const init = this.node(
        `${stmt.id}:init`,
        stmt.id,
        "init",
        "box",
        generatedSpans(stmt, "init", this.program),
        0,
      );
      frag.nodes.push(init);
      frag.entry = init.id;
      y = init.h + JOIN;
      widest = init.w / 2;
    }
    const top = this.node(`${stmt.id}:top`, stmt.id, "top", "junction", [], y);
    const yJoin = y;
    frag.nodes.push(top);
    if (counted) {
      const init: Stub = { from: `${stmt.id}:init`, points: [{ x: 0, y: y - JOIN }], place: null };
      frag.edges.push(edge(init, top.id, [{ x: 0, y }]));
    } else frag.entry = top.id;

    y += JOIN;
    const d = counted
      ? this.captioned(
          stmt,
          `${stmt.id}:check`,
          "check",
          "diamond",
          generatedSpans(stmt, "check", this.program),
          y,
        )
      : this.diamond(stmt, y);
    frag.nodes.push(d);
    frag.edges.push(
      edge({ from: top.id, points: [{ x: 0, y: yJoin }], place: null }, d.id, [{ x: 0, y }]),
    );

    this.depth += 1;
    const body = this.regionOf(stmt, slot);
    this.depth -= 1;
    // Jumps reaching this loop are its own: an inner loop has routed those for itself.
    const exits = body.escapes.filter((escape) => escape.to === "exit");
    const nexts = body.escapes.filter((escape) => escape.to === "next");
    const passing = body.escapes.filter((escape) => escape.to !== "exit" && escape.to !== "next");
    const yBody = y + d.h + GAP_Y;
    const yesStub: Stub = { from: d.id, label: "yes", points: [{ x: 0, y: y + d.h }], place: null };
    let out = this.enter(yesStub, body, { x: 0, y: yBody }, frag, stmt.id, slot as RegionSlot);
    let bottom = yBody + body.height;
    let half = d.w / 2;
    let update: ChartNode | null = null;

    if (counted) {
      const yUpdate = body.entry === null ? yBody : bottom + GAP_Y;
      update = this.node(
        `${stmt.id}:update`,
        stmt.id,
        "update",
        "box",
        generatedSpans(stmt, "update", this.program),
        yUpdate,
      );
      frag.nodes.push(update);
      if (out) frag.edges.push(edge(out, update.id, [{ x: 0, y: yUpdate }]));
      out = { from: update.id, points: [{ x: 0, y: yUpdate + update.h }], place: null };
      bottom = yUpdate + update.h;
      half = Math.max(half, update.w / 2);
    }

    const yTurn = bottom + GAP_Y / 2;
    const xBack = -(Math.max(half, body.left) + LANE);
    // A `next` lane runs down inside the `No` lane when the body has a jump to the next pass.
    const xNext = Math.max(half, body.right) + LANE;
    const xNo = nexts.length > 0 ? xNext + LANE : xNext;
    const up = [
      { x: 0, y: yTurn },
      { x: xBack, y: yTurn },
      { x: xBack, y: yJoin },
      { x: 0, y: yJoin },
    ];
    const toLane = (escape: Stub, x: number) => escape.points.push({ x, y: last(escape.points).y });

    if (update) {
      // The next pass of a counted loop starts at its update.
      const yUpdate = update.y + update.h / 2;
      for (const escape of nexts) {
        toLane(escape, xNext);
        frag.edges.push(
          edge(
            escape,
            update.id,
            [
              { x: xNext, y: yUpdate },
              { x: update.w / 2, y: yUpdate },
            ],
            {
              anchor: "start",
            },
          ),
        );
      }
      if (out) frag.edges.push(edge(out, top.id, up, { anchor: "first" }));
    } else if (nexts.length > 0) {
      // The next pass of a checked loop starts where the back edge does.
      const next = this.node(`${stmt.id}:next`, stmt.id, "next", "junction", [], yTurn);
      frag.nodes.push(next);
      for (const escape of nexts) {
        toLane(escape, xNext);
        frag.edges.push(
          edge(
            escape,
            next.id,
            [
              { x: xNext, y: yTurn },
              { x: 0, y: yTurn },
            ],
            { anchor: "start" },
          ),
        );
      }
      if (out) frag.edges.push(edge(out, next.id, [{ x: 0, y: yTurn }]));
      const from: Stub = { from: next.id, points: [{ x: 0, y: yTurn }], place: null };
      frag.edges.push(edge(from, top.id, up.slice(1), { anchor: "first" }));
    } else if (out) {
      frag.edges.push(edge(out, top.id, up, { anchor: "first" }));
    }

    frag.height = yTurn + LANE;
    const no: Stub = {
      from: d.id,
      label: "no",
      points: [
        { x: d.w / 2, y: y + d.h / 2 },
        { x: xNo, y: y + d.h / 2 },
        { x: xNo, y: frag.height },
        { x: 0, y: frag.height },
      ],
      place: null,
    };
    if (exits.length > 0) {
      // `No` and every exit meet below the loop, and what follows starts there.
      const exit = this.node(`${stmt.id}:exit`, stmt.id, "exit", "junction", [], frag.height);
      frag.nodes.push(exit);
      frag.edges.push(edge(no, exit.id, []));
      for (const escape of exits) {
        toLane(escape, xNo);
        const down = [
          { x: xNo, y: frag.height },
          { x: 0, y: frag.height },
        ];
        frag.edges.push(edge(escape, exit.id, down, { anchor: "start" }));
      }
      frag.out = { from: exit.id, points: [{ x: 0, y: frag.height }], place: null };
    } else frag.out = no;
    frag.left = Math.max(-xBack + 4, widest);
    frag.right = Math.max(xNo + 4, widest);
    for (const escape of passing) toLane(escape, frag.right);
    frag.escapes.push(...passing);
    return frag;
  }
}

/**
 * The chart of `main` or of one function, every chart node and edge placed; undefined for a
 * routine that names no function.
 */
export function layout(program: Program, opts: LayoutOptions): ChartLayout | undefined {
  const routine = findRoutine(program, opts.routine);
  if (routine === undefined) return undefined;
  const fn = routine === "main" ? undefined : routine;
  const builder = new Builder(program, opts.measure);
  const frag = emptyFrag();

  const startSpans = fn
    ? filledSpans(CHART_TEXT.functionStart, () => [
        { text: `${fn.name}(${fn.params.join(SEPARATOR)})` },
      ])
    : [{ text: CHART_TEXT.start }];
  const start = builder.node("start", fn ? fn.id : null, "start", "terminal", startSpans, 0);
  frag.nodes.push(start);
  let out: Stub | null = { from: start.id, points: [{ x: 0, y: start.h }], place: null };
  let y = start.h + GAP_Y;
  let half = start.w / 2;

  for (const input of fn ? [] : program.inputs) {
    const spans = inputSpans(input.name, inputValue(opts.inputs, input.name));
    const node = builder.node(`input:${input.name}`, null, "input", "input", spans, y);
    frag.nodes.push(node);
    frag.edges.push(edge(out, node.id, [{ x: 0, y }]));
    out = { from: node.id, points: [{ x: 0, y: y + node.h }], place: null };
    y += node.h + GAP_Y;
    half = Math.max(half, node.w / 2);
  }

  const slot = fn ? "body" : "main";
  const body = builder.region(routineStmts(program, routine), opts.routine, slot);
  const first: Place = { parent: opts.routine, slot, index: 0 };
  if (body.entry === null) out = { ...out, place: first };
  else {
    shift(body, 0, y);
    frag.nodes.push(...body.nodes);
    frag.edges.push(edge({ ...out, place: first }, body.entry, [{ x: 0, y }]), ...body.edges);
    out = body.out;
    y += body.height + GAP_Y;
  }

  const end = builder.node("end", null, "end", "terminal", [{ text: CHART_TEXT.end }], y);
  frag.nodes.push(end);
  if (out) frag.edges.push(edge(out, end.id, [{ x: 0, y }]));
  half = Math.max(half, end.w / 2);

  // Every Return leads to End, down one trunk to the right of the whole chart.
  const left = Math.max(half, body.left);
  let right = Math.max(half, body.right);
  if (body.escapes.length > 0) {
    const trunk = right + LANE;
    const yEnd = y + end.h / 2;
    for (const escape of body.escapes) {
      const into = [
        { x: trunk, y: last(escape.points).y },
        { x: trunk, y: yEnd },
        { x: end.w / 2, y: yEnd },
      ];
      frag.edges.push(edge(escape, end.id, into, { anchor: "start" }));
    }
    right = trunk + 4;
  }

  shift(frag, left, 0);
  return { nodes: frag.nodes, edges: frag.edges, width: left + right, height: y + end.h };
}
