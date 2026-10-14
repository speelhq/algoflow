import { describe, expect, it } from "vitest";
import { unparse } from "@/python/emit";
import { ast, evalExpr, eventTypes, notation } from "./testing";

const { item, list, num, str, bin, neg, v } = ast;

describe("index (nodes.md)", () => {
  it("emits `<list>[<index>]`, an operation before the brackets in parentheses", () => {
    expect(unparse(item(v("nums"), bin("+", v("i"), num(1))))).toBe("nums[i + 1]");
    expect(unparse(item(bin("+", v("a"), v("b")), num(0)))).toBe("(a + b)[0]");
    expect(unparse(item(neg(v("xs")), num(0)))).toBe("(-xs)[0]");
    expect(unparse(neg(item(v("xs"), num(0))))).toBe("-xs[0]");
    expect(unparse(item(item(v("grid"), num(1)), num(2)))).toBe("grid[1][2]");
  });

  it("reads one item, emitting a read of its position in the list", () => {
    const result = evalExpr(item(v("nums"), num(2)), { nums: [4, 9, 2, 7] });
    expect(result.data).toBe(2);
    expect(eventTypes(result.events)).toEqual(["read"]);
    expect(result.events[0]).toMatchObject({ type: "read", refs: [{ heap: 1, index: 2 }] });
  });

  it("a negative position counts from the end, and the read names the item it found", () => {
    const result = evalExpr(item(v("nums"), neg(num(1))), { nums: [4, 9] });
    expect(result.data).toBe(9);
    expect(result.events[0]).toMatchObject({ refs: [{ heap: 1, index: 1 }] });
  });

  it("reads the items of an item and of a list written in place", () => {
    expect(evalExpr(item(item(v("grid"), num(1)), num(0)), { grid: [[1], [2, 3]] }).data).toBe(2);
    expect(evalExpr(item(list(num(5), num(6)), num(1))).data).toBe(6);
  });

  it("a position beyond the list → E_INDEX with the index and the length", () => {
    expect(evalExpr(item(v("nums"), num(4)), { nums: [4, 9, 2, 7] }).done).toMatchObject({
      type: "error",
      error: { code: "E_INDEX", params: { index: 4, length: 4 } },
    });
  });

  it("an item of a value that is no list → E_TYPE", () => {
    expect(evalExpr(item(str("abc"), num(0))).done).toMatchObject({
      type: "error",
      error: { code: "E_TYPE", params: { left: "str", right: "int" } },
    });
  });
});

describe("notation (nodes.md, Node text)", () => {
  it("writes the notation of its table", () => {
    expect(notation(item(v("nums"), num(0)))).toBe("{list}[{index}]");
  });
});
