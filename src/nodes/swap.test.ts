import { describe, expect, it } from "vitest";
import type { FunctionDef } from "@/lang/types";
import { emit } from "@/python/emit";
import { ast, eventTypes, notation, program, runAll, varData, withInputs } from "./testing";

const { swap, num, float, bin, v, call, assignTo, ret } = ast;

/** Runs `main` with `nums` as its input. */
const runOn = (nums: number[], ...main: ReturnType<typeof swap>[]) => {
  const made = withInputs({ nums }, main);
  return runAll(made.program, made.inputs);
};

describe("swap (nodes.md)", () => {
  it("emits the exchange of the two items, its list bracketed as an atom", () => {
    const lines = (stmt: ReturnType<typeof swap>) => emit(program([stmt]), {}).code.trimEnd();
    expect(lines(swap(v("nums"), v("j"), bin("+", v("j"), num(1))))).toBe(
      "nums[j], nums[j + 1] = nums[j + 1], nums[j]",
    );
    expect(lines(swap(bin("+", v("a"), v("b")), num(0), num(1)))).toBe(
      "(a + b)[0], (a + b)[1] = (a + b)[1], (a + b)[0]",
    );
  });

  it("enter then swap, naming the two items it exchanged", () => {
    const stmt = swap(v("nums"), num(0), num(-1));
    const result = runOn([4, 9, 2], stmt);
    expect(eventTypes(result.events)).toEqual(["enter", "swap"]);
    // A position from the end is named by the item it found.
    expect(result.events[1]).toEqual({
      type: "swap",
      nodeId: stmt.id,
      a: { heap: 1, index: 0 },
      b: { heap: 1, index: 2 },
    });
    expect(result.done).toEqual({ type: "done", steps: 2, loops: 0 });
  });
});

describe("Semantics, Lists (language.md)", () => {
  it("swap exchanges list[i] and list[j]", () => {
    expect(varData(runOn([4, 9, 2], swap(v("nums"), num(0), num(2))), "nums")).toEqual([2, 9, 4]);
    expect(varData(runOn([4, 9, 2], swap(v("nums"), num(1), num(1))), "nums")).toEqual([4, 9, 2]);
  });

  it("swap evaluates as its Python line: j's item is read before i's, each position twice", () => {
    const stmt = swap(v("nums"), num(5), num(7));
    expect(runOn([4, 9, 2], stmt).done).toMatchObject({
      type: "error",
      error: { nodeId: stmt.id, code: "E_INDEX", params: { index: 7, length: 3 } },
    });
    // A draw in a position is drawn twice, as the emitted Python draws it.
    const drawn = runOn([4, 9, 2], swap(v("nums"), call("randint", num(0), num(2)), num(0)));
    expect(drawn.draws).toHaveLength(2);
    // Each item is read where it is found: `nums[0]` before `f` changes it, as Python reads it.
    const f: FunctionDef = {
      id: "f0000000000s",
      name: "f",
      params: ["xs"],
      body: [assignTo({ kind: "index", list: v("xs"), index: num(0) }, num(99)), ret(num(1))],
    };
    const made = withInputs({ nums: [4, 9, 2] }, [swap(v("nums"), call("f", v("nums")), num(0))], {
      functions: [f],
    });
    expect(varData(runAll(made.program, made.inputs), "nums")).toEqual([9, 4, 2]);
  });
});

describe("swap errors", () => {
  it("an item of a value that is no list, or a position that is no int → E_TYPE", () => {
    const made = withInputs({ n: 3 }, [swap(v("n"), num(0), num(1))]);
    expect(runAll(made.program, made.inputs).done).toMatchObject({
      error: { code: "E_TYPE", params: { left: "int", right: "int" } },
    });
    expect(runOn([4, 9], swap(v("nums"), float(0), num(1))).done).toMatchObject({
      error: { code: "E_TYPE", params: { left: "list", right: "float" } },
    });
  });
});

describe("notation (nodes.md, Node text)", () => {
  it("writes the notation of its table", () => {
    expect(notation(swap(v("nums"), num(0), num(1)))).toBe("swap({list}[{i}], {list}[{j}])");
  });
});
