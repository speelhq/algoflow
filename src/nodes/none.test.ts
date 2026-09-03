import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr } from "./testing";

describe("none (03-nodes)", () => {
  it("N-03: emits None", () => {
    expect(unparse(ast.none())).toBe("None");
  });

  it("T-02: evaluates to none", () => {
    expect(evalExpr(ast.none())).toMatchObject({ value: { t: "none" }, data: null, events: [] });
  });
});
