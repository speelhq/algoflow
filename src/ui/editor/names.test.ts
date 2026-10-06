// U-41: the suggestion row of a name slot, and what a name input keeps.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { COMMON_NAMES, nameChars, nameSuggestions } from "./names";

const { assign, num, for_ } = ast;

describe("name suggestions (U-41)", () => {
  it("U-41: the asked names first, marked, then the program's, then the fixed list, each once", () => {
    const p = program([assign("count", num(0)), for_("k", num(0), num(3), [])], {
      inputs: [{ name: "n", value: 3 }],
    });
    const row = nameSuggestions(p, ["total"]);
    expect(row.slice(0, 4)).toEqual([
      { name: "total", asked: true },
      { name: "n", asked: false },
      { name: "count", asked: false },
      { name: "k", asked: false },
    ]);
    const names = row.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.slice(4)).toEqual(
      COMMON_NAMES.filter((name) => !["total", "n", "count"].includes(name)),
    );
  });

  it("U-41: a name input keeps only the characters of L-01", () => {
    expect(nameChars("Total Sum-1_x")).toBe("otalum1_x");
    expect(nameChars("i")).toBe("i");
    expect(nameChars("1x2")).toBe("x2");
  });
});
