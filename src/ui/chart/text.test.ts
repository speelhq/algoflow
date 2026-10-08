// N-08: node sentences as plain text in the block language; U-33: a diamond's question.
import { describe, expect, it } from "vitest";
import type { Expr } from "@/lang/types";
import { ast, program } from "@/nodes/testing";
import { isParseError, parse } from "@/python/parse";
import {
  capitalise,
  capitaliseParts,
  conditionOf,
  exprText,
  generatedText,
  joinParts,
  questionText,
  sentence,
  sentenceParts,
} from "./text";

const { assign, num, str, bool, bin, neg, not, v, print, for_, if_, call, exprStmt, ret } = ast;

function expr(python: string): Expr {
  const parsed = parse(python, { classes: [], functions: ["f"] });
  if (isParseError(parsed)) throw new Error(python);
  return parsed;
}

describe("sentence (N-08)", () => {
  it("renders statements from their template, with the create form of a first assignment", () => {
    const first = assign("total", num(0));
    const again = assign("total", bin("+", v("total"), v("i")));
    const p = program([first, again, print(str("a"), v("total")), ret()]);
    expect(sentence(first, p)).toBe("create total and set it to 0");
    expect(sentence(again, p)).toBe("set total to total + i");
    expect(p.main.slice(2).map((stmt) => sentence(stmt, p))).toEqual([
      'print "a", total',
      "return",
    ]);
    expect(capitalise(sentence(again, p))).toBe("Set total to total + i");
  });

  it("uses each block's form and text hooks, and names builtin arguments by parameter", () => {
    expect(exprText(bin("*", num(2, "2.50"), bin("/", v("a"), v("b"))))).toBe("2.50 × (a ÷ b)");
    expect(exprText(bool(false))).toBe("false");
    expect(exprText(not(v("ok")))).toBe("not ok");
    expect(exprText(neg(v("x")))).toBe("−x");
    expect(exprText(expr("min(a, abs(b))"))).toBe("smaller of a and (absolute value of b)");
    expect(exprText(call("f", num(1), v("n")))).toBe("f(1, n)");
  });

  it("parenthesises operators among themselves exactly where the emitter would (E-05)", () => {
    expect(exprText(expr("(a + b) * c"))).toBe("(a + b) × c");
    expect(exprText(expr("a + b * c"))).toBe("a + b × c");
    expect(exprText(expr("a - (b - c)"))).toBe("a − (b − c)");
    expect(exprText(expr("-(a + b)"))).toBe("−(a + b)");
  });

  it("N-09: a counted loop's generated nodes carry the loop's own slots", () => {
    const loop = for_("i", num(1), bin("+", v("n"), num(1)), []);
    expect(generatedText(loop, "init")).toBe("Set i to 1");
    expect(generatedText(loop, "check")).toBe("i < n + 1?");
    expect(generatedText(loop, "step")).toBe("Set i to i + 1");
    expect(conditionOf(if_(v("ok"), []))).toMatchObject({ kind: "var", name: "ok" });
  });
});

describe("the block language (N-08)", () => {
  it("writes school symbols for operators and words for every other operation", () => {
    expect(exprText(expr("a - b * c / d"))).toBe("a − b × c ÷ d");
    expect(exprText(expr("a == b"))).toBe("a = b");
    expect(exprText(expr("a != b"))).toBe("a ≠ b");
    expect(exprText(expr("a <= b and a >= c or a < d"))).toBe("a ≤ b and a ≥ c or a < d");
    expect(exprText(expr("i % 15"))).toBe("remainder of i divided by 15");
    expect(exprText(expr("i // 2"))).toBe("whole-number quotient of i divided by 2");
    expect(exprText(expr("2 ** n"))).toBe("2 to the power of n");
    expect(exprText(expr("x in nums"))).toBe("x is in nums");
    expect(exprText(expr("int(t)"))).toBe("t as whole number");
  });

  it("brackets a word operation next to an operator, and an operation inside words", () => {
    expect(exprText(expr("i % 15 == 0"))).toBe("(remainder of i divided by 15) = 0");
    expect(exprText(expr("(i + 1) % 3"))).toBe("remainder of (i + 1) divided by 3");
    expect(exprText(expr("i % (n % 3)"))).toBe("remainder of i divided by (remainder of n divided by 3)");
    expect(exprText(expr("not (a < b)"))).toBe("not (a < b)");
    expect(exprText(expr("not a and b"))).toBe("(not a) and b");
    expect(exprText(expr("x in s or ok"))).toBe("(x is in s) or ok");
    expect(exprText(expr("2 ** n + 1"))).toBe("(2 to the power of n) + 1");
    // A call is neither: its arguments sit in its own parentheses.
    expect(exprText(expr("abs(f(a + 1))"))).toBe("absolute value of f(a + 1)");
  });

  it("a statement's slot shows its expression as written, never a template sentence", () => {
    const p = program([assign("ok", expr("n > 3")), print(expr("n == 3"), expr("n + 1"))]);
    expect(p.main.map((stmt) => sentence(stmt, p))).toEqual([
      "create ok and set it to n > 3",
      "print n = 3, n + 1",
    ]);
  });

  it("capitalises a sentence only when it begins with a word of its template", () => {
    const first = assign("total", num(0));
    const bare = exprStmt(call("f", num(1)));
    const p = program([first, bare]);
    expect(joinParts(capitaliseParts(sentenceParts(first, p)))).toBe("Create total and set it to 0");
    expect(joinParts(capitaliseParts(sentenceParts(bare, p)))).toBe("f(1)");
  });
});

describe("a diamond's question (U-33)", () => {
  it("is its condition as the chart writes it, then ?", () => {
    expect(questionText(expr("i % 15 == 0"))).toBe("(remainder of i divided by 15) = 0?");
    expect(questionText(expr("a < b and b < c"))).toBe("a < b and b < c?");
    expect(questionText(expr("not ok"))).toBe("not ok?");
    expect(questionText(expr("x in nums"))).toBe("x is in nums?");
  });
});
