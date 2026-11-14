// layout() places every chart node of every challenge solution without overlap; loops and branches
// take their shapes. Synthetic programs cover the nestings no challenge has yet.
import { caseInputs } from "@/challenges/cases";
import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/challenges";
import { removeFunction } from "@/lang/edit";
import type { Program, Routine, Stmt } from "@/lang/types";
import { allStmts, getRoutineDef, bodyRegions, routineStmts } from "@/lang/walk";
import { getBlockDef, registryKey } from "@/blocks/registry";
import { ast, createTestId } from "@/blocks/testing";
import {
  estimatedWidth,
  layout,
  LINE,
  type ChartEdge,
  type ChartLayout,
  type ChartNode,
  type Measure,
} from "./layout";
import { CHART_TEXT } from "./text";
import { getLayout } from "./testing";

const { assign, num, str, bin, v, print, for_, while_, if_, ret, brk, cont, program } = ast;

const wideMeasure: Measure = (span) => span.text.length * 14.4;

const createLessThan = (name: string, n: number) => bin("<", v(name), num(n));
const createIfChain = (depth: number): Stmt =>
  if_(
    createLessThan("x", depth),
    [print(num(depth))],
    depth > 1 ? [createIfChain(depth - 1)] : [print(str("else"))],
  );

const createFunction = (name: string, body: Stmt[]) => ({
  id: createTestId(),
  name,
  params: ["x"],
  body,
});

const SYNTHETIC: Array<[string, Program]> = [
  ["an empty main", program([])],
  ["one statement", program([print(str("hi"))])],
  [
    "a for in a for with an if/else and a statement after the inner loop",
    program([
      for_("i", num(0), num(3), [
        for_("j", num(0), v("i"), [if_(createLessThan("j", 1), [print(v("j"))], [print(v("i"))])]),
        print(str("row")),
      ]),
    ]),
  ],
  [
    "a while in a Yes region with a for in the No region",
    program([
      assign("x", num(0)),
      if_(
        createLessThan("x", 3),
        [while_(createLessThan("x", 3), [assign("x", bin("+", v("x"), num(1)))]), print(v("x"))],
        [for_("k", num(0), num(2), [print(v("k"))])],
      ),
      print(str("after")),
    ]),
  ],
  [
    "every region empty",
    program([
      assign("x", num(0)),
      if_(createLessThan("x", 1), []),
      while_(createLessThan("x", 0), []),
      for_("i", num(0), num(2), []),
    ]),
  ],
  ["an else-if chain five deep", program([assign("x", num(2)), createIfChain(5)])],
  [
    "an if inside a Yes region, and a loop ending a Yes region",
    program([
      assign("x", num(0)),
      if_(createLessThan("x", 5), [
        if_(createLessThan("x", 2), [print(str("small"))]),
        while_(createLessThan("x", 1), []),
      ]),
    ]),
  ],
  [
    "a long sentence three levels deep",
    program([
      for_("i", num(0), num(2), [
        if_(createLessThan("i", 1), [while_(createLessThan("i", 0), [print(str("x".repeat(80)))])]),
      ]),
    ]),
  ],
  [
    "break and continue in a for, with a print after them",
    program([
      for_("i", num(0), num(9), [
        if_(createLessThan("i", 2), [cont()]),
        if_(createLessThan("i", 5), [], [brk()]),
        print(str("go on")),
      ]),
      print(str("after")),
    ]),
  ],
  [
    "break and continue in a while, and a while ending in break",
    program([
      assign("i", num(0)),
      while_(createLessThan("i", 9), [
        assign("i", bin("+", v("i"), num(1))),
        if_(createLessThan("i", 2), [cont()]),
        if_(createLessThan("i", 5), [print(v("i"))], [brk()]),
      ]),
      while_(createLessThan("i", 20), [assign("i", bin("+", v("i"), num(1))), brk()]),
    ]),
  ],
  [
    "a continue and a break in nested loops",
    program([
      for_("i", num(0), num(3), [
        while_(createLessThan("i", 2), [cont()]),
        for_("j", num(0), num(2), [if_(createLessThan("j", 1), [brk()])]),
      ]),
    ]),
  ],
];

const returning = createFunction("find", [
  if_(
    createLessThan("x", 0),
    [for_("i", num(0), v("x"), [if_(createLessThan("i", 2), [ret(v("i"))])])],
    [ret(num(0))],
  ),
  while_(createLessThan("x", 9), [ret(v("x"))]),
  ret(num(-1)),
]);
const bothReturn = createFunction("sign", [
  if_(createLessThan("x", 0), [ret(num(-1))], [ret(num(1))]),
]);

type Case = { name: string; program: Program; routine: Routine };
const CASES: Case[] = [
  ...CHALLENGES.map((challenge) => ({
    name: challenge.id,
    program: challenge.solution,
    routine: "main" as const,
  })),
  ...SYNTHETIC.map(([name, p]) => ({ name, program: p, routine: "main" as const })),
  {
    name: "returns in a loop in an if",
    program: program([], { functions: [returning] }),
    routine: returning.id,
  },
  {
    name: "both regions return",
    program: program([], { functions: [bothReturn] }),
    routine: bothReturn.id,
  },
];

const caseBody = (c: Case): Stmt[] => routineStmts(c.program, getRoutineDef(c.program, c.routine));

const lay = (c: Case, measure: Measure): ChartLayout =>
  getLayout(c.program, {
    routine: c.routine,
    inputs: caseInputs(c.program, 0),
    measure,
  });

/** A Return, or a jump (every jump of these cases is inside a loop): no edge to the next chart node. */
const leaves = (stmt: Stmt): boolean => {
  const def = getBlockDef(registryKey(stmt));
  return def.requires === "function" || (def.chart !== undefined && "jump" in def.chart);
};

/** Something flows out of the bottom of the statement: not a Return or jump, nor a branch whose regions all leave. */
function flows(stmt: Stmt): boolean {
  const form = getBlockDef(registryKey(stmt)).chart;
  if (!form || "jump" in form) return !leaves(stmt);
  if (!("branch" in form)) return true; // a loop's No edge
  return bodyRegions(stmt).some((region) => {
    const final = region.stmts.at(-1);
    return final === undefined || flows(final);
  });
}

const byId = (chart: ChartLayout) => new Map(chart.nodes.map((node) => [node.id, node]));
const center = (node: ChartNode) => node.x + node.w / 2;

function rectsOverlap(a: ChartNode, b: ChartNode, inflate: number): boolean {
  return (
    a.x - inflate < b.x + b.w + inflate &&
    b.x - inflate < a.x + a.w + inflate &&
    a.y - inflate < b.y + b.h + inflate &&
    b.y - inflate < a.y + a.h + inflate
  );
}

/** An axis-parallel segment meets the interior of `node` (a chart node) shrunk by 1 px. */
function crosses(a: { x: number; y: number }, b: { x: number; y: number }, node: ChartNode) {
  if (node.w === 0) return false;
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return x1 > node.x + 1 && x0 < node.x + node.w - 1 && y1 > node.y + 1 && y0 < node.y + node.h - 1;
}

/** A loop's back edges: those into its top from below; the edge from above enters the loop. */
function backEdges(chart: ChartLayout, top: ChartNode): ChartEdge[] {
  const ys = new Map(chart.nodes.map((node) => [node.id, node.y]));
  return chart.edges.filter((edge) => {
    if (edge.to !== top.id) return false;
    const y = ys.get(edge.from);
    if (y === undefined) throw new Error(`no chart node ${edge.from}`);
    return y > top.y;
  });
}

function segments(edge: ChartEdge) {
  return edge.points.slice(1).map((point, i) => [edge.points[i] ?? point, point] as const);
}

describe.each([
  ["an estimated measure", estimatedWidth],
  ["a measure twice as wide", wideMeasure],
] as const)("layout with %s", (_, measure) => {
  it.each(CASES.map((c) => [c.name, c] as const))(
    "%s: every node placed once, inside the chart",
    (_n, c) => {
      const chart = lay(c, measure);
      const nodes = byId(chart);
      expect(nodes.size).toBe(chart.nodes.length);
      expect(chart.nodes[0]?.role).toBe("start");
      expect(chart.nodes.at(-1)?.role).toBe("end");
      for (const stmt of allStmts(caseBody(c))) {
        const form = getBlockDef(registryKey(stmt)).chart;
        const ids =
          form && "counted" in form
            ? ["init", "check", "update"].map((r) => `${stmt.id}:${r}`)
            : [stmt.id];
        for (const id of ids) expect(nodes.get(id)?.owner, id).toBe(stmt.id);
      }
      for (const node of chart.nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x + node.w).toBeLessThanOrEqual(chart.width);
        expect(node.y + node.h).toBeLessThanOrEqual(chart.height);
      }
      for (const edge of chart.edges) {
        for (const point of [...edge.points, edge.anchor]) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(chart.width);
          expect(point.y).toBeLessThanOrEqual(chart.height);
        }
      }
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))("%s: no two nodes overlap", (_n, c) => {
    const drawn = lay(c, measure).nodes.filter((node) => node.w > 0);
    for (const [i, a] of drawn.entries()) {
      for (const b of drawn.slice(i + 1))
        expect(rectsOverlap(a, b, 4), `${a.id} / ${b.id}`).toBe(false);
    }
  });

  it.each(CASES.map((c) => [c.name, c] as const))(
    "%s: edges are orthogonal, join their nodes, and cross no other node",
    (_n, c) => {
      const chart = lay(c, measure);
      const nodes = byId(chart);
      expect(new Set(chart.edges.map((edge) => edge.id)).size).toBe(chart.edges.length);
      for (const edge of chart.edges) {
        const from = nodes.get(edge.from);
        const to = nodes.get(edge.to);
        expect(from && to, edge.id).toBeTruthy();
        expect(edge.points.length).toBeGreaterThanOrEqual(2);
        for (const [a, b] of segments(edge)) {
          expect(a.x === b.x || a.y === b.y, edge.id).toBe(true);
          for (const node of chart.nodes) {
            if (node.id !== edge.from && node.id !== edge.to) {
              expect(crosses(a, b, node), `${edge.id} through ${node.id}`).toBe(false);
            }
          }
        }
        for (const node of chart.nodes) {
          expect(crosses(edge.anchor, edge.anchor, node), `anchor of ${edge.id}`).toBe(false);
        }
        const [first, final] = [edge.points[0], edge.points.at(-1)];
        if (from && first)
          expect(isOnBorder(first, from), `${edge.id} leaves ${from.id}`).toBe(true);
        if (to && final) expect(isOnBorder(final, to), `${edge.id} reaches ${to.id}`).toBe(true);
      }
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))(
    "%s: every node is reached from Start",
    (_n, c) => {
      const chart = lay(c, measure);
      const reached = new Set(["start"]);
      for (let grew = true; grew;) {
        grew = false;
        for (const edge of chart.edges) {
          if (reached.has(edge.from) && !reached.has(edge.to)) {
            reached.add(edge.to);
            grew = true;
          }
        }
      }
      const dead = new Set(["returns in a loop in an if"]); // the statements after a loop that always returns
      if (!dead.has(c.name))
        expect(chart.nodes.filter((node) => !reached.has(node.id))).toEqual([]);
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))(
    "%s: branches and loops take their shapes",
    (_n, c) => {
      const chart = lay(c, measure);
      const nodes = byId(chart);
      const labeledEdges = (id: string, label: "yes" | "no") =>
        chart.edges.filter((edge) => edge.from === id && edge.label === label);
      for (const stmt of allStmts(caseBody(c))) {
        const form = getBlockDef(registryKey(stmt)).chart;
        if (!form || "jump" in form) {
          expect(nodes.get(stmt.id)?.shape).toBe("box");
          continue;
        }
        const inside = bodyRegions(stmt).flatMap((region) => [...allStmts(region.stmts)]);
        const under = chart.nodes.filter(
          (node) => node.owner !== null && inside.some((s) => s.id === node.owner),
        );
        if ("branch" in form) {
          const d = nodes.get(stmt.id);
          const [yes] = labeledEdges(stmt.id, "yes");
          const [no] = labeledEdges(stmt.id, "no");
          if (!d || !yes || !no) throw new Error(`branch ${stmt.id}`);
          expect(d.shape).toBe("diamond");
          expect(yes.points[0]).toEqual({ x: d.x + d.w, y: d.y + d.h / 2 }); // Yes leaves by the right vertex
          expect(no.points[0]).toEqual({ x: center(d), y: d.y + d.h }); // No by the bottom vertex
          const yesTo = nodes.get(yes.to);
          const noTo = nodes.get(no.to);
          if (yesTo?.role !== "merge") expect(center(yesTo ?? d)).toBeGreaterThan(d.x + d.w);
          if (noTo?.role !== "merge") expect(center(noTo ?? d)).toBe(center(d));
          const merge = nodes.get(`${stmt.id}:merge`);
          if (merge) {
            expect(center(merge)).toBe(center(d));
            for (const node of under) expect(node.y + node.h).toBeLessThan(merge.y);
            const bare =
              bodyRegions(stmt).find((region) => region.slot === form.branch.no)?.stmts.length ===
              0;
            if (bare)
              expect(no).toMatchObject({
                to: merge.id,
                points: [no.points[0], { x: center(d), y: merge.y }],
              });
          }
          continue;
        }
        const counted = "counted" in form;
        const d = nodes.get(counted ? `${stmt.id}:check` : stmt.id);
        const top = nodes.get(`${stmt.id}:top`);
        if (!d || !top) throw new Error(`loop ${stmt.id}`);
        expect(d.shape).toBe("diamond");
        expect(center(top)).toBe(center(d));
        expect(top.y).toBeLessThan(d.y);
        const [yes] = labeledEdges(d.id, "yes");
        const [no] = labeledEdges(d.id, "no");
        if (!yes || !no) throw new Error(`loop ${stmt.id} edges`);
        expect(yes.points[0]).toEqual({ x: center(d), y: d.y + d.h }); // Yes leads down into the body
        expect(no.points[0]).toEqual({ x: d.x + d.w, y: d.y + d.h / 2 }); // No leaves to the right
        const bottom = Math.max(d.y + d.h, ...under.map((node) => node.y + node.h));
        expect(Math.max(...no.points.map((point) => point.y))).toBeGreaterThan(bottom);
        const backs = backEdges(chart, top);
        expect(backs.length).toBeLessThanOrEqual(1);
        for (const back of backs) {
          const lane = Math.min(...back.points.map((point) => point.x));
          for (const node of [d, ...under]) expect(lane).toBeLessThan(node.x);
          expect(back.points.at(-1)).toEqual({ x: center(top), y: top.y });
        }
        if (counted) {
          const init = nodes.get(`${stmt.id}:init`);
          const update = nodes.get(`${stmt.id}:update`);
          if (!init || !update) throw new Error(`counted ${stmt.id}`);
          expect([init.generated, d.generated, update.generated]).toEqual([true, true, true]);
          expect([center(init), center(update)]).toEqual([center(d), center(d)]);
          expect(init.y + init.h).toBeLessThan(top.y);
          for (const node of under) expect(node.y + node.h).toBeLessThan(update.y);
          expect(backs.map((edge) => edge.from)).toEqual([update.id]);
        }
        const next = nodes.get(`${stmt.id}:next`);
        if (next) expect(backs.map((edge) => edge.from)).toEqual([next.id]);
      }
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))(
    "%s: each region offers the places 0..n once",
    (_n, c) => {
      const chart = lay(c, measure);
      const count = new Map<string, number>();
      for (const edge of chart.edges) {
        if (!edge.place) continue;
        const key = `${edge.place.parent}/${edge.place.slot}/${edge.place.index}`;
        count.set(key, (count.get(key) ?? 0) + 1);
      }
      const expectRegion = (parent: string, slot: string, stmts: Stmt[]) => {
        for (let index = 0; index <= stmts.length; index += 1) {
          // A Return's edge to End carries the place after it; after a branch whose regions all
          // return nothing flows on, so no edge is there to carry one.
          const before = stmts[index - 1];
          const offered = before === undefined || flows(before) || leaves(before);
          expect(count.get(`${parent}/${slot}/${index}`), `${parent}/${slot}/${index}`).toBe(
            offered ? 1 : undefined,
          );
        }
      };
      expectRegion(c.routine, c.routine === "main" ? "main" : "body", caseBody(c));
      for (const stmt of allStmts(caseBody(c))) {
        for (const region of bodyRegions(stmt)) expectRegion(stmt.id, region.slot, region.stmts);
      }
    },
  );

  it.each(CASES.map((c) => [c.name, c] as const))("%s: deterministic", (_n, c) => {
    expect(lay(c, measure)).toEqual(lay({ ...c, program: structuredClone(c.program) }, measure));
  });
});

function isOnBorder(point: { x: number; y: number }, node: ChartNode): boolean {
  if (node.w === 0) return point.x === node.x && point.y === node.y;
  const onX = point.x === node.x || point.x === node.x + node.w;
  const onY = point.y === node.y || point.y === node.y + node.h;
  const inX = point.x >= node.x && point.x <= node.x + node.w;
  const inY = point.y >= node.y && point.y <= node.y + node.h;
  return (onX && inY) || (onY && inX);
}

describe("layout of jumps", () => {
  const edgesFrom = (chart: ChartLayout, id: string) =>
    chart.edges.filter((edge) => edge.from === id);

  it("in a for, break leads past the loop and continue to its update", () => {
    const stop = brk();
    const skip = cont();
    const loop = for_("i", num(0), num(9), [if_(createLessThan("i", 2), [skip], [stop])]);
    const after = print(str("after"));
    const chart = getLayout(program([loop, after]), {
      routine: "main",
      inputs: {},
      measure: estimatedWidth,
    });
    expect(edgesFrom(chart, stop.id).map((edge) => edge.to)).toEqual([`${loop.id}:exit`]);
    expect(edgesFrom(chart, skip.id).map((edge) => edge.to)).toEqual([`${loop.id}:update`]);
    const no = chart.edges.find((edge) => edge.from === `${loop.id}:check` && edge.label === "no");
    expect(no?.to).toBe(`${loop.id}:exit`);
    expect(edgesFrom(chart, `${loop.id}:exit`)).toMatchObject([
      { to: after.id, place: { parent: "main", slot: "main", index: 1 } },
    ]);
  });

  it("in a while, continue meets the back edge and break leads past the loop", () => {
    const stop = brk();
    const skip = cont();
    const loop = while_(createLessThan("i", 9), [if_(createLessThan("i", 2), [skip]), stop]);
    const chart = getLayout(program([assign("i", num(0)), loop]), {
      routine: "main",
      inputs: {},
      measure: estimatedWidth,
    });
    expect(edgesFrom(chart, skip.id).map((edge) => edge.to)).toEqual([`${loop.id}:next`]);
    expect(edgesFrom(chart, stop.id)).toMatchObject([
      { to: `${loop.id}:exit`, place: { parent: loop.id, slot: "body", index: 2 } },
    ]);
    const top = chart.nodes.find((node) => node.id === `${loop.id}:top`);
    if (!top) throw new Error(`no top of ${loop.id}`);
    expect(backEdges(chart, top).map((edge) => edge.from)).toEqual([`${loop.id}:next`]);
  });

  it("a jump outside every loop is an ordinary box with an edge to the next chart node", () => {
    const stop = brk();
    const after = print(num(1));
    const chart = getLayout(program([stop, after]), {
      routine: "main",
      inputs: {},
      measure: estimatedWidth,
    });
    expect(edgesFrom(chart, stop.id).map((edge) => edge.to)).toEqual([after.id]);
  });
});

describe("layout texts", () => {
  it("main: Start, one Input chart node per input with the chosen values, the statements, End", () => {
    const sum = CHALLENGES.find((challenge) => challenge.id === "sum-to-n");
    if (!sum) throw new Error("sum-to-n missing");
    const chart = getLayout(sum.solution, {
      routine: "main",
      inputs: { n: 0 },
      measure: estimatedWidth,
    });
    expect(chart.nodes.slice(0, 2).map((node) => node.text)).toEqual(["Start", "Input n ← 0"]);
    expect(
      getLayout(sum.solution, {
        routine: "main",
        inputs: caseInputs(sum.solution, 0),
        measure: estimatedWidth,
      }).nodes[1]?.text,
    ).toBe("Input n ← 10");
    expect(chart.nodes.at(-1)?.text).toBe("End");
    const texts = chart.nodes.filter((node) => node.generated).map((node) => node.text);
    expect(texts).toEqual(["i ← 1", "i < n + 1?", "i ← i + 1"]);
    // Every statement in the notation, the first value of `total` as every later one.
    const drawn = chart.nodes.slice(2, -1).filter((node) => node.shape !== "junction");
    expect(drawn.map((node) => node.text)).toEqual([
      "total ← 0",
      "i ← 1",
      "i < n + 1?",
      "total ← total + i",
      "i ← i + 1",
    ]);
  });

  it("a diamond asks its condition; a function chart starts with its signature and has no inputs", () => {
    const found = ret(v("x"));
    const fallback = ret(num(0));
    const check = if_(bin("==", bin("%", v("x"), num(15)), num(0)), [found]);
    const f = createFunction("f", [check, fallback]);
    const chart = getLayout(
      program([], { functions: [f], inputs: [{ name: "n", kind: "number" }] }),
      {
        routine: f.id,
        inputs: {},
        measure: estimatedWidth,
      },
    );
    expect(chart.nodes[0]?.text).toBe("Start f(x)");
    expect(chart.nodes.some((node) => node.role === "input")).toBe(false);
    expect(chart.nodes.find((node) => node.id === check.id)?.text).toBe("x % 15 == 0?");
    const returns = chart.edges.filter((edge) => [found.id, fallback.id].includes(edge.from));
    expect(returns.map((edge) => edge.to)).toEqual(["end", "end"]); // a Return leads to End
  });

  it("gives a function chart's Start its function as owner, and main's terminals none", () => {
    const f = createFunction("f", [ret(v("x"))]);
    const p = program([print(num(1))], { functions: [f] });
    const opts = { inputs: {}, measure: estimatedWidth };
    const owners = (routine: Routine) =>
      getLayout(p, { routine, ...opts })
        .nodes.filter((node) => node.shape === "terminal")
        .map((node) => [node.role, node.owner]);
    expect(owners(f.id)).toEqual([
      ["start", f.id],
      ["end", null],
    ]);
    expect(owners("main")).toEqual([
      ["start", null],
      ["end", null],
    ]);
  });

  it("gives no chart for a routine that names no function, rather than main's", () => {
    const f = createFunction("f", [ret(num(0))]);
    const p = program([print(num(1))], { functions: [f] });
    const opts = { routine: f.id, inputs: {}, measure: estimatedWidth };
    expect(layout(p, opts)).toBeDefined();
    expect(layout(removeFunction(p, f.id), opts)).toBeUndefined();
  });

  it("a block with a caption shows it alone, with what it would draw otherwise as the title", () => {
    const captioned = { ...print(v("x")), caption: "Show x" };
    const unfinished = { ...print(ast.empty()), caption: "Show y" };
    const loop = { ...for_("i", num(0), num(3), []), caption: "Three times" };
    const check = { ...if_(bin("<", v("x"), num(2)), []), caption: "Small?" };
    const chart = getLayout(program([assign("x", num(1)), captioned, unfinished, loop, check]), {
      routine: "main",
      inputs: {},
      measure: estimatedWidth,
    });
    const node = (id: string) => chart.nodes.find((n) => n.id === id);
    expect(node(captioned.id)).toMatchObject({ text: "Show x", title: "print(x)" });
    expect(node(unfinished.id)).toMatchObject({ text: "print(values)" });
    expect(node(unfinished.id)?.title).toBeUndefined();
    expect(node(`${loop.id}:check`)).toMatchObject({ text: "Three times", title: "i < 3?" });
    expect(node(`${loop.id}:init`)?.text).toBe("i ← 0");
    const startless = { ...for_("k", ast.empty(), num(3), []), caption: "Counting" };
    const unfinishedLoop = getLayout(program([startless]), {
      routine: "main",
      inputs: {},
      measure: estimatedWidth,
    });
    expect(unfinishedLoop.nodes.find((n) => n.id === `${startless.id}:check`)?.text).toBe("k < 3?");
    expect(node(check.id)).toMatchObject({ text: "Small?", title: "x < 2?" });
  });

  it("a long diamond's text is drawn on two lines, split at a space between words", () => {
    const measure: Measure = (span) => span.text.length * 7;
    const createDivisibleCheck = (by: number) => bin("==", bin("%", v("i"), num(by)), num(0));
    const check = if_(bin("and", createDivisibleCheck(15), bin("<", v("i"), ast.empty())), []);
    const short = if_(createDivisibleCheck(15), []);
    const chart = getLayout(program([assign("i", num(1)), check, short]), {
      routine: "main",
      inputs: {},
      measure,
    });
    const lines = (id: string) => {
      const spans = chart.nodes.find((n) => n.id === id)?.spans ?? [];
      return [-LINE / 2, LINE / 2].map((dy) =>
        spans
          .filter((span) => span.dy === dy)
          .map((span) => span.text)
          .join("")
          .trimEnd(),
      );
    };
    expect(chart.nodes.find((n) => n.id === check.id)?.text).toBe("i % 15 == 0 and i < value?");
    expect(lines(check.id)).toEqual(["i % 15 == 0", "and i < value?"]);
    const one = chart.nodes.find((n) => n.id === short.id)?.spans ?? [];
    expect(new Set(one.map((span) => span.dy))).toEqual(new Set([0]));
  });

  it("a variable's span is measured bold", () => {
    const measure: Measure = (span) => span.text.length * (span.variable ? 10 : 5);
    const shown = print(v("abc"));
    const chart = getLayout(program([shown]), { routine: "main", inputs: {}, measure });
    const spans = chart.nodes.find((n) => n.id === shown.id)?.spans ?? [];
    expect(spans.map((span) => [span.text, span.w, span.variable])).toEqual([
      ["print(", 30, undefined],
      ["abc", 30, true],
      [")", 5, undefined],
    ]);
  });

  it("every chart node's text is the chart's own or the learner's, none from a catalog (chart.md, Shapes)", () => {
    const named = { ...print(v("n")), caption: "Show it" };
    const chart = getLayout(program([named, if_(bin("<", v("n"), num(3)), [])]), {
      routine: "main",
      inputs: {},
      measure: estimatedWidth,
    });
    expect(chart.nodes.filter((node) => node.text !== "").map((node) => node.text)).toEqual([
      CHART_TEXT.start,
      "Show it",
      "n < 3?",
      CHART_TEXT.end,
    ]);
  });

  it("an empty main offers its one connector between Start and End", () => {
    const chart = getLayout(program([]), { routine: "main", inputs: {}, measure: estimatedWidth });
    expect(chart.edges).toHaveLength(1);
    expect(chart.edges[0]).toMatchObject({
      from: "start",
      to: "end",
      place: { parent: "main", slot: "main", index: 0 },
    });
  });
});
