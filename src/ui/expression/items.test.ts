// U-50, U-52, U-53: what an expression slot's menu offers and how a choice is placed.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import { unparse } from "@/python/emit";
import {
  blockItems,
  filterItems,
  firstEmpty,
  functionItems,
  menuItems,
  operatorItems,
  placeItem,
  templateItems,
  typedItem,
  valueItems,
  variableItems,
} from "./items";

const { v, num } = ast;

describe("expression menu items", () => {
  it("U-50: digits make a number, with or without a leading -, and a quote makes a text", () => {
    expect(unparse(typedItem("15")?.make() ?? ast.empty())).toBe("15");
    expect(unparse(typedItem("-1")?.make() ?? ast.empty())).toBe("-1");
    expect(typedItem("2.5")?.label).toBe("2.5");
    expect(unparse(typedItem('"Hello,')?.make() ?? ast.empty())).toBe('"Hello,"');
    expect(unparse(typedItem('"Fizz"')?.make() ?? ast.empty())).toBe('"Fizz"');
    expect(typedItem("1 + 2")).toBeUndefined();
    expect(typedItem("n")).toBeUndefined();
    expect(typedItem("")).toBeUndefined();
  });

  it("U-52: values are true, false, and none, written as the blocks write them", () => {
    expect(valueItems().map((item) => item.label)).toEqual(["true", "false", "none"]);
    expect(valueItems().map((item) => unparse(item.make()))).toEqual(["True", "False", "None"]);
  });

  it("U-52: operators fall into Math, Compare, and Logic, with the chart's symbols", () => {
    const by = (group: string) =>
      operatorItems()
        .filter((item) => item.group === group)
        .map((item) => item.label);
    expect(by("math")).toEqual(["+", "−", "×", "÷", "//", "%", "**"]);
    expect(by("compare")).toEqual(["=", "≠", "<", "≤", ">", "≥", "in"]);
    expect(by("logic")).toEqual(["and", "or", "not"]);
  });

  it("U-52: Call lists the builtins and the program's functions; List lists list blocks", () => {
    const calls = blockItems().filter((item) => item.group === "call");
    expect(calls.map((item) => item.label)).toContain("absolute value of …");
    const p = program([], {
      functions: [{ id: "fn0000000001", name: "double", params: ["x"], body: [] }],
    });
    const fn = functionItems(p)[0];
    expect(fn?.label).toBe("double(…)");
    expect(unparse(fn?.make() ?? ast.empty())).toBe("double(...)");
    const groups = new Set(menuItems(p, ["n"]).map((item) => item.group));
    expect([...groups]).toEqual(["variables", "values", "math", "compare", "logic", "call"]);
  });

  it("U-53: an operator wraps the current chip as its left operand and focuses the right", () => {
    const plus = operatorItems().find((item) => item.id === "op:+");
    if (!plus) throw new Error("no +");
    const current = v("n");
    const { expr, focus } = placeItem(plus, current);
    expect(unparse(expr)).toBe("n + ...");
    expect(expr.kind === "binop" && expr.left).toBe(current);
    expect(focus).toBe(expr.kind === "binop" ? expr.right : null);
  });

  it("U-53: a call wraps the current chip as its first argument", () => {
    const abs = blockItems().find((item) => item.label === "absolute value of …");
    if (!abs) throw new Error("no abs");
    const { expr, focus } = placeItem(abs, num(-3));
    expect(unparse(expr)).toBe("abs(-3)");
    expect(focus).toBeNull();
  });

  it("U-53: a call of a function with no parameter replaces the chip", () => {
    const p = program([], {
      functions: [{ id: "fn0000000001", name: "roll", params: [], body: [] }],
    });
    const roll = functionItems(p)[0];
    if (!roll) throw new Error("no roll");
    expect(unparse(placeItem(roll, num(5)).expr)).toBe("roll()");
    expect(unparse(placeItem(roll, ast.empty()).expr)).toBe("roll()");
  });

  it("U-53: a variable or a literal replaces the chip", () => {
    const [n] = variableItems(["n"]);
    if (!n) throw new Error("no n");
    expect(unparse(placeItem(n, num(1)).expr)).toBe("n");
  });

  it("U-50: a template is its expression with empty blanks, the first to fill being a", () => {
    const divisible = templateItems()[0];
    const made = divisible?.make() ?? ast.empty();
    expect(unparse(made)).toBe("... % ... == 0");
    expect(firstEmpty(made)).toBeDefined();
    expect(templateItems().map((item) => item.template.name)).toEqual([
      "divisible",
      "equals",
      "notEquals",
      "greater",
      "less",
      "atLeast",
      "atMost",
      "in",
    ]);
  });

  it("U-50: letters filter the items by label", () => {
    const items = menuItems(program([]), ["count", "n"]);
    expect(filterItems(items, "CO").map((item) => item.label)).toEqual(["count"]);
  });
});
