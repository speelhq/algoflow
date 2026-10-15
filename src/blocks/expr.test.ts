import { describe, expect, it } from "vitest";
import { emit } from "@/python/emit";
import { getBlock } from "./registry";
import { ast, eventTypes, notation, program, runAll } from "./testing";

const { exprStmt, call, num, bin } = ast;

describe("expr (blocks.md)", () => {
  it("is hidden from the block menu", () => {
    expect(getBlock("expr").hidden).toBe(true);
  });

  it("emits the expression alone", () => {
    expect(emit(program([exprStmt(call("abs", num(-1)))]), {}).code).toBe("abs(-1)\n");
  });

  it("evaluates the expression for its events and discards the value", () => {
    const stmt = exprStmt(bin("<", num(1), num(2)));
    const result = runAll(program([stmt]));
    expect(eventTypes(result.events)).toEqual(["enter", "compare"]);
    expect(result.state.frames[0]?.vars.size).toBe(0);
  });

  it("a failing expression fails the statement", () => {
    const stmt = exprStmt(bin("/", num(1), num(0)));
    expect(runAll(program([stmt])).done).toMatchObject({
      type: "error",
      error: { code: "E_DIV_ZERO" },
    });
  });
});

describe("notation (blocks.md, Node text)", () => {
  it("writes the notation of its table", () => {
    expect(notation(exprStmt(call("f")))).toBe("{expr}");
  });
});
