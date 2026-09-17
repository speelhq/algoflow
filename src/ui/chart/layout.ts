// U-30..U-33, P-02: the chart's layout, computed and never placed by hand. Every statement
// becomes a fragment around a vertical axis with a left and a right extent; a region stacks
// its fragments on one axis, a branch puts its Yes column to the right of its whole No
// column, and a loop keeps a lane on its left for the back edge and one on its right for the
// No edge. A fragment's lanes lie inside its own extents, so nested lanes never collide.
// Reads `def.chart`, `def.requires`, and the regions of a statement, never a kind (N-01).
import { t } from "@/i18n/t";
import type { Data, Id, NodeId, Place, Program, Stmt } from "@/lang/types";
import { regionsOf } from "@/lang/walk";
import { getNode, keyOf } from "@/nodes";
import { capitalise, conditionOf, dataText, generatedText, questionText, sentence } from "./text";

export type Point = { x: number; y: number };
export type Shape = "terminal" | "input" | "box" | "diamond" | "junction";
export type ChartNode = {
  /** A statement's id, `<id>:init|check|step|junction|merge`, `start`, `end`, or `input:<name>`. */
  id: string;
  /** U-33, U-39: the statement a click selects and a step highlights; null for terminals and inputs. */
  owner: NodeId | null;
  role: "start" | "end" | "input" | "stmt" | "init" | "check" | "step" | "junction" | "merge";
  shape: Shape;
  /** U-33: drawn grey, not selectable on its own. */
  generated: boolean;
  text: string;
  /** Top-left corner; a junction is a point (`w = h = 0`). */
  x: number;
  y: number;
  w: number;
  h: number;
};
export type ChartEdge = {
  /** `<from>><to>`, with `:<label>` when labelled. */
  id: string;
  from: string;
  to: string;
  label?: "yes" | "no";
  /** An orthogonal polyline from the border of `from` to the border of `to`. */
  points: Point[];
  /** U-34: where a block inserted on this edge goes (L-54); null where none can. */
  place: Place | null;
  /** Where the `+` connector and the label sit: the middle of a vertical run of the edge. */
  anchor: Point;
  /** U-33: a loop's return to its junction. */
  back?: boolean;
  /** U-31: a `Return` node's edge to `End`. */
  jump?: boolean;
};
export type ChartLayout = { nodes: ChartNode[]; edges: ChartEdge[]; width: number; height: number };
/** The width of `text` in px as the chart draws it. */
export type Measure = (text: string, shape: Shape) => number;
export type LayoutOptions = {
  /** `main` (default) or a function's id (U-30). */
  chart?: "main" | NodeId;
  /** U-32: the values the Input nodes show; defaults to the program's own. */
  inputs?: Record<Id, Data>;
  measure?: Measure;
};

export const GAP_Y = 36;
export const GAP_X = 32;
export const LANE = 24;
const JOIN = 20; // a junction to the diamond below it
const HEIGHT: Record<Shape, number> = {
  terminal: 36,
  input: 40,
  box: 40,
  diamond: 60,
  junction: 0,
};

const defaultMeasure: Measure = (text) => text.length * 7.2;

/** A flow that still needs its target: the points so far, and the place its edge will carry. */
type Stub = { from: string; label?: "yes" | "no"; points: Point[]; place: Place | null };
type Frag = {
  left: number;
  right: number;
  height: number;
  nodes: ChartNode[];
  edges: ChartEdge[];
  /** The node an incoming edge ends on, at the fragment's (0, 0); null for an empty region. */
  entry: string | null;
  /** Falls through to whatever follows; null when nothing does (a `Return`). */
  out: Stub | null;
  /** Flows that leave for `End`, each ending on the fragment's right boundary. */
  escapes: Stub[];
};
type Slot = Place["slot"];

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

/** The middle of the first or last vertical run; of the first segment when there is none. */
function anchorOf(points: Point[], which: "first" | "last"): Point {
  const runs: Array<[Point, Point]> = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b && a.x === b.x && a.y !== b.y) runs.push([a, b]);
  }
  const run = which === "first" ? runs[0] : runs[runs.length - 1];
  const [a, b] = run ?? [points[0] ?? { x: 0, y: 0 }, points[1] ?? last(points)];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function edge(
  stub: Stub,
  to: string,
  rest: Point[],
  opts: { anchor?: "first" | "last"; back?: boolean; jump?: boolean } = {},
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
  if (opts.back) made.back = true;
  if (opts.jump) made.jump = true;
  return made;
}

class Builder {
  constructor(
    private readonly program: Program,
    private readonly measure: Measure,
  ) {}

  node(
    id: string,
    owner: NodeId | null,
    role: ChartNode["role"],
    shape: Shape,
    text: string,
    y: number,
  ): ChartNode {
    const width = this.measure(text, shape);
    const padded =
      shape === "diamond"
        ? Math.max(120, width * 1.4 + 56)
        : shape === "terminal"
          ? Math.max(72, width + 40)
          : shape === "junction"
            ? 0
            : Math.max(96, width + 32);
    const w = 2 * Math.ceil(padded / 2);
    const generated = role === "init" || role === "check" || role === "step";
    return { id, owner, role, shape, generated, text, x: -w / 2, y, w, h: HEIGHT[shape] };
  }

  /** Places `region` with its entry at `at` and joins `stub` to it; returns what flows out. */
  private enter(stub: Stub, region: Frag, at: Point, into: Frag, parent: NodeId, slot: Slot) {
    const first: Place = { parent, slot, index: 0 };
    if (region.entry === null) return { ...stub, place: first };
    shift(region, at.x, at.y);
    into.nodes.push(...region.nodes);
    into.edges.push(edge({ ...stub, place: first }, region.entry, [at]), ...region.edges);
    return region.out;
  }

  region(stmts: Stmt[], parent: NodeId | "main", slot: Slot): Frag {
    const frag: Frag = {
      left: 0,
      right: 0,
      height: 0,
      nodes: [],
      edges: [],
      entry: null,
      out: null,
      escapes: [],
    };
    let y = 0;
    let flow: Stub | null = null;
    for (const [index, stmt] of stmts.entries()) {
      const child = shift(this.statement(stmt), 0, y);
      if (flow && child.entry !== null) {
        frag.edges.push(
          edge({ ...flow, place: { parent, slot, index } }, child.entry, [{ x: 0, y }]),
        );
      }
      frag.entry ??= child.entry;
      frag.nodes.push(...child.nodes);
      frag.edges.push(...child.edges);
      frag.escapes.push(...child.escapes);
      frag.left = Math.max(frag.left, child.left);
      frag.right = Math.max(frag.right, child.right);
      frag.height = y + child.height;
      flow = child.out;
      y += child.height + GAP_Y;
    }
    frag.out = flow && { ...flow, place: { parent, slot, index: stmts.length } };
    for (const escape of frag.escapes)
      escape.points.push({ x: frag.right, y: last(escape.points).y });
    return frag;
  }

  private regionOf(stmt: Stmt, slot: string): Frag {
    const stmts = regionsOf(stmt).find((region) => region.slot === slot)?.stmts ?? [];
    return this.region(stmts, stmt.id, slot as Slot);
  }

  statement(stmt: Stmt): Frag {
    const def = getNode(keyOf(stmt));
    const chart = def.chart;
    if (!chart) return this.box(stmt, def.requires === "function");
    if ("branch" in chart) return this.branch(stmt, chart.branch);
    return "check" in chart
      ? this.loop(stmt, chart.check, false)
      : this.loop(stmt, chart.counted, true);
  }

  private box(stmt: Stmt, leaves: boolean): Frag {
    const text = capitalise(sentence(stmt, this.program));
    const node = this.node(stmt.id, stmt.id, "stmt", "box", text, 0);
    const half = node.w / 2;
    return {
      left: half,
      right: half,
      height: node.h,
      nodes: [node],
      edges: [],
      entry: node.id,
      out: leaves ? null : { from: node.id, points: [{ x: 0, y: node.h }], place: null },
      // U-31: a Return's edge leads to End, leaving by the node's right side.
      escapes: leaves ? [{ from: node.id, points: [{ x: half, y: node.h / 2 }], place: null }] : [],
    };
  }

  private diamond(stmt: Stmt, y: number): ChartNode {
    const condition = conditionOf(stmt);
    const text = condition ? questionText(condition) : "";
    return this.node(stmt.id, stmt.id, "stmt", "diamond", text, y);
  }

  /** U-33 `branch`: Yes to the right, No below on the axis, both merging below. */
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
    const noOut = this.enter(noStub, no, { x: 0, y: top }, frag, stmt.id, slots.no as Slot);
    const yesOut = this.enter(yesStub, yes, { x: xYes, y: top }, frag, stmt.id, slots.yes as Slot);

    if (noOut || yesOut) {
      const merge = this.node(`${stmt.id}:merge`, stmt.id, "merge", "junction", "", yMerge);
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
   * U-33 `check` and `counted`: a junction above the diamond, Yes down into the body, a back
   * edge up the left lane, No down the right lane and on past the loop. A counted loop adds
   * its generated init before the junction and its step after the body.
   */
  private loop(stmt: Stmt, slot: string, counted: boolean): Frag {
    const frag: Frag = {
      left: 0,
      right: 0,
      height: 0,
      nodes: [],
      edges: [],
      entry: null,
      out: null,
      escapes: [],
    };
    let y = 0;
    let widest = 0;
    if (counted) {
      const init = this.node(
        `${stmt.id}:init`,
        stmt.id,
        "init",
        "box",
        generatedText(stmt, "init"),
        0,
      );
      frag.nodes.push(init);
      frag.entry = init.id;
      y = init.h + JOIN;
      widest = init.w / 2;
    }
    const junction = this.node(`${stmt.id}:junction`, stmt.id, "junction", "junction", "", y);
    const yJoin = y;
    frag.nodes.push(junction);
    if (counted) {
      const init: Stub = { from: `${stmt.id}:init`, points: [{ x: 0, y: y - JOIN }], place: null };
      frag.edges.push(edge(init, junction.id, [{ x: 0, y }]));
    } else frag.entry = junction.id;

    y += JOIN;
    const d = counted
      ? this.node(`${stmt.id}:check`, stmt.id, "check", "diamond", generatedText(stmt, "check"), y)
      : this.diamond(stmt, y);
    frag.nodes.push(d);
    frag.edges.push(
      edge({ from: junction.id, points: [{ x: 0, y: yJoin }], place: null }, d.id, [{ x: 0, y }]),
    );

    const body = this.regionOf(stmt, slot);
    const yBody = y + d.h + GAP_Y;
    const yesStub: Stub = { from: d.id, label: "yes", points: [{ x: 0, y: y + d.h }], place: null };
    let tail = this.enter(yesStub, body, { x: 0, y: yBody }, frag, stmt.id, slot as Slot);
    let bottom = yBody + body.height;
    let half = d.w / 2;

    if (counted) {
      const yStep = body.entry === null ? yBody : bottom + GAP_Y;
      const step = this.node(
        `${stmt.id}:step`,
        stmt.id,
        "step",
        "box",
        generatedText(stmt, "step"),
        yStep,
      );
      frag.nodes.push(step);
      if (tail) frag.edges.push(edge(tail, step.id, [{ x: 0, y: yStep }]));
      tail = { from: step.id, points: [{ x: 0, y: yStep + step.h }], place: null };
      bottom = yStep + step.h;
      half = Math.max(half, step.w / 2);
    }

    const yTurn = bottom + GAP_Y / 2;
    const xBack = -(Math.max(half, body.left) + LANE);
    const xNo = Math.max(half, body.right) + LANE;
    if (tail) {
      const up = [
        { x: 0, y: yTurn },
        { x: xBack, y: yTurn },
        { x: xBack, y: yJoin },
        { x: 0, y: yJoin },
      ];
      frag.edges.push(edge(tail, junction.id, up, { anchor: "first", back: true }));
    }
    frag.height = yTurn + LANE;
    frag.out = {
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
    frag.left = Math.max(-xBack + 4, widest);
    frag.right = Math.max(xNo + 4, widest);
    for (const escape of body.escapes)
      escape.points.push({ x: frag.right, y: last(escape.points).y });
    frag.escapes.push(...body.escapes);
    return frag;
  }
}

/** U-30, U-31: the chart of `main` or of one function, every node and edge placed. */
export function layout(program: Program, opts: LayoutOptions = {}): ChartLayout {
  const builder = new Builder(program, opts.measure ?? defaultMeasure);
  const fn = program.functions.find((candidate) => candidate.id === opts.chart);
  const frag: Frag = {
    left: 0,
    right: 0,
    height: 0,
    nodes: [],
    edges: [],
    entry: null,
    out: null,
    escapes: [],
  };

  const startText = fn
    ? t("chart.startFn", { name: fn.name, params: fn.params.join(", ") })
    : t("chart.start");
  const start = builder.node("start", null, "start", "terminal", startText, 0);
  frag.nodes.push(start);
  let flow: Stub = { from: start.id, points: [{ x: 0, y: start.h }], place: null };
  let y = start.h + GAP_Y;
  let half = start.w / 2;

  for (const input of fn ? [] : program.inputs) {
    const value =
      opts.inputs && Object.hasOwn(opts.inputs, input.name) ? opts.inputs[input.name] : input.value;
    const text = t("chart.input", { name: input.name, value: dataText(value ?? null) });
    const node = builder.node(`input:${input.name}`, null, "input", "input", text, y);
    frag.nodes.push(node);
    frag.edges.push(edge(flow, node.id, [{ x: 0, y }]));
    flow = { from: node.id, points: [{ x: 0, y: y + node.h }], place: null };
    y += node.h + GAP_Y;
    half = Math.max(half, node.w / 2);
  }

  const body = fn
    ? builder.region(fn.body, fn.id, "body")
    : builder.region(program.main, "main", "main");
  const first: Place = { parent: fn ? fn.id : "main", slot: fn ? "body" : "main", index: 0 };
  let tail: Stub | null;
  if (body.entry === null) tail = { ...flow, place: first };
  else {
    shift(body, 0, y);
    frag.nodes.push(...body.nodes);
    frag.edges.push(edge({ ...flow, place: first }, body.entry, [{ x: 0, y }]), ...body.edges);
    tail = body.out;
    y += body.height + GAP_Y;
  }

  const end = builder.node("end", null, "end", "terminal", t("chart.end"), y);
  frag.nodes.push(end);
  if (tail) frag.edges.push(edge(tail, end.id, [{ x: 0, y }]));
  half = Math.max(half, end.w / 2);

  // U-31: every Return leads to End, down one trunk to the right of the whole chart.
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
      frag.edges.push(edge(escape, end.id, into, { jump: true }));
    }
    right = trunk + 4;
  }

  shift(frag, left, 0);
  return { nodes: frag.nodes, edges: frag.edges, width: left + right, height: y + end.h };
}
