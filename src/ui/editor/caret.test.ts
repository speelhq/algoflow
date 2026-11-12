// A value line's text read at its caret: the word, the lists, the operation, and the choices.
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { addFunction } from "@/lang/edit";
import { program } from "@/blocks/testing";
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
function at(typed: string): TextLine {
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
function chosen(line: TextLine, row: Row, context: LineContext = ctx): string | undefined {
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
    expect(wordAt(at("total + to"))).toEqual({ text: "to", start: 8 });
    expect(wordAt(at("x abs"))).toEqual({ text: "abs", start: 2 });
    expect(wordAt(at("nums "))).toEqual({ text: "", start: 5 });
    expect(wordAt(at("1e5"))).toEqual({ text: "", start: 3 });
  });

  it("is no word inside a text", () => {
    expect(wordAt(at('"ab'))).toEqual({ text: "", start: 3 });
    expect(wordAt(at('"a b"'))).toEqual({ text: "", start: 5 });
    expect(wordAt(at('"a" + b')).text).toBe("b");
  });

  it("is no word while text is selected", () => {
    expect(wordAt({ text: "total", start: 0, end: 5 }).text).toBe("");
  });

  it("matches after a value every entry that takes one, the value's kind first", () => {
    expect(caretMatches(at("x abs"), ctx).map(rowName)[0]).toBe("Absolute value");
    expect(caretMatches(at("i < n an"), ctx).map(rowName)[0]).toBe("And");
    expect(caretMatches(at("multiply"), ctx).map(rowName)).toEqual([]);
    expect(caretMatches(at("x multiply"), ctx).map(rowName)).toEqual(["Multiply"]);
  });

  it("matches where a value is expected the variables, the entries offered there, and every call", () => {
    expect(caretMatches(at("to"), ctx).map(rowName)).toEqual(["total"]);
    expect(caretMatches(at("ab"), ctx).map(rowName)).toEqual(["Absolute value"]);
    expect(caretMatches(at("gr"), ctx).map(rowName)).toEqual(["greet"]);
    expect(caretMatches(at("i + fi"), ctx)).toEqual([]);
  });
});

describe("the value list (editor.md, Value list)", () => {
  it("reads the text before the caret, less the word being typed", () => {
    expect(readCaret(at("total + to"), ctx.kinds).place).toBe("expected");
    expect(readCaret(at("x ab"), ctx.kinds)).toMatchObject({ place: "after", kind: "number" });
    expect(readCaret(at("nums|"), ctx.kinds).place).toBe("expected");
    expect(readCaret(at("nums |"), ctx.kinds)).toMatchObject({ place: "after", kind: "list" });
    // A print's values are one text, so a value is expected after a `,` outside any bracket.
    expect(readCaret(at("1, "), ctx.kinds).place).toBe("expected");
    expect(readCaret(at("1, nums "), ctx.kinds)).toMatchObject({ place: "after", kind: "list" });
  });

  it("reads the text before a selection", () => {
    expect(readCaret({ text: "a + b", start: 4, end: 5 }, ctx.kinds).place).toBe("expected");
  });

  it("holds the groups where a value is expected", () => {
    expect(groups(at("")).map(([group]) => group)).toEqual([
      "variables",
      "values",
      "conditions",
      "calculate",
      "functions",
    ]);
    expect(groups(at("total + "))[3]).toEqual(["calculate", ["Random whole number", "( )"]]);
  });

  it("holds after a value the entries for its kind", () => {
    expect(groups(at("ok ")).map(([group]) => group)).toEqual(["conditions", "compare", "convert"]);
    expect(groups(at("nums ")).map(([group]) => group)).toEqual(["items", "compare", "convert"]);
    expect(groups(at("len(nums) ")).map(([group]) => group)).toEqual([
      "calculate",
      "compare",
      "convert",
    ]);
  });

  it("holds after a value of no known kind every entry that takes a value", () => {
    const rows = caretSections(at("nums[0] "), ctx, false).flatMap((section) => section.rows);
    expect(rows).toHaveLength(allEntries().filter((each) => each.declared.on).length);
  });

  it("holds no row inside a text", () => {
    expect(caretSections(at('"ab'), ctx, false)).toEqual([]);
    expect(caretSections(at('"ab'), ctx, true)).toEqual([]);
    expect(caretOffersAll(at('"ab'), ctx)).toBe(false);
  });

  it("holds no row where no expression ends at the caret", () => {
    expect(caretSections(at("nums."), ctx, false)).toEqual([]);
    expect(caretSections(at("nums.co"), ctx, true)).toEqual([]);
    expect(caretMatches(at("nums.co"), ctx)).toEqual([]);
    expect(caretOffersAll(at("nums."), ctx)).toBe(false);
    expect(choose(at("nums."), entry("Count"), ctx.kinds)).toBeUndefined();
  });
});

describe("choosing (editor.md, Value list, Choosing)", () => {
  it("writes each example of the spec, with the caret where it puts it", () => {
    expect(chosen(at("nums "), entry("Count"))).toBe("len(nums)|");
    expect(chosen(at("total "), entry("Add"))).toBe("total + |");
    expect(chosen(at("nums "), entry("Item at a position"))).toBe("nums[|]");
    expect(chosen(at(""), entry("Random whole number"))).toBe("random.randint(|)");
    expect(chosen(at(""), entry("Text"))).toBe('"|"');
    expect(chosen(at(""), { type: "parentheses" })).toBe("(|)");
    expect(chosen(at("i + nums "), entry("Item at a position"))).toBe("i + nums[|]");
    expect(chosen(at("i < n "), entry("As text"))).toBe("str(i < n)|");
  });

  it("writes `abs(x)` for `x abs` with `Absolute value` chosen", () => {
    expect(chosen(at("x abs"), entry("Absolute value"))).toBe("abs(x)|");
  });

  it("writes an operator after the value before it, which binds by its precedence", () => {
    expect(chosen(at("a or b "), entry("Add"))).toBe("a or b + |");
    expect(chosen(at("len(i "), entry("Multiply"))).toBe("len(i * |");
  });

  it("leaves out a separator that only slots it doesn't fill follow", () => {
    expect(chosen(at("x "), entry("Larger of two"))).toBe("max(x|)");
    expect(chosen(at(""), { type: "function", fn: { name: "pair", params: ["a", "b"] } })).toBe(
      "pair(|)",
    );
  });

  it("writes in place of the word being typed, and keeps the text after the caret", () => {
    expect(chosen(at("total + to| * 2"), { type: "variable", name: "total" })).toBe(
      "total + total| * 2",
    );
  });

  it("writes in place of the selection", () => {
    const line = { text: "a + b", start: 4, end: 5 };
    expect(chosen(line, { type: "variable", name: "total" })).toBe("a + total|");
  });

  it("keeps the value it takes as typed, a `$` included", () => {
    expect(chosen(at(`"a$'b" `), entry("Count"))).toBe(`len("a$'b")|`);
    expect(chosen(at('"p$$q" '), entry("Add"))).toBe('"p$$q" + |');
  });

  it("writes nothing inside a text", () => {
    expect(choose(at('"ab'), { type: "variable", name: "x" }, ctx.kinds)).toBeUndefined();
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
    expect(groups(at("nums "), target)).toEqual([["items", ["Item at a position"]]]);
    expect(groups(at("nums + "), target)).toEqual([]);
    expect(groups(at("i j "), target)).toEqual([]);
  });

  it("offers a value line's rows inside the target's slots, without `This problem`", () => {
    expect(groups(at("nums["), target).map(([group]) => group)).toEqual([
      "variables",
      "values",
      "conditions",
      "calculate",
      "functions",
    ]);
  });

  it("offers the name list where the text is only the word being typed, or nothing", () => {
    expect(groups(at(""), target)).toEqual([
      ["problem", ["result"]],
      ["variables", ["i", "nums"]],
    ]);
    expect(groups(at("cou"), target)).toEqual([["new", ["cou"]]]);
    expect(caretOffersAll(at(""), target)).toBe(false);
    expect(caretOffersAll(at("nums "), target)).toBe(true);
    // No `Show all` where the list holds no row, nor while a word is typed.
    expect(caretOffersAll(at("nums + "), target)).toBe(false);
    expect(caretOffersAll(at("x ab"), ctx)).toBe(false);
  });
});

describe("the operation the explanation line explains (editor.md, Explanation line)", () => {
  it("is read from the text before the caret, the caret's slot underlined", () => {
    const inside = caretOperation(at("dp["), ctx.kinds);
    const explained = inside && explainOperation(inside, ctx.kinds, program([]));
    expect(explained && joinSpans(explained.name)).toBe("Item at a position");
    expect(explained && joinSpans(explained.spans)).toBe("dp[value]");
    expect(explained?.spans[1]).toEqual({ text: "value", hint: true, underline: true });
  });

  it("holds the value that ends at the caret in its slot", () => {
    const inside = caretOperation(at("total + 1"), ctx.kinds);
    const explained = inside && explainOperation(inside, ctx.kinds, program([]));
    expect(explained?.spans.at(-1)).toEqual({ text: "1", underline: true });
    expect(caretOperation(at("total"), ctx.kinds)).toBeUndefined();
    expect(caretOperation(at('len("a'), ctx.kinds)).toBeUndefined();
  });
});
