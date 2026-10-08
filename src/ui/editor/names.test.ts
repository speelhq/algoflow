// U-94: the list of a name slot, and what a name field keeps.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { firstSetIn, nameChars, nameList } from "./names";

const { assign, num, str, for_ } = ast;

describe("the name list (U-94)", () => {
  const p = program([assign("count", num(0)), for_("k", num(0), num(3), [assign("w", str("a"))])], {
    inputs: [{ name: "n", value: 3 }],
  });

  it("the problem's names first, then the program's other variables, each with its kind", () => {
    expect(nameList(p, ["total", "count"], undefined)).toEqual({
      problem: [{ name: "total" }, { name: "count", of: "number" }],
      variables: [
        { name: "n", of: "number" },
        { name: "k", of: "number" },
        { name: "w", of: "text" },
      ],
    });
  });

  it("typing filters both, and a name neither holds is offered as a new variable", () => {
    expect(nameList(p, ["total"], "to")).toEqual({
      problem: [{ name: "total" }],
      variables: [],
      fresh: "to",
    });
    expect(nameList(p, ["total"], "total").fresh).toBeUndefined();
    expect(nameList(p, [], "for").fresh).toBeUndefined();
  });

  it("names the statement that first sets a variable", () => {
    expect(firstSetIn(p, "w")).toMatchObject({ kind: "assign" });
    expect(firstSetIn(p, "zz")).toBeUndefined();
  });

  it("a name field keeps only the characters of L-01", () => {
    expect(nameChars("Total Sum-1_x")).toBe("otalum1_x");
    expect(nameChars("i")).toBe("i");
    expect(nameChars("1x2")).toBe("x2");
  });
});
