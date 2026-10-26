import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr, notation } from "./testing";

const { bool } = ast;

describe("bool (blocks.md)", () => {
  it("emits True / False", () => {
    expect(unparse(bool(true))).toBe("True");
    expect(unparse(bool(false))).toBe("False");
  });

  it("evaluates to a bool value", () => {
    expect(evalExpr(bool(false))).toMatchObject({
      value: { t: "bool", v: false },
      data: false,
      events: [],
    });
  });
});

describe("notation (blocks.md, Notation)", () => {
  it("writes the notation of its table", () => {
    expect(notation(bool(true))).toBe("True");
    expect(notation(bool(false))).toBe("False");
  });
});
