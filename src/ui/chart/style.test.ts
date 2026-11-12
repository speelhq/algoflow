import { describe, expect, it } from "vitest";
import { spanStyle } from "./style";

describe("spanStyle (blocks.md, Notation, Drawing)", () => {
  it("draws a variable bold in the variable color", () => {
    expect(spanStyle({ variable: true })).toEqual({ fontWeight: 600, colorClass: "text-variable" });
  });

  it("draws a hint gray and never bold", () => {
    expect(spanStyle({ hint: true })).toEqual({
      fontWeight: 400,
      colorClass: "text-muted-foreground",
    });
  });

  it("draws any other span in the weight and the color around it", () => {
    expect(spanStyle({})).toEqual({ fontWeight: undefined, colorClass: "" });
  });
});
