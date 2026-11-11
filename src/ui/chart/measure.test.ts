// The font each part of the chart's text is drawn and measured in (`pages.md`, Typefaces).
import { describe, expect, it } from "vitest";
import { chartFont } from "./measure";

const MONO = "var(--typeface-code)";
const SANS = "var(--typeface-words)";

describe("chartFont", () => {
  it("names each part's typeface by the variable of its font stack, and a variable bold", () => {
    expect(chartFont({ text: "i + 1" })).toEqual({
      fontFamily: MONO,
      fontWeight: 400,
      fontSize: 13,
    });
    expect(chartFont({ text: "i", variable: true })).toMatchObject({
      fontFamily: MONO,
      fontWeight: 600,
    });
    expect(chartFont({ text: "Start", words: true })).toMatchObject({
      fontFamily: SANS,
      fontWeight: 400,
    });
  });

  it("names its font part by part, so no part resets the feature settings that turn ligatures off", () => {
    expect(Object.keys(chartFont({ text: "a" }))).not.toContain("font");
  });
});
