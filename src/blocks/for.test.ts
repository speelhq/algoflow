import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { forStmt } from "./for";
import { ast, eventTypes, notation, program, runAll, varData, withInputs } from "./testing";

const { for_, forTo, assign, num, float, str, bin, v, item, list, brk, cont, if_ } = ast;
const lines = (main: Parameters<typeof program>[0]) =>
  emit(program(main), {}).code.trimEnd().split("\n");

describe("for (blocks.md)", () => {
  it("`range(<stop>)` when start is num 0, else `range(<start>, <stop>)`", () => {
    expect(lines([for_("i", num(0), v("n"), [assign("x", v("i"))])])).toEqual([
      "for i in range(n):",
      "    x = i",
    ]);
    expect(lines([for_("i", num(1), bin("+", v("n"), num(1)), [])])).toEqual([
      "for i in range(1, n + 1):",
      "    pass",
    ]);
    expect(lines([for_("i", float(0), num(3), [])])[0]).toBe("for i in range(0.0, 3):");
    // The variable is a target, written as the expression it is.
    expect(lines([forTo(item(v("nums"), num(0)), num(0), num(3), [])])[0]).toBe(
      "for nums[0] in range(3):",
    );
  });

  it("a new for's variable is an empty slot, and it starts at 0", () => {
    expect(forStmt.create()).toMatchObject({
      type: "for",
      var: { type: "empty" },
      start: { type: "num", value: 0, raw: "0" },
      stop: { type: "empty" },
      body: [],
    });
    expect(forStmt.slots[0]).toEqual({ name: "var", role: "target", binds: true });
  });

  it("one loop event per iteration carrying the variable's place and the value", () => {
    const stmt = for_("i", num(0), num(2), [assign("x", v("i"))]);
    const result = runAll(program([stmt]));
    expect(eventTypes(result.events)).toEqual([
      "enter",
      "loop",
      "enter",
      "write",
      "loop",
      "enter",
      "write",
    ]);
    expect(result.events[1]).toEqual({
      type: "loop",
      nodeId: stmt.id,
      ref: { var: "i" },
      value: { t: "int", v: 0 },
    });
    expect(varData(result, "x")).toBe(1);
    expect(result.done).toEqual({ type: "done", events: 7, loops: 2 });
  });

  it("bounds are evaluated once; the variable stays visible after the loop", () => {
    const made = withInputs({ n: 3 }, [
      for_("i", num(0), v("n"), [assign("n", bin("+", v("n"), num(1)))]),
    ]);
    const result = runAll(made.program, made.inputs);
    expect(result.done).toMatchObject({ loops: 3 });
    expect(varData(result, "i")).toBe(2);
  });

  it("a start other than 0 is the first value, and a bound changed in the body is not read again", () => {
    const result = runAll(
      program([
        assign("n", num(5)),
        assign("acc", num(0)),
        for_("i", num(2), v("n"), [
          assign("n", num(100)),
          assign("acc", bin("+", v("acc"), v("i"))),
        ]),
      ]),
    );
    expect(varData(result, "acc")).toBe(2 + 3 + 4);
  });

  it("break stops and continue skips the rest of the body", () => {
    const result = runAll(
      program([
        assign("acc", num(0)),
        for_("i", num(0), num(10), [
          if_(bin("==", v("i"), num(1)), [cont()]),
          if_(bin("==", v("i"), num(4)), [brk()]),
          assign("acc", bin("+", v("acc"), v("i"))),
        ]),
      ]),
    );
    expect(varData(result, "acc")).toBe(0 + 2 + 3);
  });

  it("each pass finds its target's place again and stores the value there (language.md, Semantics, Loops)", () => {
    // The body moves the target's position, as `k = 1` does in Python's `for nums[k] in range(3)`.
    const made = withInputs({ k: 0, nums: [9, 9] }, [
      forTo(item(v("nums"), v("k")), num(0), num(3), [assign("k", num(1))]),
    ]);
    const result = runAll(made.program, made.inputs);
    expect(varData(result, "nums")).toEqual([0, 2]);
    // The place is found before each pass's loop event, which carries it.
    const loops = result.events.filter((event) => event.type === "loop");
    expect(loops.map((event) => event.ref)).toEqual([
      { heap: expect.any(Number), index: 0 },
      { heap: expect.any(Number), index: 1 },
      { heap: expect.any(Number), index: 1 },
    ]);
  });

  it("a target whose place fails fails at the loop, at its first pass", () => {
    const stmt = forTo(item(list(), num(0)), num(0), num(3), []);
    expect(runAll(program([stmt])).done).toMatchObject({
      type: "error",
      error: { nodeId: stmt.id, code: "E_INDEX", params: { index: 0, length: 0 } },
    });
    expect(runAll(program([forTo(item(list(), num(0)), num(0), num(0), [])])).done).toMatchObject({
      type: "done",
    });
  });

  it("a float bound → E_TYPE", () => {
    const stmt = for_("i", num(0), float(2.5), []);
    const result = runAll(program([stmt]));
    expect(result.done).toMatchObject({
      type: "error",
      error: { nodeId: stmt.id, code: "E_TYPE", params: { left: "int", right: "float" } },
    });
    expect(runAll(program([for_("i", str("a"), num(1), [])])).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE", params: { left: "str", right: "int" } },
    });
  });

  it("a counted loop over `body`, its generated chart nodes written in the notation", () => {
    expect(forStmt.chart).toEqual({
      counted: {
        body: "body",
        init: "{var} ← {start}",
        check: "{var} < {stop}",
        update: "{var} ← {var} + 1",
      },
    });
  });
});

describe("notation (blocks.md, Notation)", () => {
  it("writes the notation of its table", () => {
    expect(notation(for_("i", num(1), v("n"), []))).toBe("{var} ← {start}");
  });
});
