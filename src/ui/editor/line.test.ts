// The value line as keys and choices change it.
import { describe, expect, it } from "vitest";
import type { Expr, Kind } from "@/lang/types";
import { ast, program } from "@/blocks/testing";
import { unparse } from "@/python/emit";
import { exprText } from "@/ui/chart/text";
import { allEntries, takesValue } from "./entries";
import {
  backspace,
  callableFunctions,
  choose,
  clickAt,
  endText,
  exactRow,
  lineTakes,
  matches,
  move,
  openLine,
  setText,
  settle,
  switchTo,
  tab,
  type,
  type Line,
  type LineContext,
  type Row,
} from "./line";
import { listSections } from "./list";

const ctx: LineContext = {
  variables: ["i", "total", "n", "ok", "nums"],
  kinds: new Map<string, Kind>([
    ["i", "number"],
    ["total", "number"],
    ["n", "number"],
    ["ok", "truefalse"],
    ["nums", "list"],
  ]),
  scope: { functions: ["twice"] },
  functions: [{ name: "twice", params: ["x"] }],
  target: null,
};

const empty = () => openLine(ast.empty());

/** Types `keys` one by one; a refused key leaves the line as it was. */
function keys(text: string, line: Line = empty()): Line {
  let current = line;
  for (const key of text) current = type(current, key, ctx).line;
  return settle(current, ctx);
}

/** Types `keys` and leaves the last word as typed. */
function raw(text: string, line: Line = empty()): Line {
  let current = line;
  for (const key of text) current = type(current, key, ctx).line;
  return current;
}

const py = (line: Line) => unparse(line.root);
const entry = (id: string): Row => {
  const found = allEntries().find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return { kind: "entry", entry: found };
};
const groups = (line: Line, all = false, context: LineContext = ctx) =>
  listSections(line, context, all).map((section) => [
    section.group,
    section.rows.map((row) =>
      row.kind === "entry"
        ? row.entry.label
        : row.kind === "variable" || row.kind === "new"
          ? row.name
          : row.kind === "function"
            ? row.fn.name
            : "( )",
    ),
  ]);

describe("typing", () => {
  it("keys insert what the chart writes", () => {
    expect(py(keys("i%15==0"))).toBe("i % 15 == 0");
    expect(exprText(keys("i%15==0").root)).toBe("i % 15 = 0");
    expect(py(keys("a<=b".replace("a", "i").replace("b", "n")))).toBe("i <= n");
    expect(py(keys("i!=n"))).toBe("i != n");
    expect(py(keys("i>=n"))).toBe("i >= n");
    expect(py(keys("i//2"))).toBe("i // 2");
    expect(py(keys("i-1"))).toBe("i - 1");
    expect(py(keys("i*2/n"))).toBe("i * 2 / n");
  });

  it("a single = inserts nothing; = typed twice is Equals", () => {
    expect(py(keys("i="))).toBe("i");
    expect(keys("i=").pending?.key).toBe("=");
    expect(py(keys("i=0"))).toBe("i");
  });

  it("a - at an input still to fill is the sign of what follows", () => {
    expect(py(keys("-1"))).toBe("-1");
    expect(py(keys("n*-1"))).toBe("n * -1");
    expect(py(keys("-i"))).toBe("-i");
  });

  it("digits make a number; a number Python rejects or one after another value is not taken", () => {
    expect(py(keys("2.5"))).toBe("2.5");
    expect(py(keys("07"))).toBe("0");
    expect(py(keys("1..5"))).toBe("1.5");
    expect(py(keys("i 5"))).toBe("i");
    expect(keys("i 5").root).toMatchObject({ kind: "var", name: "i" });
  });

  it("a digit that would make an int outside the int range is not taken", () => {
    expect(py(keys("9007199254740991"))).toBe("9007199254740991");
    expect(py(keys("90071992547409911"))).toBe("9007199254740991");
    expect(py(keys("9007199254740992"))).toBe("900719925474099");
  });

  it("the line takes keys without Ctrl or Cmd, and what AltGr makes", () => {
    const key = (ctrlKey: boolean, metaKey: boolean, altGraph = false) => ({
      ctrlKey,
      metaKey,
      getModifierState: (state: string) => altGraph && state === "AltGraph",
    });
    expect(lineTakes(key(false, false))).toBe(true);
    expect(lineTakes(key(true, false))).toBe(false);
    expect(lineTakes(key(false, true))).toBe(false);
    // AltGr on Windows reports Ctrl too.
    expect(lineTakes(key(true, false, true))).toBe(true);
  });

  it("an operator's key at an input still to fill inserts nothing", () => {
    expect(type(empty(), "*", ctx).taken).toBe(false);
    expect(type(keys("i+"), "*", ctx).taken).toBe(false);
  });

  it("operators bind by precedence; ** and // typed as two keys bind by their own", () => {
    expect(py(keys("total+i*2"))).toBe("total + i * 2");
    expect(py(keys("total*i+2"))).toBe("total * i + 2");
    expect(py(keys("i-n-1"))).toBe("i - n - 1");
    expect(py(keys("2*3**2"))).toBe("2 * 3 ** 2");
    expect(keys("2*3**2").root).toMatchObject({ op: "*", right: { op: "**" } });
    expect(py(keys("2**3**2"))).toBe("2 ** 3 ** 2");
    expect(py(keys("-3**2"))).toBe("-3 ** 2");
    expect(py(keys("i<n and ok"))).toBe("i < n and ok");
    expect(py(keys("not ok and ok"))).toBe("not ok and ok");
    expect(keys("not ok and ok").root).toMatchObject({ op: "and", left: { op: "not" } });
  });

  it("brackets group what is inside them and are not stored", () => {
    const line = keys("(i+1)*2");
    expect(py(line)).toBe("(i + 1) * 2");
    expect(line.open).toEqual([]);
    expect(keys("(i+1").open).toHaveLength(1);
    expect(py(keys("2*(i+1"))).toBe("2 * (i + 1)");
  });

  it("a click inside an open bracket keeps it open; a call's ( is its own and ) leaves it", () => {
    const opened = raw("i*(5");
    const clicked = clickAt(opened, (opened.root as Extract<Expr, { kind: "binop" }>).right.id);
    expect(clicked.open).toHaveLength(1);
    expect(py(keys("+1", clicked))).toBe("i * (5 + 1)");
    expect(py(keys("twice(i)+1"))).toBe("twice(i) + 1");
    expect(py(keys("abs(i)+1"))).toBe("abs(i) + 1");
    expect(py(keys("str(n)"))).toBe("str(n)");
    expect(py(keys("i abs"))).toBe("abs(i)");
    const random = raw("randint(");
    expect([py(random), random.open]).toEqual(["random.randint(..., ...)", []]);
    expect(py(keys("i)", random))).toBe("random.randint(i, ...)");
    const abs = keys("i", choose(empty(), entry("call:abs"), ctx).line);
    expect(type(abs, ")", ctx).line.caret).toEqual({ after: abs.root.id });
    // Inside a call, a variable's ( opens nothing.
    expect(type(raw("randint(i"), "(", ctx).taken).toBe(false);
  });

  it("`)` closes a call begun inside brackets before the brackets", () => {
    expect(py(keys("2*(abs(i)-1)"))).toBe("2 * (abs(i) - 1)");
    expect(py(keys("(abs(i)+1)*2"))).toBe("(abs(i) + 1) * 2");
    expect(py(keys("(min(i,n))*2"))).toBe("min(i, n) * 2");
    expect(py(keys("abs((i+1)*2)"))).toBe("abs((i + 1) * 2)");
  });

  it("`,` in a call moves to its next input, and elsewhere to the slot's next value", () => {
    expect(py(keys("randint(1,6)"))).toBe("random.randint(1, 6)");
    expect(py(keys("min(i,n+1)"))).toBe("min(i, n + 1)");
    expect(py(keys("twice(abs(i),"))).toBe("twice(abs(i))");
    expect(type(raw("twice(1"), ",", ctx).taken).toBe(false);
    expect(type(keys("max(i,n)"), ",", ctx).move).toBe("item");
    expect(type(keys("1"), ",", ctx).move).toBe("item");
    // A filled next input takes the caret at its end.
    const filled = keys("min(i,n+1)");
    const [first, second] = (filled.root as Extract<Expr, { kind: "call" }>).args;
    const moved = type(clickAt(filled, first?.id ?? ""), ",", ctx).line;
    const one = (second as Extract<Expr, { kind: "binop" }>).right;
    expect(moved.caret).toEqual({ after: one.id });
  });

  it("`[` opens a list with an item to fill; `,` adds an item, and `]` leaves the list", () => {
    expect(py(keys("[4,9,2]"))).toBe("[4, 9, 2]");
    expect(py(keys("[i+1,n]"))).toBe("[i + 1, n]");
    expect(py(keys("[[1,2],[3]]"))).toBe("[[1, 2], [3]]");
    expect(py(keys("[abs(i),2]"))).toBe("[abs(i), 2]");
    expect(py(raw("["))).toBe("[...]");
    // `]` removes an item still to fill at the end first, so `[` then `]` is an empty list.
    expect(py(keys("[]"))).toBe("[]");
    expect(py(keys("[4,]"))).toBe("[4]");
    const left = keys("[1]");
    expect(left.caret).toEqual({ after: left.root.id });
    // Once the list is left, `,` is the slot's next value again.
    expect(type(left, ",", ctx).move).toBe("item");
    // A selected value is replaced by the list typed.
    expect(py(keys("[1]", openLine(ast.num(5))))).toBe("[1]");
  });

  it("`]` leaves the innermost item or list around the caret", () => {
    const inList = keys("i]", choose(keys("[nums "), entry("index"), ctx).line);
    expect(py(inList)).toBe("[nums[i]]");
    // The item is left, so a `,` adds the list's next item.
    expect(py(keys(",2]", inList))).toBe("[nums[i], 2]");
    const alone = keys("0]", choose(keys("nums "), entry("index"), ctx).line);
    expect(alone.caret).toEqual({ after: alone.root.id });
  });

  it("`[` after a value inserts an item of it, typed as the chart writes it", () => {
    expect(py(keys("nums[i]"))).toBe("nums[i]");
    expect(py(keys("nums[i+1]-1"))).toBe("nums[i + 1] - 1");
    expect(py(keys("nums[nums[0]]"))).toBe("nums[nums[0]]");
    expect(py(keys("[4,9][1]"))).toBe("[4, 9][1]");
    // It binds to the value just before it, as Python reads it, typed or chosen alike.
    expect(py(keys("i+nums[0]"))).toBe("i + nums[0]");
    expect(py(choose(keys("i+nums"), entry("index"), ctx).line)).toBe("i + nums[...]");
    expect(py(keys("(i+n)[0]"))).toBe("(i + n)[0]");
    expect(py(keys("abs(i)[0]"))).toBe("abs(i)[0]");
    expect(py(keys("nums[i]>nums[i+1]"))).toBe("nums[i] > nums[i + 1]");
    // In place of a selected value, `[` opens a list.
    expect(py(keys("[1]", openLine(ast.v("nums"))))).toBe("[1]");
  });

  it("`]` outside a list or an item inserts nothing", () => {
    expect(type(keys("i"), "]", ctx).taken).toBe(false);
    expect(type(raw("abs(i"), "]", ctx).taken).toBe(false);
  });

  it("an item and a count are chosen after a list, as the chart writes them", () => {
    const item = keys("i+1", choose(keys("nums"), entry("index"), ctx).line);
    expect(py(item)).toBe("nums[i + 1]");
    expect(py(keys("nums len"))).toBe("len(nums)");
    expect(py(keys("len(nums)-1"))).toBe("len(nums) - 1");
    expect(py(keys("nums sum"))).toBe("sum(nums)");
  });

  it("Tab forgets the first key of a two-key operator", () => {
    const moved = tab(raw("i*"), 1, ctx).line;
    expect(moved.pending).toBeUndefined();
    expect(type(moved, "*", ctx).taken).toBe(false);
  });

  it("a comparison typed after a comparison is refused with E_PARSE_CHAIN's message", () => {
    const line = keys("i<n");
    const refused = type(line, "<", ctx);
    expect(refused.taken).toBe(false);
    expect(refused.line.refused).toBe("Write a < b < c as a < b and b < c");
    expect(py(keys("(i<n)==ok"))).toBe("(i < n) == ok");
  });

  it("a word ends at a space or a key: chosen when it names one exactly, else it stays", () => {
    expect(py(keys("total+1"))).toBe("total + 1");
    const typo = raw("totl+");
    expect(typo.word).toBe("totl");
    expect(py(typo)).toBe("...");
    expect(py(keys("i and ok"))).toBe("i and ok");
    expect(py(keys("i in nums"))).toBe("i in nums");
  });

  it("a word matches the start of a name's words or an entry's keys, the kind's first", () => {
    const after = raw("i==0 an");
    expect(matches(after, ctx).map((row) => (row.kind === "entry" ? row.entry.label : ""))[0]).toBe(
      "And",
    );
    const names = matches(raw("t"), ctx).map((row) =>
      row.kind === "variable" ? row.name : row.kind === "entry" ? row.entry.label : row.kind,
    );
    // Where a value is expected, the calls are offered too (`As text` is `str`).
    expect(names).toEqual([
      "total",
      "Text",
      "True",
      "Larger of two",
      "Smaller of two",
      "As text",
      "function",
    ]);
    expect(exactRow(raw("i"), ctx)).toEqual({ kind: "variable", name: "i" });
    expect(matches(raw("i%"), ctx)).toEqual([]);
    expect(
      matches(raw("n mult"), ctx).map((row) => row.kind === "entry" && row.entry.label),
    ).toEqual(["Multiply"]);
  });
});

describe("choosing", () => {
  it("an entry after a value takes it as its first input; inputs left are fields", () => {
    const line = keys("i");
    const abs = choose(line, entry("call:abs"), ctx).line;
    expect(py(abs)).toBe("abs(i)");
    const more = choose(keys("i"), entry("call:max"), ctx).line;
    expect(py(more)).toBe("max(i, ...)");
    expect("at" in more.caret).toBe(true);
    // A call takes what the list is about; an operator binds by precedence.
    expect(py(choose(keys("total+i"), entry("call:str"), ctx).line)).toBe("str(total + i)");
    expect(py(choose(keys("i<n"), entry("call:str"), ctx).line)).toBe("str(i < n)");
    expect(py(choose(keys("total+i"), entry("binop.mul"), ctx).line)).toBe("total + i * ...");
    // Brackets typed first limit it to a part.
    expect(py(choose(keys("total+(i"), entry("call:str"), ctx).line)).toBe("total + str(i)");
  });

  it("where a value is expected, an entry fills the input and the caret moves to its first input", () => {
    const placed = choose(empty(), entry("binop.add"), ctx).line;
    expect(py(placed)).toBe("... + ...");
    const random = choose(empty(), entry("call:randint"), ctx).line;
    expect(py(random)).toBe("random.randint(..., ...)");
    expect(py(choose(empty(), { kind: "variable", name: "n" }, ctx).line)).toBe("n");
    expect(py(choose(empty(), { kind: "function", fn: ctx.functions[0]! }, ctx).line)).toBe(
      "twice(...)",
    );
    expect(py(choose(empty(), entry("bool.false"), ctx).line)).toBe("False");
  });

  it("Text places a text field typed without quotes", () => {
    const line = choose(empty(), entry("str"), ctx).line;
    expect(line.text).toBeDefined();
    const typed = endText(setText(line, line.text ?? "", "Fizz"));
    expect(py(typed)).toBe('"Fizz"');
    expect(typed.text).toBeUndefined();
  });

  it("a text is edited again: Backspace takes its last character, a click opens its field", () => {
    const opened = choose(empty(), entry("str"), ctx).line;
    const typed = endText(setText(opened, opened.text ?? "", "hello"));
    const shorter = backspace(typed, ctx).line;
    expect(py(shorter)).toBe('"hell"');
    expect(shorter.text).toBe(typed.root.id);
    // A character is one as the text field counts it: a symbol with its modifier goes whole.
    const emoji = endText(setText(opened, opened.text ?? "", "a👍🏽"));
    expect(py(backspace(emoji, ctx).line)).toBe('"a"');
    // The field opens empty after the last character; a text with no character goes whole.
    const one = backspace(endText(setText(opened, opened.text ?? "", "a")), ctx).line;
    expect([py(one), one.text]).toEqual(['""', typed.root.id]);
    expect(py(backspace(endText(one), ctx).line)).toBe("...");
    expect(clickAt(typed, typed.root.id).text).toBe(typed.root.id);
    // A number is typed in the line, and a click on it opens no field.
    const number = keys("12");
    expect(clickAt(number, number.root.id).text).toBeUndefined();
    expect(py(backspace(number, ctx).line)).toBe("1");
  });

  it("a selected value is replaced by a value typed; an operator's key takes it", () => {
    const n = openLine(ast.v("n"));
    expect(n.selected).toBe(true);
    expect(py(keys("*", n))).toBe("n * ...");
    expect(py(keys("5", n))).toBe("5");
    expect(py(raw("i", n))).toBe("...");
    expect(py(keys("i ", n))).toBe("i");
    expect(py(keys("-1", n))).toBe("-1");
  });

  it("an operator clicked is switched to another entry of its block", () => {
    const line = keys("i<n");
    expect(
      py(
        switchTo(
          line,
          line.root.id,
          allEntries().find((e) => e.id === "binop.le")!,
        ),
      ),
    ).toBe("i <= n");
  });
});

describe("Backspace and moving", () => {
  const back = (line: Line, times = 1) => {
    let current = line;
    for (let i = 0; i < times; i += 1) current = backspace(current, ctx).line;
    return current;
  };

  it("removes the last digit, a value, or the operator before the caret", () => {
    expect(py(back(keys("125")))).toBe("12");
    expect(py(back(keys("i+12"), 2))).toBe("i + ...");
    expect(py(back(keys("i+12"), 3))).toBe("i");
    expect(py(back(keys("i")))).toBe("...");
    expect(py(back(openLine(ast.v("n"))))).toBe("...");
  });

  it("after an operator's last input, it removes what ends that input", () => {
    const after = keys("(i+12)");
    expect(after.caret).toEqual({ after: after.root.id });
    expect(py(back(after))).toBe("i + 1");
    expect(py(back(after, 3))).toBe("i");
  });

  it("after a call's bracket it removes the call and keeps its first input", () => {
    const line = choose(keys("i"), entry("call:str"), ctx).line;
    expect(py(back(line))).toBe("i");
    const inside = keys("12", choose(empty(), entry("call:abs"), ctx).line);
    expect(py(back(move(inside, 1).line))).toBe("12");
  });

  it("at an item still to fill of a list, other than its first, it removes that item", () => {
    const added = raw("[4,");
    const removed = back(added);
    expect(py(removed)).toBe("[4]");
    const [four] = (removed.root as Extract<Expr, { kind: "list" }>).items;
    expect(removed.caret).toEqual({ after: four?.id });
    // The only item left to fill goes with its list.
    expect(py(back(raw("[")))).toBe("...");
  });

  it("after a list, it removes from its last item, and an empty list as a value", () => {
    const two = keys("[4,9]");
    expect(py(back(two))).toBe("[4, ...]");
    expect(py(back(two, 2))).toBe("[4]");
    expect(py(back(two, 3))).toBe("[...]");
    expect(py(back(two, 4))).toBe("...");
    expect(py(back(keys("[[1]]")))).toBe("[[...]]");
    expect(py(back(keys("[]")))).toBe("...");
  });

  it("after an item's bracket it removes its position, then the item, keeping its list", () => {
    const item = keys("i", choose(keys("nums"), entry("index"), ctx).line);
    const after = move(item, 1).line;
    expect(after.caret).toEqual({ after: item.root.id });
    expect(py(back(after))).toBe("nums[i]");
    expect(py(back(after, 2))).toBe("nums[...]");
    expect(py(back(after, 3))).toBe("nums");
  });

  it("after a call whose later input holds a value, it removes nothing and moves left", () => {
    const larger = keys("3)", choose(keys("i"), entry("call:max"), ctx).line);
    expect([py(larger), larger.caret]).toEqual(["max(i, 3)", { after: larger.root.id }]);
    const after = backspace(larger, ctx).line;
    expect(py(after)).toBe("max(i, 3)");
    expect(after.caret).not.toEqual(larger.caret);
    expect(py(back(after))).toBe("max(i, ...)");
  });

  it("at a first input still to fill while a later one holds a value, it moves left", () => {
    const opened = choose(keys("i*("), entry("binop.add"), ctx).line;
    const filled = keys("3", tab(opened, 1, ctx).line);
    expect(py(filled)).toBe("i * (... + 3)");
    const sum = (filled.root as Extract<Expr, { kind: "binop" }>).right;
    const first = clickAt(filled, (sum as Extract<Expr, { kind: "binop" }>).left.id);
    const after = backspace(first, ctx).line;
    expect(py(after)).toBe("i * (... + 3)");
    expect(after.caret).toEqual({
      after: (filled.root as Extract<Expr, { kind: "binop" }>).left.id,
    });
  });

  it("at a later input still to fill, it moves left while another later input holds a value", () => {
    const three = { name: "three", params: ["a", "b", "c"] };
    const wide: LineContext = {
      ...ctx,
      scope: { functions: ["twice", "three"] },
      functions: [...ctx.functions, three],
    };
    const placed = choose(empty(), { kind: "function", fn: three }, wide).line;
    const second = tab(keys("1", placed), 1, wide).line;
    const third = tab(keys("2", second), 1, wide).line;
    expect(py(third)).toBe("three(1, 2, ...)");
    const left = backspace(third, ctx).line;
    expect(py(left)).toBe("three(1, 2, ...)");
    expect("after" in left.caret).toBe(true);
    // With nothing after the first input, the call goes and its first input stays.
    const bare = tab(tab(keys("1", placed), 1, wide).line, 1, wide).line;
    expect(py(bare)).toBe("three(1, ..., ...)");
    expect(py(backspace(bare, ctx).line)).toBe("1");
  });

  it("Tab moves between inputs still to fill, then to the next slot", () => {
    const placed = choose(empty(), entry("call:randint"), ctx).line;
    const second = tab(placed, 1, ctx);
    expect(second.move).toBeUndefined();
    expect(tab(second.line, 1, ctx).move).toBe("next");
    expect(tab(placed, -1, ctx).move).toBe("previous");
    expect(tab(openLine(ast.v("n")), 1, ctx).move).toBe("next");
  });

  it("→ at the end of an operation's last input leaves it", () => {
    const inside = keys("1", choose(empty(), entry("call:abs"), ctx).line);
    expect(py(keys("+2", inside))).toBe("abs(1 + 2)");
    expect(py(keys("+2", move(inside, 1).line))).toBe("abs(1) + 2");
  });
});

describe("the list", () => {
  it("where a value is expected: variables, values, Not, Random whole number and ( ), functions", () => {
    expect(groups(empty())).toEqual([
      ["variables", ["i", "total", "n", "ok", "nums"]],
      ["values", ["Text", "True", "False", "None", "Empty list"]],
      ["conditions", ["Not"]],
      ["calculate", ["Random whole number", "( )"]],
      ["functions", ["twice"]],
    ]);
  });

  it("after a value, its kind's group and Compare and Convert", () => {
    expect(groups(keys("i")).map(([group]) => group)).toEqual(["calculate", "compare", "convert"]);
    expect(groups(keys("i==0"))).toEqual([
      ["conditions", ["And", "Or"]],
      ["compare", ["Equals", "Does not equal", "Is in a list"]],
      ["convert", ["As text"]],
    ]);
    expect(groups(keys("nums"))).toEqual([
      ["items", ["Item at a position", "Count", "Sum", "Join with another list"]],
      ["compare", ["Equals", "Does not equal", "Is in a list"]],
      ["convert", ["As text"]],
    ]);
  });

  it("after a value of no known kind every entry that takes one; Show all lists every entry", () => {
    const unknown = choose(empty(), { kind: "function", fn: ctx.functions[0]! }, ctx).line;
    const left = move(unknown, 1).line;
    expect(groups(left).map(([group]) => group)).toEqual([
      "conditions",
      "calculate",
      "items",
      "compare",
      "convert",
    ]);
    expect(groups(empty(), true).map(([group]) => group)).toEqual([
      "variables",
      "values",
      "conditions",
      "calculate",
      "items",
      "compare",
      "convert",
      "functions",
    ]);
  });
});

describe("the functions offered", () => {
  it("are the program's functions a call can name, with their parameters", () => {
    const fn = (id: string, name: string, params = ["x"]) => ({ id, name, params, body: [] });
    const p = program([], {
      functions: [
        fn("fn0000000001", "twice"),
        fn("fn0000000002", "for"),
        fn("fn0000000003", "abs"),
        fn("fn0000000004", "twice"),
        // A parameter's fault is no fault of the function's name.
        fn("fn0000000005", "f", ["f", "f"]),
      ],
    });
    expect(callableFunctions(p)).toEqual([
      { name: "twice", params: ["x"] },
      { name: "f", params: ["f", "f"] },
    ]);
  });
});

describe("a target's line (editor.md, Targets)", () => {
  /** A slot that binds: the problem asks for `total`, the program has `n` and `nums`. */
  const binding: LineContext = {
    ...ctx,
    target: { asked: ["total"], names: ["n", "nums"], binds: true },
  };
  /** A slot that does not bind, in a function whose parameters `heap` and `i` have no kind. */
  const reading: LineContext = {
    ...ctx,
    variables: ["heap", "i"],
    kinds: new Map(),
    target: { asked: [], names: ["heap", "i"], binds: false },
  };
  const typed = (text: string, context: LineContext, line: Line = empty()): Line => {
    let current = line;
    for (const key of text) current = type(current, key, context).line;
    return settle(current, context);
  };

  it("takes an item typed as the chart writes it, of a variable of any kind", () => {
    expect(py(typed("nums[i+1]", binding))).toBe("nums[i + 1]");
    expect(py(typed("heap[i]", reading))).toBe("heap[i]");
    expect(py(typed("nums[0][i]", binding))).toBe("nums[0][i]");
  });

  it("refuses a key that would leave no target, with the reason; inside an item any value", () => {
    for (const key of ["-", "5", "[", "("]) {
      const step = type(empty(), key, binding);
      expect(step.taken && step.line.root.kind !== "empty", key).toBe(false);
    }
    const refused = type(typed("nums", binding), "+", binding);
    expect(refused.taken).toBe(false);
    expect(refused.line.refused).toBe("Only a variable or an item of a list can be given a value");
    expect(py(refused.line)).toBe("nums");
    expect(py(typed("nums[-1]", binding))).toBe("nums[-1]");
    // Backspace at an item's position still to fill takes the item back to its variable.
    expect(py(backspace(type(typed("nums", binding), "[", binding).line, binding).line)).toBe(
      "nums",
    );
    // Backspace that would leave an operation in the target's place is refused too.
    let sum = type(typed("nums", binding), "[", binding).line;
    sum = move(sum, -1).line;
    for (const key of "+1") sum = type(sum, key, binding).line;
    expect(py(sum)).toBe("(nums + 1)[...]");
    const at = move(move(sum, 1).line, 1).line;
    const removed = backspace(at, binding);
    expect(removed.taken).toBe(false);
    expect(py(removed.line)).toBe("(nums + 1)[...]");
  });

  it("lists the problem's names, the program's, and a new name typed, last", () => {
    expect(groups(empty(), false, binding)).toEqual([
      ["problem", ["total"]],
      ["variables", ["n", "nums"]],
    ]);
    const to = raw("to", empty());
    expect(matches(to, binding).map((row) => [row.kind, "name" in row ? row.name : ""])).toEqual([
      ["variable", "total"],
      ["new", "to"],
    ]);
    // The word names the new variable exactly, as a variable is named, so Tab or a key chooses it.
    expect(py(settle(to, binding))).toBe("to");
    expect(matches(raw("for", empty()), binding)).toEqual([]);
    // A slot that does not bind offers the variables visible there, and no new one.
    expect(groups(empty(), false, reading)).toEqual([["variables", ["heap", "i"]]]);
    expect(matches(raw("zz", empty()), reading)).toEqual([]);
  });

  it("`[` on the target's selected variable makes its item", () => {
    const selected = openLine(typed("nums", binding).root);
    expect(selected.selected).toBe(true);
    expect(py(type(selected, "[", binding).line)).toBe("nums[...]");
    // In any other slot it replaces the selected value with a list.
    expect(py(type(selected, "[", ctx).line)).toBe("[...]");
  });

  it("tries no key again but one two entries name: `.` after a selected `0` is refused anywhere", () => {
    const zero = openLine(ast.num(0));
    expect(zero.selected).toBe(true);
    expect(type(zero, ".", ctx).taken).toBe(false);
    expect(type(zero, ".", binding).taken).toBe(false);
  });

  it("inside the target's item lists a value line's rows, a chained comparison refused", () => {
    const inside = typed("nums[i<n", binding);
    expect(groups(inside, false, binding)).toEqual(groups(keys("nums[i<n"), false, ctx));
    expect(groups(inside, false, binding).map(([group]) => group)).toContain("compare");
    const chained = choose(inside, entry("binop.lt"), binding);
    expect(chained.taken).toBe(false);
    expect(chained.line.refused).toBe("Write a < b < c as a < b and b < c");
    // A word naming the refused entry stays to be corrected, as in a value line.
    for (const context of [binding, ctx]) {
      const word = type(raw("nums[i<n in"), " ", context);
      expect(word.taken).toBe(false);
      expect(word.line.word).toBe("in");
      expect(word.line.refused).toBe("Write a < b < c as a < b and b < c");
    }
  });

  it("after the target's whole value lists only the entries whose block is a target", () => {
    // Each value with its kind: an item has none (`blocks.md`, Kinds), nor has a parameter here.
    for (const [text, context, kind] of [
      ["nums", binding, "list"],
      ["heap", reading, undefined],
      ["nums[0]", binding, undefined],
      ["n", binding, "number"],
    ] as const) {
      const line = typed(text, context);
      const targets = allEntries().filter(
        (each) =>
          takesValue(each) &&
          each.def.store !== undefined &&
          (kind === undefined || each.menu.on?.includes(kind)),
      );
      const listed = groups(line, false, context).flatMap(([, labels]) => labels);
      expect(listed, text).toEqual(targets.map((each) => each.label));
    }
  });

  it("after the target's variable lists only the entries that keep a target", () => {
    expect(groups(typed("nums", binding), false, binding)).toEqual([
      ["items", ["Item at a position"]],
    ]);
    expect(groups(typed("heap", reading), false, reading)).toEqual([
      ["items", ["Item at a position"]],
    ]);
    // Inside the item, the position is any value, and the problem's names are variables there.
    const inside = type(typed("nums", binding), "[", binding).line;
    const listed = groups(inside, false, binding);
    expect(listed.map(([group]) => group)).toContain("calculate");
    expect(listed[0]).toEqual(["variables", ["i", "total", "n", "ok", "nums"]]);
  });
});
