// The explanation line explains what the list highlights or the caret is in.
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { ast, program } from "@/blocks/testing";
import { joinSpans } from "@/ui/chart/text";
import { allEntries, labelOf, makeEntry } from "./entries";
import type { TextLine } from "./caret";
import { explainEditor, explainLine, explainVariable } from "./explain";
import type { LineContext } from "./choices";

const { assign, num, bin, v, for_, print, empty } = ast;

const ctx: LineContext = {
  variables: ["i", "total", "n"],
  kinds: new Map<string, Kind>([
    ["i", "number"],
    ["total", "number"],
    ["n", "number"],
  ]),
  functions: [],
  target: null,
};

/** A line holding `text`, the caret at its end. */
const at = (text: string): TextLine => ({ text, start: text.length, end: text.length });

const shown = (explained: ReturnType<typeof explainLine>) =>
  explained && [joinSpans(explained.name), explained.spans.map((span) => span.text).join("")];

const target = print(empty());
const p = program(
  [assign("total", num(0)), for_("i", num(1), bin("+", v("n"), num(1)), [target])],
  { inputs: [{ name: "n", kind: "number" }] },
);

describe("explanation line", () => {
  it("an entry: its name and its help, ending with how to type it", () => {
    const remainder = allEntries().find((entry) => entry.id === "binop.mod");
    if (!remainder) throw new Error("no Remainder");
    const explained = explainLine(at("i"), ctx, { type: "entry", entry: remainder }, p, target.id);
    expect(explained && joinSpans(explained.name)).toBe("Remainder");
    expect(explained?.spans.at(-2)).toEqual({ text: "%", key: true });
    expect(shown(explained)?.[1]).toMatch(/is 1\. Type %\.$/);
    const text = allEntries().find((entry) => entry.id === "str");
    if (!text) throw new Error("no Text");
    const plain = explainLine(at(""), ctx, { type: "entry", entry: text }, p, target.id);
    expect(shown(plain)?.[1]).toBe("A piece of text, typed between quotes.");
  });

  it("a variable: its kind and where it first gets a value; an input; a new name", () => {
    expect(explainVariable(p, target.id, "i")).toBe(
      "A number variable. It first gets a value in: i ← 1.",
    );
    expect(explainVariable(p, target.id, "total")).toBe(
      "A number variable. It first gets a value in: total ← 0.",
    );
    expect(explainVariable(p, target.id, "n")).toBe("A number input of the problem.");
    expect(explainVariable(p, target.id, "found")).toBe(
      "Choosing it makes a new variable found, which gets its value here.",
    );
  });

  it("inside an operation's slot: its name and its template with that slot underlined", () => {
    const explained = explainLine(at("total + "), ctx, undefined, p, target.id);
    expect(shown(explained)).toEqual(["Add", "total + value"]);
    // The empty slot is its hint, gray, and the caret's slot is underlined.
    expect(explained?.spans.at(-1)).toEqual({ text: "value", hint: true, underline: true });
    // A slot's value is parenthesized as the chart parenthesizes it.
    expect(shown(explainLine(at("(i+n)//"), ctx, undefined, p, target.id))).toEqual([
      "Whole-number quotient",
      "(i + n) // value",
    ]);
  });

  it("an operation is named by the entry offered after the kind of its first slot's value", () => {
    const lists: LineContext = { ...ctx, variables: ["nums"], kinds: new Map([["nums", "list"]]) };
    const typed = (text: string) => explainLine(at(text), lists, undefined, p, target.id);
    expect(shown(typed("nums+"))).toEqual(["Join with another list", "nums + value"]);
    // A list with items is named by its block; `Empty list` names one with none.
    expect(shown(typed("[1,"))?.[0]).toBe("List");
    const blank = allEntries().find((entry) => entry.id === "list.empty");
    if (!blank) throw new Error("no Empty list");
    const [one, two] = [makeEntry(blank), makeEntry(blank)];
    expect(labelOf(one, lists.kinds)).toBe("Empty list");
    const explained = explainLine(at(""), ctx, { type: "entry", entry: blank }, p, target.id);
    expect(explained?.spans.filter((span) => "key" in span)).toEqual([{ text: "[]", key: true }]);
    // Each made list has its own items, none shared with the block definition.
    expect(Reflect.get(one, "items")).not.toBe(Reflect.get(two, "items"));
  });

  it("a function of the program: its call, each argument its parameter's hint", () => {
    const fn = { name: "double", params: ["x", "times"] };
    const explained = explainLine(at(""), ctx, { type: "function", fn }, p, target.id);
    expect(explained?.name).toEqual([
      { text: "double(" },
      { text: "x", hint: true },
      { text: ", " },
      { text: "times", hint: true },
      { text: ")" },
    ]);
  });

  it("a word that matches nothing: the closest name, or that nothing is like it", () => {
    expect(shown(explainLine(at("totl"), ctx, undefined, p, target.id))).toEqual([
      "totl",
      "Did you mean total?",
    ]);
    expect(shown(explainLine(at("zzz"), ctx, undefined, p, target.id))?.[1]).toBe(
      "Nothing has this name. Check the spelling, or choose from the list.",
    );
  });

  it("nothing where no row is highlighted and no operation holds the caret, which leaves the block's help", () => {
    expect(explainLine(at("n "), ctx, undefined, p, target.id)).toBeUndefined();
  });
});

describe("the explanation line on the editor itself (editor.md, Explanation line)", () => {
  it("names Enter and Esc as the ways to close the editor, and how to remove the block", () => {
    const { name, spans } = explainEditor();
    expect(name).toEqual([]);
    expect(spans.filter((span) => "key" in span).map((span) => span.text)).toEqual([
      "Enter",
      "Esc",
      "Enter",
      "Delete",
    ]);
    expect(spans.map((span) => span.text).join("")).toContain("click Delete (the trash icon)");
  });
});
