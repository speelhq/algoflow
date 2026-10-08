// U-41: the suggestion row of a name slot, and what a name input keeps.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { nameChars, nameSuggestions, ROW } from "./names";

const { assign, num, for_ } = ast;

describe("name suggestions (U-41)", () => {
  it("U-41: the asked names first, marked, then the program's, then i j count found, at most six", () => {
    const p = program([assign("count", num(0)), for_("k", num(0), num(3), [])], {
      inputs: [{ name: "n", value: 3 }],
    });
    expect(nameSuggestions(p, ["total"])).toEqual([
      { name: "total", asked: true },
      { name: "n", asked: false },
      { name: "count", asked: false },
      { name: "k", asked: false },
      { name: "i", asked: false },
      { name: "j", asked: false },
    ]);
    const many = program(["a", "b", "c", "d", "e", "f", "g"].map((name) => assign(name, num(0))));
    expect(nameSuggestions(many, ["total"])).toHaveLength(ROW);
  });

  it("U-41: a name input keeps only the characters of L-01", () => {
    expect(nameChars("Total Sum-1_x")).toBe("otalum1_x");
    expect(nameChars("i")).toBe("i");
    expect(nameChars("1x2")).toBe("x2");
  });
});
