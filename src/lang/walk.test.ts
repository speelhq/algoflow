// Every node maps to the statement that contains it.
import { describe, expect, it } from "vitest";
import { ast, program, tid } from "@/blocks/testing";
import { removeFunction } from "./edit";
import {
  bodyStmts,
  conditionOf,
  diamondConditions,
  emptySlots,
  findRoutine,
  getRoutine,
  isStatement,
  ownerOf,
  paramArg,
  routineOf,
  routineStmts,
  holdsEmptySlot,
} from "./walk";

const { assign, num, bin, v, if_, for_, while_, print, ret, call, empty } = ast;

describe("emptySlots", () => {
  it("lists every empty slot at any depth, with the block that holds it", () => {
    const sum = bin("+", num(1), empty());
    const loop = ast.forTo(empty(), num(0), sum, []);
    const abs = call("abs", empty());
    const shown = print(num(1), empty(), abs);
    expect(emptySlots(loop)).toEqual([
      { block: loop, slot: "var" },
      { block: sum, slot: "right" },
    ]);
    expect(emptySlots(shown)).toEqual([
      { block: shown, slot: "args", index: 1 },
      { block: abs, slot: "args", index: 0 },
    ]);
    expect(emptySlots(assign("x", bin("+", v("n"), num(1))))).toEqual([]);
  });
});

describe("holdsEmptySlot", () => {
  it("a value that is an empty slot or holds one at any depth; a list with no item holds none", () => {
    expect(holdsEmptySlot(empty())).toBe(true);
    expect(holdsEmptySlot(bin("+", num(1), call("abs", empty())))).toBe(true);
    expect(holdsEmptySlot(bin("+", v("n"), num(1)))).toBe(false);
    expect(holdsEmptySlot(call("abs"))).toBe(false);
    expect(holdsEmptySlot(ast.list())).toBe(false);
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
    expect(ownerOf(p, cond.id)).toBe(branch.id);
    expect(ownerOf(p, cond.type === "binop" ? cond.left.id : "")).toBe(branch.id);
    expect(ownerOf(p, inner.id)).toBe(inner.id);
    expect(ownerOf(p, value.id)).toBe(body.id);
    expect(ownerOf(p, body.id)).toBe(body.id);
    expect(ownerOf(p, fn.id)).toBe(fn.id);
  });

  it("gives the routine of an expression, of a statement, and of a function", () => {
    expect(routineOf(p, value.id)).toBe(fn.id);
    expect(routineOf(p, body.id)).toBe(fn.id);
    expect(routineOf(p, fn.id)).toBe(fn.id);
    expect(routineOf(p, cond.id)).toBe("main");
    expect(routineOf(p, inner.id)).toBe("main");
  });

  it("throws for a node the program doesn't hold, such as one of a deleted function", () => {
    const deleted = removeFunction(p, fn.id);
    for (const id of [tid(), value.id, fn.id]) {
      expect(() => ownerOf(deleted, id)).toThrow();
      expect(() => routineOf(deleted, id)).toThrow();
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

describe("conditionOf and diamondConditions", () => {
  it("give the condition a branch or a checked loop asks, by its declared slot, and nothing else", () => {
    const asked = v("ok");
    const branch = if_(asked, []);
    const loop = while_(bin("<", v("i"), num(3)), []);
    const counted = for_("i", num(0), num(3), [branch]);
    expect(conditionOf(branch)).toEqual({ slot: "cond", expr: asked });
    expect(conditionOf(counted)).toBeUndefined();
    expect(conditionOf(print(v("i")))).toBeUndefined();
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
