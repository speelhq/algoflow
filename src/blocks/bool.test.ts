import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";
import { blockNotation } from "./registry";

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
    expect(blockNotation(bool(true))).toBe("True");
    expect(blockNotation(bool(false))).toBe("False");
  });
});
