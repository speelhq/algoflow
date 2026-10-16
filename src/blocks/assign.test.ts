import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { ast, eventTypes, notation, program, runAll, varData } from "./testing";

const { assign, assignTo, num, bin, v } = ast;
const lines = (main: Parameters<typeof program>[0]) =>
  emit(program(main), {}).code.trimEnd().split("\n");

describe("assign (blocks.md)", () => {
  it("emits `<target> = <value>`", () => {
    expect(lines([assign("x", bin("+", num(1), num(2)))])).toEqual(["x = 1 + 2"]);
    expect(lines([assignTo(ast.item(v("xs"), num(0)), num(9))])).toEqual(["xs[0] = 9"]);
    // An item target is written by its block, its list bracketed as its slot declares.
    const sum = bin("+", v("a"), v("b"));
    expect(lines([assignTo(ast.item(sum, num(0)), num(9))])).toEqual(["(a + b)[0] = 9"]);
  });

  it("enter then write, and the variable is set", () => {
    const stmt = assign("x", num(5));
    const result = runAll(program([stmt]));
    expect(eventTypes(result.events)).toEqual(["enter", "write"]);
    expect(result.events[1]).toEqual({
      type: "write",
      nodeId: stmt.id,
      ref: { var: "x" },
      value: { t: "int", v: 5 },
    });
    expect(varData(result, "x")).toBe(5);
    expect(result.done).toEqual({ type: "done", events: 2, loops: 0 });
  });
});

describe("notation (blocks.md, Node text)", () => {
  it("writes the notation of its table", () => {
    expect(notation(assign("total", num(0)))).toBe("{target} ← {value}");
  });
});
