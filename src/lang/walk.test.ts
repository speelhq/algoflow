// U-38: every node maps to the statement that contains it.
import { describe, expect, it } from "vitest";
import { ast, program, tid } from "@/nodes/testing";
import { ownerStmts } from "./walk";

const { assign, num, bin, v, if_, print, ret } = ast;

describe("ownerStmts (U-38)", () => {
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
