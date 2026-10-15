import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr, notation } from "./testing";

const { call, num, float, str } = ast;

describe("builtin max (blocks.md)", () => {
  it("emits `max(<a>, <b>)`", () => {
    expect(unparse(call("max", num(2), num(3)))).toBe("max(2, 3)");
  });

  it("the larger value, keeping its type", () => {
    expect(evalExpr(call("max", num(2), float(3))).value).toEqual({ t: "float", v: 3 });
    expect(evalExpr(call("max", num(9), num(4))).data).toBe(9);
    expect(evalExpr(call("max", str("b"), str("a"))).data).toBe("b");
  });

  it("a number and a string → E_TYPE", () => {
    expect(evalExpr(call("max", str("a"), num(1))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE" },
    });
  });
});

describe("notation (blocks.md, Node text)", () => {
  it("writes the notation of its table", () => {
    expect(notation(call("max", num(1), num(2)))).toBe("max({a}, {b})");
  });
});
