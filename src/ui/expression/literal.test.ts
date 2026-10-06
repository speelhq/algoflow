// U-32: a Custom… value is limited to literals and stored as Data.
import { describe, expect, it } from "vitest";
import { ast } from "@/nodes/testing";
import { isParseError, parse } from "@/python/parse";
import { isLiteral, literalData } from "./literal";

const parsed = (text: string) => {
  const result = parse(text);
  if (isParseError(result)) throw new Error(text);
  return result;
};

describe("Custom… values (U-32)", () => {
  it("U-32: numbers, texts, true, false, and none are literals, stored as Data", () => {
    expect(literalData(parsed("5"))).toBe(5);
    expect(literalData(parsed("-3"))).toBe(-3);
    expect(literalData(parsed("2.0"))).toEqual({ $float: 2 });
    expect(literalData(parsed('"Ada"'))).toBe("Ada");
    expect(literalData(parsed("True"))).toBe(true);
    expect(literalData(parsed("None"))).toBeNull();
  });

  it("U-32: variables, operators, and calls are not", () => {
    expect(isLiteral(parsed("n"))).toBe(false);
    expect(isLiteral(parsed("1 + 2"))).toBe(false);
    expect(isLiteral(parsed("abs(1)"))).toBe(false);
    expect(isLiteral(ast.empty())).toBe(false);
    expect(literalData(parsed("n"))).toBeUndefined();
  });
});
