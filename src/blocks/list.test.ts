import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr, notation, program, runAll, varData } from "./testing";
import { list as listBlock } from "./list";

const { list, num, str, bin, v, assign, call } = ast;

describe("list (blocks.md)", () => {
  it("emits `[<a>, <b>]`, and `[]` with no item", () => {
    expect(unparse(list(num(1), str("a"), bin("+", v("i"), num(1))))).toBe('[1, "a", i + 1]');
    expect(unparse(list())).toBe("[]");
  });

  it("evaluates its items in order into a new list, emitting no event of its own", () => {
    const result = evalExpr(list(num(1), call("abs", num(-2)), list()));
    expect(result.data).toEqual([1, 2, []]);
    expect(result.events).toEqual([]);
  });

  it("makes a new list each time it runs", () => {
    const result = runAll(program([assign("a", list(num(1))), assign("b", list(num(1)))]));
    expect(varData(result, "a")).toEqual([1]);
    expect(result.state.frames[0]?.vars.get("a")).not.toEqual(
      result.state.frames[0]?.vars.get("b"),
    );
  });

  it("an item's error stops it", () => {
    expect(evalExpr(list(num(1), bin("/", num(1), num(0)))).done).toMatchObject({
      type: "error",
      error: { code: "E_DIV_ZERO" },
    });
  });

  it("is created empty, and its zero is an empty list", () => {
    expect(listBlock.create()).toMatchObject({ kind: "list", items: [] });
    expect(listBlock.zeroLike?.(list(num(1)))).toMatchObject({ kind: "list", items: [] });
  });
});

describe("notation (blocks.md, Node text)", () => {
  it("writes the notation of its table", () => {
    expect(notation(list(num(1)))).toBe("[{items}]");
  });
});
