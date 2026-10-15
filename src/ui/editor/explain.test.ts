// The explanation line explains what the list highlights or the caret is in.
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { ast, program } from "@/blocks/testing";
import { allEntries, labelOf, makeEntry } from "./entries";
import { explainLine, explainVariable } from "./explain";
import { openLine, settle, type, type Line, type LineContext } from "./line";

const { assign, num, bin, v, for_, print, empty } = ast;

const ctx: LineContext = {
  variables: ["i", "total", "n"],
  kinds: new Map<string, Kind>([
    ["i", "number"],
    ["total", "number"],
    ["n", "number"],
  ]),
  scope: { functions: [] },
  functions: [],
  target: null,
};

function keys(text: string, settled = true): Line {
  let line = openLine(empty());
  for (const key of text) line = type(line, key, ctx).line;
  return settled ? settle(line, ctx) : line;
}

const shown = (explained: ReturnType<typeof explainLine>) =>
  explained && [explained.name, explained.parts.map((part) => part.text).join("")];

const target = print(empty());
const p = program(
  [assign("total", num(0)), for_("i", num(1), bin("+", v("n"), num(1)), [target])],
  { inputs: [{ name: "n", kind: "number" }] },
);

describe("explanation line", () => {
  it("an entry: its name and its help, ending with how to type it", () => {
    const remainder = allEntries().find((entry) => entry.id === "binop.mod");
    if (!remainder) throw new Error("no Remainder");
    const explained = explainLine(
      keys("i"),
      ctx,
      { kind: "entry", entry: remainder },
      p,
      target.id,
    );
    expect(explained?.name).toBe("Remainder");
    expect(explained?.parts.at(-2)).toEqual({ text: "%", slot: "key" });
    expect(shown(explained)?.[1]).toMatch(/is 1\. Type %\.$/);
    const text = allEntries().find((entry) => entry.id === "str");
    if (!text) throw new Error("no Text");
    const plain = explainLine(keys(""), ctx, { kind: "entry", entry: text }, p, target.id);
    expect(shown(plain)?.[1]).toBe("A piece of text, typed without quotes.");
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

  it("inside an operation's input: its name and its template with that input underlined", () => {
    const explained = explainLine(keys("total+"), ctx, undefined, p, target.id);
    expect(shown(explained)).toEqual(["Add", "total + …"]);
    expect(explained?.parts.find((part) => part.underline)?.text).toBe("…");
    // An input is bracketed as the chart brackets it.
    expect(shown(explainLine(keys("(i+n)//"), ctx, undefined, p, target.id))).toEqual([
      "Whole-number quotient",
      "(i + n) // …",
    ]);
  });

  it("an operation is named by the entry offered after its first input's kind", () => {
    const lists: LineContext = { ...ctx, variables: ["nums"], kinds: new Map([["nums", "list"]]) };
    const typed = (text: string) => {
      let line = openLine(empty());
      for (const key of text) line = type(line, key, lists).line;
      return explainLine(line, lists, undefined, p, target.id);
    };
    expect(shown(typed("nums+"))).toEqual(["Join with another list", "nums + …"]);
    // A list with items is named by its block; `Empty list` names one with none.
    expect(typed("[1,")?.name).toBe("List");
    const blank = allEntries().find((entry) => entry.id === "list.empty");
    if (!blank) throw new Error("no Empty list");
    const [one, two] = [makeEntry(blank), makeEntry(blank)];
    expect(labelOf(one, lists.kinds)).toBe("Empty list");
    // Each made list has its own items, none shared with the menu.
    expect(Reflect.get(one, "items")).not.toBe(Reflect.get(two, "items"));
  });

  it("a word that matches nothing: the closest name, or that nothing is like it", () => {
    expect(shown(explainLine(keys("totl", false), ctx, undefined, p, target.id))).toEqual([
      "totl",
      "Did you mean total?",
    ]);
    expect(shown(explainLine(keys("zzz", false), ctx, undefined, p, target.id))?.[1]).toBe(
      "Nothing has this name. Check the spelling, or choose from the list.",
    );
  });

  it("a refused key's message; else nothing, which leaves the block's help", () => {
    const refused = type(keys("i<n"), "<", ctx).line;
    expect(shown(explainLine(refused, ctx, undefined, p, target.id))?.[1]).toBe(
      "Write a < b < c as a < b and b < c",
    );
    expect(explainLine(openLine(v("n")), ctx, undefined, p, target.id)).toBeUndefined();
  });
});
