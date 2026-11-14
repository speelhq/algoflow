// What is visible where; the places `loop` and `requires` allow; the value list's Variables.
import { describe, expect, it } from "vitest";
import { ast } from "@/blocks/testing";
import { declaredBy, placeContext, findVisibleNames } from "./scope";

const { assign, num, v, bin, print, for_, if_, while_, ret, program } = ast;

describe("scope", () => {
  it("a binding target declares its variable with the value its slot stores; a loop's stores none", () => {
    const value = bin("+", v("a"), num(1));
    const set = ast.assignTo(v("a"), value);
    expect(declaredBy(set)).toEqual([{ name: "a", target: set.target, stores: value }]);
    const loop = ast.forTo(v("i"), num(1), num(3), []);
    expect(declaredBy(loop)).toEqual([{ name: "i", target: loop.var, stores: undefined }]);
    // An item or an empty slot declares no variable, and a slot that doesn't bind none either.
    expect(declaredBy(ast.assignTo(ast.item(v("xs"), num(0)), num(9)))).toEqual([]);
    expect(declaredBy(ast.forTo(ast.empty(), num(0), num(3), []))).toEqual([]);
    expect(declaredBy(ast.swap(v("a"), v("b")))).toEqual([]);
    expect(declaredBy(print(v("a")))).toEqual([]);
  });

  it("names assigned before a statement are visible, the latest first", () => {
    const a = assign("a", num(1));
    const b = assign("b", num(2));
    const again = assign("a", num(3));
    const here = print(v("a"));
    const p = program([a, b, again, here], { inputs: [{ name: "n", kind: "number" }] });
    expect(findVisibleNames(p, a.id)).toEqual(["n"]);
    expect(findVisibleNames(p, b.id)).toEqual(["a", "n"]);
    expect(findVisibleNames(p, here.id)).toEqual(["a", "b", "n"]);
    expect(findVisibleNames(p, "nope00000000")).toBeUndefined();
  });

  it("a loop variable is visible in the body and after the loop, not in its own bounds", () => {
    const inner = print(v("i"));
    const loop = for_("i", num(0), v("n"), [inner]);
    const after = print(v("i"));
    const p = program([loop, after], { inputs: [{ name: "n", kind: "number" }] });
    expect(findVisibleNames(p, loop.id)).toEqual(["n"]);
    expect(findVisibleNames(p, inner.id)).toEqual(["i", "n"]);
    expect(findVisibleNames(p, after.id)).toEqual(["i", "n"]);
  });

  it("a name first assigned inside a compound statement is not visible after it", () => {
    const inside = assign("y", num(1));
    const branch = if_(v("c"), [inside]);
    const after = print(v("y"));
    const p = program([assign("c", num(1)), branch, after]);
    expect(findVisibleNames(p, after.id)).toEqual(["c"]);
  });

  it("a function sees its parameters", () => {
    const body = ret(v("x"));
    const p = program([], {
      functions: [{ id: "fn0000000001", name: "f", params: ["x", "y"], body: [body] }],
    });
    expect(findVisibleNames(p, body.id)).toEqual(["y", "x"]);
  });

  it("a place is in a loop under a loop's body at any depth, and in a function under one", () => {
    const branch = if_(v("c"), []);
    const loop = while_(v("c"), [branch]);
    const p = program([loop], {
      functions: [{ id: "fn0000000001", name: "f", params: [], body: [] }],
    });
    expect(placeContext(p, { parent: "main", slot: "main", index: 0 })).toEqual({
      loop: false,
      fn: false,
    });
    expect(placeContext(p, { parent: loop.id, slot: "body", index: 0 })).toEqual({
      loop: true,
      fn: false,
    });
    expect(placeContext(p, { parent: branch.id, slot: "then", index: 0 })).toEqual({
      loop: true,
      fn: false,
    });
    expect(placeContext(p, { parent: "fn0000000001", slot: "body", index: 0 })).toEqual({
      loop: false,
      fn: true,
    });
  });
});
