import { describe, expect, it } from "vitest";
import { parseSlotText } from "./drafts";

describe("parseSlotText (language.md, Expressions, Drafts)", () => {
  it("gives the value a slot's text writes", () => {
    expect(parseSlotText("expr", "n + 1")).toMatchObject({ value: { type: "binop", op: "+" } });
    expect(parseSlotText("target", "nums[0]")).toMatchObject({ value: { type: "index" } });
    expect(parseSlotText("exprs", "1, x")).toMatchObject({
      value: [{ type: "num" }, { type: "var" }],
    });
  });

  it("gives the parser's error, or E_NOT_TARGET for a target slot's text that is no target", () => {
    expect(parseSlotText("expr", "n +")).toEqual({
      error: { code: "E_PARSE_SYNTAX", position: 3 },
    });
    expect(parseSlotText("exprs", "1,")).toEqual({
      error: { code: "E_PARSE_SYNTAX", position: 2 },
    });
    expect(parseSlotText("target", "a + 1")).toEqual({ error: "E_NOT_TARGET" });
  });
});
