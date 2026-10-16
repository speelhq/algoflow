import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import type { Data, Stmt } from "@/lang/types";
import { ast, eventTypes, notation, program, runAll, varData, withInputs } from "./testing";

const { assign, bin, for_, item, num, swap, v } = ast;
const runWith = (values: Record<string, Data>, main: Stmt[]) => {
  const made = withInputs(values, main);
  return runAll(made.program, made.inputs);
};

describe("swap (blocks.md)", () => {
  it("emits `<a>, <b> = <b>, <a>`", () => {
    const stmt = swap(item(v("nums"), v("j")), item(v("nums"), bin("+", v("j"), num(1))));
    expect(emit(program([stmt]), {}).code.trimEnd()).toBe(
      "nums[j], nums[j + 1] = nums[j + 1], nums[j]",
    );
    expect(emit(program([swap(v("x"), v("y"))]), {}).code.trimEnd()).toBe("x, y = y, x");
  });

  it("reads b then a, then writes a then b, each write carrying where its value was read", () => {
    const a = item(v("nums"), num(0));
    const b = item(v("nums"), num(2));
    const stmt = swap(a, b);
    const result = runWith({ nums: [1, 2, 3] }, [stmt]);
    expect(varData(result, "nums")).toEqual([3, 2, 1]);
    const first = { heap: 1, index: 0 };
    const third = { heap: 1, index: 2 };
    expect(result.events).toEqual([
      { type: "enter", nodeId: stmt.id },
      { type: "read", nodeId: b.id, refs: [third] },
      { type: "read", nodeId: a.id, refs: [first] },
      { type: "write", nodeId: stmt.id, ref: first, value: { t: "int", v: 3 }, from: third },
      { type: "write", nodeId: stmt.id, ref: third, value: { t: "int", v: 1 }, from: first },
    ]);
    expect(result.done).toEqual({ type: "done", events: 5, loops: 0 });
  });

  it("exchanges two variables, whose reads emit nothing", () => {
    const stmt = swap(v("x"), v("y"));
    const result = runAll(program([assign("x", num(1)), assign("y", num(2)), stmt]));
    expect([varData(result, "x"), varData(result, "y")]).toEqual([2, 1]);
    expect(result.events.slice(-3)).toEqual([
      { type: "enter", nodeId: stmt.id },
      {
        type: "write",
        nodeId: stmt.id,
        ref: { var: "x" },
        value: { t: "int", v: 2 },
        from: { var: "y" },
      },
      {
        type: "write",
        nodeId: stmt.id,
        ref: { var: "y" },
        value: { t: "int", v: 1 },
        from: { var: "x" },
      },
    ]);
  });
});

describe("swap, Semantics (language.md, Lists)", () => {
  it("finds a's place again and writes it before finding b's again", () => {
    const b = item(v("nums"), v("i"));
    const stmt = swap(v("i"), b);
    const result = runWith({ i: 0, nums: [1, 9] }, [stmt]);
    expect([varData(result, "i"), varData(result, "nums")]).toEqual([1, [1, 0]]);
    expect(result.events).toEqual([
      { type: "enter", nodeId: stmt.id },
      { type: "read", nodeId: b.id, refs: [{ heap: 1, index: 0 }] },
      {
        type: "write",
        nodeId: stmt.id,
        ref: { var: "i" },
        value: { t: "int", v: 1 },
        from: { heap: 1, index: 0 },
      },
      {
        type: "write",
        nodeId: stmt.id,
        ref: { heap: 1, index: 1 },
        value: { t: "int", v: 0 },
        from: { var: "i" },
      },
    ]);
  });

  it("the reads inside a place's expressions are emitted at each finding", () => {
    const first = item(v("perm"), num(0));
    const second = item(v("perm"), num(1));
    const a = item(v("nums"), first);
    const b = item(v("nums"), second);
    const result = runWith({ nums: [5, 6], perm: [1, 0] }, [swap(a, b)]);
    expect(varData(result, "nums")).toEqual([6, 5]);
    const reads = result.events.flatMap((event) =>
      event.type === "read" ? [event.nodeId] : event.type === "write" ? ["write"] : [],
    );
    expect(reads).toEqual([second.id, b.id, first.id, a.id, first.id, "write", second.id, "write"]);
  });
});

describe("swap, errors", () => {
  it("a position beyond the list → E_INDEX at the statement", () => {
    const stmt = swap(item(v("nums"), num(5)), item(v("nums"), num(0)));
    expect(runWith({ nums: [1, 2] }, [stmt]).done).toMatchObject({
      type: "error",
      error: { nodeId: stmt.id, code: "E_INDEX", params: { index: 5, length: 2 } },
    });
  });

  it("a variable never assigned → E_UNDEFINED at the statement", () => {
    const stmt = swap(v("i"), v("x"));
    const result = runAll(program([for_("i", num(0), num(0), []), assign("x", num(1)), stmt]));
    expect(result.done).toMatchObject({
      type: "error",
      error: { nodeId: stmt.id, code: "E_UNDEFINED", params: { name: "i" } },
    });
  });

  it("a place found again that fails comes after the first write", () => {
    const stmt = swap(v("i"), item(v("nums"), v("i")));
    const result = runWith({ i: 0, nums: [3, 9] }, [stmt]);
    expect(eventTypes(result.events)).toEqual(["enter", "read", "write"]);
    expect(result.done).toMatchObject({
      type: "error",
      error: { nodeId: stmt.id, code: "E_INDEX", params: { index: 3, length: 2 } },
    });
  });
});

describe("notation (blocks.md, Node text)", () => {
  it("writes the notation of its table", () => {
    expect(notation(swap(v("x"), v("y")))).toBe("swap({a}, {b})");
  });
});
