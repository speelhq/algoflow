// Node text as the chart writes it; a value as the blocks write it.
import { describe, expect, it } from "vitest";
import type { Expr } from "@/lang/types";
import { ast, withInputs } from "@/nodes/testing";
import { isParseError, parse } from "@/python/parse";
import { PRECEDENCE } from "@/python/precedence";
import { run } from "@/runtime/run";
import {
  assignmentText,
  exprParts,
  exprText,
  generatedParts,
  inputParts,
  joinParts,
  placeholderValue,
  questionParts,
  hasInputToFill,
  notationParts,
  notationText,
  templatePieces,
  valueText,
} from "./text";

const { assign, assignTo, num, str, bool, bin, neg, not, v, print, for_, if_, call, ret, empty } =
  ast;

const { item } = ast;

function expr(python: string): Expr {
  const parsed = parse(python, { functions: ["f"] });
  if (isParseError(parsed)) throw new Error(python);
  return parsed;
}

describe("templatePieces and placeholderValue", () => {
  it("reads a template or a notation as its own text and placeholders, in order", () => {
    expect(templatePieces("{target} ← {value}")).toEqual([
      { name: "target" },
      { words: " ← " },
      { name: "value" },
    ]);
    expect(templatePieces("abs({x})")).toEqual([{ words: "abs(" }, { name: "x" }, { words: ")" }]);
    expect(templatePieces("break")).toEqual([{ words: "break" }]);
  });

  it("gives what a placeholder holds: a slot, a parameter's argument with its side, or nothing", () => {
    const left = v("a");
    const right = num(2);
    const sum = bin("+", left, right);
    // An operator's inputs bind at its own precedence.
    expect(placeholderValue(sum, "left")).toEqual({
      role: "expr",
      expr: left,
      side: "left",
      binds: PRECEDENCE.additive,
    });
    expect(placeholderValue(sum, "right")).toMatchObject({ expr: right, side: "right" });
    expect(placeholderValue(sum, "op")).toEqual({ role: "text", text: "+" });
    const max = call("max", left, right);
    expect(placeholderValue(max, "b")).toEqual({
      role: "expr",
      expr: right,
      side: "right",
      binds: undefined,
    });
    // An item's list binds as an atom, as its slot declares; its position binds nowhere.
    const nth = ast.item(left, right);
    expect(placeholderValue(nth, "list")).toMatchObject({ binds: PRECEDENCE.atom });
    expect(placeholderValue(nth, "index")).toMatchObject({ binds: undefined });
    expect(placeholderValue(call("max", left), "b")).toBeUndefined();
    expect(placeholderValue(print(left), "args")).toEqual({ role: "exprs", items: [left] });
    expect(placeholderValue(for_("i", num(0), num(3), []), "var")).toEqual({
      role: "id",
      name: "i",
    });
    expect(placeholderValue(for_("i", num(0), num(3), []), "body")).toBeUndefined();
  });
});

describe("notation", () => {
  it("writes a statement in its notation, a first assignment as every later one", () => {
    const first = assign("total", num(0));
    const again = assign("total", bin("+", v("total"), v("i")));
    expect(notationText(first)).toBe("total ← 0");
    expect(notationText(again)).toBe("total ← total + i");
    expect([print(str("a"), v("total")), ret(), ret(v("x"))].map(notationText)).toEqual([
      'print("a", total)',
      "return",
      "return x",
    ]);
  });

  it("writes only school symbols, and names builtin arguments by parameter", () => {
    expect(exprText(bin("*", num(2, "2.50"), bin("/", v("a"), v("b"))))).toBe("2.50 × (a ÷ b)");
    expect(
      ["a - b", "a == b", "a != b", "a <= b", "a >= b", "a < b"].map((t) => exprText(expr(t))),
    ).toEqual(["a − b", "a = b", "a ≠ b", "a ≤ b", "a ≥ b", "a < b"]);
    expect(exprText(bool(false))).toBe("False");
    expect(exprText(neg(v("x")))).toBe("−x");
    expect(exprText(call("f", num(1), v("n")))).toBe("f(1, n)");
  });

  it("writes %, //, **, and in as Python writes them", () => {
    expect(exprText(expr("i % 15"))).toBe("i % 15");
    expect(exprText(expr("a // b"))).toBe("a // b");
    expect(exprText(expr("2 ** 3"))).toBe("2 ** 3");
    expect(exprText(expr("x in nums"))).toBe("x in nums");
  });

  it("writes a builtin as a call named as Python names it, without its module", () => {
    expect(exprText(expr("abs(x)"))).toBe("abs(x)");
    expect(exprText(expr("min(a, b)"))).toBe("min(a, b)");
    expect(exprText(expr("str(n)"))).toBe("str(n)");
    expect(exprText(expr("random.randint(1, 6)"))).toBe("randint(1, 6)");
  });

  it("parenthesises operators among themselves exactly where the emitter would", () => {
    expect(exprText(expr("(a + b) * c"))).toBe("(a + b) × c");
    expect(exprText(expr("a + b * c"))).toBe("a + b × c");
    expect(exprText(expr("a - (b - c)"))).toBe("a − (b − c)");
    expect(exprText(expr("-(a + b)"))).toBe("−(a + b)");
    expect(exprText(expr("a < b and b < c"))).toBe("a < b and b < c");
  });

  it("brackets no call and no input of one, and every operator as the emitter does", () => {
    expect(exprText(expr("i % 15 == 0"))).toBe("i % 15 = 0");
    expect(exprText(expr("(i + 1) % 3"))).toBe("(i + 1) % 3");
    expect(exprText(expr("abs(i % 3)"))).toBe("abs(i % 3)");
    expect(exprText(expr("min(a, abs(b))"))).toBe("min(a, abs(b))");
    expect(exprText(expr("-x ** 2"))).toBe("−x ** 2");
    expect(exprText(expr("(-x) ** 2"))).toBe("(−x) ** 2");
    expect(exprText(not(bin("<", v("a"), v("b"))))).toBe("not a < b");
    expect(exprText(expr("not (a and b)"))).toBe("not (a and b)");
    expect(exprText(expr("f(abs(x), y)"))).toBe("f(abs(x), y)");
    expect(exprText(expr("str(n) + str(m)"))).toBe("str(n) + str(m)");
  });

  it("writes a list and an item as Python does, the list of an item as an atom", () => {
    expect(exprText(expr("[]"))).toBe("[]");
    expect(exprText(expr('[1, "a", [x]]'))).toBe('[1, "a", [x]]');
    expect(exprText(expr("nums[i + 1]"))).toBe("nums[i + 1]");
    expect(exprText(expr("nums[j] > nums[j + 1]"))).toBe("nums[j] > nums[j + 1]");
    expect(exprText(expr("(a + b)[0]"))).toBe("(a + b)[0]");
    expect(exprText(expr("(-xs)[0]"))).toBe("(−xs)[0]");
    expect(exprText(expr("-xs[0]"))).toBe("−xs[0]");
    expect(exprText(expr("len(nums) - 1"))).toBe("len(nums) − 1");
    expect(notationText(assignTo(item(v("nums"), v("i")), num(0)))).toBe("nums[i] ← 0");
  });

  it("a target is written as the expression it is, its inputs still to fill as `…`", () => {
    const parts = notationParts(assignTo(item(v("nums"), empty()), num(0)));
    expect(joinParts(parts)).toBe("nums[…] ← 0");
    expect(parts.find((part) => part.text === "nums")).toMatchObject({ variable: true });
    expect(parts.filter((part) => part.hole !== undefined)).toHaveLength(1);
  });

  it("marks variables, and an input still to fill at any depth", () => {
    const hole = empty();
    const parts = exprParts(bin("+", v("total"), hole));
    expect(parts).toEqual([
      { text: "total", variable: true },
      { text: " + " },
      { text: "…", empty: true, hole: hole.id },
    ]);
    const set = assign("total", bin("+", v("total"), hole));
    expect(notationParts(set).map((part) => [part.text, part.slot])).toEqual([
      ["total", "target"],
      [" ← ", undefined],
      ["total", "value"],
      [" + ", "value"],
      ["…", "value"],
    ]);
    expect(hasInputToFill(set)).toBe(true);
    // A counted loop's stop, which its notation (its init) does not write, counts too.
    expect(hasInputToFill(for_("i", num(0), empty(), []))).toBe(true);
    expect(hasInputToFill(for_("i", num(0), num(3), []))).toBe(false);
  });

  it("writes a variable as its value when the writing gives one", () => {
    const values: Record<string, string> = { i: "3" };
    expect(exprText(expr("i % 15 == 0"), { value: (name) => values[name] })).toBe("3 % 15 = 0");
  });

  it("keeps the spaces a text holds, and leaves no space where a slot holds nothing", () => {
    expect(notationText(print(str("a  b"), str(" x ")))).toBe('print("a  b", " x ")');
    expect(exprText(bin("+", str("  "), v("s")))).toBe('"  " + s');
    expect(notationText(ret())).toBe("return");
  });

  it("adds no capital to a node", () => {
    expect(notationText(print(v("i")))).toBe("print(i)");
    expect(notationText(ast.brk())).toBe("break");
    expect(joinParts(questionParts(if_(bin("<", v("i"), v("n")), [])))).toBe("i < n?");
  });
});

describe("diamonds and generated nodes", () => {
  it("a diamond is its condition followed by ?, or the placeholder without it", () => {
    expect(joinParts(questionParts(if_(expr("i % 15 == 0"), [])))).toBe("i % 15 = 0?");
    expect(joinParts(questionParts(if_(expr("abs(x) < 3"), [])))).toBe("abs(x) < 3?");
    expect(joinParts(questionParts(if_(empty(), [])))).toBe("…");
    // The condition's runs name its slot; the `?` names none.
    expect(questionParts(if_(v("ok"), [])).map((part) => part.slot)).toEqual(["cond", undefined]);
  });

  it("a counted loop's generated nodes carry the loop's own slots", () => {
    const loop = for_("i", num(1), bin("+", v("n"), num(1)), []);
    const drawn = (part: "init" | "check" | "step") => joinParts(generatedParts(loop, part));
    expect(drawn("init")).toBe("i ← 1");
    // The check is asked as every diamond asks its condition.
    expect(drawn("check")).toBe("i < n + 1?");
    expect(drawn("step")).toBe("i ← i + 1");
    expect(notationText(loop)).toBe("i ← 1");
  });

  it("an Input node's name is a variable", () => {
    expect(inputParts("n", 15)).toEqual([
      { text: "Input " },
      { text: "n", variable: true },
      { text: " ← 15" },
    ]);
  });

  it("a variable shown with its value keeps the spaces of a text", () => {
    expect(assignmentText("s", '"a  b"')).toBe('s ← "a  b"');
    expect(joinParts(inputParts("s", "a  b"))).toBe('Input s ← "a  b"');
  });
});

describe("valueText", () => {
  it("writes True, False, None, and a text in quotes, inside containers too", () => {
    const made = withInputs({ d: { a: [true, null, "x", { $float: 2 }], "$int:3": 1 } }, []);
    const runner = run(made.program, made.inputs, 1);
    const { frames, heap } = runner.state();
    const value = frames[0]?.vars.get("d");
    expect(value && valueText(value, heap)).toBe('{"a": [True, None, "x", 2.0], 3: 1}');
  });
});
