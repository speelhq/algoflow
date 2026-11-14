// A value line's text read at its caret: the word, the lists, the operation, and the choices.
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { addFunction } from "@/lang/edit";
import { ast } from "@/blocks/testing";
import { joinSpans } from "@/ui/chart/text";
import {
  caretMatches,
  caretOffersAll,
  caretOperation,
  caretSections,
  choose,
  readCaret,
  choiceLine,
  wordAt,
  type TextLine,
} from "./caret";
import { rowName, type LineContext, type Row } from "./choices";
import { allEntries } from "./entries";
import { explainOperation } from "./explain";
import { menuGroups } from "./menu";

const { program } = ast;

const ctx: LineContext = {
  variables: ["i", "total", "n", "ok", "nums", "x"],
  kinds: new Map<string, Kind>([
    ["i", "number"],
    ["total", "number"],
    ["n", "number"],
    ["ok", "truefalse"],
    ["nums", "list"],
    ["x", "number"],
  ]),
  functions: [{ name: "greet", params: ["name"] }],
  target: null,
};

/** A line with the caret at its end, or at `|`. */
function textLine(typed: string): TextLine {
  const caret = typed.indexOf("|");
  const text = typed.replace("|", "");
  const end = caret === -1 ? text.length : caret;
  return { text, start: end, end };
}

const entry = (label: string): Row => {
  const found = allEntries().find((candidate) => candidate.label === label);
  if (!found) throw new Error(label);
  return { type: "entry", entry: found };
};

/** The line a choice leaves, with `|` at its caret. */
function lineAfterChoice(line: TextLine, row: Row, context: LineContext = ctx): string | undefined {
  const left = choose(line, row, context.kinds);
  return left && `${left.text.slice(0, left.start)}|${left.text.slice(left.start)}`;
}

const groups = (line: TextLine, context: LineContext = ctx, all = false) =>
  caretSections(line, context, all).map((section) => [
    section.group,
    section.rows.map((row) => (row.type === "parentheses" ? "( )" : rowName(row))),
  ]);

describe("the word being typed (editor.md, Value line, Words)", () => {
  it("is the name that ends at the caret", () => {
    expect(wordAt(textLine("total + to"))).toEqual({ text: "to", start: 8 });
    expect(wordAt(textLine("x abs"))).toEqual({ text: "abs", start: 2 });
    expect(wordAt(textLine("nums "))).toEqual({ text: "", start: 5 });
    expect(wordAt(textLine("1e5"))).toEqual({ text: "", start: 3 });
  });

  it("is no word inside a text", () => {
    expect(wordAt(textLine('"ab'))).toEqual({ text: "", start: 3 });
    expect(wordAt(textLine('"a b"'))).toEqual({ text: "", start: 5 });
    expect(wordAt(textLine('"a" + b')).text).toBe("b");
  });

  it("is no word while text is selected", () => {
    expect(wordAt({ text: "total", start: 0, end: 5 }).text).toBe("");
  });

  it("matches after a value every entry that takes one, the value's kind first", () => {
    expect(caretMatches(textLine("x abs"), ctx).map(rowName)[0]).toBe("Absolute value");
    expect(caretMatches(textLine("i < n an"), ctx).map(rowName)[0]).toBe("And");
    expect(caretMatches(textLine("multiply"), ctx).map(rowName)).toEqual([]);
    expect(caretMatches(textLine("x multiply"), ctx).map(rowName)).toEqual(["Multiply"]);
  });

  it("matches where a value is expected the variables, the entries offered there, and every call", () => {
    expect(caretMatches(textLine("to"), ctx).map(rowName)).toEqual(["total"]);
    expect(caretMatches(textLine("ab"), ctx).map(rowName)).toEqual(["Absolute value"]);
    expect(caretMatches(textLine("gr"), ctx).map(rowName)).toEqual(["greet"]);
    expect(caretMatches(textLine("i + fi"), ctx)).toEqual([]);
  });
});

describe("the value list (editor.md, Value list)", () => {
  it("reads the text before the caret, less the word being typed", () => {
    expect(readCaret(textLine("total + to"), ctx.kinds).place).toBe("expected");
    expect(readCaret(textLine("x ab"), ctx.kinds)).toMatchObject({
      place: "after",
      kind: "number",
    });
    expect(readCaret(textLine("nums|"), ctx.kinds).place).toBe("expected");
    expect(readCaret(textLine("nums |"), ctx.kinds)).toMatchObject({
      place: "after",
      kind: "list",
    });
    // A print's values are one text, so a value is expected after a `,` outside any bracket.
    expect(readCaret(textLine("1, "), ctx.kinds).place).toBe("expected");
    expect(readCaret(textLine("1, nums "), ctx.kinds)).toMatchObject({
      place: "after",
      kind: "list",
    });
  });

  it("reads the text before a selection", () => {
    expect(readCaret({ text: "a + b", start: 4, end: 5 }, ctx.kinds).place).toBe("expected");
  });

  it("holds the groups where a value is expected", () => {
    expect(groups(textLine("")).map(([group]) => group)).toEqual([
      "variables",
      "values",
      "conditions",
      "calculate",
      "functions",
    ]);
    expect(groups(textLine("total + "))[3]).toEqual(["calculate", ["Random whole number", "( )"]]);
  });

  it("holds after a value the entries for its kind", () => {
    expect(groups(textLine("ok ")).map(([group]) => group)).toEqual([
      "conditions",
      "compare",
      "convert",
    ]);
    expect(groups(textLine("nums ")).map(([group]) => group)).toEqual([
      "items",
      "compare",
      "convert",
    ]);
    expect(groups(textLine("len(nums) ")).map(([group]) => group)).toEqual([
      "calculate",
      "compare",
      "convert",
    ]);
  });

  it("holds after a value of no known kind every entry that takes a value", () => {
    const rows = caretSections(textLine("nums[0] "), ctx, false).flatMap((section) => section.rows);
    expect(rows).toHaveLength(allEntries().filter((each) => each.declared.on).length);
  });

  it("holds no row inside a text", () => {
    expect(caretSections(textLine('"ab'), ctx, false)).toEqual([]);
    expect(caretSections(textLine('"ab'), ctx, true)).toEqual([]);
    expect(caretOffersAll(textLine('"ab'), ctx)).toBe(false);
  });

  it("holds no row where no expression ends at the caret", () => {
    expect(caretSections(textLine("nums."), ctx, false)).toEqual([]);
    expect(caretSections(textLine("nums.co"), ctx, true)).toEqual([]);
    expect(caretMatches(textLine("nums.co"), ctx)).toEqual([]);
    expect(caretOffersAll(textLine("nums."), ctx)).toBe(false);
    expect(choose(textLine("nums."), entry("Count"), ctx.kinds)).toBeUndefined();
  });
});

describe("choosing (editor.md, Value list, Choosing)", () => {
  it("writes each example of the spec, with the caret where it puts it", () => {
    expect(lineAfterChoice(textLine("nums "), entry("Count"))).toBe("len(nums)|");
    expect(lineAfterChoice(textLine("total "), entry("Add"))).toBe("total + |");
    expect(lineAfterChoice(textLine("nums "), entry("Item at a position"))).toBe("nums[|]");
    expect(lineAfterChoice(textLine(""), entry("Random whole number"))).toBe("random.randint(|)");
    expect(lineAfterChoice(textLine(""), entry("Text"))).toBe('"|"');
    expect(lineAfterChoice(textLine(""), { type: "parentheses" })).toBe("(|)");
    expect(lineAfterChoice(textLine("i + nums "), entry("Item at a position"))).toBe("i + nums[|]");
    expect(lineAfterChoice(textLine("i < n "), entry("As text"))).toBe("str(i < n)|");
  });

  it("writes `abs(x)` for `x abs` with `Absolute value` chosen", () => {
    expect(lineAfterChoice(textLine("x abs"), entry("Absolute value"))).toBe("abs(x)|");
  });

  it("writes an operator after the value before it, which binds by its precedence", () => {
    expect(lineAfterChoice(textLine("a or b "), entry("Add"))).toBe("a or b + |");
    expect(lineAfterChoice(textLine("len(i "), entry("Multiply"))).toBe("len(i * |");
  });

  it("leaves out a separator that only slots it doesn't fill follow", () => {
    expect(lineAfterChoice(textLine("x "), entry("Larger of two"))).toBe("max(x|)");
    expect(
      lineAfterChoice(textLine(""), { type: "function", fn: { name: "pair", params: ["a", "b"] } }),
    ).toBe("pair(|)");
  });

  it("writes in place of the word being typed, and keeps the text after the caret", () => {
    expect(lineAfterChoice(textLine("total + to| * 2"), { type: "variable", name: "total" })).toBe(
      "total + total| * 2",
    );
  });

  it("writes in place of the selection", () => {
    const line = { text: "a + b", start: 4, end: 5 };
    expect(lineAfterChoice(line, { type: "variable", name: "total" })).toBe("a + total|");
  });

  it("keeps the value it takes as typed, a `$` included", () => {
    expect(lineAfterChoice(textLine(`"a$'b" `), entry("Count"))).toBe(`len("a$'b")|`);
    expect(lineAfterChoice(textLine('"p$$q" '), entry("Add"))).toBe('"p$$q" + |');
  });

  it("writes nothing inside a text", () => {
    expect(choose(textLine('"ab'), { type: "variable", name: "x" }, ctx.kinds)).toBeUndefined();
  });
});

describe("the block menu's text of a call (editor.md, Block menu)", () => {
  it("writes `greet()` for a call of the program's function, the caret inside", () => {
    const made = addFunction(program([]), "greet", ["name"]);
    const call = menuGroups(made, { parent: "main", slot: "main", index: 0 })
      .flatMap((group) => group.entries)
      .find((each) => each.id === "call:greet");
    const stmt = call?.create();
    expect(stmt && stmt.type === "expr" ? choiceLine(stmt.expr).text : undefined).toBe("greet()");
    expect(call?.caret).toBe(6);
  });
});

describe("a target's line (editor.md, Targets)", () => {
  const target: LineContext = {
    ...ctx,
    target: { asked: ["result"], names: ["i", "nums"], binds: true },
  };

  it("leaves out the rows that would write no target", () => {
    expect(groups(textLine("nums "), target)).toEqual([["items", ["Item at a position"]]]);
    expect(groups(textLine("nums + "), target)).toEqual([]);
    expect(groups(textLine("i j "), target)).toEqual([]);
  });

  it("offers a value line's rows inside the target's slots, without `This problem`", () => {
    expect(groups(textLine("nums["), target).map(([group]) => group)).toEqual([
      "variables",
      "values",
      "conditions",
      "calculate",
      "functions",
    ]);
  });

  it("offers the name list where the text is only the word being typed, or nothing", () => {
    expect(groups(textLine(""), target)).toEqual([
      ["problem", ["result"]],
      ["variables", ["i", "nums"]],
    ]);
    expect(groups(textLine("cou"), target)).toEqual([["new", ["cou"]]]);
    expect(caretOffersAll(textLine(""), target)).toBe(false);
    expect(caretOffersAll(textLine("nums "), target)).toBe(true);
    // No `Show all` where the list holds no row, nor while a word is typed.
    expect(caretOffersAll(textLine("nums + "), target)).toBe(false);
    expect(caretOffersAll(textLine("x ab"), ctx)).toBe(false);
  });
});

describe("the operation the explanation line explains (editor.md, Explanation line)", () => {
  it("is read from the text before the caret, the caret's slot underlined", () => {
    const inside = caretOperation(textLine("dp["), ctx.kinds);
    const explained = inside && explainOperation(inside, ctx.kinds, program([]));
    expect(explained && joinSpans(explained.name)).toBe("Item at a position");
    expect(explained && joinSpans(explained.spans)).toBe("dp[value]");
    expect(explained?.spans[1]).toEqual({ text: "value", hint: true, underline: true });
  });

  it("holds the value that ends at the caret in its slot", () => {
    const inside = caretOperation(textLine("total + 1"), ctx.kinds);
    const explained = inside && explainOperation(inside, ctx.kinds, program([]));
    expect(explained?.spans.at(-1)).toEqual({ text: "1", underline: true });
    expect(caretOperation(textLine("total"), ctx.kinds)).toBeUndefined();
    expect(caretOperation(textLine('len("a'), ctx.kinds)).toBeUndefined();
  });
});
