// N-08: node sentences as plain text; U-50: template sentences and the matcher behind them.
import { describe, expect, it } from "vitest";
import type { Expr } from "@/lang/types";
import { ast, program } from "@/nodes/testing";
import { isParseError, parse } from "@/python/parse";
import { CONDITION_TEMPLATES, matchTemplate, matchTemplates } from "@/ui/expression/templates";
import { capitalise, conditionOf, exprText, generatedText, sentence } from "./text";

const { assign, num, str, bool, bin, neg, not, v, print, for_, if_, call, comment, ret } = ast;

function expr(python: string): Expr {
  const parsed = parse(python, { classes: [], functions: ["f"] });
  if (isParseError(parsed)) throw new Error(python);
  return parsed;
}

describe("sentence (N-08)", () => {
  it("renders statements from their template, with the create form of a first assignment", () => {
    const first = assign("total", num(0));
    const again = assign("total", bin("+", v("total"), v("i")));
    const p = program([first, again, print(str("a"), v("total")), comment("note"), ret()]);
    expect(sentence(first, p)).toBe("create total and set it to 0");
    expect(sentence(again, p)).toBe("set total to total + i");
    expect(p.main.slice(2).map((stmt) => sentence(stmt, p))).toEqual([
      'print "a", total',
      "# note",
      "return",
    ]);
    expect(capitalise(sentence(again, p))).toBe("Set total to total + i");
  });

  it("uses each block's form and text hooks, and names builtin arguments by parameter", () => {
    expect(exprText(bin("*", num(2, "2.50"), bin("/", v("a"), v("b"))))).toBe("2.50 × (a ÷ b)");
    expect(exprText(bool(false))).toBe("false");
    expect(exprText(not(v("ok")))).toBe("not ok");
    expect(exprText(neg(v("x")))).toBe("−x");
    expect(exprText(expr("min(a, abs(b))"))).toBe("smaller of a and absolute value of b");
    expect(exprText(call("f", num(1), v("n")))).toBe("f(1, n)");
  });

  it("parenthesises a child exactly where the emitter would (E-05)", () => {
    expect(exprText(expr("(a + b) * c"))).toBe("(a + b) × c");
    expect(exprText(expr("a + b * c"))).toBe("a + b × c");
    expect(exprText(expr("a - (b - c)"))).toBe("a - (b - c)");
    expect(exprText(expr("-(a + b)"))).toBe("−(a + b)");
  });

  it("N-09: a counted loop's generated nodes carry the loop's own slots", () => {
    const loop = for_("i", num(1), bin("+", v("n"), num(1)), []);
    expect(generatedText(loop, "init")).toBe("Set i to 1");
    expect(generatedText(loop, "check")).toBe("Is i < n + 1?");
    expect(generatedText(loop, "step")).toBe("Set i to i + 1");
    expect(conditionOf(if_(v("ok"), []))).toMatchObject({ kind: "var", name: "ok" });
  });
});

describe("condition templates (U-50)", () => {
  it("every template matches its own expression, under its own name first", () => {
    for (const template of CONDITION_TEMPLATES) {
      const matched = matchTemplate(expr(template.python.replace("a", "x").replace("b", "y")));
      expect(matched?.template.name).toBe(template.name);
      expect(matched).toMatchObject({ a: { name: "x" }, b: { name: "y" } });
    }
  });

  it("a slot holding a matching expression shows the template's sentence", () => {
    expect(exprText(expr("i % 15 == 0"))).toBe("i is divisible by 15");
    expect(exprText(expr("i % 15 == 1"))).toBe("i % 15 equals 1");
    expect(exprText(expr("n + 1 >= f(2)"))).toBe("n + 1 is at least f(2)");
    expect(exprText(expr("x in nums and not x != 3"))).toBe(
      "x is in nums and not x does not equal 3",
    );
    expect(exprText(expr("(a and b) == c"))).toBe("(a and b) equals c");
  });

  it("`is divisible by` also matches as `equals`, second; anything else matches nothing", () => {
    expect(matchTemplates(expr("i % 3 == 0")).map((m) => m.template.name)).toEqual([
      "divisible",
      "equals",
    ]);
    expect(matchTemplates(expr("a + b"))).toEqual([]);
    expect(matchTemplates(expr("a and b"))).toEqual([]);
  });
});
