import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

const { bool } = ast;

describe("bool (03-nodes)", () => {
  it("N-03: emits True / False", () => {
    expect(unparse(bool(true))).toBe("True");
    expect(unparse(bool(false))).toBe("False");
  });

  it("T-02: evaluates to a bool value", () => {
    expect(evalExpr(bool(false))).toMatchObject({
      value: { t: "bool", v: false },
      data: false,
      events: [],
    });
  });
});
