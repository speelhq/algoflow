import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr, notation } from "./testing";

const { call, num, str, bool, none } = ast;

describe("builtin float (blocks.md)", () => {
  it("emits `float(<x>)`", () => {
    expect(unparse(call("float", num(1)))).toBe("float(1)");
  });

  it("converts numbers, numeric text, and bools to float", () => {
    expect(evalExpr(call("float", num(3))).value).toEqual({ t: "float", v: 3 });
    expect(evalExpr(call("float", str("2.5"))).value).toEqual({ t: "float", v: 2.5 });
    expect(evalExpr(call("float", str("1e3"))).value).toEqual({ t: "float", v: 1000 });
    expect(evalExpr(call("float", bool(false))).value).toEqual({ t: "float", v: 0 });
  });

  it("non-numeric text → E_NUMBER_TEXT, none → E_VALUE", () => {
    expect(evalExpr(call("float", str("x"))).done).toMatchObject({
      type: "error",
      error: { code: "E_NUMBER_TEXT", params: { op: "call:float", text: "x" } },
    });
    expect(evalExpr(call("float", none())).done).toMatchObject({
      type: "error",
      error: { code: "E_VALUE", params: { op: "call:float", type: "none" } },
    });
  });
});

describe("notation (blocks.md, Notation)", () => {
  it("writes the notation of its table", () => {
    expect(notation(call("float", num(1)))).toBe("float({x})");
  });
});
