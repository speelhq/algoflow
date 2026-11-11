// The font each span of the chart's text is drawn and measured in (`pages.md`, Typefaces).
import { describe, expect, it } from "vitest";
import { chartSpanFont } from "./measure";

describe("chartSpanFont", () => {
  it("gives a span's family, weight, and size, a variable bold", () => {
    expect(chartSpanFont({ text: "Start" })).toEqual({
      fontFamily: "var(--typeface-code)",
      fontWeight: 400,
      fontSize: 13,
    });
    expect(chartSpanFont({ text: "i", variable: true })).toMatchObject({ fontWeight: 600 });
  });

  it("sets each font property on its own, so no span resets the feature settings that turn ligatures off", () => {
    expect(Object.keys(chartSpanFont({ text: "a" }))).not.toContain("font");
  });
});
