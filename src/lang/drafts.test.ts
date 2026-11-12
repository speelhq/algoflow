import { describe, expect, it } from "vitest";
import { draftValue } from "./drafts";

describe("draftValue (language.md, Expressions, Drafts)", () => {
  it("gives the value a slot's text writes", () => {
    expect(draftValue("expr", "n + 1")).toMatchObject({ value: { type: "binop", op: "+" } });
    expect(draftValue("target", "nums[0]")).toMatchObject({ value: { type: "index" } });
    expect(draftValue("exprs", "1, x")).toMatchObject({
      value: [{ type: "num" }, { type: "var" }],
    });
  });

  it("gives the parser's error, or E_NOT_TARGET for a target slot's text that is no target", () => {
    expect(draftValue("expr", "n +")).toEqual({ error: { code: "E_PARSE_SYNTAX", position: 3 } });
    expect(draftValue("exprs", "1,")).toEqual({ error: { code: "E_PARSE_SYNTAX", position: 2 } });
    expect(draftValue("target", "a + 1")).toEqual({ error: "E_NOT_TARGET" });
  });
});
