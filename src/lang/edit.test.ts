// Each edit does what it says, leaves the input untouched, and keeps node ids unique.
import { describe, expect, it } from "vitest";
import { getBlockDef } from "@/blocks/registry";
import { ast, createProgramWithInputs } from "@/blocks/testing";
import {
  addFunction,
  duplicateStmt,
  EditError,
  hoistAssign,
  insertStmt,
  findStmt,
  moveStmt,
  removeExpr,
  removeFunction,
  removeStmt,
  renameName,
  setExpr,
  setParams,
  setCaption,
} from "./edit";
import { unparse } from "@/python/emit";
import { emit } from "@/python/emit";
import type { Data, Program, Stmt } from "./types";
import { validate } from "./validate";

const { assign, print, num, str, bin, v, if_, for_, call, exprStmt, program } = ast;

type For = Extract<Stmt, { type: "for" }>;

function hasUniqueIds(p: Program): boolean {
  return !validate(p).some((d) => d.code === "E_DUPLICATE_ID");
}

function lines(p: Program, inputs: Record<string, Data> = {}): string[] {
  return emit(p, inputs).code.trimEnd().split("\n");
}

function createSample(): { p: Program; a: Stmt; loop: Stmt; inner: Stmt; b: Stmt } {
  const a = assign("x", num(1));
  const inner = assign("x", bin("+", v("x"), v("i")));
  const loop = for_("i", num(0), num(3), [inner]);
  const b = print(v("x"));
  return { p: program([a, loop, b]), a, loop, inner, b };
}

describe("edit", () => {
  it("every edit keeps the ids unique, also when what it adds reuses ids of the program", () => {
    const { p: base, a, loop, inner, b } = createSample();
    const start = addFunction(base, "f", ["a"]);
    const fn = start.functions[0]!;
    const value = (inner as Extract<Stmt, { type: "assign" }>).value;
    const edits: Record<string, (p: Program) => Program> = {
      insertStmt: (p) => insertStmt(p, loop, { parent: "main", slot: "main", index: 0 }),
      moveStmt: (p) => moveStmt(p, b.id, { parent: loop.id, slot: "body", index: 0 }),
      removeStmt: (p) => removeStmt(p, a.id),
      duplicateStmt: (p) => duplicateStmt(p, loop.id),
      setLoopTarget: (p) => setExpr(p, loop.id, "var", v("k")),
      setExpr: (p) => setExpr(p, b.id, "args", [value, structuredClone(value)]),
      setTarget: (p) => setExpr(p, a.id, "target", ast.item(value, structuredClone(value))),
      renameName: (p) => renameName(p, "x", "total"),
      setCaption: (p) => setCaption(p, loop.id, "Count"),
      addFunction: (p) => addFunction(p, "g"),
      removeFunction: (p) => removeFunction(p, fn.id),
      setParams: (p) => setParams(p, fn.id, ["a", "b"]),
      hoistAssign: (p) => hoistAssign(p, loop.id, "x"),
    };
    for (const [name, edit] of Object.entries(edits))
      expect(hasUniqueIds(edit(start)), name).toBe(true);
  });

  it("every edit returns a new Program and leaves the input unchanged", () => {
    const { p, a } = createSample();
    const before = structuredClone(p);
    const next = removeStmt(p, a.id);
    expect(p).toEqual(before);
    expect(next).not.toBe(p);
    expect(next.main).toHaveLength(2);
  });

  it("insertStmt places a statement at a Place and re-ids a colliding statement", () => {
    const { p, a, loop } = createSample();
    const next = insertStmt(p, print(str("hi")), { parent: loop.id, slot: "body", index: 0 });
    expect(lines(next)).toEqual([
      "x = 1",
      "for i in range(3):",
      '    print("hi")',
      "    x = x + i",
      "print(x)",
    ]);
    const collided = insertStmt(p, a, { parent: "main", slot: "main", index: 99 });
    expect(collided.main).toHaveLength(4);
    expect(collided.main[3]?.id).not.toBe(a.id);
    expect(hasUniqueIds(collided)).toBe(true);
  });

  it("moveStmt removes then inserts, counting the index after removal", () => {
    const { p, a, loop, b } = createSample();
    const next = moveStmt(p, a.id, { parent: "main", slot: "main", index: 2 });
    expect(next.main.map((s) => s.id)).toEqual([loop.id, b.id, a.id]);
    const into = moveStmt(p, b.id, { parent: loop.id, slot: "body", index: 1 });
    expect(lines(into)).toEqual(["x = 1", "for i in range(3):", "    x = x + i", "    print(x)"]);
    expect(hasUniqueIds(into)).toBe(true);
  });

  it("removeStmt removes a compound statement with its contents; a missing id throws", () => {
    const { p, loop, inner } = createSample();
    const next = removeStmt(p, loop.id);
    expect(lines(next)).toEqual(["x = 1", "print(x)"]);
    expect(findStmt(next, inner.id)).toBeUndefined();
    expect(() => removeStmt(p, "nope00000000")).toThrow(/no statement/);
  });

  it("duplicateStmt inserts a deep copy with fresh ids right after the original", () => {
    const { p, loop } = createSample();
    const next = duplicateStmt(p, loop.id);
    expect(lines(next)).toEqual([
      "x = 1",
      "for i in range(3):",
      "    x = x + i",
      "for i in range(3):",
      "    x = x + i",
      "print(x)",
    ]);
    expect(next.main[2]?.id).not.toBe(loop.id);
    expect(hasUniqueIds(next)).toBe(true);
  });

  it("setExpr sets a loop's variable, a target as an assignment's is", () => {
    const { p, loop } = createSample();
    expect(lines(setExpr(p, loop.id, "var", v("k")))[1]).toBe("for k in range(3):");
    expect(lines(setExpr(p, loop.id, "var", ast.empty()))[1]).toBe("for ... in range(3):");
  });

  it("removeExpr takes the value out of an optional slot, and refuses any other slot", () => {
    const back = ast.ret(v("a"));
    const p = program([], {
      functions: [{ id: "f0000000000f", name: "f", params: ["a"], body: [back] }],
    });
    const next = removeExpr(p, back.id, "value");
    expect(lines(next)).toEqual(["def f(a):", "    return"]);
    expect(lines(p)).toEqual(["def f(a):", "    return a"]);
    expect(hasUniqueIds(next)).toBe(true);
    const { p: sample, a } = createSample();
    expect(() => removeExpr(sample, a.id, "value")).toThrow(EditError);
  });

  it("setCaption stores one trimmed line and removes an empty caption", () => {
    const { p, loop } = createSample();
    const captioned = setCaption(p, loop.id, "  Count  to\n three ");
    expect(findStmt(captioned, loop.id)?.stmt.caption).toBe("Count to three");
    expect(hasUniqueIds(captioned)).toBe(true);
    expect(findStmt(p, loop.id)?.stmt.caption).toBeUndefined();
    const cleared = setCaption(captioned, loop.id, " \n ");
    expect(findStmt(cleared, loop.id)?.stmt).not.toHaveProperty("caption");
    expect(() => setCaption(p, "missing00000", "x")).toThrow(/no statement/);
  });

  it("setExpr replaces an expression slot, an exprs slot's items, or a nested expression block", () => {
    const { p, a, inner, b } = createSample();
    expect(lines(setExpr(p, a.id, "value", num(42)))[0]).toBe("x = 42");
    expect(lines(setExpr(p, b.id, "args", [v("x"), str("more")]))[3]).toBe('print(x, "more")');
    expect(lines(setExpr(p, b.id, "args", []))[3]).toBe("print()");
    const binop = (inner as Extract<Stmt, { type: "assign" }>).value;
    expect(lines(setExpr(p, binop.id, "right", num(2)))[2]).toBe("    x = x + 2");
    const reused = setExpr(p, a.id, "value", (inner as Extract<Stmt, { type: "assign" }>).value);
    expect(hasUniqueIds(reused)).toBe(true);
    expect(unparse((reused.main[0] as Extract<Stmt, { type: "assign" }>).value)).toBe("x + i");
  });

  it("setExpr keeps the ids of the expression it wraps", () => {
    const { p, a } = createSample();
    const value = (a as Extract<Stmt, { type: "assign" }>).value;
    const wrapped = bin("+", value, ast.empty());
    const next = setExpr(p, a.id, "value", wrapped);
    const placed = (next.main[0] as Extract<Stmt, { type: "assign" }>).value;
    expect(placed.id).toBe(wrapped.id);
    expect(placed.type === "binop" && placed.left.id).toBe(value.id);
    expect(hasUniqueIds(next)).toBe(true);
  });

  it("setExpr keeps the ids of the items it replaces, and refuses a value of another role's shape", () => {
    const { p, a, b } = createSample();
    const held = (b as Extract<Stmt, { type: "print" }>).args[0]!;
    const next = setExpr(p, b.id, "args", [held, structuredClone(held)]);
    const items = (next.main[2] as Extract<Stmt, { type: "print" }>).args;
    expect(items[0]?.id).toBe(held.id);
    expect(hasUniqueIds(next)).toBe(true);
    expect(() => setExpr(p, b.id, "args", num(1))).toThrow(/no expression slot/);
    expect(() => setExpr(p, a.id, "value", [num(1)])).toThrow(/no exprs slot/);
  });

  it("setParams replaces a function's parameters", () => {
    const p = addFunction(program([]), "f", ["a"]);
    const fn = p.functions[0];
    if (!fn) throw new Error("no function");
    expect(setParams(p, fn.id, ["a", "b"]).functions[0]?.params).toEqual(["a", "b"]);
    expect(() => setParams(p, "nope00000000", [])).toThrow(/no function/);
  });

  it("setExpr sets a target, and a target's part by the target's own id", () => {
    const target = ast.item(v("xs"), num(0));
    const stmt = ast.assignTo(target, num(9));
    const p = program([stmt]);
    expect(lines(setExpr(p, target.id, "index", num(2)))).toEqual(["xs[2] = 9"]);
    expect(lines(setExpr(p, stmt.id, "target", v("y")))).toEqual(["y = 9"]);
    expect(() => setExpr(p, target.id, "nope", num(2))).toThrow(/no expression slot/);
  });

  it("renameName rewrites variables, loop variables, and function names and calls", () => {
    const { p } = createSample();
    const renamed = renameName(p, "x", "total");
    expect(lines(renamed)).toEqual([
      "total = 1",
      "for i in range(3):",
      "    total = total + i",
      "print(total)",
    ]);
    const withFn = program([exprStmt(call("f", num(1)))], {
      functions: [{ id: "f0000000000f", name: "f", params: ["x"], body: [print(v("x"))] }],
    });
    const fnRenamed = renameName(withFn, "f", "g");
    expect(fnRenamed.functions[0]?.name).toBe("g");
    expect(lines(fnRenamed).at(-1)).toBe("g(1)");
    expect(lines(fnRenamed)[1]).toBe("    print(x)");
  });

  it("addFunction / removeFunction", () => {
    let p = addFunction(program([]), "f", ["a"]);
    expect(p.functions).toEqual([{ id: expect.any(String), name: "f", params: ["a"], body: [] }]);
    expect(hasUniqueIds(p)).toBe(true);
    p = removeFunction(p, p.functions[0]!.id);
    expect(p.functions).toEqual([]);
    expect(() => removeFunction(p, "nope00000000")).toThrow(/no function/);
  });

  it("hoistAssign inserts `name = <default of the same type>` before the compound statement", () => {
    const branch = if_(v("c"), [assign("x", num(1))], [assign("s", str("a"))]);
    const { program: p, inputs } = createProgramWithInputs({ c: 1 }, [branch, print(v("x"))]);
    expect(validate(p).map((d) => d.code)).toEqual(["E_DECLARE_FIRST"]);
    const fixed = hoistAssign(p, branch.id, "x");
    expect(lines(fixed, inputs)[1]).toBe("x = 0");
    expect(validate(fixed)).toEqual([]);
    expect(lines(hoistAssign(p, branch.id, "s"), inputs)[1]).toBe('s = ""');
    const floatFrame = if_(v("c"), [assign("y", ast.float(1.5))]);
    const floats = createProgramWithInputs({ c: 1 }, [floatFrame]);
    expect(lines(hoistAssign(floats.program, floatFrame.id, "y"), inputs)[1]).toBe("y = 0.0");
    expect(lines(hoistAssign(p, branch.id, "unknown"), inputs)[1]).toBe("unknown = None");
  });

  it("hoistAssign declares a name that validate() refuses, which stays the learner's to fix", () => {
    const loop = for_("i", num(0), num(3), [assign("myTotal", v("i"))]);
    const p = program([loop, print(v("myTotal"))]);
    expect(validate(p).map((d) => d.code)).toEqual(["E_BAD_NAME", "E_DECLARE_FIRST"]);
    const fixed = hoistAssign(p, loop.id, "myTotal");
    expect(lines(fixed, {})[0]).toBe("myTotal = None");
    expect(validate(fixed).map((d) => d.code)).toEqual(["E_BAD_NAME", "E_BAD_NAME"]);
  });
});

describe("loop variables (language.md, Edits, Loop variables)", () => {
  const createLoop = () => getBlockDef("for").create() as For;
  const at = (parent: string, index = 0) =>
    ({ parent, slot: parent === "main" ? "main" : "body", index }) as const;

  it("names an inserted loop i, a loop inside it j, and a loop after it i again", () => {
    let p = insertStmt(program([]), createLoop(), at("main"));
    const outer = p.main[0]!;
    p = insertStmt(p, createLoop(), at(outer.id));
    const middle = (p.main[0] as For).body[0]!;
    p = insertStmt(p, createLoop(), at(middle.id));
    p = insertStmt(p, createLoop(), at("main", 1));
    expect(lines(p)).toEqual([
      "for i in range(...):",
      "    for j in range(...):",
      "        for k in range(...):",
      "            pass",
      "for i in range(...):",
      "    pass",
    ]);
  });

  it("gives an inserted loop the first name that no input, parameter, or assignment has", () => {
    const made = createProgramWithInputs({ i: 3 }, [assign("j", num(0))]);
    const inMain = insertStmt(made.program, createLoop(), at("main", 1));
    expect(unparse((inMain.main[1] as For).var)).toBe("k");
    const withFn = addFunction(program([]), "f", ["i"]);
    const fn = withFn.functions[0]!;
    const inFn = insertStmt(withFn, createLoop(), at(fn.id));
    expect(unparse((inFn.functions[0]!.body[0] as For).var)).toBe("j");
  });

  it("gives a loop no name that a function holds, which no variable can take", () => {
    const withFn = addFunction(program([]), "j");
    let p = insertStmt(withFn, createLoop(), at("main"));
    p = insertStmt(p, createLoop(), at(p.main[0]!.id));
    expect(lines(p).slice(-3)).toEqual([
      "for i in range(...):",
      "    for k in range(...):",
      "        pass",
    ]);
  });

  it("keeps the name of a loop whose place leaves none of its names free", () => {
    const slot = getBlockDef("for").slots[0];
    const names = slot?.role === "target" ? (slot.names ?? []) : [];
    const p = program(names.map((name) => assign(name, num(0))));
    const next = insertStmt(p, createLoop(), at("main", names.length));
    expect(unparse((next.main.at(-1) as For).var)).toBe("i");
  });

  it("keeps the name of an inserted loop whose own body reads its variable", () => {
    const loop = for_("i", num(0), num(3), [print(v("i"))]);
    expect(lines(insertStmt(program([]), loop, at("main")))).toEqual([
      "for i in range(3):",
      "    print(i)",
    ]);
  });

  it("names a moved loop by how deep it sits, then each loop inside it, with each use inside", () => {
    const outer = for_("i", num(0), num(3), [print(v("i"))]);
    const inner = for_("j", num(0), num(2), [print(v("i"), v("j"))]);
    const moved = for_("i", num(0), num(2), [inner, print(v("i"))]);
    const p = program([outer, moved]);
    expect(lines(moveStmt(p, moved.id, at(outer.id, 1)))).toEqual([
      "for i in range(3):",
      "    print(i)",
      "    for j in range(2):",
      "        for k in range(2):",
      "            print(j, k)",
      "        print(j)",
    ]);
    const nested = program([
      for_("i", num(0), num(3), [for_("j", num(0), num(2), [print(v("j"))])]),
    ]);
    const out = (nested.main[0] as For).body[0]!;
    expect(lines(moveStmt(nested, out.id, at("main", 1))).slice(2)).toEqual([
      "for i in range(2):",
      "    print(i)",
    ]);
  });

  it("gives a loop no name that its body reads from outside it", () => {
    const inner = for_("j", num(0), num(2), [print(v("i"), v("j"))]);
    const p = program([for_("i", num(0), num(3), [inner])]);
    const next = moveStmt(p, inner.id, at("main", 1));
    // The read of the outer i is left with no variable, so the moved loop keeps j rather than i.
    expect(lines(next).slice(2)).toEqual(["for j in range(2):", "    print(i, j)"]);
    expect(validate(next).map((d) => d.code)).toEqual(["E_LOOP_VARIABLE_OUTSIDE"]);
  });

  it("counts a read of a loop that the same edit renames by the loop's new name", () => {
    const inner = for_("k", num(0), num(2), [print(v("j"), v("k"))]);
    const moved = for_("j", num(0), num(2), [inner]);
    const p = program([for_("i", num(0), num(2), [moved])]);
    expect(lines(moveStmt(p, moved.id, at("main", 1))).slice(2)).toEqual([
      "for i in range(2):",
      "    for j in range(2):",
      "        print(i, j)",
    ]);
  });

  it("changes an assignment of a renamed variable inside the loop with it", () => {
    const outer = for_("i", num(0), num(3), []);
    const moved = for_("i", num(0), num(2), [assign("i", bin("+", v("i"), num(1))), print(v("i"))]);
    const next = moveStmt(program([outer, moved]), moved.id, at(outer.id));
    expect(lines(next)).toEqual([
      "for i in range(3):",
      "    for j in range(2):",
      "        j = j + 1",
      "        print(j)",
    ]);
  });

  it("gives a loop no name that a variable its body declares has", () => {
    const outer = for_("i", num(0), num(3), []);
    const moved = for_("i", num(0), num(2), [assign("j", bin("*", v("i"), num(2))), print(v("j"))]);
    const next = moveStmt(program([outer, moved]), moved.id, at(outer.id));
    expect(lines(next)).toEqual([
      "for i in range(3):",
      "    for k in range(2):",
      "        j = k * 2",
      "        print(j)",
    ]);
  });

  it("renames a loop moved into another routine for a parameter that has its name", () => {
    const loop = for_("i", num(0), num(2), [print(v("i"))]);
    const fn = { id: "fn0000000001", name: "f", params: ["i"], body: [] };
    const next = moveStmt(program([loop], { functions: [fn] }), loop.id, at(fn.id));
    expect(lines(next)).toEqual(["def f(i):", "    for j in range(2):", "        print(j)"]);
  });
});
