import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr, notation } from "./testing";

const { call, list, num, str, v } = ast;

describe("builtin len (nodes.md)", () => {
  it("emits `len(<a>)`", () => {
    expect(unparse(call("len", v("nums")))).toBe("len(nums)");
  });

  it("counts the items of a list or a dict, and the characters of a text", () => {
    expect(evalExpr(call("len", v("nums")), { nums: [4, 9, 2] }).value).toEqual({ t: "int", v: 3 });
    expect(evalExpr(call("len", list())).data).toBe(0);
    expect(evalExpr(call("len", v("d")), { d: { a: 1, b: 2 } }).data).toBe(2);
    expect(evalExpr(call("len", str("héllo"))).data).toBe(5);
    // A character beyond the 16-bit range is one character, as Python counts it.
    expect(evalExpr(call("len", str("a😀"))).data).toBe(2);
  });

  it("emits no event of its own", () => {
    expect(evalExpr(call("len", v("nums")), { nums: [1] }).events).toEqual([]);
  });

  it("a value that holds no items → E_VALUE naming len and the type", () => {
    const e = call("len", num(5));
    expect(evalExpr(e).done).toMatchObject({
      type: "error",
      error: { nodeId: e.id, code: "E_VALUE", params: { op: "call:len", type: "int" } },
    });
  });
});

describe("notation (nodes.md, Node text)", () => {
  it("writes the notation of its table", () => {
    expect(notation(call("len", v("nums")))).toBe("len({a})");
  });
});
