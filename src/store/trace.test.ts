// U-61 Trace: rows for write/swap/compare/loop, cells only for what changed, columns in order.
import { describe, expect, it } from "vitest";
import type { Heap, Value } from "@/lang/types";
import type { Event, State } from "@/runtime/types";
import { traceRow, withColumns } from "./trace";

function state(vars: Record<string, Value>, heap: Heap = new Map()): State {
  return { frames: [{ fn: "main", vars: new Map(Object.entries(vars)) }], heap };
}

const int = (v: number): Value => ({ t: "int", v });

describe("traceRow (U-61)", () => {
  it("write to a variable fills that variable's cell with the written value", () => {
    const row = traceRow(
      { type: "write", nodeId: "n", ref: { var: "x" }, value: int(3) },
      state({ x: int(3) }),
      7,
    );
    expect(row).toEqual({
      step: 7,
      event: { type: "write", nodeId: "n", ref: { var: "x" }, value: int(3) },
      cells: { x: "3" },
    });
  });

  it("write to a heap entry fills every current-frame variable holding it", () => {
    const heap: Heap = new Map([[1, { kind: "list", items: [int(1), int(2)] }]]);
    const s = state({ nums: { t: "list", ref: 1 }, alias: { t: "list", ref: 1 }, k: int(0) }, heap);
    const row = traceRow(
      { type: "write", nodeId: "n", ref: { heap: 1, index: 0 }, value: int(1) },
      s,
      1,
    );
    expect(row?.cells).toEqual({ nums: "[1, 2]", alias: "[1, 2]" });
    const swap = traceRow(
      { type: "swap", nodeId: "n", a: { heap: 1, index: 0 }, b: { var: "k" } },
      s,
      2,
    );
    expect(swap?.cells).toEqual({ nums: "[1, 2]", alias: "[1, 2]", k: "0" });
  });

  it("compare rows carry `text → True/False` and no cells", () => {
    const row = traceRow(
      { type: "compare", nodeId: "n", text: "5 > 3", result: true },
      state({}),
      1,
    );
    expect(row).toMatchObject({ cells: {}, condition: "5 > 3 → True" });
    const no = traceRow(
      { type: "compare", nodeId: "n", text: "1 == 0", result: false },
      state({}),
      1,
    );
    expect(no?.condition).toBe("1 == 0 → False");
  });

  it("loop rows fill the loop variable when there is one", () => {
    expect(
      traceRow({ type: "loop", nodeId: "n", var: "i", value: int(4) }, state({}), 1)?.cells,
    ).toEqual({
      i: "4",
    });
    expect(traceRow({ type: "loop", nodeId: "n" }, state({}), 1)?.cells).toEqual({});
  });

  it("other events produce no row", () => {
    const events: Event[] = [
      { type: "enter", nodeId: "n" },
      { type: "read", nodeId: "n", refs: [] },
      { type: "print", nodeId: "n", text: "x" },
      { type: "call", nodeId: "n", fn: "f", args: [] },
      { type: "return", nodeId: "n", fn: "f", value: int(1) },
    ];
    for (const event of events) {
      expect(traceRow(event, state({}), 1)).toBeUndefined();
    }
  });
});

describe("withColumns", () => {
  it("appends new names in first-appearance order and keeps existing ones", () => {
    const row = {
      step: 1,
      event: { type: "loop" as const, nodeId: "n" },
      cells: { b: "1", a: "2" },
    };
    expect(withColumns(["n", "a"], row)).toEqual(["n", "a", "b"]);
    const same = ["n", "a", "b"];
    expect(withColumns(same, row)).toBe(same);
  });
});
