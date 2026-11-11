// The font each part of the chart's text is drawn and measured in (`pages.md`, Typefaces).
import { describe, expect, it } from "vitest";
import { chartFont } from "./measure";

describe("chartFont", () => {
  it("sets a part's weight and size, a variable bold", () => {
    expect(chartFont({ text: "Start" })).toEqual({ fontWeight: 400, fontSize: 13 });
    expect(chartFont({ text: "i", variable: true })).toMatchObject({ fontWeight: 600 });
  });

  it("names its font part by part, so no part resets the feature settings that turn ligatures off", () => {
    expect(Object.keys(chartFont({ text: "a" }))).not.toContain("font");
  });
});
