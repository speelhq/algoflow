// U-39: every node maps to the statement that contains it.
import { describe, expect, it } from "vitest";
import { ast, program, tid } from "@/nodes/testing";
import { bodyStmts, ownerStmts } from "./walk";

const { assign, num, bin, v, if_, for_, print, ret } = ast;

describe("ownerStmts (U-39)", () => {
  it("maps expressions to their statement and statements, functions, classes to themselves", () => {
    const cond = bin("==", v("n"), num(1));
    const inner = print(v("n"));
    const frame = if_(cond, [inner]);
    const body = ret(bin("+", v("a"), num(1)));
    const fn = { id: tid(), name: "inc", params: ["a"], body: [body] };
    const p = program([assign("n", num(1)), frame], { functions: [fn] });
    p.classes = [{ id: tid(), name: "P", fields: [] }];
    const owners = ownerStmts(p);

    expect(owners.get(cond.id)).toBe(frame.id);
    expect(owners.get(cond.kind === "binop" ? cond.left.id : "")).toBe(frame.id);
    expect(owners.get(inner.id)).toBe(inner.id);
    expect(owners.get(body.id)).toBe(body.id);
    expect(owners.get(fn.id)).toBe(fn.id);
    expect(owners.get(p.classes[0]?.id ?? "")).toBe(p.classes[0]?.id);
    if (body.kind === "return" && body.value) expect(owners.get(body.value.id)).toBe(body.id);
  });
});

describe("bodyStmts (U-61)", () => {
  it("lists every statement inside a statement's regions, at any depth, and skips plain statements", () => {
    const hit = print(v("i"));
    const miss = print(num(0));
    const frame = if_(bin("==", v("i"), num(1)), [hit], [miss]);
    const tail = assign("x", v("i"));
    const loop = for_("i", num(0), num(3), [frame, tail]);
    const bodies = bodyStmts(program([loop, print(v("x"))]));

    expect(bodies.get(loop.id)).toEqual([frame.id, hit.id, miss.id, tail.id]);
    expect(bodies.get(frame.id)).toEqual([hit.id, miss.id]);
    expect([...bodies.keys()]).toEqual([loop.id, frame.id]);
  });
});
