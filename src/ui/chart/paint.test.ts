// The taken path, marks, current chart node, and breakpoint drawn while running.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/blocks/testing";
import { estimatedWidth } from "./layout";
import { currentNode, paint, type RunView } from "./paint";
import { laidOut } from "./testing";

const { bin, for_, if_, num, print, str, v } = ast;

const yes = print(str("zero"));
const branch = if_(bin("==", v("i"), num(0)), [yes], [print(v("i"))]);
const loop = for_("i", num(0), num(3), [branch]);
const after = print(str("done"));
const chart = laidOut(program([loop, after]), {
  routine: "main",
  inputs: {},
  measure: estimatedWidth,
});

const findNodeId = (owner: string, role: string) =>
  chart.nodes.find((node) => node.owner === owner && node.role === role)?.id;

function view(partial: Partial<RunView>): RunView {
  return {
    finished: false,
    activeId: null,
    lastEvent: null,
    taken: {},
    marks: {},
    breakpoint: null,
    ...partial,
  };
}

describe("currentNode", () => {
  it("is a counted loop's init on its enter and its check on a pass", () => {
    const enter = view({ activeId: loop.id, lastEvent: { type: "enter", nodeId: loop.id } });
    expect(currentNode(chart, enter)).toBe(findNodeId(loop.id, "init"));
    const pass = view({ activeId: loop.id, lastEvent: { type: "loop", nodeId: loop.id } });
    expect(currentNode(chart, pass)).toBe(findNodeId(loop.id, "check"));
  });

  it("is the statement's own chart node otherwise, and none before the first step", () => {
    expect(currentNode(chart, view({ activeId: branch.id }))).toBe(branch.id);
    expect(currentNode(chart, view({}))).toBeNull();
  });
});

describe("paint", () => {
  it("draws the path of the current pass, a labeled edge by its diamond's mark", () => {
    const p = paint(
      chart,
      view({
        taken: { [loop.id]: true, [branch.id]: true, [yes.id]: true },
        marks: { [loop.id]: true, [branch.id]: true },
      }),
    );
    expect(p.takenNodes.has("start")).toBe(true);
    expect(p.takenNodes.has(branch.id)).toBe(true);
    expect(p.takenNodes.has("end")).toBe(false);
    const labeled = chart.edges.filter((edge) => edge.from === branch.id);
    const taken = labeled.filter((edge) => p.takenEdges.has(edge.id)).map((edge) => edge.label);
    expect(taken).toEqual(["yes"]);
    expect(p.marks.get(branch.id)).toBe(true);
    expect(p.marks.get(findNodeId(loop.id, "check") ?? "")).toBe(true);
  });

  it("takes a loop's No edge to the next statement once the loop's mark is cleared", () => {
    const p = paint(
      chart,
      view({ activeId: after.id, taken: { [loop.id]: true, [after.id]: true } }),
    );
    const no = chart.edges.find(
      (edge) => edge.from === findNodeId(loop.id, "check") && edge.label === "no",
    );
    expect(no && p.takenEdges.has(no.id)).toBe(true);
  });

  it("takes a loop's No edge into a following loop's first chart node once control is there", () => {
    const first = for_("i", num(0), num(2), [print(v("i"))]);
    const second = for_("j", num(0), num(2), [print(v("j"))]);
    const twice = laidOut(program([first, second]), {
      routine: "main",
      inputs: {},
      measure: estimatedWidth,
    });
    const check = twice.nodes.find((node) => node.owner === first.id && node.role === "check");
    const no = twice.edges.find((edge) => edge.from === check?.id && edge.label === "no");
    const at = (activeId: string) =>
      paint(twice, view({ activeId, taken: { [first.id]: true, [second.id]: true } }));
    expect(no && at(second.id).takenEdges.has(no.id)).toBe(true);
    // Before its first check the loop is current and has no mark: its No edge is not taken.
    expect(no && at(first.id).takenEdges.has(no.id)).toBe(false);
  });

  it("after a loop with a break, the No edge is taken unless the break reached the exit", () => {
    const stop = ast.brk();
    const jumpy = for_("i", num(0), num(3), [if_(bin("==", v("i"), num(1)), [stop])]);
    const next = print(str("done"));
    const drawn = laidOut(program([jumpy, next]), {
      routine: "main",
      inputs: {},
      measure: estimatedWidth,
    });
    const check = drawn.nodes.find((node) => node.owner === jumpy.id && node.role === "check");
    const no = drawn.edges.find((edge) => edge.from === check?.id && edge.label === "no");
    const jump = drawn.edges.find((edge) => edge.from === stop.id);
    const at = (taken: Record<string, true>) => paint(drawn, view({ activeId: next.id, taken }));
    const ended = at({ [jumpy.id]: true, [next.id]: true });
    expect(no && ended.takenEdges.has(no.id)).toBe(true);
    const broke = at({ [jumpy.id]: true, [stop.id]: true, [next.id]: true });
    expect(no && broke.takenEdges.has(no.id)).toBe(false);
    expect(jump && broke.takenEdges.has(jump.id)).toBe(true);
  });

  it("marks the breakpoint on a loop's check and End once the run has ended", () => {
    const p = paint(chart, view({ breakpoint: loop.id, finished: true }));
    expect(p.breakpoint).toBe(findNodeId(loop.id, "check"));
    expect(p.takenNodes.has("end")).toBe(true);
  });
});
