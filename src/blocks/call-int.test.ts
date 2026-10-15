import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr, notation } from "./testing";

const { call, num, float, str, bool, none } = ast;

describe("builtin int (blocks.md)", () => {
  it("emits `int(<x>)`", () => {
    expect(unparse(call("int", str("42")))).toBe('int("42")');
  });

  it("truncates floats, parses integer text, True → 1", () => {
    expect(evalExpr(call("int", float(-2.7))).value).toEqual({ t: "int", v: -2 });
    expect(evalExpr(call("int", str(" 42 "))).value).toEqual({ t: "int", v: 42 });
    expect(evalExpr(call("int", bool(true))).value).toEqual({ t: "int", v: 1 });
    expect(evalExpr(call("int", num(3))).value).toEqual({ t: "int", v: 3 });
  });

  it("non-integer text → E_NUMBER_TEXT, none → E_VALUE", () => {
    expect(evalExpr(call("int", str("4.2"))).done).toMatchObject({
      type: "error",
      error: { code: "E_NUMBER_TEXT", params: { op: "call:int", text: "4.2" } },
    });
    expect(evalExpr(call("int", none())).done).toMatchObject({
      type: "error",
      error: { code: "E_VALUE", params: { op: "call:int", type: "none" } },
    });
  });
});

describe("notation (blocks.md, Node text)", () => {
  it("writes the notation of its table", () => {
    expect(notation(call("int", num(1)))).toBe("int({x})");
  });
});
