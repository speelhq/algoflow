import { describe, expect, it } from "vitest";
import { spanStyle } from "./style";

describe("spanStyle (blocks.md, Notation, Drawing)", () => {
  it("draws a variable bold in the variable color", () => {
    expect(spanStyle({ variable: true })).toEqual({ fontWeight: 600, colorClass: "text-variable" });
  });

  it("draws any other span regular, in the color around it", () => {
    expect(spanStyle({})).toEqual({ fontWeight: 400, colorClass: "" });
  });
});
