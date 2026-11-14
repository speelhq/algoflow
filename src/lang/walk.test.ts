// The traversal by slots: a statement's drafts, an argument by its parameter, a diamond's
// condition, the statements inside each compound statement, and a routine's statements.
import { describe, expect, it } from "vitest";
import { ast, createTestId } from "@/blocks/testing";
import {
  bodyStmts,
  findCondition,
  diamondConditions,
  draftSlots,
  draftText,
  findRoutineDef,
  getRoutineDef,
  paramArg,
  routineStmts,
} from "./walk";

const { assign, num, bin, v, if_, for_, while_, print, call, empty, draft, program } = ast;

describe("draftSlots", () => {
  it("lists the drafts in a statement's slots, with their slots and their texts", () => {
    const variable = empty();
    const loop = ast.forTo(variable, num(0), v("n"), []);
    const item = empty();
    const typed = draft("abs(");
    const shown = print(num(1), item, typed);
    expect(draftSlots(loop)).toEqual([{ slot: "var", role: "target", expr: variable, text: "" }]);
    expect(draftSlots(shown)).toEqual([
      { slot: "args", role: "exprs", index: 1, expr: item, text: "" },
      { slot: "args", role: "exprs", index: 2, expr: typed, text: "abs(" },
    ]);
    expect(draftSlots(assign("x", bin("+", v("n"), num(1))))).toEqual([]);
  });
});

describe("draftText", () => {
  it("is a draft's text, and undefined for any other value", () => {
    expect(draftText(draft("1 +"))).toBe("1 +");
    expect(draftText(empty())).toBe("");
    expect(draftText(num(1))).toBeUndefined();
  });
});

describe("paramArg", () => {
  it("finds the argument a builtin's parameter takes, with its position", () => {
    const a = v("a");
    const b = num(2);
    const max = call("max", a, b);
    expect(paramArg(max, "a")).toEqual({ arg: a, index: 0 });
    expect(paramArg(max, "b")).toEqual({ arg: b, index: 1 });
    expect(paramArg(max, "c")).toBeUndefined();
    expect(paramArg(call("max", a), "b")).toBeUndefined();
    expect(paramArg(v("x"), "a")).toBeUndefined();
  });
});

describe("findCondition and diamondConditions", () => {
  it("give the condition a branch or a checked loop asks, by its declared slot, and nothing else", () => {
    const asked = v("ok");
    const branch = if_(asked, []);
    const loop = while_(bin("<", v("i"), num(3)), []);
    const counted = for_("i", num(0), num(3), [branch]);
    expect(findCondition(branch)).toEqual({ slot: "cond", expr: asked });
    expect(findCondition(counted)).toBeUndefined();
    expect(findCondition(print(v("i")))).toBeUndefined();
    const p = program([counted, loop]);
    expect(diamondConditions(p)).toEqual(
      new Map([
        [asked.id, branch.id],
        [loop.type === "while" ? loop.cond.id : "", loop.id],
      ]),
    );
    expect(diamondConditions(p)).toBe(diamondConditions(p));
  });
});

describe("bodyStmts", () => {
  it("lists every statement inside a statement's regions, at any depth, and skips plain statements", () => {
    const hit = print(v("i"));
    const miss = print(num(0));
    const branch = if_(bin("==", v("i"), num(1)), [hit], [miss]);
    const tail = assign("x", v("i"));
    const loop = for_("i", num(0), num(3), [branch, tail]);
    const bodies = bodyStmts(program([loop, print(v("x"))]));

    expect(bodies.get(loop.id)).toEqual([branch.id, hit.id, miss.id, tail.id]);
    expect(bodies.get(branch.id)).toEqual([hit.id, miss.id]);
    expect([...bodies.keys()]).toEqual([loop.id, branch.id]);
  });
});

describe("routines", () => {
  it("finds a routine's function, or main, and nothing for a routine that names no function", () => {
    const fn = { id: "fun000000004", name: "main", params: [], body: [] };
    const p = program([], { functions: [fn] });
    expect(findRoutineDef(p, "main")).toBe("main");
    expect(findRoutineDef(p, fn.id)).toBe(p.functions[0]);
    expect(findRoutineDef(p, createTestId())).toBeUndefined();
    expect(getRoutineDef(p, fn.id)).toBe(p.functions[0]);
    expect(() => getRoutineDef(p, createTestId())).toThrow();
    expect(routineStmts(p, "main")).toBe(p.main);
    expect(routineStmts(p, getRoutineDef(p, fn.id))).toBe(p.functions[0]?.body);
  });
});
