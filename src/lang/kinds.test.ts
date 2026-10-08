// L-59: what is known of a value before the program runs.
import { describe, expect, it } from "vitest";
import { ast, program, tid } from "@/nodes/testing";
import { dataKind, kindOf, variableKinds } from "./kinds";
import type { Data } from "./types";

const { assign, num, float, str, bool, none, bin, not, neg, v, call, for_, if_ } = ast;

describe("kinds (L-59)", () => {
  it("an input's kind is its value's", () => {
    const values: Data[] = [1, { $float: 2 }, "a", true, null, [1], { a: 1 }, { $cls: "V" }];
    expect(values.map((value) => dataKind(value))).toEqual([
      "number",
      "number",
      "text",
      "truefalse",
      "none",
      "list",
      "dict",
      "object",
    ]);
  });

  it("an expression's kind comes from its block and the kinds inside it", () => {
    const vars = new Map([
      ["n", "number"],
      ["s", "text"],
    ] as const);
    const of = (e: Parameters<typeof kindOf>[0]) => kindOf(e, vars);
    expect([num(1), float(1.5), str("a"), bool(true), none()].map(of)).toEqual([
      "number",
      "number",
      "text",
      "truefalse",
      "none",
    ]);
    expect(of(bin("%", v("n"), num(3)))).toBe("number");
    expect(of(bin("+", v("s"), str("!")))).toBe("text");
    expect(of(bin("+", v("s"), v("n")))).toBeUndefined();
    expect(of(bin("<", v("n"), num(3)))).toBe("truefalse");
    expect(of(not(v("n")))).toBe("truefalse");
    expect(of(neg(v("n")))).toBe("number");
    expect(of(call("str", v("n")))).toBe("text");
    expect(of(call("max", v("n"), num(1)))).toBe("number");
    expect(of(call("f", v("n")))).toBeUndefined();
    expect(of(v("unknown"))).toBeUndefined();
  });

  it("a variable's kind is its input's, else its first assignment's; a for variable is a number", () => {
    const p = program(
      [
        assign("total", num(0)),
        for_("i", num(1), v("n"), [assign("total", str("later"))]),
        if_(bin(">", v("total"), num(3)), [assign("big", bin(">", v("total"), num(9)))]),
        assign("label", call("str", v("total"))),
        assign("odd", call("f")),
      ],
      { inputs: [{ name: "n", value: 10 }] },
    );
    expect(Object.fromEntries(variableKinds(p))).toEqual({
      n: "number",
      total: "number",
      i: "number",
      big: "truefalse",
      label: "text",
    });
  });

  it("a for variable is a number whatever its bounds; a list repeated stays a list", () => {
    const fn = {
      id: tid(),
      name: "f",
      params: ["lo", "hi"],
      body: [for_("i", v("lo"), v("hi"), []), assign("row", bin("*", v("cells"), v("hi")))],
    };
    const p = program([], { functions: [fn] });
    expect(variableKinds(p, fn.id).get("i")).toBe("number");
    const vars = new Map([["cells", "list"]] as const);
    expect(kindOf(bin("*", v("cells"), num(3)), vars)).toBe("list");
    expect(kindOf(bin("*", num(3), str("ab")), vars)).toBe("text");
  });

  it("a function's variables are its own; its parameters have none", () => {
    const fn = {
      id: tid(),
      name: "f",
      params: ["x"],
      body: [assign("y", bin("*", v("x"), num(2)))],
    };
    const p = program([assign("y", str("main"))], { functions: [fn] });
    expect(Object.fromEntries(variableKinds(p, fn.id))).toEqual({ y: "number" });
    expect(Object.fromEntries(variableKinds(p))).toEqual({ y: "text" });
  });
});
