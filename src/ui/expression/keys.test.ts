// U-50, U-53, U-93: keys typed in a value line, and the list it shows (U-52).
import { describe, expect, it } from "vitest";
import type { Kind } from "@/lang/types";
import { program } from "@/nodes/testing";
import { unparse } from "@/python/emit";
import { atInput, choose, press, stateOf, type LineState } from "./keys";
import { empty, lineOf } from "./line";
import { afterGroups, allGroups, closest, kindsOf, matches, valueGroups, type Row } from "./list";

const KINDS = new Map<string, Kind>([
  ["i", "number"],
  ["n", "number"],
  ["total", "number"],
  ["nums", "list"],
  ["ok", "truefalse"],
]);
const variables = [...KINDS].map(([name, of]) => ({ name, of }));
const p = program([]);

/** The rows the list shows for the state: matches of the word, else its groups. */
function rows(state: LineState): Row[] {
  const groups = atInput(state)
    ? valueGroups(p, variables)
    : afterGroups(undefined).concat(allGroups(p));
  return matches(groups, state.draft);
}

function type(keys: string[], state = stateOf(lineOf(empty()))): LineState {
  let s = state;
  for (const key of keys) {
    const out = press(s, key, rows(s), KINDS);
    if ("state" in out) s = out.state;
  }
  return s;
}

const chars = (text: string) => text.split("");
const typed = (text: string) => unparse(type(chars(text)).line.root);

describe("keys (U-93)", () => {
  it("names and digits, then operators as the chart writes them", () => {
    expect(typed("total+i*2")).toBe("total + i * 2");
    expect(typed("i%15==0")).toBe("i % 15 == 0");
    expect(typed("a!=3".replace("a", "n"))).toBe("n != 3");
    expect(typed("n<=3")).toBe("n <= 3");
    expect(typed("n>=3")).toBe("n >= 3");
    expect(typed("n**2")).toBe("n ** 2");
    // `**` binds by its own precedence, though `*` was typed first.
    expect(typed("2*3**2")).toBe("2 * 3 ** 2");
    expect(type(chars("2*3**2")).line.root).toMatchObject({ op: "*", right: { op: "**" } });
    expect(typed("-n**2")).toBe("-n ** 2");
    expect(type(chars("-n**2")).line.root).toMatchObject({ op: "neg", operand: { op: "**" } });
    expect(typed("n//2")).toBe("n // 2");
    expect(typed("-3")).toBe("-3");
    expect(typed("(n+1)*2")).toBe("(n + 1) * 2");
  });

  it("a single = inserts nothing, and a second comparison is refused", () => {
    expect(typed("n=3")).toBe("n");
    const refused = type(chars("n<3<"));
    expect(unparse(refused.line.root)).toBe("n < 3");
    expect(refused.message).toBe("error.E_PARSE_CHAIN");
  });

  it("words: a variable or an entry chosen by its name or its keys", () => {
    expect(
      unparse(type([...chars("ok"), " ", ...chars("and"), " ", ...chars("ok"), " "]).line.root),
    ).toBe("ok and ok");
    expect(unparse(type([...chars("not"), " ", ...chars("ok"), " "]).line.root)).toBe("not ok");
    expect(
      unparse(type([...chars("i"), " ", ...chars("in"), " ", ...chars("nums"), " "]).line.root),
    ).toBe("i in nums");
  });

  it("Enter chooses the first match while a word is typed, else closes", () => {
    const state = type(chars("tot"));
    const out = press(state, "Enter", rows(state), KINDS);
    expect("state" in out && unparse(out.state.line.root)).toBe("total");
    expect(press(stateOf(lineOf(empty())), "Enter", [], KINDS)).toEqual({ close: true });
  });

  it("Backspace removes a letter of the word, then what is before the caret", () => {
    expect(type([...chars("tot"), "Backspace"]).draft).toBe("to");
    expect(unparse(type([...chars("n+"), "Backspace"]).line.root)).toBe("n");
  });

  it(", opens the next item of a list of values", () => {
    const state = type(chars("n"));
    expect(press(state, ",", rows(state), KINDS, true)).toEqual({ nextItem: true });
  });
});

describe("the list (U-52)", () => {
  const ids = (groups: ReturnType<typeof valueGroups>) => groups.map((group) => group.id);

  it("where a value is expected: variables with their kind, values, order, combine, functions", () => {
    const groups = valueGroups(p, variables);
    expect(ids(groups)).toEqual(["variables", "values", "order", "combine", "functions"]);
    expect(groups[1]?.rows.map((row) => row.type === "entry" && row.label)).toEqual([
      "Text",
      "True",
      "False",
      "None",
    ]);
  });

  it("after a value: the entries for its kind, grouped by purpose", () => {
    const number = afterGroups("number");
    expect(ids(number)).toEqual(["calculate", "compare", "convert"]);
    expect(number[0]?.rows.map((row) => row.type === "entry" && row.label)).toEqual([
      "Add",
      "Subtract",
      "Multiply",
      "Divide",
      "Remainder",
      "Whole-number quotient",
      "Power",
      "Absolute value",
    ]);
    expect(ids(afterGroups("truefalse"))).toEqual(["combine", "compare", "convert"]);
    expect(ids(afterGroups("list"))).toEqual(["compare", "convert", "other"]);
  });

  it("a word finds an entry by its name or keys, and an unknown word its closest", () => {
    const groups = afterGroups(undefined);
    expect(matches(groups, "multiply").map((row) => row.type === "entry" && row.symbol)).toEqual([
      "×",
    ]);
    expect(matches(groups, "%").map((row) => row.type === "entry" && row.label)).toEqual([
      "Remainder",
    ]);
    expect(closest(valueGroups(p, variables), "totl")).toBe("total");
    expect(closest(valueGroups(p, variables), "zzzzzz")).toBeUndefined();
    // A word's start ranks before its inside, and the entries for the kind before the caret
    // before the rest: `an` after a comparison is And, not Less than.
    const after = (kind: string) => (row: Row) =>
      row.type === "entry" && (kindsOf(row) as string[]).includes(kind);
    expect(matches(groups, "an", after("truefalse"))[0]).toMatchObject({ label: "And" });
    // Only a word's start matches: `i` is not found inside `first`.
    expect(matches(valueGroups(p, []), "i").map((row) => row.type)).toEqual([]);
    // A short word is not taken for another two letters away (`totl` is not `Not`).
    expect(closest(valueGroups(p, []), "totl")).toBeUndefined();
  });

  it("Show all lists what can be chosen at the caret, and every row of it acts", () => {
    const at = stateOf(lineOf(empty()));
    const multiply = allGroups(p)
      .flatMap((group) => group.rows)
      .find((row) => row.type === "entry" && row.label === "Multiply");
    expect(multiply && unparse(choose(at, multiply).line.root)).toBe("... * ...");
    const after = allGroups(p, true).flatMap((group) => group.rows);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((row) => row.type === "entry" && row.after)).toBe(true);
  });

  it("a chosen entry after a value takes it; where a value is expected it fills the input", () => {
    const state = type(["n", " "]);
    const abs = matches(afterGroups("number"), "absolute")[0];
    expect(abs && unparse(choose(state, abs).line.root)).toBe("abs(n)");
    const max = matches(valueGroups(p, variables), "larger")[0];
    expect(max && unparse(choose(stateOf(lineOf(empty())), max).line.root)).toBe("max(..., ...)");
  });
});
