// What is visible where; the places `loop` and `requires` allow; the value list's Variables;
// each node's owner and routine.
import { describe, expect, it } from "vitest";
import { ast, createTestId } from "@/blocks/testing";
import { removeFunction } from "./edit";
import type { Program, Stmt } from "./types";
import {
  declaredBy,
  getHoldingRoutine,
  getOwner,
  isStatement,
  declarationsUnder,
  eachVisible,
  isVisible,
  placeContext,
  findVisibleNames,
  statementScopes,
} from "./scope";

const { assign, num, v, bin, print, for_, if_, while_, ret, program } = ast;

/** The scopes of `stmt`, one for each place the program holds it. */
const scopesOf = (p: Program, stmt: Stmt) =>
  statementScopes(p).filter((scope) => scope.stmt === stmt);

/** The variables visible at the one place the program holds `stmt`. */
const visibleAt = (p: Program, stmt: Stmt) =>
  scopesOf(p, stmt).map(({ visible }) => [...eachVisible(visible)]);

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

  it("a loop variable is visible only in the loop's body, not in its bounds or after it", () => {
    const inner = print(v("i"));
    const loop = for_("i", num(0), v("n"), [inner]);
    const after = print(v("i"));
    const p = program([loop, after], { inputs: [{ name: "n", kind: "number" }] });
    expect(findVisibleNames(p, loop.id)).toEqual(["n"]);
    expect(findVisibleNames(p, inner.id)).toEqual(["i", "n"]);
    expect(findVisibleNames(p, after.id)).toEqual(["n"]);
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

  it("names what declares each visible variable: a statement, a function, or main", () => {
    const set = assign("a", num(1));
    const inner = print(v("i"));
    const loop = for_("i", num(0), v("n"), [inner]);
    const body = ret(v("x"));
    const fn = { id: "fn0000000001", name: "f", params: ["x"], body: [body] };
    const p = program([set, loop], { inputs: [{ name: "n", kind: "number" }], functions: [fn] });
    expect(visibleAt(p, inner)).toEqual([
      [
        { name: "i", declarer: loop.id },
        { name: "a", declarer: set.id },
        { name: "n", declarer: "main" },
      ],
    ]);
    expect(visibleAt(p, body)).toEqual([[{ name: "x", declarer: fn.id }]]);
  });

  it("lists a name declared again once per declaration, the latest first", () => {
    const first = assign("a", num(1));
    const again = assign("a", num(3));
    const here = print(v("a"));
    const p = program([first, again, here]);
    expect(visibleAt(p, here)).toEqual([
      [
        { name: "a", declarer: again.id },
        { name: "a", declarer: first.id },
      ],
    ]);
    expect(findVisibleNames(p, here.id)).toEqual(["a"]);
  });

  it("names the compound statement inside which a name not yet visible is first declared", () => {
    const branch = if_(v("c"), [assign("x", num(1))]);
    const read = print(v("x"));
    const set = assign("x", num(2));
    const after = print(v("x"));
    const p = program([assign("c", num(1)), branch, read, set, after]);
    const [atRead] = scopesOf(p, read);
    expect(atRead?.declaredInside).toEqual(new Map([["x", branch.id]]));
    expect(isVisible(atRead?.visible, "x")).toBe(false);
    // Once the name is visible, a read finds the variable rather than the compound statement.
    expect(isVisible(scopesOf(p, after)[0]?.visible, "x")).toBe(true);
  });

  it("gives a statement held in two places a scope for each", () => {
    const read = print(v("x"));
    const p = program([read, assign("x", num(1)), read]);
    expect(scopesOf(p, read).map(({ visible }) => isVisible(visible, "x"))).toEqual([false, true]);
  });

  it("gives the loops that hold each statement, outermost first, and its routine", () => {
    const inner = print(v("i"));
    const branch = if_(v("i"), [inner]);
    const loop = for_("i", num(0), num(3), [branch]);
    const body = ret(num(1));
    const fn = { id: "fn0000000001", name: "f", params: [], body: [body] };
    const p = program([loop], { functions: [fn] });
    const sits = (stmt: Stmt) => scopesOf(p, stmt).map(({ routine, loops }) => [routine, loops]);
    expect([sits(loop), sits(branch), sits(inner), sits(body)]).toEqual([
      [["main", []]],
      [["main", [loop]]],
      [["main", [loop]]],
      [[fn.id, []]],
    ]);
  });

  it("gives every variable that the statements under a region declare, in program order", () => {
    const one = num(1);
    const set = assign("a", one);
    const pass = v("i");
    const inner = assign("b", pass);
    const loop = for_("i", num(0), num(3), [inner]);
    const p = program([set, loop, print(v("a"))]);
    expect(declarationsUnder(p.main).map(({ name, stmt, stores }) => [name, stmt, stores])).toEqual(
      [
        ["a", set, one],
        ["i", loop, undefined],
        ["b", inner, pass],
      ],
    );
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
    for (const id of [createTestId(), value.id, fn.id]) {
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
    expect([cond.id, value.id, fn.id, createTestId()].map((id) => isStatement(p, id))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
