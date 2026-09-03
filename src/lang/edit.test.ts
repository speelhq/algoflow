// T-01: each edit of L-50 does what it says, leaves the input untouched, and preserves L-04.
import { describe, expect, it } from "vitest";
import { ast, program } from "@/nodes/testing";
import {
  addClass,
  addFunction,
  duplicateStmt,
  hoistAssign,
  insertStmt,
  locateStmt,
  moveStmt,
  removeClass,
  removeFunction,
  removeStmt,
  renameName,
  setExpr,
  setFields,
  setSlot,
} from "./edit";
import { unparse } from "@/python/emit";
import { emit } from "@/python/emit";
import type { Program, Stmt } from "./types";
import { validate } from "./validate";

const { assign, print, num, str, bin, v, if_, for_, call, exprStmt } = ast;

function idsUnique(p: Program): boolean {
  return !validate(p).some((d) => d.code === "E_DUPLICATE_ID");
}

function lines(p: Program): string[] {
  return emit(p).code.trimEnd().split("\n");
}

function sample(): { p: Program; a: Stmt; loop: Stmt; inner: Stmt; b: Stmt } {
  const a = assign("x", num(1));
  const inner = assign("x", bin("+", v("x"), v("i")));
  const loop = for_("i", num(0), num(3), [inner]);
  const b = print(v("x"));
  return { p: program([a, loop, b]), a, loop, inner, b };
}

describe("edit (L-50)", () => {
  it("every edit returns a new Program and leaves the input unchanged", () => {
    const { p, a } = sample();
    const before = structuredClone(p);
    const next = removeStmt(p, a.id);
    expect(p).toEqual(before);
    expect(next).not.toBe(p);
    expect(next.main).toHaveLength(2);
  });

  it("insertStmt places a statement at a Place (L-54) and re-ids a colliding statement (L-51)", () => {
    const { p, a, loop } = sample();
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
    expect(idsUnique(collided)).toBe(true);
  });

  it("moveStmt removes then inserts, counting the index after removal", () => {
    const { p, a, loop, b } = sample();
    const next = moveStmt(p, a.id, { parent: "main", slot: "main", index: 2 });
    expect(next.main.map((s) => s.id)).toEqual([loop.id, b.id, a.id]);
    const into = moveStmt(p, b.id, { parent: loop.id, slot: "body", index: 1 });
    expect(lines(into)).toEqual(["x = 1", "for i in range(3):", "    x = x + i", "    print(x)"]);
    expect(idsUnique(into)).toBe(true);
  });

  it("removeStmt removes a frame with its contents; a missing id throws", () => {
    const { p, loop, inner } = sample();
    const next = removeStmt(p, loop.id);
    expect(lines(next)).toEqual(["x = 1", "print(x)"]);
    expect(locateStmt(next, inner.id)).toBeUndefined();
    expect(() => removeStmt(p, "nope00000000")).toThrow(/no statement/);
  });

  it("duplicateStmt inserts a deep copy with fresh ids right after the original", () => {
    const { p, loop } = sample();
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
    expect(idsUnique(next)).toBe(true);
  });

  it("setSlot sets id, text, and target slots; expression slots are refused", () => {
    const { p, loop, a } = sample();
    expect(lines(setSlot(p, loop.id, "var", "k"))[1]).toBe("for k in range(3):");
    expect(lines(setSlot(p, a.id, "target", { kind: "var", name: "y" }))[0]).toBe("y = 1");
    const c = ast.comment("old");
    expect(lines(setSlot(program([c]), c.id, "text", "new"))).toEqual(["# new"]);
    expect(() => setSlot(p, a.id, "value", "x")).toThrow(/no settable slot/);
  });

  it("setExpr replaces an expression slot, an exprs item, or a nested expression node", () => {
    const { p, a, inner, b } = sample();
    expect(lines(setExpr(p, a.id, "value", num(42)))[0]).toBe("x = 42");
    expect(lines(setExpr(p, b.id, "args", str("done"), 0))[3]).toBe('print("done")');
    expect(lines(setExpr(p, b.id, "args", str("more")))[3]).toBe('print(x, "more")');
    const binop = (inner as Extract<Stmt, { kind: "assign" }>).value;
    expect(lines(setExpr(p, binop.id, "right", num(2)))[2]).toBe("    x = x + 2");
    const reused = setExpr(p, a.id, "value", (inner as Extract<Stmt, { kind: "assign" }>).value);
    expect(idsUnique(reused)).toBe(true);
    expect(unparse((reused.main[0] as Extract<Stmt, { kind: "assign" }>).value)).toBe("x + i");
  });

  it("renameName rewrites variables, loop variables, function names and calls, and class names", () => {
    const { p } = sample();
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
    const withClass = program([]);
    withClass.classes = [{ id: "c0000000000c", name: "P", fields: [] }];
    expect(renameName(withClass, "P", "Point").classes[0]?.name).toBe("Point");
  });

  it("addFunction / removeFunction / addClass / removeClass / setFields", () => {
    let p = addFunction(program([]), "f", ["a"]);
    expect(p.functions).toEqual([{ id: expect.any(String), name: "f", params: ["a"], body: [] }]);
    p = addClass(p, "Value");
    expect(p.classes[0]).toMatchObject({ name: "Value", fields: [] });
    p = setFields(p, p.classes[0]!.id, [{ name: "data", default: { $float: 0 } }]);
    expect(p.classes[0]?.fields).toEqual([{ name: "data", default: { $float: 0 } }]);
    expect(idsUnique(p)).toBe(true);
    p = removeClass(p, p.classes[0]!.id);
    p = removeFunction(p, p.functions[0]!.id);
    expect(p.classes).toEqual([]);
    expect(p.functions).toEqual([]);
    expect(() => removeFunction(p, "nope00000000")).toThrow(/no function/);
  });

  it("hoistAssign inserts `name = <default of the same type>` before the frame (L-41)", () => {
    const frame = if_(v("c"), [assign("x", num(1))], [assign("s", str("a"))]);
    const p = program([frame, print(v("x"))], { inputs: [{ name: "c", value: 1 }] });
    expect(validate(p).map((d) => d.code)).toEqual(["E_DECLARE_FIRST"]);
    const fixed = hoistAssign(p, frame.id, "x");
    expect(lines(fixed)[1]).toBe("x = 0");
    expect(validate(fixed)).toEqual([]);
    expect(lines(hoistAssign(p, frame.id, "s"))[1]).toBe('s = ""');
    const floatFrame = if_(v("c"), [assign("y", ast.float(1.5))]);
    expect(
      lines(
        hoistAssign(
          program([floatFrame], { inputs: [{ name: "c", value: 1 }] }),
          floatFrame.id,
          "y",
        ),
      )[1],
    ).toBe("y = 0.0");
    expect(lines(hoistAssign(p, frame.id, "unknown"))[1]).toBe("unknown = None");
  });
});
