import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";
import { blockNotation } from "./registry";

const { call, list, num, float, str, bool, v } = ast;

const evalSum = (items: ReturnType<typeof num>[]) => evalExpr(call("sum", list(...items)));

describe("builtin sum (blocks.md)", () => {
  it("emits `sum(<a>)`", () => {
    expect(unparse(call("sum", v("nums")))).toBe("sum(nums)");
  });

  it("adds a list's ints to an int, and an empty list to 0", () => {
    expect(evalExpr(call("sum", v("nums")), { nums: [4, 9, 2] }).value).toEqual({
      t: "int",
      v: 15,
    });
    expect(evalSum([]).value).toEqual({ t: "int", v: 0 });
  });

  it("adds floats as CPython 3.12 does, with Neumaier's compensation", () => {
    // sum([0.1] * 10) is 1.0 in CPython 3.12, where adding in turn gives 0.9999999999999999.
    expect(evalSum(Array.from({ length: 10 }, () => float(0.1))).value).toEqual({
      t: "float",
      v: 1,
    });
    expect(evalSum([float(1e100), float(1), float(-1e100)]).value).toEqual({ t: "float", v: 1 });
    expect(evalSum([float(0.1), float(0.2), float(0.3)]).value).toEqual({ t: "float", v: 0.6 });
    // Ints before the first float are added exactly; one after it is added plainly.
    expect(evalSum([num(1), float(0.1), num(2), float(0.2), num(3), float(0.3)]).value).toEqual({
      t: "float",
      v: 6.6000000000000005,
    });
    expect(evalSum([num(1), num(2), float(0.5), num(1)]).value).toEqual({ t: "float", v: 4.5 });
  });

  it("emits no event of its own", () => {
    expect(evalExpr(call("sum", v("nums")), { nums: [1] }).events).toEqual([]);
  });

  it("an item that is no number → E_TYPE with the total's type and the item's", () => {
    expect(evalSum([num(1), str("a")]).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE", params: { left: "int", right: "str" } },
    });
    expect(evalSum([bool(true)]).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE", params: { left: "int", right: "bool" } },
    });
  });

  it("a value that is no list → E_VALUE naming sum and the type", () => {
    const e = call("sum", num(5));
    expect(evalExpr(e).done).toMatchObject({
      type: "error",
      error: { nodeId: e.id, code: "E_VALUE", params: { op: "call:sum", type: "int" } },
    });
  });
});

describe("notation (blocks.md, Notation)", () => {
  it("writes the notation of its table", () => {
    expect(blockNotation(call("sum", v("nums")))).toBe("sum({a})");
  });
});
