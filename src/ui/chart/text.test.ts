// Notation as the chart writes it; a value as the blocks write it.
import { describe, expect, it } from "vitest";
import type { Expr } from "@/lang/types";
import { ast, program, withInputs } from "@/blocks/testing";
import { isParseError, parse } from "@/python/parse";
import { PRECEDENCE } from "@/python/precedence";
import { run } from "@/runtime/run";
import {
  assignmentText,
  exprSpans,
  exprText,
  generatedSpans,
  inputSpans,
  joinSpans,
  placeholderValue,
  slotSpans,
  questionSpans,
  holdsDraft,
  notationSpans,
  notationText,
  notationTokens,
  valueText,
} from "./text";

const {
  assign,
  assignTo,
  num,
  str,
  bool,
  bin,
  neg,
  not,
  v,
  print,
  for_,
  if_,
  while_,
  call,
  ret,
  empty,
} = ast;

const { item } = ast;

/** A program that defines no function. */
const P = program([]);

function expr(python: string): Expr {
  const parsed = parse(python);
  if (isParseError(parsed)) throw new Error(python);
  return parsed;
}

describe("notationTokens and placeholderValue", () => {
  it("reads a template or a notation as its own text and placeholders, in order", () => {
    expect(notationTokens("{target} ← {value}")).toEqual([
      { placeholder: "target" },
      { text: " ← " },
      { placeholder: "value" },
    ]);
    expect(notationTokens("abs({x})")).toEqual([
      { text: "abs(" },
      { placeholder: "x" },
      { text: ")" },
    ]);
    expect(notationTokens("break")).toEqual([{ text: "break" }]);
  });

  it("gives what a placeholder holds: a slot, a parameter's argument with its side, or nothing", () => {
    const left = v("a");
    const right = num(2);
    const sum = bin("+", left, right);
    // An operator's values bind at its own precedence.
    expect(placeholderValue(sum, "left")).toEqual({
      role: "expr",
      expr: left,
      side: "left",
      binds: PRECEDENCE.additive,
    });
    expect(placeholderValue(sum, "right")).toMatchObject({ expr: right, side: "right" });
    expect(placeholderValue(sum, "op")).toEqual({ role: "operator", text: "+" });
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
    // A loop's variable is a target, held as the expression it is.
    const loop = for_("i", num(0), num(3), []);
    expect(placeholderValue(loop, "var")).toMatchObject({ role: "expr", expr: { name: "i" } });
    expect(placeholderValue(for_("i", num(0), num(3), []), "body")).toBeUndefined();
  });
});

describe("notation", () => {
  it("writes a statement in its notation, a first assignment as every later one", () => {
    const first = assign("total", num(0));
    const again = assign("total", bin("+", v("total"), v("i")));
    expect(notationText(first, P)).toBe("total ← 0");
    expect(notationText(again, P)).toBe("total ← total + i");
    expect(
      [print(str("a"), v("total")), ret(), ret(v("x"))].map((block) => notationText(block, P)),
    ).toEqual(['print("a", total)', "return", "return x"]);
  });

  it("writes each operator as Python does, and names builtin arguments by parameter", () => {
    expect(exprText(bin("*", num(2, "2.50"), bin("/", v("a"), v("b"))), P)).toBe("2.50 * (a / b)");
    const ops = "+ - * / // % ** == != < <= > >= and or in".split(" ");
    expect(ops.map((op) => exprText(expr(`a ${op} b`), P))).toEqual(ops.map((op) => `a ${op} b`));
    expect(exprText(bool(false), P)).toBe("False");
    expect(exprText(neg(v("x")), P)).toBe("-x");
    expect(exprText(call("f", num(1), v("n")), P)).toBe("f(1, n)");
  });

  it("writes %, //, **, and in as Python writes them", () => {
    expect(exprText(expr("i % 15"), P)).toBe("i % 15");
    expect(exprText(expr("a // b"), P)).toBe("a // b");
    expect(exprText(expr("2 ** 3"), P)).toBe("2 ** 3");
    expect(exprText(expr("x in nums"), P)).toBe("x in nums");
  });

  it("writes a builtin as a call named as Python names it, without its module", () => {
    expect(exprText(expr("abs(x)"), P)).toBe("abs(x)");
    expect(exprText(expr("min(a, b)"), P)).toBe("min(a, b)");
    expect(exprText(expr("str(n)"), P)).toBe("str(n)");
    expect(exprText(expr("random.randint(1, 6)"), P)).toBe("randint(1, 6)");
  });

  it("parenthesizes operators among themselves exactly where the emitter would", () => {
    expect(exprText(expr("(a + b) * c"), P)).toBe("(a + b) * c");
    expect(exprText(expr("a + b * c"), P)).toBe("a + b * c");
    expect(exprText(expr("a - (b - c)"), P)).toBe("a - (b - c)");
    expect(exprText(expr("-(a + b)"), P)).toBe("-(a + b)");
    expect(exprText(expr("a < b and b < c"), P)).toBe("a < b and b < c");
  });

  it("parenthesizes no call and no argument of one, and every operator as the emitter does", () => {
    expect(exprText(expr("i % 15 == 0"), P)).toBe("i % 15 == 0");
    expect(exprText(expr("(i + 1) % 3"), P)).toBe("(i + 1) % 3");
    expect(exprText(expr("abs(i % 3)"), P)).toBe("abs(i % 3)");
    expect(exprText(expr("min(a, abs(b))"), P)).toBe("min(a, abs(b))");
    expect(exprText(expr("-x ** 2"), P)).toBe("-x ** 2");
    expect(exprText(expr("(-x) ** 2"), P)).toBe("(-x) ** 2");
    expect(exprText(not(bin("<", v("a"), v("b"))), P)).toBe("not a < b");
    expect(exprText(expr("not (a and b)"), P)).toBe("not (a and b)");
    expect(exprText(expr("f(abs(x), y)"), P)).toBe("f(abs(x), y)");
    expect(exprText(expr("str(n) + str(m)"), P)).toBe("str(n) + str(m)");
  });

  it("writes a list and an item as Python does, the list of an item as an atom", () => {
    expect(exprText(expr("[]"), P)).toBe("[]");
    expect(exprText(expr('[1, "a", [x]]'), P)).toBe('[1, "a", [x]]');
    expect(exprText(expr("nums[i + 1]"), P)).toBe("nums[i + 1]");
    expect(exprText(expr("nums[j] > nums[j + 1]"), P)).toBe("nums[j] > nums[j + 1]");
    expect(exprText(expr("(a + b)[0]"), P)).toBe("(a + b)[0]");
    expect(exprText(expr("(-xs)[0]"), P)).toBe("(-xs)[0]");
    expect(exprText(expr("-xs[0]"), P)).toBe("-xs[0]");
    expect(exprText(expr("len(nums) - 1"), P)).toBe("len(nums) - 1");
    expect(notationText(assignTo(item(v("nums"), v("i")), num(0)), P)).toBe("nums[i] ← 0");
  });

  it("a target is written as the expression it is, its empty slots as their hints", () => {
    const spans = notationSpans(assignTo(item(v("nums"), empty()), num(0)), P);
    expect(joinSpans(spans)).toBe("nums[value] ← 0");
    expect(spans.find((span) => span.text === "nums")).toMatchObject({ variable: true });
    expect(spans.filter((span) => span.emptyId !== undefined)).toHaveLength(1);
  });

  it("marks variables, and an empty slot at any depth as its hint", () => {
    const slot = empty();
    const spans = exprSpans(bin("+", v("total"), slot), P);
    expect(spans).toEqual([
      { text: "total", variable: true },
      { text: " + " },
      { text: "value", hint: true, emptyId: slot.id },
    ]);
    const set = assign("total", bin("+", v("total"), slot));
    expect(notationSpans(set, P).map((span) => [span.text, span.slot])).toEqual([
      ["total", "target"],
      [" ← ", undefined],
      ["total", "value"],
      [" + ", "value"],
      ["value", "value"],
    ]);
    expect(holdsDraft(assign("total", empty()))).toBe(true);
    // A counted loop's stop, which its notation (its init) does not write, counts too.
    expect(holdsDraft(for_("i", num(0), empty(), []))).toBe(true);
    expect(holdsDraft(for_("i", num(0), num(3), []))).toBe(false);
  });

  it("writes a draft as its text, a brace included, and a statement that holds one shows it", () => {
    const set = assign("total", ast.draft("total + {"));
    expect(notationText(set, P)).toBe("total ← total + {");
    expect(holdsDraft(set)).toBe(true);
    expect(notationText(print(num(1), ast.draft("x y")), P)).toBe("print(1, x y)");
    expect(joinSpans(questionSpans(if_(ast.draft("i <"), []), P))).toBe("i <?");
  });

  it("writes a statement's empty slot as the slot's hint, a loop's empty variable as any other", () => {
    const variable = empty();
    const loop = ast.forTo(variable, num(0), num(3), []);
    expect(notationSpans(loop, P)).toEqual([
      { text: "variable", hint: true, emptyId: variable.id, slot: "var" },
      { text: " ← " },
      { text: "0", slot: "start" },
    ]);
    expect(holdsDraft(loop)).toBe(true);
    // An empty value carries its id, so a click on it opens the editor at it.
    const hole = empty();
    expect(slotSpans(print(num(1), hole), "args", P).at(-1)).toEqual({
      text: "values",
      hint: true,
      emptyId: hole.id,
      slot: "args",
    });
  });

  it("writes an argument of a call of the program's function as its parameter's name, any other slot of an expression as value", () => {
    const fn = { id: "fn0000000001", name: "double", params: ["x", "times"], body: [] };
    const withDouble = program([], { functions: [fn] });
    const twice = call("double", num(1), empty());
    expect(exprText(twice, withDouble)).toBe("double(1, times)");
    expect(exprSpans(twice, withDouble).at(-2)).toMatchObject({ text: "times", hint: true });
    // A name the program doesn't define, and a builtin, name no parameter.
    expect(exprText(twice, P)).toBe("double(1, value)");
    expect(exprText(call("abs", empty()), withDouble)).toBe("abs(value)");
    expect(exprText(bin("+", empty(), empty()), P)).toBe("value + value");
  });

  it("writes a variable as its value when the writing gives one", () => {
    const values: Record<string, string> = { i: "3" };
    expect(exprText(expr("i % 15 == 0"), P, { value: (name) => values[name] })).toBe("3 % 15 == 0");
  });

  it("keeps the spaces a text holds, and leaves no space where a slot holds nothing", () => {
    expect(notationText(print(str("a  b"), str(" x ")), P)).toBe('print("a  b", " x ")');
    expect(exprText(bin("+", str("  "), v("s")), P)).toBe('"  " + s');
    expect(notationText(ret(), P)).toBe("return");
  });

  it("adds no capital to a block", () => {
    expect(notationText(print(v("i")), P)).toBe("print(i)");
    expect(notationText(ast.brk(), P)).toBe("break");
    expect(joinSpans(questionSpans(if_(bin("<", v("i"), v("n")), []), P))).toBe("i < n?");
  });
});

describe("diamonds and generated chart nodes", () => {
  it("a diamond is its condition followed by ?, or its hint without it while it is empty", () => {
    expect(joinSpans(questionSpans(if_(expr("i % 15 == 0"), []), P))).toBe("i % 15 == 0?");
    expect(joinSpans(questionSpans(if_(expr("abs(x) < 3"), []), P))).toBe("abs(x) < 3?");
    expect(joinSpans(questionSpans(if_(empty(), []), P))).toBe("condition");
    expect(questionSpans(while_(empty(), []), P)).toMatchObject([{ hint: true }]);
    // The condition's spans name its slot; the `?` names none.
    expect(questionSpans(if_(v("ok"), []), P).map((span) => span.slot)).toEqual([
      "cond",
      undefined,
    ]);
  });

  it("a counted loop's generated chart nodes carry the loop's own slots", () => {
    const loop = for_("i", num(1), bin("+", v("n"), num(1)), []);
    const drawn = (which: "init" | "check" | "update") => joinSpans(generatedSpans(loop, which, P));
    expect(drawn("init")).toBe("i ← 1");
    // The check is asked as every diamond asks its condition.
    expect(drawn("check")).toBe("i < n + 1?");
    expect(drawn("update")).toBe("i ← i + 1");
    expect(notationText(loop, P)).toBe("i ← 1");
  });

  it("an Input chart node's name is a variable", () => {
    expect(inputSpans("n", 15)).toEqual([
      { text: "Input " },
      { text: "n", variable: true },
      { text: " ← 15" },
    ]);
  });

  it("a variable shown with its value keeps the spaces of a text", () => {
    expect(assignmentText("s", '"a  b"')).toBe('s ← "a  b"');
    expect(joinSpans(inputSpans("s", "a  b"))).toBe('Input s ← "a  b"');
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
