// Every node maps to the statement that contains it.
import { describe, expect, it } from "vitest";
import { ast, program, tid } from "@/blocks/testing";
import { removeFunction } from "./edit";
import {
  bodyStmts,
  findCondition,
  diamondConditions,
  draftSlots,
  draftText,
  findRoutine,
  getRoutine,
  isStatement,
  getOwner,
  paramArg,
  getHoldingRoutine,
  routineStmts,
} from "./walk";

const { assign, num, bin, v, if_, for_, while_, print, ret, call, empty, draft } = ast;

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

describe("the node index", () => {
  const cond = bin("==", v("n"), num(1));
  const inner = print(v("n"));
  const branch = if_(cond, [inner]);
  const value = bin("+", v("a"), num(1));
  const body = ret(value);
  const fn = { id: "fun000000003", name: "inc", params: ["a"], body: [body] };
  const p = program([assign("n", num(1)), branch], { functions: [fn] });

  it("gives an expression its statement as owner, and a statement or a function itself", () => {
    expect(getOwner(p, cond.id)).toBe(branch.id);
    expect(getOwner(p, cond.type === "binop" ? cond.left.id : "")).toBe(branch.id);
    expect(getOwner(p, inner.id)).toBe(inner.id);
    expect(getOwner(p, value.id)).toBe(body.id);
    expect(getOwner(p, body.id)).toBe(body.id);
    expect(getOwner(p, fn.id)).toBe(fn.id);
  });

  it("gives the routine of an expression, of a statement, and of a function", () => {
    expect(getHoldingRoutine(p, value.id)).toBe(fn.id);
    expect(getHoldingRoutine(p, body.id)).toBe(fn.id);
    expect(getHoldingRoutine(p, fn.id)).toBe(fn.id);
    expect(getHoldingRoutine(p, cond.id)).toBe("main");
    expect(getHoldingRoutine(p, inner.id)).toBe("main");
  });

  it("throws for a node the program doesn't hold, such as one of a deleted function", () => {
    const deleted = removeFunction(p, fn.id);
    for (const id of [tid(), value.id, fn.id]) {
      expect(() => getOwner(deleted, id)).toThrow();
      expect(() => getHoldingRoutine(deleted, id)).toThrow();
    }
  });

  it("counts a statement as a statement, and neither an expression nor a function", () => {
    expect([inner.id, branch.id, body.id].map((id) => isStatement(p, id))).toEqual([
      true,
      true,
      true,
    ]);
    expect([cond.id, value.id, fn.id, tid()].map((id) => isStatement(p, id))).toEqual([
      false,
      false,
      false,
      false,
    ]);
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
    expect(findRoutine(p, "main")).toBe("main");
    expect(findRoutine(p, fn.id)).toBe(p.functions[0]);
    expect(findRoutine(p, tid())).toBeUndefined();
    expect(getRoutine(p, fn.id)).toBe(p.functions[0]);
    expect(() => getRoutine(p, tid())).toThrow();
    expect(routineStmts(p, "main")).toBe(p.main);
    expect(routineStmts(p, getRoutine(p, fn.id))).toBe(p.functions[0]?.body);
  });
});
