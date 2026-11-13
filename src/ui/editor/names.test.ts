// The names a binding target's line offers (`editor.md`, Name list): the routine's variables, and
// in `main` the problem's names first.
import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/challenges";
import { ast } from "@/blocks/testing";
import { isNewName, routineNames } from "./names";

const { assign, num, for_, program } = ast;

describe("name list", () => {
  it("the problem's names first, in order, then the program's other variables, with no limit", () => {
    const p = program(
      [assign("count", num(0)), for_("k", num(0), num(3), []), assign("total", num(1))],
      { inputs: [{ name: "n", kind: "number" }] },
    );
    expect(routineNames(p, "main", ["total", "best"], "nothing")).toEqual({
      asked: ["total", "best"],
      names: ["n", "count", "k"],
    });
    const many = program(["a", "b", "c", "d", "e", "f", "g"].map((name) => assign(name, num(0))));
    expect(routineNames(many, "main", [], "nothing").names).toHaveLength(7);
  });

  it("Sum to n: total is the problem's name", () => {
    const sum = CHALLENGES.find((challenge) => challenge.id === "sum-to-n");
    if (!sum) throw new Error("sum-to-n missing");
    const asked = Object.keys(sum.tests[0]?.expect.variables ?? {});
    const p = program([], { inputs: [{ name: "n", kind: "number" }] });
    expect(routineNames(p, "main", asked, "nothing")).toEqual({ asked: ["total"], names: ["n"] });
  });

  it("in a function, its parameters and the names its body assigns, and no problem's names", () => {
    const fn = {
      id: "f0000000000f",
      name: "push",
      params: ["heap", "x"],
      body: [assign("i", num(0))],
    };
    const p = program([assign("total", num(0))], { functions: [fn] });
    expect(routineNames(p, fn.id, ["total"], "nothing")).toEqual({
      asked: [],
      names: ["heap", "x", "i"],
    });
    expect(routineNames(p, "main", ["total"], "nothing")).toEqual({ asked: ["total"], names: [] });
  });

  it("leaves out the names that the statement being edited assigns, its line holding the name typed", () => {
    const typed = for_("i", num(0), num(3), []);
    const p = program([assign("count", num(0)), typed, assign("i", num(1))]);
    expect(routineNames(p, "main", [], typed.id).names).toEqual(["count", "i"]);
    expect(routineNames(program([typed]), "main", [], typed.id).names).toEqual([]);
  });

  it("offers a typed name as a new variable when no name is it and Identifiers allows it", () => {
    expect(isNewName("to", ["total"])).toBe(true);
    expect(isNewName("total", ["total"])).toBe(false);
    expect(isNewName("for", [])).toBe(false);
    expect(isNewName("", [])).toBe(false);
  });
});
