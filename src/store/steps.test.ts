// Visible steps (`interpreter.md`, Steps and batches): two writes that exchange their places are
// one `swap`; any other write is its own step, shown with the state from before the event read
// past it.
import { describe, expect, it } from "vitest";
import { ast, program, runAll, tid, withInputs } from "@/blocks/testing";
import type { Data, Program, Stmt } from "@/lang/types";
import { run } from "@/runtime/run";
import type { Done } from "@/runtime/types";
import { stepsOf, type Step } from "./steps";

const { assign, call, item, num, ret, swap, v } = ast;

/** Every step of the run, each read as a step to be shown. */
function stepsThrough(p: Program, inputs: Record<string, Data> = {}): Array<Step | Done> {
  const steps = stepsOf(run(p, inputs, 1));
  const all: Array<Step | Done> = [];
  for (;;) {
    const next = steps.next(true);
    all.push(next);
    if (!("event" in next)) return all;
  }
}

const types = (all: Array<Step | Done>) =>
  all.map((step) => ("event" in step ? step.event.type : step.type));

const runWith = (values: Record<string, Data>, main: Stmt[]) => {
  const made = withInputs(values, main);
  return stepsThrough(made.program, made.inputs);
};

describe("steps (interpreter.md, Steps and batches)", () => {
  it("two writes that exchange their places are one swap step", () => {
    const stmt = swap(item(v("nums"), num(0)), item(v("nums"), num(2)));
    const all = runWith({ nums: [1, 2, 3] }, [stmt]);
    expect(types(all)).toEqual(["enter", "read", "read", "swap", "done"]);
    expect(all[3]).toEqual({
      event: { type: "swap", nodeId: stmt.id, a: { heap: 1, index: 0 }, b: { heap: 1, index: 2 } },
      state: undefined,
    });
  });

  it("a swap of two variables is one step after its enter", () => {
    const all = stepsThrough(
      program([assign("x", num(1)), assign("y", num(2)), swap(v("x"), v("y"))]),
    );
    expect(types(all)).toEqual(["enter", "write", "enter", "write", "enter", "swap", "done"]);
  });

  it("writes whose places are not each other's are each a step", () => {
    const all = runWith({ i: 0, nums: [1, 9] }, [swap(v("i"), item(v("nums"), v("i")))]);
    expect(types(all)).toEqual(["enter", "read", "write", "write", "done"]);
  });

  it("an event between the writes leaves each write a step", () => {
    const places = [
      item(v("nums"), item(v("perm"), num(0))),
      item(v("nums"), item(v("perm"), num(1))),
    ] as const;
    const all = runWith({ nums: [5, 6], perm: [1, 0] }, [swap(...places)]);
    expect(types(all).slice(-4)).toEqual(["write", "read", "write", "done"]);
  });

  it("a write before a call shows the state from before the call pushed its frame", () => {
    const f = { id: tid(), name: "f", params: [], body: [ret(num(2))] };
    const stmt = swap(item(v("nums"), num(0)), item(v("nums"), call("f")));
    const made = withInputs({ nums: [1, 2, 3] }, [stmt], { functions: [f] });
    const all = stepsThrough(made.program, made.inputs);
    const at = types(all).indexOf("write");
    expect(types(all).slice(at)).toEqual(["write", "call", "enter", "return", "write", "done"]);
    const write = all[at] as Step;
    expect(write.state?.frames.map((frame) => frame.fn)).toEqual(["main"]);
    // Every other step is shown with the runner's own state.
    expect(all.filter((step) => "event" in step && step.state !== undefined)).toEqual([write]);
  });

  it("a step not to be shown copies no state, though it reads past the write", () => {
    const made = withInputs({ i: 0, nums: [1, 9] }, [swap(v("i"), item(v("nums"), v("i")))]);
    const steps = stepsOf(run(made.program, made.inputs, 1));
    const shown: Array<Step | Done> = [];
    for (let next = steps.next(false); ; next = steps.next(false)) {
      shown.push(next);
      if (!("event" in next)) break;
    }
    expect(types(shown)).toEqual(["enter", "read", "write", "write", "done"]);
    expect(shown.every((step) => !("state" in step) || step.state === undefined)).toBe(true);
  });

  it("the steps hold every event of the run once, in order", () => {
    const made = withInputs({ i: 0, nums: [1, 9] }, [swap(v("i"), item(v("nums"), v("i")))]);
    const events = runAll(made.program, made.inputs).events;
    const shown = stepsThrough(made.program, made.inputs).flatMap((step) =>
      "event" in step && step.event.type !== "swap" ? [step.event] : [],
    );
    expect(shown).toEqual(events);
  });
});
